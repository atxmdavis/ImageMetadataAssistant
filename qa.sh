#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_ACTIVATE="$ROOT_DIR/.venv/bin/activate"

if [[ ! -f "$VENV_ACTIVATE" ]]; then
  echo "[FAIL] Virtualenv not found at $VENV_ACTIVATE"
  echo "Create it first: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# shellcheck disable=SC1090
source "$VENV_ACTIVATE"

cd "$ROOT_DIR"

echo "[1/4] JavaScript syntax check"
if ! command -v node >/dev/null 2>&1; then
  echo "[FAIL] node is required for JS syntax checks."
  exit 1
fi
node --check static/app.js

echo "[2/4] Python syntax check"
PYTHONPYCACHEPREFIX=/tmp/image-describer-pycache \
  python -m py_compile web_app.py image_describer_app.py

echo "[3/4] Flask endpoint smoke checks"
python - <<'PY'
from web_app import app

client = app.test_client()

checks = []

resp = client.get("/")
checks.append(("GET /", resp.status_code == 200, f"status={resp.status_code}"))

for path in (
    "/api/analyze",
    "/api/embed",
    "/api/remove",
    "/api/verify",
    "/api/check-metadata",
    "/api/check-ip-risk",
    "/api/audit",
):
    resp = client.post(path, data={})
    checks.append((f"POST {path} (missing image)", resp.status_code < 500, f"status={resp.status_code}"))

for path in (
    "/api/local/analyze",
    "/api/local/embed",
    "/api/local/remove",
    "/api/local/verify",
    "/api/local/check-metadata",
    "/api/local/check-ip-risk",
    "/api/local/audit",
    "/api/local/prescan-skip",
):
    resp = client.post(path, json={})
    checks.append((f"POST {path} (missing session)", resp.status_code < 500, f"status={resp.status_code}"))

resp = client.post("/api/cancel-run", json={})
checks.append(("POST /api/cancel-run", resp.status_code == 200, f"status={resp.status_code}"))

resp = client.get("/api/local/restore-session")
checks.append(("GET /api/local/restore-session", resp.status_code == 200, f"status={resp.status_code}"))

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} | {detail}")

if failed:
    raise SystemExit(1)
PY

echo "[4/4] DOM ID wiring check (JS getElementById -> HTML)"
python - <<'PY'
import re
from pathlib import Path

js = Path("static/app.js").read_text(encoding="utf-8")
html = Path("templates/index.html").read_text(encoding="utf-8")

ids = set(re.findall(r'getElementById\("([^"]+)"\)', js))
if not ids:
    raise SystemExit("[FAIL] No JS-bound IDs found; check the DOM ID matcher.")
missing = sorted(i for i in ids if f'id="{i}"' not in html)

allowed_dynamic = {
    "statusToast",
    "statusToastMessage",
    "statusToastProgressTrack",
    "statusToastProgressFill",
}
# These controls belong to alternate layouts; app.js guards absent elements.
allowed_optional = {
    "diagnosticsToggle",
    "selectionInfo",
    "resumeDetails",
    "flowStepSource",
    "flowStepConfigure",
    "flowStepProcess",
    "flowStepReview",
    "flowStepFinish",
}

unexpected = [i for i in missing if i not in allowed_dynamic | allowed_optional]
if unexpected:
    print("[FAIL] Missing IDs in templates/index.html:")
    for item in unexpected:
        print(f" - {item}")
    raise SystemExit(1)

print(f"[PASS] Checked {len(ids)} JS-bound IDs (absent dynamic/optional IDs: {len(missing)}).")
PY

echo
echo "QA passed."
