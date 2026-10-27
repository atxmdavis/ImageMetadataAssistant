#!/usr/bin/env python3
"""Browser-based UI for image metadata generation and in-file writing."""

from __future__ import annotations

import atexit
import json
import multiprocessing as mp
import os
import queue
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request, send_file

from image_describer_app import (
    DEFAULT_CAPTION_MODEL,
    DEFAULT_DETECTOR_MODEL,
    DETECTOR_DISABLED_MODEL,
    ImageMetadata,
    SUPPORTED_EXTENSIONS,
    SUPPORTED_CAPTION_MODELS,
    SUPPORTED_DETECTOR_MODELS,
    VisionMetadataGenerator,
    find_images,
    read_metadata_from_bytes,
    read_metadata_from_file,
    remove_metadata_from_bytes,
    remove_metadata_from_file,
    write_metadata_to_file,
    write_metadata_to_bytes,
)

app = Flask(__name__)

_local_sessions: dict[str, dict[str, object]] = {}
_local_sessions_lock = threading.Lock()
_local_resume_state_lock = threading.Lock()
_analysis_request_lock = threading.Lock()
_analysis_worker_lock = threading.Lock()
_analysis_worker_process: Any = None
_analysis_worker_request_queue: Any = None
_analysis_worker_result_queue: Any = None
_analysis_worker_busy_run_id: str | None = None
_analysis_device_preference = "auto"
_canceled_run_ids: set[str] = set()
_canceled_runs_lock = threading.Lock()
_metadata_check_lock = threading.Lock()
_metadata_checker: VisionMetadataGenerator | None = None
_LOCAL_RESUME_STATE_PATH = Path(__file__).resolve().parent / ".local_resume_state.json"
_shutdown_hooks_registered = False
_ANALYSIS_TIMEOUT_SECONDS = 120.0
_ANALYSIS_TIMEOUT_SECONDS_HIGH_RECALL = 300.0
_LOCAL_SESSION_SCAN_BATCH_SIZE = 2500
_LOCAL_SESSION_ITEM_LIMIT = 10000

try:
    if sys.platform == "darwin":
        # macOS + fork can crash with Objective-C runtime (SIGABRT, Namespace OBJC).
        _analysis_mp_context = mp.get_context("spawn")
    elif sys.platform == "win32":
        _analysis_mp_context = mp.get_context("spawn")
    else:
        _analysis_mp_context = mp.get_context("fork")
except Exception:  # pragma: no cover
    _analysis_mp_context = mp.get_context("spawn")

try:
    import tkinter as tk
    from tkinter import filedialog
except Exception:  # pragma: no cover
    tk = None
    filedialog = None


class AnalysisCanceledError(Exception):
    """Raised when analysis for a run is canceled by the user."""


def _mark_run_canceled(run_id: str) -> None:
    if not run_id:
        return
    with _canceled_runs_lock:
        _canceled_run_ids.add(run_id)
        if len(_canceled_run_ids) > 256:
            # Keep memory bounded for long-lived dev sessions.
            _canceled_run_ids.clear()
            _canceled_run_ids.add(run_id)


def _is_run_canceled(run_id: str) -> bool:
    if not run_id:
        return False
    with _canceled_runs_lock:
        return run_id in _canceled_run_ids


def _raise_if_run_canceled(run_id: str) -> None:
    if run_id and _is_run_canceled(run_id):
        raise AnalysisCanceledError("Analysis canceled.")


def _analysis_worker_main(request_queue: Any, result_queue: Any) -> None:
    generators: dict[tuple[str, str, str], VisionMetadataGenerator] = {}
    while True:
        job = request_queue.get()
        if not isinstance(job, dict):
            break
        if str(job.get("cmd", "")) != "analyze":
            break

        job_id = str(job.get("job_id", "")).strip()
        image_path_text = str(job.get("image_path", "")).strip()
        high_recall = bool(job.get("high_recall", False))
        fast_mode = bool(job.get("fast_mode", False))
        caption_model = _normalize_caption_model(job.get("caption_model", DEFAULT_CAPTION_MODEL))
        detector_model = _normalize_detector_model(job.get("detector_model", DEFAULT_DETECTOR_MODEL))
        device_preference = "cpu" if str(job.get("device_preference", "auto")).strip().lower() == "cpu" else "auto"

        if not job_id or not image_path_text:
            result_queue.put(
                {
                    "job_id": job_id,
                    "ok": False,
                    "error": "Invalid analysis job payload.",
                }
            )
            continue

        try:
            key = (caption_model, detector_model, device_preference)
            generator = generators.get(key)
            if generator is None:
                generator = VisionMetadataGenerator(
                    caption_model=caption_model,
                    detector_model=detector_model,
                    device_preference=device_preference,
                )
                generator.load_models()
                generators[key] = generator
            metadata = generator.analyze_image(
                Path(image_path_text),
                high_recall=high_recall,
                fast_mode=fast_mode,
            )
            result_queue.put(
                {
                    "job_id": job_id,
                    "ok": True,
                    "metadata": _metadata_payload(metadata),
                }
            )
        except Exception as exc:
            result_queue.put(
                {
                    "job_id": job_id,
                    "ok": False,
                    "error": str(exc),
                }
            )


def _terminate_analysis_worker_locked() -> None:
    global _analysis_worker_process
    global _analysis_worker_request_queue
    global _analysis_worker_result_queue
    global _analysis_worker_busy_run_id

    proc = _analysis_worker_process
    req_q = _analysis_worker_request_queue
    if proc is not None and proc.is_alive() and req_q is not None:
        try:
            # Ask the worker to exit cleanly so multiprocessing can release
            # queue-backed semaphores before interpreter shutdown.
            req_q.put_nowait(None)
        except Exception:
            pass
        proc.join(timeout=1.0)
    if proc is not None and proc.is_alive():
        proc.terminate()
        proc.join(timeout=2.0)
    if proc is not None and proc.is_alive():
        proc.kill()
        proc.join(timeout=1.0)

    for q in (_analysis_worker_request_queue, _analysis_worker_result_queue):
        if q is None:
            continue
        try:
            q.close()
        except Exception:
            pass
        try:
            q.join_thread()
        except Exception:
            pass

    _analysis_worker_process = None
    _analysis_worker_request_queue = None
    _analysis_worker_result_queue = None
    _analysis_worker_busy_run_id = None


def _cleanup_analysis_resources() -> None:
    with _analysis_worker_lock:
        _terminate_analysis_worker_locked()


def _handle_exit_signal(signum: int, _frame) -> None:
    _cleanup_analysis_resources()
    if signum == signal.SIGINT:
        raise KeyboardInterrupt
    raise SystemExit(0)


def _register_shutdown_hooks() -> None:
    global _shutdown_hooks_registered
    if _shutdown_hooks_registered:
        return
    atexit.register(_cleanup_analysis_resources)
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _handle_exit_signal)
        except Exception:
            pass
    _shutdown_hooks_registered = True


def _ensure_analysis_worker_locked() -> tuple[Any, Any, Any]:
    global _analysis_worker_process
    global _analysis_worker_request_queue
    global _analysis_worker_result_queue

    proc = _analysis_worker_process
    req_q = _analysis_worker_request_queue
    res_q = _analysis_worker_result_queue
    if proc is not None and proc.is_alive() and req_q is not None and res_q is not None:
        return proc, req_q, res_q

    _terminate_analysis_worker_locked()

    req_q = _analysis_mp_context.Queue()
    res_q = _analysis_mp_context.Queue()
    proc = _analysis_mp_context.Process(
        target=_analysis_worker_main,
        args=(req_q, res_q),
        daemon=True,
    )
    proc.start()

    _analysis_worker_process = proc
    _analysis_worker_request_queue = req_q
    _analysis_worker_result_queue = res_q
    return proc, req_q, res_q


def _current_analysis_device_preference() -> str:
    global _analysis_device_preference
    return "cpu" if _analysis_device_preference == "cpu" else "auto"


def _force_analysis_cpu_fallback_locked() -> None:
    global _analysis_device_preference
    _analysis_device_preference = "cpu"
    _terminate_analysis_worker_locked()


def _analysis_timeout_seconds(high_recall: bool, fast_mode: bool) -> float:
    if high_recall:
        return _ANALYSIS_TIMEOUT_SECONDS_HIGH_RECALL
    if fast_mode:
        return max(90.0, _ANALYSIS_TIMEOUT_SECONDS)
    return _ANALYSIS_TIMEOUT_SECONDS


def _analyze_image_with_cancel(
    image_path: Path,
    high_recall: bool,
    fast_mode: bool = False,
    caption_model: str = DEFAULT_CAPTION_MODEL,
    detector_model: str = DEFAULT_DETECTOR_MODEL,
    run_id: str = "",
) -> ImageMetadata:
    run_key = run_id.strip()
    caption_choice = _normalize_caption_model(caption_model)
    detector_choice = _normalize_detector_model(detector_model)
    timeout_seconds = _analysis_timeout_seconds(high_recall=bool(high_recall), fast_mode=bool(fast_mode))

    with _analysis_request_lock:
        if run_key and _is_run_canceled(run_key):
            raise AnalysisCanceledError("Analysis canceled.")
        attempted_cpu_fallback = False
        while True:
            job_id = uuid.uuid4().hex
            device_preference = _current_analysis_device_preference()
            started_at = time.monotonic()

            with _analysis_worker_lock:
                _, req_q, _ = _ensure_analysis_worker_locked()
                global _analysis_worker_busy_run_id
                _analysis_worker_busy_run_id = run_key or None
                req_q.put(
                    {
                        "cmd": "analyze",
                        "job_id": job_id,
                        "image_path": str(image_path),
                        "high_recall": bool(high_recall),
                        "fast_mode": bool(fast_mode),
                        "caption_model": caption_choice,
                        "detector_model": detector_choice,
                        "device_preference": device_preference,
                    }
                )

            try:
                while True:
                    if run_key and _is_run_canceled(run_key):
                        raise AnalysisCanceledError("Analysis canceled.")

                    with _analysis_worker_lock:
                        proc = _analysis_worker_process
                        res_q = _analysis_worker_result_queue

                    if proc is None or res_q is None:
                        raise AnalysisCanceledError("Analysis canceled.")

                    try:
                        row = res_q.get(timeout=0.15)
                    except queue.Empty:
                        if not proc.is_alive():
                            if run_key and _is_run_canceled(run_key):
                                raise AnalysisCanceledError("Analysis canceled.")
                            raise RuntimeError("Analysis worker stopped unexpectedly.")
                        elapsed = time.monotonic() - started_at
                        should_fallback_to_cpu = (
                            sys.platform == "darwin"
                            and device_preference != "cpu"
                            and not attempted_cpu_fallback
                            and elapsed >= timeout_seconds
                        )
                        if should_fallback_to_cpu:
                            app.logger.warning(
                                "Analysis timeout after %.1fs on %s using auto device (high_recall=%s, fast_mode=%s); retrying on CPU.",
                                elapsed,
                                image_path.name,
                                bool(high_recall),
                                bool(fast_mode),
                            )
                            with _analysis_worker_lock:
                                _force_analysis_cpu_fallback_locked()
                                _analysis_worker_busy_run_id = None
                            attempted_cpu_fallback = True
                            break
                        continue
                    except Exception as exc:
                        if run_key and _is_run_canceled(run_key):
                            raise AnalysisCanceledError("Analysis canceled.")
                        raise RuntimeError(f"Analysis worker communication failed: {exc}")

                    if not isinstance(row, dict):
                        continue
                    if str(row.get("job_id", "")) != job_id:
                        continue

                    if bool(row.get("ok")):
                        metadata_dict = row.get("metadata")
                        if not isinstance(metadata_dict, dict):
                            raise RuntimeError("Invalid analysis response from worker.")
                        return ImageMetadata.from_dict(metadata_dict)
                    raise RuntimeError(str(row.get("error", "Analyze failed.")))
            finally:
                with _analysis_worker_lock:
                    if _analysis_worker_busy_run_id == (run_key or None):
                        _analysis_worker_busy_run_id = None
            if attempted_cpu_fallback and _current_analysis_device_preference() == "cpu":
                continue
            break

        raise RuntimeError("Analysis timed out and could not recover.")


def error_response(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def _save_upload_to_temp(uploaded, suffix: str) -> Path:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        uploaded.save(temp_file)
        return Path(temp_file.name)


def _metadata_payload(metadata: ImageMetadata) -> dict[str, object]:
    return {
        "description": metadata.description,
        "colors": metadata.colors,
        "actions": metadata.actions,
        "objects": metadata.objects,
        "custom_tags": metadata.custom_tags,
        "categories": metadata.categories,
        "confidence": metadata.confidence,
        "ip_risk": metadata.ip_risk,
    }


def _get_metadata_checker() -> VisionMetadataGenerator:
    global _metadata_checker
    with _metadata_check_lock:
        if _metadata_checker is None:
            # Fast checker: no heavy caption/object models loaded here.
            _metadata_checker = VisionMetadataGenerator()
        return _metadata_checker


def _check_metadata_fast(image_path: Path, metadata: ImageMetadata, *, run_id: str = "") -> tuple[ImageMetadata, list[str], list[str], bool, int]:
    checker = _get_metadata_checker()
    start = time.perf_counter()
    _raise_if_run_canceled(run_id)
    corrected, issues, missing, changed = checker.check_metadata_fast(image_path, metadata)
    _raise_if_run_canceled(run_id)
    elapsed_ms = int(round((time.perf_counter() - start) * 1000.0))
    return corrected, issues, missing, changed, elapsed_ms


def _check_ip_risk_fast(image_path: Path, metadata: ImageMetadata, *, run_id: str = "") -> tuple[ImageMetadata, bool, int]:
    checker = _get_metadata_checker()
    start = time.perf_counter()
    _raise_if_run_canceled(run_id)
    corrected, changed = checker.check_ip_risk_fast(image_path, metadata)
    _raise_if_run_canceled(run_id)
    elapsed_ms = int(round((time.perf_counter() - start) * 1000.0))
    return corrected, changed, elapsed_ms


def _collect_missing_metadata_fields(metadata: ImageMetadata) -> list[str]:
    missing: list[str] = []
    if not str(metadata.description or "").strip():
        missing.append("description")

    objects = metadata.objects if isinstance(metadata.objects, list) else []
    if not any(str(item).strip() for item in objects):
        missing.append("keywords")

    actions = metadata.actions if isinstance(metadata.actions, list) else []
    if not any(str(item).strip() for item in actions):
        missing.append("actions")

    categories = metadata.categories if isinstance(metadata.categories, list) else []
    if not any(str(item).strip() for item in categories):
        missing.append("categories")

    colors = metadata.colors if isinstance(metadata.colors, list) else []
    if not any(isinstance(item, dict) for item in colors):
        missing.append("colors")
    return missing


def _audit_metadata_fast(
    image_path: Path,
    metadata: ImageMetadata,
    *,
    run_metadata_check: bool,
    run_ip_risk_check: bool,
    run_id: str = "",
) -> tuple[ImageMetadata, list[str], list[str], bool, int]:
    current = ImageMetadata.from_dict(_metadata_payload(metadata))
    issues: list[str] = []
    missing = _collect_missing_metadata_fields(current)
    changed = False
    elapsed_total = 0

    _raise_if_run_canceled(run_id)
    if run_metadata_check:
        checked, check_issues, check_missing, check_changed, check_elapsed = _check_metadata_fast(image_path, current, run_id=run_id)
        current = checked
        issues = check_issues
        missing = check_missing
        changed = changed or bool(check_changed)
        elapsed_total += check_elapsed

    _raise_if_run_canceled(run_id)
    if run_ip_risk_check:
        ip_checked, ip_changed, ip_elapsed = _check_ip_risk_fast(image_path, current, run_id=run_id)
        current = ip_checked
        changed = changed or bool(ip_changed)
        elapsed_total += ip_elapsed

    if not run_metadata_check:
        missing = _collect_missing_metadata_fields(current)

    _raise_if_run_canceled(run_id)
    return current, issues, missing, changed, elapsed_total


def _to_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "on"}


def _normalize_caption_model(value: object) -> str:
    raw = str(value or "").strip()
    if raw in SUPPORTED_CAPTION_MODELS:
        return raw
    return DEFAULT_CAPTION_MODEL


def _normalize_detector_model(value: object) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"", "disabled", "off"}:
        return DETECTOR_DISABLED_MODEL
    detector = str(value or "").strip()
    if detector in SUPPORTED_DETECTOR_MODELS:
        return detector
    return DEFAULT_DETECTOR_MODEL


def _open_file_dialog() -> Path | None:
    if sys.platform == "darwin":
        # On macOS, avoid Tkinter fallback because it can trigger Objective-C
        # runtime aborts with some Python/Tk combinations after dialog cancel.
        return _open_file_dialog_macos()
    if tk is None or filedialog is None:
        return None
    root = tk.Tk()
    root.withdraw()
    root.update()
    selected = filedialog.askopenfilename(
        title="Select an image file",
        filetypes=[
            ("Image Files", "*.jpg *.jpeg *.png *.tif *.tiff *.webp"),
            ("All Files", "*.*"),
        ],
    )
    root.destroy()
    if not selected:
        return None
    return Path(selected)


def _open_folder_dialog() -> Path | None:
    if sys.platform == "darwin":
        # On macOS, avoid Tkinter fallback because it can trigger Objective-C
        # runtime aborts with some Python/Tk combinations after dialog cancel.
        return _open_folder_dialog_macos()
    if tk is None or filedialog is None:
        return None
    root = tk.Tk()
    root.withdraw()
    root.update()
    selected = filedialog.askdirectory(title="Select a folder of images")
    root.destroy()
    if not selected:
        return None
    return Path(selected)


def _run_osascript(script_lines: list[str]) -> str | None:
    cmd: list[str] = ["osascript"]
    for line in script_lines:
        cmd.extend(["-e", line])
    try:
        proc = subprocess.run(
            cmd,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except Exception:
        return None
    if proc.returncode != 0:
        return None
    out = proc.stdout.strip()
    if not out:
        return None
    return out


def _open_file_dialog_macos() -> Path | None:
    selected = _run_osascript(
        [
            'set selectedFile to choose file with prompt "Select an image file"',
            "return POSIX path of selectedFile",
        ]
    )
    if not selected:
        return None
    return Path(selected)


def _open_folder_dialog_macos() -> Path | None:
    selected = _run_osascript(
        [
            'set selectedFolder to choose folder with prompt "Select a folder of images"',
            "return POSIX path of selectedFolder",
        ]
    )
    if not selected:
        return None
    return Path(selected)


def _new_local_session(
    image_paths: list[Path],
    root_dir: Path,
    selected_label: str,
    *,
    scan_complete: bool = True,
    scan_error: str = "",
) -> str:
    session_id = uuid.uuid4().hex
    normalized_images = [
        _normalize_local_session_image_entry(image_path, root_dir)
        for image_path in image_paths
    ]
    with _local_sessions_lock:
        _local_sessions[session_id] = {
            "images": normalized_images,
            "root_dir": root_dir,
            "selected_label": selected_label,
            "scan_complete": bool(scan_complete),
            "scan_error": str(scan_error or ""),
            "entries_checked": 0,
            "folders_scanned": 0,
        }
        # Keep memory bounded.
        if len(_local_sessions) > 32:
            first = next(iter(_local_sessions.keys()))
            _local_sessions.pop(first, None)
    return session_id


def _get_local_session(session_id: str) -> dict[str, object] | None:
    with _local_sessions_lock:
        return _local_sessions.get(session_id)


def _session_item_payload(
    session: dict[str, object],
    offset: int = 0,
    limit: int | None = None,
) -> list[dict[str, object]]:
    images = session.get("images", [])
    if not isinstance(images, list):
        return []
    start = max(0, int(offset))
    if limit is None:
        selected_images = images[start:]
    else:
        selected_images = images[start : start + max(0, int(limit))]
    items: list[dict[str, object]] = []
    for idx, entry in enumerate(selected_images, start=start):
        if not isinstance(entry, dict):
            continue
        relative_path = str(entry.get("relative_path", "") or entry.get("name", "")).strip()
        name = str(entry.get("name", "")).strip()
        if not relative_path and not name:
            continue
        items.append(
            {
                "index": idx,
                "name": name or Path(relative_path).name,
                "relative_path": relative_path or name,
            }
        )
    return items


def _iter_image_paths(folder: Path):
    for root, dirnames, filenames in os.walk(folder):
        dirnames.sort()
        filenames.sort()
        root_path = Path(root)
        for filename in filenames:
            image_path = root_path / filename
            if image_path.suffix.lower() in SUPPORTED_EXTENSIONS and image_path.is_file():
                yield image_path


def _normalize_local_session_image_entry(image_path: Path | dict[str, object], root_dir: Path) -> dict[str, str]:
    if isinstance(image_path, dict):
        path_text = str(image_path.get("path", "")).strip()
        name = str(image_path.get("name", "")).strip()
        relative_path = str(image_path.get("relative_path", "")).strip()
        if path_text and name and relative_path:
            return {
                "path": path_text,
                "name": name,
                "relative_path": relative_path,
            }

    path_obj = Path(image_path).expanduser().resolve()
    try:
        relative_path = path_obj.relative_to(root_dir).as_posix()
    except Exception:
        relative_path = path_obj.name
    return {
        "path": str(path_obj),
        "name": path_obj.name,
        "relative_path": relative_path,
    }


def _append_local_session_images(session_id: str, image_entries: list[dict[str, str]]) -> bool:
    if not image_entries:
        return True
    with _local_sessions_lock:
        session = _local_sessions.get(session_id)
        if session is None:
            return False
        images = session.get("images")
        if not isinstance(images, list):
            return False
        images.extend(image_entries)
        return True


def _update_local_session_scan_stats(
    session_id: str,
    *,
    entries_checked: int | None = None,
    folders_scanned: int | None = None,
) -> bool:
    with _local_sessions_lock:
        session = _local_sessions.get(session_id)
        if session is None:
            return False
        if entries_checked is not None:
            session["entries_checked"] = max(0, int(entries_checked))
        if folders_scanned is not None:
            session["folders_scanned"] = max(0, int(folders_scanned))
        return True


def _finish_local_session_scan(session_id: str, error: str = "") -> None:
    with _local_sessions_lock:
        session = _local_sessions.get(session_id)
        if session is None:
            return
        session["scan_complete"] = True
        session["scan_error"] = str(error or "")


def _start_local_folder_session_scan(session_id: str, folder: Path) -> None:
    def worker() -> None:
        batch: list[dict[str, str]] = []
        scan_error = ""
        entries_checked = 0
        folders_scanned = 0
        last_reported_entries = 0
        last_reported_folders = 0
        visited_dirs: set[str] = set()

        def report_progress(force: bool = False) -> bool:
            nonlocal last_reported_entries
            nonlocal last_reported_folders
            if (
                not force
                and (entries_checked - last_reported_entries) < _LOCAL_SESSION_SCAN_BATCH_SIZE
                and folders_scanned == last_reported_folders
            ):
                return True
            last_reported_entries = entries_checked
            last_reported_folders = folders_scanned
            return _update_local_session_scan_stats(
                session_id,
                entries_checked=entries_checked,
                folders_scanned=folders_scanned,
            )

        try:
            stack: list[tuple[Path, str]] = [(folder, "")]
            while stack:
                current_dir, current_prefix = stack.pop()
                try:
                    current_key = str(current_dir.resolve())
                except Exception:
                    current_key = str(current_dir)
                if current_key in visited_dirs:
                    continue
                visited_dirs.add(current_key)
                folders_scanned += 1
                if not report_progress():
                    return

                child_dirs: list[tuple[Path, str]] = []
                with os.scandir(current_dir) as entries:
                    for entry in entries:
                        entries_checked += 1
                        try:
                            if entry.is_dir(follow_symlinks=True):
                                child_rel_prefix = f"{current_prefix}/{entry.name}" if current_prefix else entry.name
                                child_dirs.append((Path(entry.path), child_rel_prefix))
                                if not report_progress():
                                    return
                                continue
                        except Exception:
                            if not report_progress():
                                return
                            continue

                        suffix = Path(entry.name).suffix.lower()
                        if suffix not in SUPPORTED_EXTENSIONS:
                            if not report_progress():
                                return
                            continue

                        try:
                            if not entry.is_file(follow_symlinks=True):
                                if not report_progress():
                                    return
                                continue
                        except Exception:
                            if not report_progress():
                                return
                            continue

                        relative_path = f"{current_prefix}/{entry.name}" if current_prefix else entry.name
                        batch.append(
                            {
                                "path": entry.path,
                                "name": entry.name,
                                "relative_path": relative_path,
                            }
                        )
                        if len(batch) >= _LOCAL_SESSION_SCAN_BATCH_SIZE:
                            if not _append_local_session_images(session_id, batch):
                                return
                            batch = []
                            if not report_progress(force=True):
                                return

                        if not report_progress():
                            return

                for child_dir in reversed(child_dirs):
                    stack.append(child_dir)
            if batch:
                _append_local_session_images(session_id, batch)
        except Exception as exc:
            scan_error = str(exc)
        finally:
            _update_local_session_scan_stats(
                session_id,
                entries_checked=entries_checked,
                folders_scanned=folders_scanned,
            )
            _finish_local_session_scan(session_id, scan_error)

    thread = threading.Thread(
        target=worker,
        name=f"local-session-scan-{session_id[:8]}",
        daemon=True,
    )
    thread.start()


def _get_session_image(session: dict[str, object], index: int) -> Path | None:
    images = session.get("images", [])
    if not isinstance(images, list):
        return None
    if index < 0 or index >= len(images):
        return None
    image_entry = images[index]
    if not isinstance(image_entry, dict):
        return None
    path_text = str(image_entry.get("path", "")).strip()
    if not path_text:
        return None
    return Path(path_text)


def _write_local_resume_state(payload: dict[str, object]) -> None:
    with _local_resume_state_lock:
        temp_path = _LOCAL_RESUME_STATE_PATH.with_suffix(".json.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
        temp_path.replace(_LOCAL_RESUME_STATE_PATH)


def _save_local_resume_folder_state(folder: Path, selected_label: str) -> None:
    payload = {
        "version": 1,
        "source_mode": "local",
        "selection_mode": "folder",
        "root_dir": str(folder),
        "image_path": "",
        "selected_label": str(selected_label),
        "updated_at": int(time.time() * 1000),
    }
    _write_local_resume_state(payload)


def _save_local_resume_image_state(image_path: Path, selected_label: str) -> None:
    payload = {
        "version": 1,
        "source_mode": "local",
        "selection_mode": "image",
        "root_dir": str(image_path.parent),
        "image_path": str(image_path),
        "selected_label": str(selected_label),
        "updated_at": int(time.time() * 1000),
    }
    _write_local_resume_state(payload)


def _load_local_resume_state() -> dict[str, object] | None:
    with _local_resume_state_lock:
        if not _LOCAL_RESUME_STATE_PATH.exists():
            return None
        try:
            raw = json.loads(_LOCAL_RESUME_STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return None
    if not isinstance(raw, dict):
        return None
    return raw


def _metadata_has_keywords(metadata: ImageMetadata | None) -> bool:
    if metadata is None:
        return False
    objects = metadata.objects if isinstance(metadata.objects, list) else []
    for item in objects:
        if str(item).strip():
            return True
    categories = metadata.categories if isinstance(metadata.categories, list) else []
    for item in categories:
        if str(item).strip():
            return True
    return False


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/analyze")
def analyze_image():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")
    high_recall = _to_bool(request.form.get("high_recall", "0"))
    fast_mode = _to_bool(request.form.get("fast_mode", "1"))
    caption_model = _normalize_caption_model(request.form.get("caption_model", DEFAULT_CAPTION_MODEL))
    detector_model = _normalize_detector_model(request.form.get("detector_model", DEFAULT_DETECTOR_MODEL))
    run_id = str(request.form.get("run_id", "")).strip()

    temp_path: Path | None = None
    try:
        temp_path = _save_upload_to_temp(uploaded, suffix)
        metadata = _analyze_image_with_cancel(
            temp_path,
            high_recall=high_recall,
            fast_mode=fast_mode,
            caption_model=caption_model,
            detector_model=detector_model,
            run_id=run_id,
        )
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(metadata),
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Analyze failed: {exc}", status=500)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@app.post("/api/embed")
def embed_metadata():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")

    metadata_raw = request.form.get("metadata", "")
    if not metadata_raw:
        return error_response("Missing metadata payload.")

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")

    try:
        metadata_dict = json.loads(metadata_raw)
        metadata = ImageMetadata.from_dict(metadata_dict)
    except Exception:
        return error_response("Invalid metadata JSON.")

    try:
        input_bytes = uploaded.read()
        output_bytes = write_metadata_to_bytes(input_bytes, suffix, metadata)
        return send_file(
            path_or_file=BytesIO(output_bytes),
            as_attachment=True,
            download_name=uploaded.filename,
            mimetype=uploaded.mimetype or "application/octet-stream",
        )
    except Exception as exc:
        return error_response(f"Embed failed: {exc}", status=500)


@app.post("/api/remove")
def remove_metadata():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")

    try:
        input_bytes = uploaded.read()
        output_bytes = remove_metadata_from_bytes(input_bytes, suffix)
        return send_file(
            path_or_file=BytesIO(output_bytes),
            as_attachment=True,
            download_name=uploaded.filename,
            mimetype=uploaded.mimetype or "application/octet-stream",
        )
    except Exception as exc:
        return error_response(f"Remove metadata failed: {exc}", status=500)


@app.post("/api/verify")
def verify_metadata():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")
    run_id = str(request.form.get("run_id", "")).strip()

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")

    try:
        _raise_if_run_canceled(run_id)
        input_bytes = uploaded.read()
        metadata = read_metadata_from_bytes(input_bytes, suffix)
        _raise_if_run_canceled(run_id)
        if metadata is None:
            return error_response("No embedded metadata found on this image.", status=404)
        return jsonify({"ok": True, "metadata": _metadata_payload(metadata)})
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Verify failed: {exc}", status=500)


@app.post("/api/verify-batch-keywords")
def verify_batch_keywords():
    uploads = request.files.getlist("images")
    if not uploads:
        return error_response("Missing image files.")

    raw_indices = request.form.get("item_indices", "")
    parsed_indices: list[int] = []
    if raw_indices:
        try:
            decoded = json.loads(raw_indices)
            if not isinstance(decoded, list):
                return error_response("Invalid item_indices payload.")
            for value in decoded:
                try:
                    parsed_indices.append(int(value))
                except Exception:
                    parsed_indices.append(-1)
        except Exception:
            return error_response("Invalid item_indices payload.")

    start = time.perf_counter()
    results: list[dict[str, object]] = []
    for pos, uploaded in enumerate(uploads):
        index = pos
        if pos < len(parsed_indices) and parsed_indices[pos] >= 0:
            index = parsed_indices[pos]
        has_keywords = False

        if uploaded is not None and uploaded.filename:
            suffix = Path(uploaded.filename).suffix.lower()
            if suffix in SUPPORTED_EXTENSIONS:
                try:
                    input_bytes = uploaded.read()
                    metadata = read_metadata_from_bytes(input_bytes, suffix)
                    has_keywords = _metadata_has_keywords(metadata)
                except Exception:
                    has_keywords = False

        results.append(
            {
                "index": index,
                "has_keywords": has_keywords,
            }
        )

    elapsed_ms = int(round((time.perf_counter() - start) * 1000.0))
    return jsonify(
        {
            "ok": True,
            "results": results,
            "elapsed_ms": elapsed_ms,
            "total": len(uploads),
        }
    )


@app.post("/api/check-metadata")
def check_metadata():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")

    metadata_raw = request.form.get("metadata", "")
    run_id = str(request.form.get("run_id", "")).strip()
    if not metadata_raw:
        return error_response("Missing metadata payload.")

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")

    temp_path: Path | None = None
    try:
        metadata_dict = json.loads(metadata_raw)
        if not isinstance(metadata_dict, dict):
            return error_response("Invalid metadata JSON.")
        metadata = ImageMetadata.from_dict(metadata_dict)
    except Exception:
        return error_response("Invalid metadata JSON.")

    try:
        temp_path = _save_upload_to_temp(uploaded, suffix)
        corrected, issues, missing, changed, elapsed_ms = _check_metadata_fast(temp_path, metadata, run_id=run_id)
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(corrected),
                "changed": bool(changed),
                "issues": issues,
                "missing": missing,
                "elapsed_ms": elapsed_ms,
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Metadata check failed: {exc}", status=500)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@app.post("/api/check-ip-risk")
def check_ip_risk():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")

    metadata_raw = request.form.get("metadata", "")
    run_id = str(request.form.get("run_id", "")).strip()
    if not metadata_raw:
        return error_response("Missing metadata payload.")

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")

    temp_path: Path | None = None
    try:
        metadata_dict = json.loads(metadata_raw)
        if not isinstance(metadata_dict, dict):
            return error_response("Invalid metadata JSON.")
        metadata = ImageMetadata.from_dict(metadata_dict)
    except Exception:
        return error_response("Invalid metadata JSON.")

    try:
        temp_path = _save_upload_to_temp(uploaded, suffix)
        corrected, changed, elapsed_ms = _check_ip_risk_fast(temp_path, metadata, run_id=run_id)
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(corrected),
                "changed": bool(changed),
                "ip_risk": corrected.ip_risk,
                "elapsed_ms": elapsed_ms,
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"IP risk check failed: {exc}", status=500)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@app.post("/api/audit")
def audit_metadata():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return error_response("Missing image file.")

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {suffix}")

    metadata_raw = request.form.get("metadata", "")
    run_id = str(request.form.get("run_id", "")).strip()
    run_metadata_check = _to_bool(request.form.get("metadata_check", "1"))
    run_ip_risk_check = _to_bool(request.form.get("ip_risk_check", "0"))

    base_metadata: ImageMetadata | None = None
    if metadata_raw:
        try:
            metadata_dict = json.loads(metadata_raw)
            if not isinstance(metadata_dict, dict):
                return error_response("Invalid metadata JSON.")
            base_metadata = ImageMetadata.from_dict(metadata_dict)
        except Exception:
            return error_response("Invalid metadata JSON.")

    temp_path: Path | None = None
    try:
        temp_path = _save_upload_to_temp(uploaded, suffix)
        has_embedded_metadata = False
        if base_metadata is None:
            try:
                embedded = read_metadata_from_file(temp_path)
            except Exception:
                embedded = None
            if embedded is not None:
                base_metadata = embedded
                has_embedded_metadata = True
            else:
                base_metadata = ImageMetadata.from_dict({})

        corrected, issues, missing, changed, elapsed_ms = _audit_metadata_fast(
            temp_path,
            base_metadata,
            run_metadata_check=run_metadata_check,
            run_ip_risk_check=run_ip_risk_check,
            run_id=run_id,
        )
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(corrected),
                "issues": issues,
                "missing": missing,
                "changed": bool(changed),
                "elapsed_ms": elapsed_ms,
                "has_embedded_metadata": has_embedded_metadata,
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Audit request failed: {exc}", status=500)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@app.post("/api/local/select-folder")
def local_select_folder():
    folder = _open_folder_dialog()
    if folder is None:
        return error_response("No folder selected.")
    folder = folder.expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        return error_response("Selected folder does not exist.")

    session_id = _new_local_session([], folder, f"Folder: {folder.name}", scan_complete=False)
    session = _get_local_session(session_id)
    if session is None:
        return error_response("Failed to create local session.", status=500)
    _save_local_resume_folder_state(folder, str(session.get("selected_label", f"Folder: {folder.name}")))
    _start_local_folder_session_scan(session_id, folder)

    return jsonify(
        {
            "ok": True,
            "session_id": session_id,
            "selected_label": session.get("selected_label", f"Folder: {folder.name}"),
            "items": [],
            "loaded_count": 0,
            "scan_complete": False,
            "scan_error": "",
        }
    )


@app.post("/api/local/select-image")
def local_select_image():
    image_path = _open_file_dialog()
    if image_path is None:
        return error_response("No image selected.")

    image_path = image_path.expanduser().resolve()
    if not image_path.exists() or not image_path.is_file():
        return error_response("Selected file does not exist.")
    if image_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return error_response(f"Unsupported image extension: {image_path.suffix.lower()}")

    session_id = _new_local_session([image_path], image_path.parent, f"Image: {image_path.name}")
    session = _get_local_session(session_id)
    if session is None:
        return error_response("Failed to create local session.", status=500)
    _save_local_resume_image_state(image_path, str(session.get("selected_label", f"Image: {image_path.name}")))

    return jsonify(
        {
            "ok": True,
            "session_id": session_id,
            "selected_label": session.get("selected_label", f"Image: {image_path.name}"),
            "items": _session_item_payload(session),
        }
    )


@app.get("/api/local/preview/<session_id>/<int:index>")
def local_preview(session_id: str, index: int):
    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)
    return send_file(str(image_path))


@app.get("/api/local/session-items/<session_id>")
def local_session_items(session_id: str):
    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    try:
        offset = int(request.args.get("offset", "0"))
    except Exception:
        offset = 0
    try:
        limit = int(request.args.get("limit", "2000"))
    except Exception:
        limit = 2000

    items = _session_item_payload(session, offset=offset, limit=max(1, min(limit, _LOCAL_SESSION_ITEM_LIMIT)))
    images = session.get("images", [])
    loaded_count = len(images) if isinstance(images, list) else 0
    scan_complete = bool(session.get("scan_complete", True))
    scan_error = str(session.get("scan_error", "") or "")
    entries_checked = max(0, int(session.get("entries_checked", 0) or 0))
    folders_scanned = max(0, int(session.get("folders_scanned", 0) or 0))
    return jsonify(
        {
            "ok": True,
            "session_id": session_id,
            "selected_label": str(session.get("selected_label", "Folder")).strip() or "Folder",
            "items": items,
            "loaded_count": loaded_count,
            "entries_checked": entries_checked,
            "folders_scanned": folders_scanned,
            "scan_complete": scan_complete,
            "scan_error": scan_error,
        }
    )


@app.get("/api/local/restore-session")
def local_restore_session():
    state = _load_local_resume_state()
    if state is None:
        return jsonify({"ok": True, "available": False})

    mode = str(state.get("selection_mode", "")).strip().lower()
    selected_label = str(state.get("selected_label", "Local Session")).strip() or "Local Session"
    root_dir_text = str(state.get("root_dir", "")).strip()
    image_path_text = str(state.get("image_path", "")).strip()

    try:
        root_dir = Path(root_dir_text).expanduser().resolve() if root_dir_text else None
    except Exception:
        root_dir = None

    if mode == "folder":
        if root_dir is None or not root_dir.exists() or not root_dir.is_dir():
            return jsonify({"ok": True, "available": False, "reason": "folder-missing"})
        images = find_images(root_dir)
        if not images:
            return jsonify({"ok": True, "available": False, "reason": "no-images"})
        session_id = _new_local_session(images, root_dir, selected_label)
        session = _get_local_session(session_id)
        if session is None:
            return error_response("Failed to restore local session.", status=500)
        return jsonify(
            {
                "ok": True,
                "available": True,
                "session_id": session_id,
                "selected_label": session.get("selected_label", selected_label),
                "items": _session_item_payload(session),
            }
        )

    if mode == "image":
        if not image_path_text:
            return jsonify({"ok": True, "available": False, "reason": "image-missing"})
        try:
            image_path = Path(image_path_text).expanduser().resolve()
        except Exception:
            return jsonify({"ok": True, "available": False, "reason": "image-invalid"})
        if not image_path.exists() or not image_path.is_file():
            return jsonify({"ok": True, "available": False, "reason": "image-missing"})
        if image_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return jsonify({"ok": True, "available": False, "reason": "unsupported"})
        session_id = _new_local_session([image_path], image_path.parent, selected_label)
        session = _get_local_session(session_id)
        if session is None:
            return error_response("Failed to restore local session.", status=500)
        return jsonify(
            {
                "ok": True,
                "available": True,
                "session_id": session_id,
                "selected_label": session.get("selected_label", selected_label),
                "items": _session_item_payload(session),
            }
        )

    return jsonify({"ok": True, "available": False, "reason": "unsupported-mode"})


@app.post("/api/local/analyze")
def local_analyze():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    high_recall = _to_bool(payload.get("high_recall", False))
    fast_mode = _to_bool(payload.get("fast_mode", True))
    caption_model = _normalize_caption_model(payload.get("caption_model", DEFAULT_CAPTION_MODEL))
    detector_model = _normalize_detector_model(payload.get("detector_model", DEFAULT_DETECTOR_MODEL))
    run_id = str(payload.get("run_id", "")).strip()
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    try:
        metadata = _analyze_image_with_cancel(
            image_path,
            high_recall=high_recall,
            fast_mode=fast_mode,
            caption_model=caption_model,
            detector_model=detector_model,
            run_id=run_id,
        )
        return jsonify({"ok": True, "metadata": _metadata_payload(metadata)})
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Analyze failed: {exc}", status=500)


@app.post("/api/cancel-run")
def cancel_run():
    payload = request.get_json(silent=True) or {}
    run_id = str(payload.get("run_id", "")).strip()
    if run_id:
        _mark_run_canceled(run_id)

    canceled = False
    with _analysis_worker_lock:
        proc = _analysis_worker_process
        busy_run_id = _analysis_worker_busy_run_id
        if proc is not None and proc.is_alive():
            if not run_id or busy_run_id == run_id:
                _terminate_analysis_worker_locked()
                canceled = True

    return jsonify({"ok": True, "canceled": canceled})


@app.post("/api/local/embed")
def local_embed():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    metadata_raw = payload.get("metadata")
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")
    if not isinstance(metadata_raw, dict):
        return error_response("Missing metadata payload.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    try:
        metadata = ImageMetadata.from_dict(metadata_raw)
        write_metadata_to_file(image_path, metadata)
        return jsonify({"ok": True})
    except Exception as exc:
        return error_response(f"Embed failed: {exc}", status=500)


@app.post("/api/local/remove")
def local_remove():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    try:
        remove_metadata_from_file(image_path)
        return jsonify({"ok": True})
    except Exception as exc:
        return error_response(f"Remove metadata failed: {exc}", status=500)


@app.post("/api/local/verify")
def local_verify():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    run_id = str(payload.get("run_id", "")).strip()
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    try:
        _raise_if_run_canceled(run_id)
        metadata = read_metadata_from_file(image_path)
        _raise_if_run_canceled(run_id)
        if metadata is None:
            return error_response("No embedded metadata found on this image.", status=404)
        return jsonify({"ok": True, "metadata": _metadata_payload(metadata)})
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Verify failed: {exc}", status=500)


@app.post("/api/local/check-metadata")
def local_check_metadata():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    run_id = str(payload.get("run_id", "")).strip()
    metadata_raw = payload.get("metadata")
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")
    if not isinstance(metadata_raw, dict):
        return error_response("Missing metadata payload.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    try:
        metadata = ImageMetadata.from_dict(metadata_raw)
        corrected, issues, missing, changed, elapsed_ms = _check_metadata_fast(image_path, metadata, run_id=run_id)
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(corrected),
                "changed": bool(changed),
                "issues": issues,
                "missing": missing,
                "elapsed_ms": elapsed_ms,
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Metadata check failed: {exc}", status=500)


@app.post("/api/local/check-ip-risk")
def local_check_ip_risk():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    run_id = str(payload.get("run_id", "")).strip()
    metadata_raw = payload.get("metadata")
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")
    if not isinstance(metadata_raw, dict):
        return error_response("Missing metadata payload.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    try:
        metadata = ImageMetadata.from_dict(metadata_raw)
        corrected, changed, elapsed_ms = _check_ip_risk_fast(image_path, metadata, run_id=run_id)
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(corrected),
                "changed": bool(changed),
                "ip_risk": corrected.ip_risk,
                "elapsed_ms": elapsed_ms,
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"IP risk check failed: {exc}", status=500)


@app.post("/api/local/audit")
def local_audit_metadata():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    run_id = str(payload.get("run_id", "")).strip()
    metadata_raw = payload.get("metadata")
    run_metadata_check = _to_bool(payload.get("metadata_check", True))
    run_ip_risk_check = _to_bool(payload.get("ip_risk_check", False))
    try:
        index = int(payload.get("index", -1))
    except Exception:
        index = -1
    if not session_id:
        return error_response("Missing session_id.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)
    image_path = _get_session_image(session, index)
    if image_path is None:
        return error_response("Invalid image index.", status=404)
    if not image_path.exists():
        return error_response("Image file not found.", status=404)

    base_metadata: ImageMetadata | None = None
    if metadata_raw is not None:
        if not isinstance(metadata_raw, dict):
            return error_response("Invalid metadata payload.")
        try:
            base_metadata = ImageMetadata.from_dict(metadata_raw)
        except Exception:
            return error_response("Invalid metadata payload.")

    try:
        has_embedded_metadata = False
        if base_metadata is None:
            _raise_if_run_canceled(run_id)
            embedded = read_metadata_from_file(image_path)
            _raise_if_run_canceled(run_id)
            if embedded is not None:
                base_metadata = embedded
                has_embedded_metadata = True
            else:
                base_metadata = ImageMetadata.from_dict({})

        corrected, issues, missing, changed, elapsed_ms = _audit_metadata_fast(
            image_path,
            base_metadata,
            run_metadata_check=run_metadata_check,
            run_ip_risk_check=run_ip_risk_check,
            run_id=run_id,
        )
        return jsonify(
            {
                "ok": True,
                "metadata": _metadata_payload(corrected),
                "issues": issues,
                "missing": missing,
                "changed": bool(changed),
                "elapsed_ms": elapsed_ms,
                "has_embedded_metadata": has_embedded_metadata,
            }
        )
    except AnalysisCanceledError as exc:
        return error_response(str(exc), status=499)
    except Exception as exc:
        return error_response(f"Local audit failed: {exc}", status=500)


@app.post("/api/local/prescan-skip")
def local_prescan_skip():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    if not session_id:
        return error_response("Missing session_id.")

    session = _get_local_session(session_id)
    if session is None:
        return error_response("Invalid local session.", status=404)

    images = session.get("images", [])
    if not isinstance(images, list):
        return error_response("Invalid local session payload.", status=500)

    start = time.perf_counter()
    skip_indices: list[int] = []
    scanned = 0
    for idx, image_path in enumerate(images):
        if not isinstance(image_path, Path):
            continue
        if not image_path.exists() or not image_path.is_file():
            continue
        scanned += 1
        try:
            metadata = read_metadata_from_file(image_path)
        except Exception:
            continue
        if _metadata_has_keywords(metadata):
            skip_indices.append(idx)

    elapsed_ms = int(round((time.perf_counter() - start) * 1000.0))
    return jsonify(
        {
            "ok": True,
            "total": len(images),
            "scanned": scanned,
            "skip_count": len(skip_indices),
            "skip_indices": skip_indices,
            "elapsed_ms": elapsed_ms,
        }
    )


if __name__ == "__main__":
    _register_shutdown_hooks()
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
