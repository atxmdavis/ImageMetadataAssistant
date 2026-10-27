const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"]);
const PICKER_ACCEPT = {
  "image/*": [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"],
};
const PICKER_LOCATION_ID = "image-describer-workspace";
const RUN_CHECKPOINT_KEY = "image-describer-run-checkpoint-v1";
const AUTO_RESUME_PREF_KEY = "image-describer-auto-resume-v1";
const LAST_SOURCE_CHOICE_KEY = "image-describer-last-source-choice-v1";
const DIAGNOSTICS_PREF_KEY = "image-describer-diagnostics-v1";
const HANDLE_RESUME_DB_NAME = "image-describer-resume-db-v1";
const HANDLE_RESUME_STORE_NAME = "state";
const HANDLE_RESUME_KEY = "latest";
const RUN_CHECKPOINT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BULK_VERIFY_INTERVAL = 50;
const HANDLE_SKIP_PRESCAN_BATCH_SIZE = 24;
const LOG_BOTTOM_THRESHOLD_PX = 12;
const DEFAULT_CAPTION_MODEL = "Salesforce/blip-image-captioning-base";
const DEFAULT_DETECTOR_MODEL = "google/owlvit-base-patch32";
const DETECTOR_DISABLED_MODEL = "none";

const selectFolderBtn = document.getElementById("selectFolderBtn");
const selectImageBtn = document.getElementById("selectImageBtn");
const serverFolderBtn = document.getElementById("serverFolderBtn");
const serverImageBtn = document.getElementById("serverImageBtn");
const startBtn = document.getElementById("startBtn");
const autoApplyToggle = document.getElementById("autoApplyToggle");
const skipExistingToggle = document.getElementById("skipExistingToggle");
const diagnosticsToggle = document.getElementById("diagnosticsToggle");
const highRecallToggle = document.getElementById("highRecallToggle");
const fastModeToggle = document.getElementById("fastModeToggle");
const checkMetadataToggle = document.getElementById("checkMetadataToggle");
const repairOnlyToggle = document.getElementById("repairOnlyToggle");
const auditOnlyToggle = document.getElementById("auditOnlyToggle");
const removeOnlyToggle = document.getElementById("removeOnlyToggle");
const detectDuplicatesToggle = document.getElementById("detectDuplicatesToggle");
const ipRiskToggle = document.getElementById("ipRiskToggle");
const autoResumeToggle = document.getElementById("autoResumeToggle");

const selectionInfo = document.getElementById("selectionInfo");
const sourceSummaryText = document.getElementById("sourceSummaryText");
const resumeBanner = document.getElementById("resumeBanner");
const resumeDetails = document.getElementById("resumeDetails");
const statusText = document.getElementById("statusText");
let statusToast = document.getElementById("statusToast");
let statusToastMessage = document.getElementById("statusToastMessage");
let statusToastProgressTrack = document.getElementById("statusToastProgressTrack");
let statusToastProgressFill = document.getElementById("statusToastProgressFill");
let statusToastCloseBtn = document.getElementById("statusToastCloseBtn");
const inlineStatusAlert = document.getElementById("inlineStatusAlert");
const inlineStatusMessage = document.getElementById("inlineStatusMessage");
const inlineStatusCloseBtn = document.getElementById("inlineStatusCloseBtn");
const progressText = document.getElementById("progressText");
const skippedCountChip = document.getElementById("skippedCountChip");
const progressFill = document.getElementById("progressFill");
const etaText = document.getElementById("etaText");
const runElapsedText = document.getElementById("runElapsedText");
const skipActivityText = document.getElementById("skipActivityText");
const exportIndexBtn = document.getElementById("exportIndexBtn");
const exportCard = document.getElementById("exportCard");
const exportLogBtn = document.getElementById("exportLogBtn");
const previewWrap = document.getElementById("previewWrap");
const previewImage = document.getElementById("previewImage");
const previewOverlay = document.getElementById("previewOverlay");
const previewOverlayText = document.getElementById("previewOverlayText");
const imageProgressFill = document.getElementById("imageProgressFill");
const imageProgressText = document.getElementById("imageProgressText");
const dropWarningAlert = document.getElementById("dropWarningAlert");
const dropWarningText = document.getElementById("dropWarningText");
const dropWarningCloseBtn = document.getElementById("dropWarningCloseBtn");
const dropHint = document.getElementById("dropHint");
const currentFileText = document.getElementById("currentFileText");
const runStateText = document.getElementById("runStateText");
const runStatusBadge = document.getElementById("runStatusBadge");
const confirmControlsAnnouncer = document.getElementById("confirmControlsAnnouncer");
const liveLog = document.getElementById("liveLog");
const showLogToggle = document.getElementById("showLogToggle");
const removeOnlyWarning = document.getElementById("removeOnlyWarning");
const removeOnlyOptionRow = document.getElementById("removeOnlyOptionRow");
const flowStepSource = document.getElementById("flowStepSource");
const flowStepConfigure = document.getElementById("flowStepConfigure");
const flowStepProcess = document.getElementById("flowStepProcess");
const flowStepReview = document.getElementById("flowStepReview");
const flowStepFinish = document.getElementById("flowStepFinish");

const metaColorsEdit = document.getElementById("metaColorsEdit");
const metaIpRiskDetected = document.getElementById("metaIpRiskDetected");
const metaIpRiskLow = document.getElementById("metaIpRiskLow");
const metaIpRiskMedium = document.getElementById("metaIpRiskMedium");
const metaIpRiskHigh = document.getElementById("metaIpRiskHigh");
const metaIpRiskScore = document.getElementById("metaIpRiskScore");
const metaIpRiskMatches = document.getElementById("metaIpRiskMatches");
const metaJson = document.getElementById("metaJson");
const metaDescriptionEdit = document.getElementById("metaDescriptionEdit");
const metaObjectsEdit = document.getElementById("metaObjectsEdit");
const metaActionsEdit = document.getElementById("metaActionsEdit");
const metaCustomTagsEdit = document.getElementById("metaCustomTagsEdit");
const metaCategoriesEdit = document.getElementById("metaCategoriesEdit");

const confirmAddBtn = document.getElementById("confirmAddBtn");
const removeMetadataBtn = document.getElementById("removeMetadataBtn");
const restartBtn = document.getElementById("restartBtn");

const state = {
  items: [],
  allItems: [],
  processing: false,
  stopRequested: false,
  skipCurrentRequested: false,
  skipNextRequested: false,
  currentStage: "idle",
  runId: null,
  activeAnalyzeAbortController: null,
  activePreScanAbortController: null,
  pendingConfirm: null,
  previewUrl: null,
  sourceMode: "none",
  localSessionId: null,
  selectedLabel: "None",
  imageProgressTimer: null,
  imageProgressCeilingTimer: null,
  imageProgressValue: 0,
  imageProgressIndeterminate: false,
  runElapsedTimer: null,
  runStartedAtMs: 0,
  runStartCompletedCount: 0,
  lastProgressCompleted: 0,
  lastProgressTotal: 0,
  lastSkippedCount: 0,
  handleWritePermission: false,
  lastDirectoryHandle: null,
  currentItem: null,
  currentIndex: 0,
  currentMetadata: null,
  metadataDirty: false,
  confirmControlsActive: false,
  ignoreCheckpointOnce: false,
  resumeNextIndex: 0,
  resumeStats: { added: 0, skipped: 0, failed: 0 },
  metadataIndex: {},
  qcFindings: [],
  lastQcReport: null,
  duplicateMap: {},
  logAutoScroll: true,
  pickerBusy: false,
  selectionLoading: false,
  selectionLoadingMessage: "",
  selectionLoadingToastActive: false,
  preScanLoading: false,
  dropWarningTimer: null,
  statusToastTimer: null,
  selectionScanStats: {
    imagesFound: 0,
    entriesChecked: 0,
    foldersScanned: 0,
  },
  selectionDiagnostics: {
    active: false,
    label: "",
    startedAtMs: 0,
    lastLogAtMs: 0,
    lastLoggedEntries: 0,
    lastLoggedImages: 0,
  },
  lastSourceChoice: "folder",
  localSkipPrescan: {
    sessionId: "",
    skipIndices: [],
  },
  handleSkipPrescan: {
    selectionFingerprint: "",
    skipIndices: [],
  },
  localFolderHydrationSessionId: "",
};

const DESCRIPTION_TYPO_CORRECTIONS = new Map([
  ["sombrel", "sombrero"],
  ["sombero", "sombrero"],
  ["sombrer", "sombrero"],
  ["sombrerro", "sombrero"],
  ["banda", "bandana"],
  ["bandna", "bandana"],
  ["bandanna", "bandana"],
  ["spiderman", "spider-man"],
  ["starwars", "star wars"],
  ["pokmon", "pokemon"],
]);

const OBJECT_NOISE_TERMS = new Set([
  "around",
  "its",
  "neck",
  "his",
  "her",
  "their",
  "our",
  "your",
  "my",
  "mine",
  "yours",
  "ours",
  "theirs",
  "inside",
  "outside",
  "between",
  "across",
  "along",
  "through",
  "toward",
  "towards",
  "into",
  "onto",
  "upon",
  "over",
  "under",
  "above",
  "below",
  "behind",
  "beside",
  "within",
  "without",
  "nearby",
  "head",
  "face",
  "arm",
  "arms",
  "hand",
  "hands",
  "leg",
  "legs",
  "foot",
  "feet",
  "eye",
  "eyes",
  "ear",
  "ears",
  "nose",
  "mouth",
  "color",
  "colors",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "magenta",
  "pink",
  "brown",
  "tan",
  "gray",
  "grey",
  "black",
  "white",
  "shape",
  "shapes",
  "circle",
  "circles",
  "square",
  "squares",
  "triangle",
  "triangles",
  "pattern",
  "patterns",
]);

function hasMeaningfulMetadata() {
  const metadata = normalizeMetadata(state.currentMetadata);
  return Boolean(
    metadata.description
    || metadata.objects.length
    || metadata.actions.length
    || metadata.custom_tags.length
    || metadata.categories.length
    || metadata.colors.length
  );
}

function setFlowStepState(element, stateName) {
  if (!element) {
    return;
  }
  const stateValue = String(stateName || "upcoming");
  element.classList.toggle("is-active", stateValue === "active");
  element.classList.toggle("is-complete", stateValue === "complete");
  element.classList.toggle("is-upcoming", stateValue === "upcoming");
  element.setAttribute("data-step-state", stateValue);
  element.setAttribute("aria-current", stateValue === "active" ? "step" : "false");
}

function updateFlowStepper() {
  const hasSelection = state.items.length > 0;
  const processFinished = state.lastProgressTotal > 0 && state.lastProgressCompleted >= state.lastProgressTotal && !state.processing;
  const reviewReady = hasSelection && hasMeaningfulMetadata();
  let activeStep = "source";

  if (state.processing || state.selectionLoading || state.preScanLoading) {
    activeStep = "process";
  } else if (processFinished) {
    activeStep = "finish";
  } else if (reviewReady) {
    activeStep = "review";
  } else if (hasSelection) {
    activeStep = "configure";
  }

  setFlowStepState(flowStepSource, hasSelection ? "complete" : activeStep === "source" ? "active" : "upcoming");
  setFlowStepState(flowStepConfigure, hasSelection ? (activeStep === "configure" ? "active" : "complete") : "upcoming");
  setFlowStepState(
    flowStepProcess,
    state.processing || state.selectionLoading || state.preScanLoading
      ? "active"
      : processFinished
        ? "complete"
        : hasSelection
          ? "upcoming"
          : "upcoming"
  );
  setFlowStepState(flowStepReview, activeStep === "review" ? "active" : (processFinished || reviewReady ? "complete" : "upcoming"));
  setFlowStepState(flowStepFinish, activeStep === "finish" ? "active" : (processFinished ? "complete" : "upcoming"));
}

function appendLog(message) {
  if (!liveLog) {
    return;
  }
  const shouldStick = state.logAutoScroll || isLiveLogNearBottom();
  const line = document.createElement("div");
  line.className = "log-entry";
  const stamp = new Date().toLocaleTimeString();
  line.textContent = `[${stamp}] ${message}`;
  liveLog.appendChild(line);
  while (liveLog.childElementCount > 500) {
    liveLog.removeChild(liveLog.firstElementChild);
  }
  if (shouldStick) {
    liveLog.scrollTop = liveLog.scrollHeight;
  }
}

function setLogVisibility(show) {
  if (!liveLog) {
    return;
  }
  liveLog.classList.toggle("hidden", !show);
  if (show && state.logAutoScroll) {
    liveLog.scrollTop = liveLog.scrollHeight;
  }
}

function clearDropWarningTimer() {
  if (state.dropWarningTimer) {
    clearTimeout(state.dropWarningTimer);
    state.dropWarningTimer = null;
  }
}

function hideDropWarningAlert() {
  clearDropWarningTimer();
  if (!dropWarningAlert) {
    return;
  }
  dropWarningAlert.classList.add("hidden");
  if (dropWarningText) {
    dropWarningText.textContent = "";
  }
}

function showDropWarningAlert(message, options = {}) {
  if (!dropWarningAlert || !dropWarningText) {
    return;
  }
  const text = String(message || "").trim();
  if (!text) {
    hideDropWarningAlert();
    return;
  }
  const { durationMs = 7000, persist = true } = options;
  clearDropWarningTimer();
  dropWarningText.textContent = text;
  dropWarningAlert.classList.remove("hidden");
  if (!persist) {
    state.dropWarningTimer = setTimeout(() => {
      hideDropWarningAlert();
    }, Math.max(1200, Number(durationMs) || 7000));
  }
}

function readToggleState(control) {
  if (!control) {
    return false;
  }
  if (typeof control.selected === "boolean") {
    return control.selected;
  }
  if (typeof control.checked === "boolean") {
    return control.checked;
  }
  const ariaChecked = control.getAttribute("aria-checked");
  if (ariaChecked === "true" || ariaChecked === "false") {
    return ariaChecked === "true";
  }
  return control.hasAttribute("selected") || control.hasAttribute("checked");
}

function isLiveLogNearBottom() {
  if (!liveLog) {
    return true;
  }
  const distanceFromBottom = liveLog.scrollHeight - liveLog.scrollTop - liveLog.clientHeight;
  return distanceFromBottom <= LOG_BOTTOM_THRESHOLD_PX;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateSkippedChip(value) {
  if (!skippedCountChip) {
    return;
  }
  const safeSkipped = Math.max(0, Math.floor(Number(value) || 0));
  const label = auditOnlyEnabled() && !repairOnlyEnabled() ? "Reviewed" : "Skipped";
  skippedCountChip.textContent = `${label}: ${safeSkipped}`;
}

function resetSelectionScanStats() {
  state.selectionScanStats = {
    imagesFound: 0,
    entriesChecked: 0,
    foldersScanned: 0,
  };
  state.selectionDiagnostics = {
    active: false,
    label: "",
    startedAtMs: 0,
    lastLogAtMs: 0,
    lastLoggedEntries: 0,
    lastLoggedImages: 0,
  };
}

function updateSelectionScanStats(partial = {}) {
  state.selectionScanStats = {
    imagesFound: Math.max(0, Number(partial.imagesFound ?? state.selectionScanStats.imagesFound) || 0),
    entriesChecked: Math.max(0, Number(partial.entriesChecked ?? state.selectionScanStats.entriesChecked) || 0),
    foldersScanned: Math.max(0, Number(partial.foldersScanned ?? state.selectionScanStats.foldersScanned) || 0),
  };
}

function formatFolderScanMessage(imagesFound, entriesChecked, foldersScanned) {
  const safeImages = Math.max(0, Math.floor(Number(imagesFound) || 0));
  const safeEntries = Math.max(0, Math.floor(Number(entriesChecked) || 0));
  const safeFolders = Math.max(0, Math.floor(Number(foldersScanned) || 0));
  return `Scanning folder... ${safeImages} image(s) found, ${safeEntries} entries checked in ${safeFolders} folder(s).`;
}

function diagnosticsEnabled() {
  return Boolean(diagnosticsToggle && diagnosticsToggle.checked);
}


function loadDiagnosticsPreference() {
  if (!diagnosticsToggle) {
    return;
  }
  try {
    if (!window.localStorage) {
      diagnosticsToggle.checked = false;
      return;
    }
    diagnosticsToggle.checked = window.localStorage.getItem(DIAGNOSTICS_PREF_KEY) === "1";
  } catch (_) {
    diagnosticsToggle.checked = false;
  }
}

function saveDiagnosticsPreference() {
  if (!diagnosticsToggle) {
    return;
  }
  try {
    if (!window.localStorage) {
      return;
    }
    window.localStorage.setItem(DIAGNOSTICS_PREF_KEY, diagnosticsToggle.checked ? "1" : "0");
  } catch (_) {
    // ignore
  }
}

function loadLastSourceChoice() {
  try {
    if (!window.localStorage) {
      state.lastSourceChoice = "folder";
      return;
    }
    const raw = String(window.localStorage.getItem(LAST_SOURCE_CHOICE_KEY) || "").toLowerCase();
    state.lastSourceChoice = raw === "image" ? "image" : "folder";
  } catch (_) {
    state.lastSourceChoice = "folder";
  }
}

function saveLastSourceChoice(choice) {
  const normalized = String(choice || "").toLowerCase() === "image" ? "image" : "folder";
  state.lastSourceChoice = normalized;
  try {
    if (window.localStorage) {
      window.localStorage.setItem(LAST_SOURCE_CHOICE_KEY, normalized);
    }
  } catch (_) {
    // ignore
  }
}

function setSourceButtonVariant(button, primary) {
  if (!button) {
    return;
  }
  button.classList.toggle("action-primary", Boolean(primary));
  button.classList.toggle("action-secondary", !primary);
}

function beginSelectionDiagnostics(label) {
  state.selectionDiagnostics = {
    active: diagnosticsEnabled(),
    label: String(label || "folder scan"),
    startedAtMs: Date.now(),
    lastLogAtMs: Date.now(),
    lastLoggedEntries: 0,
    lastLoggedImages: 0,
  };
}

function maybeLogSelectionDiagnostics(imagesFound, entriesChecked, foldersScanned) {
  if (!state.selectionDiagnostics.active) {
    return;
  }
  const now = Date.now();
  const elapsedMs = Math.max(1, now - state.selectionDiagnostics.startedAtMs);
  const sinceLastEntries = Math.max(0, entriesChecked - state.selectionDiagnostics.lastLoggedEntries);
  const shouldLog = (
    sinceLastEntries >= 10000
    || now - state.selectionDiagnostics.lastLogAtMs >= 5000
  );
  if (!shouldLog) {
    return;
  }
  const entriesPerSec = entriesChecked > 0 ? (entriesChecked / (elapsedMs / 1000)) : 0;
  const imagesPerSec = imagesFound > 0 ? (imagesFound / (elapsedMs / 1000)) : 0;
  appendLog(
    `${state.selectionDiagnostics.label}: ${imagesFound} images found, ${entriesChecked} entries checked in ${foldersScanned} folders `
    + `(${entriesPerSec.toFixed(1)} entries/s, ${imagesPerSec.toFixed(1)} images/s).`
  );
  state.selectionDiagnostics.lastLogAtMs = now;
  state.selectionDiagnostics.lastLoggedEntries = entriesChecked;
  state.selectionDiagnostics.lastLoggedImages = imagesFound;
}

function finishSelectionDiagnostics(imagesFound, entriesChecked, foldersScanned) {
  const startedAtMs = Number(state.selectionDiagnostics.startedAtMs || 0);
  const elapsedMs = startedAtMs > 0 ? Math.max(0, Date.now() - startedAtMs) : 0;
  const elapsedText = formatElapsed(elapsedMs);
  const summary = `Folder scan complete: ${imagesFound} image(s) found after checking ${entriesChecked} entries in ${foldersScanned} folder(s) over ${elapsedText}.`;
  if (state.selectionDiagnostics.active) {
    const entriesPerSec = elapsedMs > 0 ? (entriesChecked / (elapsedMs / 1000)) : 0;
    const imagesPerSec = elapsedMs > 0 ? (imagesFound / (elapsedMs / 1000)) : 0;
    appendLog(`${summary} Avg ${entriesPerSec.toFixed(1)} entries/s, ${imagesPerSec.toFixed(1)} images/s.`);
  } else {
    appendLog(summary);
  }
  state.selectionDiagnostics.active = false;
  return summary;
}

function updateExportVisibility() {
  if (!exportCard) {
    return;
  }
  const processedCount = Math.max(
    0,
    Number(state.lastProgressCompleted || 0),
    Number(state.currentIndex || 0),
  );
  exportCard.classList.toggle("hidden", processedCount <= 10);
}

function updateProgress(completed, total, skippedCount = null) {
  progressText.classList.remove("hidden");
  progressFill.classList.remove("indeterminate");
  progressFill.style.marginLeft = "0";
  const boundedCompleted = Math.max(0, completed);
  const boundedTotal = Math.max(0, total);
  const ratio = boundedTotal > 0 ? Math.min(1, boundedCompleted / boundedTotal) : 0;
  const percent = Math.round(ratio * 100);
  const resolvedSkipped = skippedCount == null
    ? state.lastSkippedCount
    : Math.max(0, Math.floor(Number(skippedCount) || 0));
  progressText.textContent = `Progress: ${boundedCompleted}/${boundedTotal} (${percent}%)`;
  state.lastProgressCompleted = boundedCompleted;
  state.lastProgressTotal = boundedTotal;
  state.lastSkippedCount = resolvedSkipped;
  updateSkippedChip(resolvedSkipped);
  progressFill.style.width = `${percent}%`;
  const track = progressFill.parentElement;
  if (track) {
    track.setAttribute("aria-valuenow", String(percent));
  }
  updateExportVisibility();
  updateRunEstimateDisplay();
  updateFlowStepper();
}

function setSelectionLoading(active, message = "") {
  state.selectionLoading = Boolean(active);
  if (active) {
    const loadingMessage = message || "Loading selected images...";
    state.selectionLoadingMessage = loadingMessage;
    progressText.classList.add("hidden");
    progressFill.classList.add("indeterminate");
    progressFill.style.marginLeft = "";
    progressFill.style.width = "40%";
    const track = progressFill.parentElement;
    if (track) {
      track.setAttribute("aria-busy", "true");
    }
    setRunEstimateText("Remaining: -- | ETA: --");
    hideStatusToast();
    state.selectionLoadingToastActive = false;
    updateRunControlButton();
    updateFlowStepper();
    return;
  }
  state.selectionLoadingMessage = "";
  progressFill.classList.remove("indeterminate");
  progressFill.style.marginLeft = "0";
  progressText.classList.remove("hidden");
  const track = progressFill.parentElement;
  if (track) {
    track.removeAttribute("aria-busy");
  }
  const completed = Math.max(0, Number(state.lastProgressCompleted || 0));
  const total = Math.max(0, Number(state.lastProgressTotal || 0));
  const ratio = total > 0 ? Math.min(1, completed / total) : 0;
  const percent = Math.round(ratio * 100);
  progressFill.style.width = `${percent}%`;
  if (track) {
    track.setAttribute("aria-valuenow", String(percent));
  }
  hideStatusToast();
  state.selectionLoadingToastActive = false;
  updateRunControlButton();
  updateRunEstimateDisplay();
  updateFlowStepper();
}

function setPreScanLoading(active, message = "", details = null) {
  const enabled = Boolean(active);
  state.preScanLoading = enabled;
  const track = progressFill ? progressFill.parentElement : null;

  if (!enabled) {
    if (progressFill) {
      progressFill.classList.remove("indeterminate");
      progressFill.style.marginLeft = "0";
    }
    if (track) {
      track.removeAttribute("aria-busy");
    }
    setPreviewLoading(false);
    setSkipActivityMessage("");
    updateProgress(state.lastProgressCompleted, state.lastProgressTotal, state.lastSkippedCount);
    updateFlowStepper();
    return;
  }

  const baseMessage = String(message || "Pre-scanning existing metadata...").trim();
  const scanned = details && Number.isFinite(Number(details.scanned))
    ? Math.max(0, Math.floor(Number(details.scanned)))
    : null;
  const total = details && Number.isFinite(Number(details.total))
    ? Math.max(0, Math.floor(Number(details.total)))
    : null;
  const skippable = details && Number.isFinite(Number(details.skippable))
    ? Math.max(0, Math.floor(Number(details.skippable)))
    : null;
  const hasDeterminate = Number.isFinite(scanned) && Number.isFinite(total) && total > 0;
  const text = hasDeterminate
    ? `${baseMessage} ${scanned}/${total} checked, ${skippable || 0} skippable.`
    : baseMessage;

  progressText.classList.remove("hidden");
  progressText.textContent = text;
  setSkipActivityMessage(text);
  setRunEstimateText("Remaining: -- | ETA: --");
  showSkipOverlay("Skipping files already with metadata");

  if (hasDeterminate) {
    const percent = Math.max(0, Math.min(100, Math.round((scanned / total) * 100)));
    progressFill.classList.remove("indeterminate");
    progressFill.style.marginLeft = "0";
    progressFill.style.width = `${percent}%`;
    if (track) {
      track.removeAttribute("aria-busy");
      track.setAttribute("aria-valuenow", String(percent));
    }
    updateFlowStepper();
    return;
  }

  progressFill.classList.add("indeterminate");
  progressFill.style.marginLeft = "";
  progressFill.style.width = "40%";
  if (track) {
    track.setAttribute("aria-busy", "true");
  }
  updateFlowStepper();
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function nowMs() {
  if (typeof performance !== "undefined" && performance && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function waitForUiPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function formatDurationMs(ms) {
  const safe = Math.max(0, Number(ms || 0));
  if (safe < 1000) {
    return `${Math.round(safe)}ms`;
  }
  if (safe < 10000) {
    return `${(safe / 1000).toFixed(1)}s`;
  }
  return `${Math.round(safe / 1000)}s`;
}

function isLikelyServerConnectionError(error) {
  if (!error) {
    return false;
  }
  const name = String(error.name || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();
  if (name === "aborterror" || message.includes("abort")) {
    return false;
  }
  if (name === "typeerror" && (
    message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
    || message.includes("the network connection was lost")
    || message.includes("fetch failed")
  )) {
    return true;
  }
  return false;
}

function setRunElapsed(ms) {
  if (!runElapsedText) {
    return;
  }
  runElapsedText.textContent = `Elapsed: ${formatElapsed(ms)}`;
  updateRunEstimateDisplay();
}

function formatEtaClock(remainingMs) {
  const now = Date.now();
  const eta = new Date(now + Math.max(0, Number(remainingMs || 0)));
  return eta.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function setRunEstimateText(text) {
  if (!etaText) {
    return;
  }
  etaText.textContent = String(text || "Remaining: -- | ETA: --");
}

function updateRunEstimateDisplay() {
  if (!state.processing) {
    setRunEstimateText("Remaining: -- | ETA: --");
    return;
  }

  const total = Math.max(0, Number(state.lastProgressTotal || 0));
  const completed = Math.max(0, Number(state.lastProgressCompleted || 0));
  const remainingItems = Math.max(0, total - completed);
  if (!total || remainingItems <= 0) {
    setRunEstimateText("Remaining: 00:00 | ETA: now");
    return;
  }

  const processedThisRun = Math.max(0, completed - Math.max(0, Number(state.runStartCompletedCount || 0)));
  if (!state.runStartedAtMs || processedThisRun <= 0) {
    setRunEstimateText("Remaining: calculating... | ETA: --");
    return;
  }

  const elapsedMs = Math.max(0, Date.now() - state.runStartedAtMs);
  if (elapsedMs < 1500) {
    setRunEstimateText("Remaining: calculating... | ETA: --");
    return;
  }

  const minSamples = Math.min(40, Math.max(6, Math.ceil(total * 0.005)));
  if (processedThisRun < minSamples && elapsedMs < 180000) {
    setRunEstimateText(`Remaining: calculating... | ETA: -- (warming up ${processedThisRun}/${minSamples})`);
    return;
  }

  const avgPerItemMs = elapsedMs / processedThisRun;
  const remainingMs = Math.max(0, avgPerItemMs * remainingItems);
  setRunEstimateText(`Remaining: ${formatElapsed(remainingMs)} | ETA: ${formatEtaClock(remainingMs)}`);
}

function clearRunElapsedTimer() {
  if (state.runElapsedTimer) {
    clearInterval(state.runElapsedTimer);
    state.runElapsedTimer = null;
  }
}

function startRunElapsedTimer() {
  clearRunElapsedTimer();
  state.runStartedAtMs = Date.now();
  setRunElapsed(0);
  state.runElapsedTimer = setInterval(() => {
    if (!state.runStartedAtMs) {
      setRunElapsed(0);
      return;
    }
    setRunElapsed(Date.now() - state.runStartedAtMs);
  }, 1000);
}

function stopRunElapsedTimer() {
  clearRunElapsedTimer();
  if (state.runStartedAtMs) {
    setRunElapsed(Date.now() - state.runStartedAtMs);
  } else {
    setRunElapsed(0);
  }
  state.runStartedAtMs = 0;
  updateRunEstimateDisplay();
}

function ensureStatusToastElements() {
  if (statusToast && statusToastMessage && statusToastProgressTrack && statusToastProgressFill && statusToastCloseBtn) {
    bindStatusToastCloseButton();
    return true;
  }
  if (!statusToast) {
    statusToast = document.getElementById("statusToast");
  }
  if (!statusToastMessage) {
    statusToastMessage = document.getElementById("statusToastMessage");
  }
  if (!statusToastProgressTrack) {
    statusToastProgressTrack = document.getElementById("statusToastProgressTrack");
  }
  if (!statusToastProgressFill) {
    statusToastProgressFill = document.getElementById("statusToastProgressFill");
  }
  if (!statusToastCloseBtn) {
    statusToastCloseBtn = document.getElementById("statusToastCloseBtn");
  }
  if (statusToast && statusToastMessage && statusToastProgressTrack && statusToastProgressFill && statusToastCloseBtn) {
    bindStatusToastCloseButton();
    return true;
  }
  const body = document.body;
  if (!body) {
    return false;
  }
  if (!statusToast) {
    statusToast = document.createElement("div");
    statusToast.id = "statusToast";
    statusToast.className = "status-toast hidden";
    statusToast.setAttribute("role", "status");
    statusToast.setAttribute("aria-live", "polite");
    statusToast.setAttribute("aria-atomic", "true");
    statusToast.style.cssText = [
      "position:fixed",
      "top:16px",
      "right:16px",
      "z-index:1200",
      "max-width:min(560px,calc(100vw - 32px))",
      "padding:0.65rem 2.8rem 0.8rem 0.8rem",
      "border-radius:10px",
      "border:1px solid #c5d6ee",
      "background:rgba(235,244,255,.98)",
      "color:#10345a",
      "box-shadow:0 10px 26px rgba(16,42,67,.2),0 2px 10px rgba(16,42,67,.15)",
      "font-size:.9rem",
      "font-weight:500",
      "line-height:1.35",
    ].join(";");
    body.appendChild(statusToast);
  }
  if (!statusToastCloseBtn) {
    statusToastCloseBtn = document.createElement("md-icon-button");
    statusToastCloseBtn.id = "statusToastCloseBtn";
    statusToastCloseBtn.className = "status-toast-close";
    statusToastCloseBtn.setAttribute("type", "button");
    statusToastCloseBtn.setAttribute("aria-label", "Dismiss alert");
    const icon = document.createElement("span");
    icon.className = "material-icons";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "close";
    statusToastCloseBtn.appendChild(icon);
    statusToast.appendChild(statusToastCloseBtn);
  }
  if (!statusToastMessage) {
    statusToastMessage = document.createElement("span");
    statusToastMessage.id = "statusToastMessage";
    statusToast.appendChild(statusToastMessage);
  }
  if (!statusToastProgressTrack) {
    statusToastProgressTrack = document.createElement("div");
    statusToastProgressTrack.id = "statusToastProgressTrack";
    statusToastProgressTrack.className = "status-toast-progress progress-track hidden";
    statusToastProgressTrack.setAttribute("role", "progressbar");
    statusToastProgressTrack.setAttribute("aria-label", "Status toast progress");
    statusToastProgressTrack.setAttribute("aria-valuemin", "0");
    statusToastProgressTrack.setAttribute("aria-valuemax", "100");
    statusToastProgressTrack.setAttribute("aria-valuetext", "Loading");
    statusToast.appendChild(statusToastProgressTrack);
  }
  if (!statusToastProgressFill) {
    statusToastProgressFill = document.createElement("div");
    statusToastProgressFill.id = "statusToastProgressFill";
    statusToastProgressFill.className = "status-toast-progress-fill progress-fill";
    statusToastProgressTrack.appendChild(statusToastProgressFill);
  }
  bindStatusToastCloseButton();
  return true;
}

function clearStatusToastTimer() {
  if (state.statusToastTimer) {
    clearTimeout(state.statusToastTimer);
    state.statusToastTimer = null;
  }
}

function hideInlineStatusAlert() {
  if (!inlineStatusAlert) {
    return;
  }
  inlineStatusAlert.classList.add("hidden");
  inlineStatusAlert.classList.remove("error", "warn", "success");
  if (inlineStatusMessage) {
    inlineStatusMessage.textContent = "";
  }
}

function showInlineStatusAlert(message, tone = "") {
  if (!inlineStatusAlert || !inlineStatusMessage) {
    return;
  }
  inlineStatusMessage.textContent = String(message || "").trim();
  inlineStatusAlert.classList.remove("error", "warn", "success", "hidden");
  if (tone === "error" || tone === "warn" || tone === "success") {
    inlineStatusAlert.classList.add(tone);
  }
}

function bindStatusToastCloseButton() {
  if (!statusToastCloseBtn || statusToastCloseBtn.dataset.bound === "true") {
    return;
  }
  statusToastCloseBtn.addEventListener("click", (event) => {
    event.preventDefault();
    hideStatusToast();
  });
  statusToastCloseBtn.dataset.bound = "true";
}

function hideStatusToast() {
  clearStatusToastTimer();
  if (!ensureStatusToastElements() || !statusToast) {
    return;
  }
  statusToast.classList.add("hidden");
  statusToast.classList.remove("error", "warn");
  if (statusToastMessage) {
    statusToastMessage.textContent = "";
  }
  if (statusToastProgressTrack) {
    statusToastProgressTrack.classList.add("hidden");
    statusToastProgressTrack.removeAttribute("aria-busy");
  }
  if (statusToastProgressFill) {
    statusToastProgressFill.classList.remove("indeterminate");
    statusToastProgressFill.style.width = "0%";
    statusToastProgressFill.style.marginLeft = "0";
  }
}

function isAbortLikeError(error) {
  const name = String(error && error.name ? error.name : "");
  const message = String(error && error.message ? error.message : "");
  return name === "AbortError" || /aborted|canceled|cancelled/i.test(message);
}

function classifyStatusToastTone(text) {
  const value = String(text || "").toLowerCase();
  if (!value) {
    return "";
  }
  if (/^done\b/.test(value)) {
    return "success";
  }
  if (/error|failed|denied|could not|crashed|invalid|unsupported/.test(value)) {
    return "error";
  }
  if (/warn|warning/.test(value)) {
    return "warn";
  }
  return "";
}

function showStatusToast(message, options = {}) {
  if (!ensureStatusToastElements() || !statusToast || !statusToastMessage) {
    return;
  }
  const text = String(message || "").trim();
  if (!text) {
    hideStatusToast();
    return;
  }
  const {
    persist = false,
    durationMs = 5000,
    indeterminate = false,
    progressPercent = null,
  } = options;
  clearStatusToastTimer();
  statusToastMessage.textContent = text;
  if (statusToastProgressTrack && statusToastProgressFill) {
    const hasDeterminateProgress = (
      progressPercent !== null
      && progressPercent !== undefined
      && progressPercent !== ""
      && Number.isFinite(Number(progressPercent))
    );
    const boundedProgress = hasDeterminateProgress
      ? Math.max(0, Math.min(100, Number(progressPercent)))
      : 0;
    statusToastProgressTrack.classList.toggle("hidden", !(indeterminate || hasDeterminateProgress));
    if (indeterminate) {
      statusToastProgressTrack.setAttribute("aria-busy", "true");
      statusToastProgressTrack.removeAttribute("aria-valuenow");
      statusToastProgressFill.classList.add("indeterminate");
      statusToastProgressFill.style.width = "40%";
      statusToastProgressFill.style.marginLeft = "";
    } else if (hasDeterminateProgress) {
      statusToastProgressTrack.removeAttribute("aria-busy");
      statusToastProgressTrack.setAttribute("aria-valuenow", String(Math.round(boundedProgress)));
      statusToastProgressFill.classList.remove("indeterminate");
      statusToastProgressFill.style.width = `${boundedProgress}%`;
      statusToastProgressFill.style.marginLeft = "0";
    } else {
      statusToastProgressTrack.removeAttribute("aria-busy");
      statusToastProgressTrack.removeAttribute("aria-valuenow");
      statusToastProgressFill.classList.remove("indeterminate");
      statusToastProgressFill.style.width = "0%";
      statusToastProgressFill.style.marginLeft = "0";
    }
  }
  const tone = classifyStatusToastTone(text);
  statusToast.classList.remove("error", "warn");
  if (tone) {
    statusToast.classList.add(tone);
  }
  statusToast.classList.remove("hidden");
  if (!persist) {
    state.statusToastTimer = setTimeout(() => {
      hideStatusToast();
    }, Math.max(1000, Number(durationMs) || 5000));
  }
}

function setStatus(message, options = {}) {
  const {
    log = true,
    toast = true,
    persistToast = state.processing,
    toastDurationMs = 5000,
    clearToast = false,
    allowDuringSelectionLoading = false,
    allowProcessingToast = false,
  } = options;
  const text = String(message || "").trim();
  if (statusText) {
    statusText.textContent = text;
    statusText.title = text;
  }
  if (log && text) {
    appendLog(text);
  }
  if (clearToast || !text) {
    hideInlineStatusAlert();
    hideStatusToast();
    return;
  }
  const tone = classifyStatusToastTone(text);
  if (tone === "error" || tone === "warn" || tone === "success") {
    showInlineStatusAlert(text, tone);
    hideStatusToast();
    return;
  }
  hideInlineStatusAlert();
  let shouldToast = Boolean(toast && (!state.selectionLoading || allowDuringSelectionLoading));
  if (shouldToast && state.processing && !allowProcessingToast) {
    shouldToast = false;
  }
  if (shouldToast) {
    showStatusToast(text, { persist: Boolean(persistToast), durationMs: toastDurationMs });
  } else {
    hideStatusToast();
  }
}

function setResumeBanner(message = "") {
  if (!resumeBanner) {
    return;
  }
  const text = String(message || "").trim();
  resumeBanner.textContent = text;
  resumeBanner.classList.toggle("hidden", !text);
}

function setResumeDetails(message = "") {
  if (!resumeDetails) {
    return;
  }
  const text = String(message || "").trim();
  resumeDetails.textContent = text;
  resumeDetails.classList.toggle("hidden", !text);
}

function setRunStateMessage(message = "") {
  if (!runStateText) {
    return;
  }
  const text = String(message || "").trim();
  runStateText.textContent = text;
  runStateText.classList.toggle("hidden", !text);
  updateRunStatusBadge();
}

function currentMetadataInputSnapshot() {
  const current = normalizeMetadata(state.currentMetadata);
  const description = metaDescriptionEdit ? String(metaDescriptionEdit.value || "").trim() : current.description;
  return {
    description,
    objects: cleanObjectsAgainstDescription(
      metaObjectsEdit ? parseCommaList(metaObjectsEdit.value) : current.objects,
      description,
    ),
    actions: metaActionsEdit ? parseCommaList(metaActionsEdit.value) : current.actions,
    custom_tags: metaCustomTagsEdit ? parseCommaList(metaCustomTagsEdit.value) : current.custom_tags,
    categories: metaCategoriesEdit ? parseCommaList(metaCategoriesEdit.value) : current.categories,
    colors: metaColorsEdit ? parseColorList(metaColorsEdit.value, current.colors) : current.colors,
  };
}

function updateMetadataDirtyState() {
  const current = normalizeMetadata(state.currentMetadata);
  const baseline = {
    description: current.description,
    objects: current.objects,
    actions: current.actions,
    custom_tags: current.custom_tags,
    categories: current.categories,
    colors: current.colors,
  };
  state.metadataDirty = JSON.stringify(currentMetadataInputSnapshot()) !== JSON.stringify(baseline);
  if (confirmAddBtn) {
    confirmAddBtn.classList.toggle("action-primary", Boolean(state.confirmControlsActive || state.metadataDirty));
  }
  updateRunControlButton();
}

function updateSourceSummary() {
  if (!sourceSummaryText) {
    return;
  }
  const selectionLabel = String(state.selectedLabel || "").trim();
  if (!state.items.length && !selectionLabel) {
    sourceSummaryText.textContent = "No source selected yet.";
    return;
  }

  const resolvedLabel = selectionLabel || (state.items.length === 1 ? "Image selected" : "Folder selected");
  const safeLabel = escapeHtml(resolvedLabel);
  const setSummaryHtml = (suffix) => {
    sourceSummaryText.innerHTML = `Selected: <strong>${safeLabel}</strong>${suffix}`;
  };
  if (state.selectionLoading && (state.sourceMode === "local" || state.sourceMode === "handle")) {
    setSummaryHtml(".");
    return;
  }
  if (state.items.length === 1) {
    setSummaryHtml(". 1 image ready.");
    return;
  }

  if (state.sourceMode === "local") {
    setSummaryHtml(`. ${state.items.length} images ready for local processing.`);
    return;
  }

  const writable = countWritableHandleItems();
  if (writable === state.items.length) {
    setSummaryHtml(`. ${state.items.length} images ready with in-place write access.`);
    return;
  }
  setSummaryHtml(`. ${state.items.length} images ready; ${writable} can be written in-place.`);
}

function updateRunStatusBadge() {
  if (!runStatusBadge) {
    return;
  }
  let label = "Idle";
  let className = "status-idle";
  if (state.pendingConfirm) {
    label = "Waiting for Review";
    className = "status-review";
  } else if (state.metadataDirty) {
    label = "Unsaved Changes";
    className = "status-review";
  } else if (state.processing) {
    label = "Processing";
    className = "status-processing";
  } else if (state.selectionLoading || state.preScanLoading) {
    label = "Loading";
    className = "status-loading";
  } else if (state.items.length || (autoResumeEnabled() && loadRunCheckpoint())) {
    label = "Ready";
    className = "status-ready";
  }
  runStatusBadge.textContent = label;
  runStatusBadge.className = `run-status-badge ${className}`;
}

function updateRestartButton() {
  if (!restartBtn) {
    return;
  }
  const show = Boolean(!state.processing && state.resumeNextIndex > 0 && state.items.length);
  restartBtn.classList.toggle("hidden", !show);
  restartBtn.disabled = Boolean(state.pickerBusy || state.selectionLoading || state.metadataDirty || !show);
  restartBtn.setAttribute("aria-disabled", restartBtn.disabled ? "true" : "false");
}

function updateRemoveOnlyDangerUi() {
  const enabled = Boolean(removeOnlyToggle && removeOnlyToggle.checked);
  if (removeOnlyOptionRow) {
    removeOnlyOptionRow.classList.toggle("active", enabled);
  }
  if (removeOnlyWarning) {
    removeOnlyWarning.classList.toggle("hidden", !enabled);
  }
}

function updateOptionGroupSummaries() {
  const groups = document.querySelectorAll(".option-group");
  if (!groups || !groups.length) {
    return;
  }
  groups.forEach((group) => {
    if (!(group instanceof HTMLElement)) {
      return;
    }
    const summaryEnabled = group.querySelector(".summary-enabled");
    if (!summaryEnabled) {
      return;
    }
    const enabledTitles = [];
    const inputs = group.querySelectorAll(".option-toggle");
    inputs.forEach((input) => {
      if (!(input instanceof HTMLElement) || !("checked" in input) || !input.checked) {
        return;
      }
      const row = input.closest(".option-row");
      const titleEl = row ? row.querySelector(".option-title") : null;
      const title = String(titleEl ? titleEl.textContent : "").trim();
      if (title) {
        enabledTitles.push(title);
      }
    });

    if (!enabledTitles.length) {
      summaryEnabled.textContent = "(none enabled)";
      return;
    }
    if (enabledTitles.length <= 2) {
      summaryEnabled.textContent = `Enabled: ${enabledTitles.join(", ")}`;
      return;
    }
    const remaining = enabledTitles.length - 2;
    summaryEnabled.textContent = `Enabled: ${enabledTitles[0]}, ${enabledTitles[1]} +${remaining}`;
  });
}

function setOptionGroupExpanded(group, expanded) {
  if (!(group instanceof HTMLElement)) {
    return;
  }
  const isOpen = Boolean(expanded);
  group.classList.toggle("is-open", isOpen);
  const summaryBtn = group.querySelector(".option-group-summary");
  if (summaryBtn instanceof HTMLElement) {
    summaryBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
  const panel = group.querySelector(".option-group-body");
  if (panel instanceof HTMLElement) {
    panel.hidden = !isOpen;
  }
}

function initializeOptionAccordions() {
  const groups = document.querySelectorAll(".option-group");
  if (!groups || !groups.length) {
    return;
  }
  groups.forEach((group) => {
    if (!(group instanceof HTMLElement)) {
      return;
    }
    const summaryBtn = group.querySelector(".option-group-summary");
    if (!(summaryBtn instanceof HTMLElement)) {
      return;
    }
    setOptionGroupExpanded(group, group.classList.contains("is-open"));
    summaryBtn.addEventListener("click", () => {
      setOptionGroupExpanded(group, !group.classList.contains("is-open"));
      updateOptionGroupSummaries();
    });
  });
}

function setElementVisibility(element, visible) {
  if (!element) {
    return;
  }
  element.classList.toggle("hidden", !Boolean(visible));
}

function applySourceButtonVisibilityForBrowser() {
  const supportsFolderPicker = typeof window.showDirectoryPicker === "function";
  const supportsImagePicker = typeof window.showOpenFilePicker === "function";

  // Folder selection path: prefer browser picker when available, otherwise local dialog.
  setElementVisibility(selectFolderBtn, supportsFolderPicker);
  setElementVisibility(serverFolderBtn, !supportsFolderPicker);

  // Single-image path: prefer browser picker when available, otherwise local dialog.
  setElementVisibility(selectImageBtn, supportsImagePicker);
  setElementVisibility(serverImageBtn, !supportsImagePicker);
}

function setSkipActivityMessage(message = "") {
  if (!skipActivityText) {
    return;
  }
  const text = String(message || "").trim();
  skipActivityText.textContent = text;
  skipActivityText.classList.toggle("hidden", !text);
}

function extensionOf(name) {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx);
}

function isSupportedName(name) {
  return SUPPORTED_EXTENSIONS.has(extensionOf(name));
}

function isSupportedFile(file) {
  if (!file) {
    return false;
  }
  const name = typeof file.name === "string" ? file.name : "";
  if (isSupportedName(name)) {
    return true;
  }
  const mime = String(file.type || "").toLowerCase();
  return mime.startsWith("image/");
}

function createRunId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampInteger(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function defaultRunStats() {
  return { added: 0, skipped: 0, failed: 0 };
}

function normalizeRunStats(stats) {
  const input = stats && typeof stats === "object" ? stats : {};
  return {
    added: clampInteger(input.added, 0, 1000000),
    skipped: clampInteger(input.skipped, 0, 1000000),
    failed: clampInteger(input.failed, 0, 1000000),
  };
}

function itemCheckpointKey(item, index = 0) {
  if (item && Number.isFinite(Number(item.localIndex))) {
    return `local:${Number(item.localIndex)}:${String(item.relativePath || item.name || index).toLowerCase()}`;
  }
  return String(item && (item.relativePath || item.name) ? (item.relativePath || item.name) : `item-${index}`).toLowerCase();
}

function fnv1aHashStep(hash, text) {
  let h = hash >>> 0;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildSelectionFingerprint(items = state.items, sourceMode = state.sourceMode) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }
  let hash = 2166136261;
  hash = fnv1aHashStep(hash, String(sourceMode || "none"));
  hash = fnv1aHashStep(hash, "|");
  for (let i = 0; i < items.length; i += 1) {
    hash = fnv1aHashStep(hash, itemCheckpointKey(items[i], i));
    hash = fnv1aHashStep(hash, "|");
  }
  return `${String(sourceMode || "none")}:${items.length}:${(hash >>> 0).toString(16)}`;
}

function buildSelectionPathSetFingerprint(items = state.items, sourceMode = state.sourceMode) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }
  const keys = items.map((item, index) => itemCheckpointKey(item, index)).sort();
  let hash = 2166136261;
  hash = fnv1aHashStep(hash, String(sourceMode || "none"));
  hash = fnv1aHashStep(hash, "|");
  for (const key of keys) {
    hash = fnv1aHashStep(hash, key);
    hash = fnv1aHashStep(hash, "|");
  }
  return `${String(sourceMode || "none")}:${keys.length}:${(hash >>> 0).toString(16)}`;
}

function saveRunCheckpoint(payload) {
  try {
    if (!window.localStorage) {
      return;
    }
    window.localStorage.setItem(RUN_CHECKPOINT_KEY, JSON.stringify(payload));
  } catch (error) {
    try {
      const msg = error && error.message ? error.message : String(error || "");
      appendLog(`Checkpoint save skipped: ${msg || "storage unavailable"}`);
    } catch (_) {
      // ignore
    }
    // Ignore storage failures (private mode/quota).
  }
}

function autoResumeEnabled() {
  return Boolean(autoResumeToggle && autoResumeToggle.checked);
}

function loadAutoResumePreference() {
  if (!autoResumeToggle) {
    return;
  }
  try {
    if (!window.localStorage) {
      autoResumeToggle.checked = true;
      return;
    }
    const raw = window.localStorage.getItem(AUTO_RESUME_PREF_KEY);
    if (raw === null) {
      autoResumeToggle.checked = true;
      return;
    }
    autoResumeToggle.checked = raw !== "0";
  } catch (_) {
    autoResumeToggle.checked = true;
  }
}

function saveAutoResumePreference() {
  if (!autoResumeToggle) {
    return;
  }
  try {
    if (!window.localStorage) {
      return;
    }
    window.localStorage.setItem(AUTO_RESUME_PREF_KEY, autoResumeToggle.checked ? "1" : "0");
  } catch (_) {
    // ignore
  }
}

function openHandleResumeDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = window.indexedDB.open(HANDLE_RESUME_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_RESUME_STORE_NAME)) {
        db.createObjectStore(HANDLE_RESUME_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open resume DB"));
  });
}

async function saveHandleResumeState(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  let db = null;
  try {
    db = await openHandleResumeDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_RESUME_STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Failed to store resume state"));
      tx.objectStore(HANDLE_RESUME_STORE_NAME).put(payload, HANDLE_RESUME_KEY);
    });
  } catch (error) {
    appendLog(`Handle resume state save skipped: ${error.message}`);
  } finally {
    if (db) {
      db.close();
    }
  }
}

async function clearHandleResumeState() {
  let db = null;
  try {
    db = await openHandleResumeDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_RESUME_STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Failed to clear resume state"));
      tx.objectStore(HANDLE_RESUME_STORE_NAME).delete(HANDLE_RESUME_KEY);
    });
  } catch (_) {
    // ignore
  } finally {
    if (db) {
      db.close();
    }
  }
}

async function loadHandleResumeState() {
  let db = null;
  try {
    db = await openHandleResumeDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_RESUME_STORE_NAME, "readonly");
      tx.onerror = () => reject(tx.error || new Error("Failed to read resume state"));
      const request = tx.objectStore(HANDLE_RESUME_STORE_NAME).get(HANDLE_RESUME_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Failed to read resume state"));
    });
  } catch (_) {
    return null;
  } finally {
    if (db) {
      db.close();
    }
  }
}

async function computeHandleWritePermission(items) {
  if (!Array.isArray(items) || !items.length) {
    return false;
  }
  const handleItems = items.filter((item) => Boolean(item && item.fileHandle));
  if (handleItems.length !== items.length) {
    return false;
  }
  for (const item of handleItems) {
    try {
      const perm = await item.fileHandle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        return false;
      }
    } catch (_) {
      return false;
    }
  }
  return true;
}

async function persistHandleResumeStateFromCurrentSelection(mode = "files", options = {}) {
  if (state.sourceMode !== "handle" || !state.items.length) {
    return;
  }
  const selectedLabel = String(options.selectedLabel || state.selectedLabel || "");
  if (mode === "directory" && options.directoryHandle) {
    await saveHandleResumeState({
      version: 1,
      source_mode: "handle",
      selection_mode: "directory",
      selected_label: selectedLabel,
      saved_at: Date.now(),
      directory_handle: options.directoryHandle,
    });
    return;
  }

  const persistedItems = state.items
    .filter((item) => Boolean(item && item.fileHandle))
    .map((item) => ({
      name: String(item.name || ""),
      relative_path: String(item.relativePath || item.name || ""),
      file_handle: item.fileHandle,
    }));
  if (!persistedItems.length) {
    await clearHandleResumeState();
    return;
  }
  await saveHandleResumeState({
    version: 1,
    source_mode: "handle",
    selection_mode: "files",
    selected_label: selectedLabel,
    saved_at: Date.now(),
    items: persistedItems,
  });
}

function clearRunCheckpoint() {
  try {
    if (!window.localStorage) {
      setResumeBanner("");
      setResumeDetails("");
      return;
    }
    window.localStorage.removeItem(RUN_CHECKPOINT_KEY);
  } catch (_) {
    // Ignore storage failures.
  }
  setResumeBanner("");
  setResumeDetails("");
}

function loadRunCheckpoint() {
  try {
    if (!window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(RUN_CHECKPOINT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      clearRunCheckpoint();
      return null;
    }
    const updatedAt = Number(parsed.updated_at);
    if (Number.isFinite(updatedAt) && (Date.now() - updatedAt) > RUN_CHECKPOINT_MAX_AGE_MS) {
      clearRunCheckpoint();
      return null;
    }
    return parsed;
  } catch (_) {
    clearRunCheckpoint();
    return null;
  }
}

function stageLikelyCompletedCurrentItem(stage) {
  const value = String(stage || "").trim().toLowerCase();
  if (!value) {
    return false;
  }
  return new Set([
    "written",
    "skipped",
    "skipped-existing",
    "skipped-existing-prescan",
    "repair-nochange",
    "audited",
    "error",
    "checked-fixed",
  ]).has(value);
}

function resolveCheckpointResumeIndex(checkpoint, total) {
  const clampedTotal = Math.max(0, Number(total || 0));
  const fallbackIndex = clampInteger(checkpoint && checkpoint.next_index, 0, clampedTotal);
  const currentPath = String(checkpoint && checkpoint.current_item ? checkpoint.current_item : "").trim().toLowerCase();
  const orderedFingerprint = buildSelectionFingerprint(state.items, state.sourceMode);
  const checkpointOrdered = String(checkpoint && checkpoint.selection_fingerprint ? checkpoint.selection_fingerprint : "");
  if (orderedFingerprint && checkpointOrdered && orderedFingerprint === checkpointOrdered) {
    return {
      matched: true,
      nextIndex: fallbackIndex,
      matchType: "ordered",
    };
  }

  const setFingerprint = buildSelectionPathSetFingerprint(state.items, state.sourceMode);
  const checkpointSet = String(checkpoint && checkpoint.selection_pathset_fingerprint ? checkpoint.selection_pathset_fingerprint : "");
  if (setFingerprint && checkpointSet && setFingerprint === checkpointSet) {
    if (currentPath) {
      const currentIndex = state.items.findIndex((item, index) => itemCheckpointKey(item, index) === currentPath);
      if (currentIndex >= 0) {
        const derived = stageLikelyCompletedCurrentItem(checkpoint.stage) ? (currentIndex + 1) : currentIndex;
        const safeDerived = clampInteger(derived, 0, clampedTotal);
        const closeEnough = Math.abs(fallbackIndex - safeDerived) <= 1;
        return {
          matched: true,
          nextIndex: closeEnough ? fallbackIndex : safeDerived,
          matchType: "pathset+current-item",
        };
      }
    }
    return {
      matched: true,
      nextIndex: fallbackIndex,
      matchType: "pathset",
    };
  }

  if (currentPath) {
    const currentIndex = state.items.findIndex((item, index) => itemCheckpointKey(item, index) === currentPath);
    if (currentIndex >= 0) {
      const derived = stageLikelyCompletedCurrentItem(checkpoint.stage) ? (currentIndex + 1) : currentIndex;
      const safeDerived = clampInteger(derived, 0, clampedTotal);
      const checkpointTotal = clampInteger(checkpoint && checkpoint.total, 0, 1000000);
      const sameTotal = checkpointTotal > 0 && checkpointTotal === clampedTotal;
      const closeEnough = Math.abs(fallbackIndex - safeDerived) <= 2;
      if (sameTotal || closeEnough) {
        return {
          matched: true,
          nextIndex: closeEnough ? fallbackIndex : safeDerived,
          matchType: "current-item-fallback",
        };
      }
    }
  }

  return {
    matched: false,
    nextIndex: 0,
    matchType: "none",
  };
}

function selectedCaptionModel() {
  const totalItems = Math.max(0, Number(state.items && state.items.length) || 0);
  const fastMode = Boolean(fastModeToggle && fastModeToggle.checked);
  const highRecall = Boolean(highRecallToggle && highRecallToggle.checked);
  if (fastMode || totalItems >= 250) {
    return DEFAULT_CAPTION_MODEL;
  }
  if (highRecall || (totalItems > 0 && totalItems <= 25)) {
    return "Salesforce/blip-image-captioning-large";
  }
  return DEFAULT_CAPTION_MODEL;
}

function selectedDetectorModel() {
  if (removeOnlyEnabled() || repairOnlyEnabled() || auditOnlyEnabled()) {
    return DETECTOR_DISABLED_MODEL;
  }
  const totalItems = Math.max(0, Number(state.items && state.items.length) || 0);
  const fastMode = Boolean(fastModeToggle && fastModeToggle.checked);
  const highRecall = Boolean(highRecallToggle && highRecallToggle.checked);
  if (highRecall || (totalItems > 0 && totalItems <= 25 && !fastMode)) {
    return "google/owlvit-large-patch14";
  }
  return DEFAULT_DETECTOR_MODEL;
}

function buildRunCheckpointSnapshot(options = {}) {
  const total = Array.isArray(state.items) ? state.items.length : 0;
  const nextIndex = clampInteger(options.nextIndex ?? 0, 0, Math.max(0, total));
  const stats = normalizeRunStats(options.stats || defaultRunStats());
  return {
    version: 1,
    source_mode: String(state.sourceMode || "none"),
    selection_fingerprint: buildSelectionFingerprint(state.items, state.sourceMode),
    selection_pathset_fingerprint: buildSelectionPathSetFingerprint(state.items, state.sourceMode),
    total,
    next_index: nextIndex,
    stats,
    stage: String(options.stage || state.currentStage || "idle"),
    status: String(options.status || "running"),
    run_id: String(state.runId || ""),
    current_item: String(options.currentItem || (state.currentItem && state.currentItem.relativePath) || ""),
    selected_label: String(state.selectedLabel || ""),
    options: {
      auto_apply: Boolean(autoApplyToggle && autoApplyToggle.checked),
      skip_existing_keywords: Boolean(skipExistingToggle && skipExistingToggle.checked),
      high_recall: Boolean(highRecallToggle && highRecallToggle.checked),
      metadata_check: Boolean(checkMetadataToggle && checkMetadataToggle.checked),
      repair_only: Boolean(repairOnlyToggle && repairOnlyToggle.checked),
      audit_only: Boolean(auditOnlyToggle && auditOnlyToggle.checked),
      remove_only: Boolean(removeOnlyToggle && removeOnlyToggle.checked),
      duplicate_detection: Boolean(detectDuplicatesToggle && detectDuplicatesToggle.checked),
      ip_risk_check: Boolean(ipRiskToggle && ipRiskToggle.checked),
      caption_model: selectedCaptionModel(),
      detector_model: selectedDetectorModel(),
      auto_resume: autoResumeEnabled(),
    },
    error: options.error ? String(options.error) : "",
    updated_at: Date.now(),
  };
}

function persistRunCheckpointSnapshot(options = {}) {
  if (!state.items.length || !autoResumeEnabled()) {
    return;
  }
  saveRunCheckpoint(buildRunCheckpointSnapshot(options));
}

function applyCheckpointToCurrentSelection(options = {}) {
  const { announce = true } = options;
  state.resumeNextIndex = 0;
  state.resumeStats = defaultRunStats();
  if (!autoResumeEnabled()) {
    setResumeBanner("");
    setResumeDetails("");
    return false;
  }
  const checkpoint = loadRunCheckpoint();
  if (!checkpoint || !state.items.length) {
    return false;
  }
  if (String(checkpoint.source_mode || "") !== String(state.sourceMode || "")) {
    appendLog("Checkpoint source mode does not match current selection.");
    return false;
  }
  const total = state.items.length;
  const resolved = resolveCheckpointResumeIndex(checkpoint, total);
  if (!resolved.matched) {
    appendLog("Checkpoint selection did not match current selection.");
    return false;
  }
  const nextIndex = clampInteger(resolved.nextIndex, 0, total);
  if (nextIndex >= total) {
    clearRunCheckpoint();
    setResumeBanner("");
    setResumeDetails("");
    return false;
  }
  state.resumeNextIndex = nextIndex;
  state.resumeStats = normalizeRunStats(checkpoint.stats);
  updateProgress(nextIndex, total, state.resumeStats.skipped);
  setResumeBanner(`Resume available at image ${nextIndex} out of ${total} images. Click Start Processing to continue.`);
  const updatedAt = Number(checkpoint.updated_at);
  const updatedText = Number.isFinite(updatedAt) ? new Date(updatedAt).toLocaleString() : "unknown";
  const nextItem = String(checkpoint.current_item || (state.items[nextIndex] && state.items[nextIndex].relativePath) || "unknown");
  const sourceMode = String(checkpoint.source_mode || state.sourceMode || "unknown");
  setResumeDetails(`Source: ${sourceMode} | Updated: ${updatedText} | Next: ${nextItem} | Match: ${resolved.matchType}`);
  if (announce && (nextIndex > 0 || String(checkpoint.status || "") === "crashed")) {
    appendLog(`Resume checkpoint found: ${nextIndex}/${total} completed.`);
    setStatus(`Resume available at image ${nextIndex} out of ${total} images. Click Start Processing to continue.`);
  }
  return true;
}

function maybeRestoreRunCheckpointForSelection() {
  const restored = applyCheckpointToCurrentSelection({ announce: true });
  if (!restored) {
    state.resumeNextIndex = 0;
    state.resumeStats = defaultRunStats();
    updateProgress(0, state.items.length, 0);
    setResumeBanner("");
    setResumeDetails("");
  }
  return restored;
}

function updateSelectionInfo() {
  updateSourceSummary();
  if (!selectionInfo) {
    updateRunControlButton();
    updateFlowStepper();
    return;
  }
  if (state.selectionLoading && (state.sourceMode === "local" || state.sourceMode === "handle")) {
    selectionInfo.textContent = state.selectionLoadingMessage || formatFolderScanMessage(
      state.selectionScanStats.imagesFound,
      state.selectionScanStats.entriesChecked,
      state.selectionScanStats.foldersScanned,
    );
    updateRunControlButton();
    updateFlowStepper();
    return;
  }

  if (!state.items.length) {
    if (state.allItems.length > 0) {
      selectionInfo.textContent = `Queue filter returned 0/${state.allItems.length} files. Clear filter to restore selection.`;
    } else {
      selectionInfo.textContent = "No folder or image selected.";
    }
    updateRunControlButton();
    updateProgress(0, 0, 0);
    updateFlowStepper();
    return;
  }

  if (state.sourceMode === "local") {
    selectionInfo.textContent = `Selected ${state.items.length} image(s). Metadata will be written directly by local server.`;
  } else {
    const writable = state.items.filter((item) => Boolean(item.fileHandle)).length;
    if (writable === state.items.length) {
      selectionInfo.textContent = `Selected ${state.items.length} image(s). Files will be updated in-place after confirmation.`;
    } else {
      selectionInfo.textContent = `Selected ${state.items.length} image(s). ${writable} can be written in-place. Re-select with Select Image/Folder for full in-place write access.`;
    }
  }
  if (state.allItems.length > state.items.length) {
    selectionInfo.textContent += ` Filtered queue: ${state.items.length}/${state.allItems.length}.`;
  }
  if (removeOnlyEnabled()) {
    selectionInfo.textContent += " Remove-metadata mode is enabled (batch metadata removal).";
  } else if (auditOnlyEnabled()) {
    selectionInfo.textContent += " Audit mode is enabled (no writes).";
  } else if (repairOnlyEnabled()) {
    selectionInfo.textContent += " Repair-only mode is enabled (no full analysis).";
  }
  if (ipRiskCheckEnabled()) {
    selectionInfo.textContent += " Copyright/IP risk flagging is enabled.";
  }
  updateRunControlButton();
  updateFlowStepper();
}

function updateRunControlButton() {
  if (!startBtn) {
    return;
  }
  const hasSelectedSource = Boolean(state.items.length || state.localSessionId || (autoResumeEnabled() && loadRunCheckpoint()));
  if (state.processing) {
    startBtn.disabled = false;
    startBtn.setAttribute("aria-disabled", "false");
    startBtn.textContent = "Stop Processing";
    startBtn.setAttribute("aria-label", "Stop Processing");
    startBtn.classList.add("danger");
    startBtn.classList.add("action-primary");
    startBtn.classList.remove("action-secondary");
    updateSourceButtonHierarchy(true);
    updateRunStatusBadge();
    updateRestartButton();
    return;
  }
  const disabled = Boolean(state.pickerBusy || state.selectionLoading || state.metadataDirty || !hasSelectedSource);
  startBtn.disabled = disabled;
  startBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
  startBtn.textContent = "Start Processing";
  startBtn.setAttribute("aria-label", "Start Processing");
  startBtn.classList.remove("danger");
  startBtn.classList.toggle("action-primary", hasSelectedSource && !disabled);
  startBtn.classList.toggle("action-secondary", !hasSelectedSource || disabled);
  updateSourceButtonHierarchy(hasSelectedSource);
  updateRunStatusBadge();
  updateRestartButton();
}

function updateSourceButtonHierarchy(hasSelectedSource) {
  const selected = Boolean(hasSelectedSource);
  const preferImage = !selected && state.lastSourceChoice === "image";
  setSourceButtonVariant(selectFolderBtn, !selected && !preferImage);
  setSourceButtonVariant(serverFolderBtn, !selected && !preferImage);
  setSourceButtonVariant(selectImageBtn, !selected && preferImage);
  setSourceButtonVariant(serverImageBtn, !selected && preferImage);
}

function countWritableHandleItems() {
  if (!Array.isArray(state.items) || !state.items.length) {
    return 0;
  }
  return state.items.filter((item) => Boolean(item && item.fileHandle)).length;
}

function setSourceButtonBlockedState(button, blocked, visuallyDisabled) {
  if (!button) {
    return;
  }
  button.disabled = Boolean(blocked && visuallyDisabled);
  if (visuallyDisabled) {
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-disabled");
  }
  button.classList.toggle("busy-blocked", Boolean(blocked && !visuallyDisabled));
}

function setPickerBusy(active) {
  state.pickerBusy = Boolean(active);
  const blocked = Boolean(state.processing || state.pickerBusy);
  const visuallyDisabled = Boolean(state.processing);
  setSourceButtonBlockedState(selectFolderBtn, blocked, visuallyDisabled);
  setSourceButtonBlockedState(selectImageBtn, blocked, visuallyDisabled);
  setSourceButtonBlockedState(serverFolderBtn, blocked, visuallyDisabled);
  setSourceButtonBlockedState(serverImageBtn, blocked, visuallyDisabled);
  updateRunControlButton();
}

function setControlsForRun(running) {
  const blocked = Boolean(running || state.pickerBusy);
  const visuallyDisabled = Boolean(running);
  setSourceButtonBlockedState(selectFolderBtn, blocked, visuallyDisabled);
  setSourceButtonBlockedState(selectImageBtn, blocked, visuallyDisabled);
  setSourceButtonBlockedState(serverFolderBtn, blocked, visuallyDisabled);
  setSourceButtonBlockedState(serverImageBtn, blocked, visuallyDisabled);
  updateRunControlButton();
}

function clearPreview() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
  if (previewWrap) {
    previewWrap.classList.remove("has-image");
  }
  previewImage.src = "";
  previewImage.style.display = "none";
  setCurrentFileLabel("No image loaded.");
  state.currentItem = null;
  stopImageProgressTimer();
  renderImageProgress(0);
  setPreviewLoading(false);
  setDropHint(true);
  clearMetadataView();
}

function clearMetadataView() {
  state.currentMetadata = {
    description: "",
    objects: [],
    actions: [],
    custom_tags: [],
    categories: [],
    colors: [],
    confidence: {},
    ip_risk: { level: "none", score: 0, matches: [] },
  };
  renderMetadataView();
}

function shouldShowReadOnlyPreviewOverlay() {
  if (!auditOnlyEnabled()) {
    return false;
  }
  if (!previewImage) {
    return false;
  }
  if (previewImage.style.display === "none") {
    return false;
  }
  return Boolean(previewImage.src);
}

function setPreviewLoading(active, message = "Loading image...", options = {}) {
  if (!previewOverlay || !previewOverlayText) {
    return;
  }
  if (active) {
    hideDropWarningAlert();
  }
  const skipMode = Boolean(options && options.skipMode);
  const processingMode = Boolean(options && options.processingMode);
  const readOnlyMode = shouldShowReadOnlyPreviewOverlay();
  const finalActive = Boolean(active || readOnlyMode);
  previewOverlayText.textContent = readOnlyMode
    ? "Read only mode. Images will not show"
    : message;
  previewOverlay.classList.toggle("hidden", !finalActive);
  previewOverlay.classList.toggle("read-only-mode", Boolean(readOnlyMode));
  previewOverlay.classList.toggle("skip-mode", Boolean(finalActive && !readOnlyMode && skipMode));
  previewOverlay.classList.toggle("processing-mode", Boolean(finalActive && !readOnlyMode && processingMode));
}

function showSkipOverlay(message = "Skipping files already with metadata") {
  stopImageProgressTimer();
  renderImageProgress(0);
  setPreviewLoading(true, message, { skipMode: true });
}

function stopImageProgressTimer() {
  if (state.imageProgressTimer) {
    clearInterval(state.imageProgressTimer);
    state.imageProgressTimer = null;
  }
  if (state.imageProgressCeilingTimer) {
    clearTimeout(state.imageProgressCeilingTimer);
    state.imageProgressCeilingTimer = null;
  }
}

function setImageProgressIndeterminate(active, text = "Working...") {
  state.imageProgressIndeterminate = Boolean(active);
  if (imageProgressFill) {
    imageProgressFill.classList.toggle("indeterminate", Boolean(active));
  }
  const track = imageProgressFill ? imageProgressFill.parentElement : null;
  if (track) {
    if (active) {
      track.removeAttribute("aria-valuenow");
    } else {
      track.setAttribute("aria-valuenow", String(state.imageProgressValue || 0));
    }
  }
  if (imageProgressText && active) {
    imageProgressText.textContent = text;
  }
}

function renderImageProgress(value) {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  state.imageProgressValue = bounded;
  if (state.imageProgressIndeterminate) {
    setImageProgressIndeterminate(false);
  }
  if (imageProgressFill) {
    imageProgressFill.style.width = `${bounded}%`;
    const track = imageProgressFill.parentElement;
    if (track) {
      track.setAttribute("aria-valuenow", String(bounded));
    }
  }
  if (imageProgressText) {
    imageProgressText.textContent = `${bounded}%`;
  }
}

function setImageProgressInstant(value) {
  if (!imageProgressFill) {
    renderImageProgress(value);
    return;
  }
  imageProgressFill.classList.add("no-transition");
  renderImageProgress(value);
  // Force style flush so the reset is applied immediately with no tween.
  void imageProgressFill.offsetWidth;
  imageProgressFill.classList.remove("no-transition");
}

function startImageProgress(message, startValue = 4, ceiling = 92, options = {}) {
  const resetFromLeft = Boolean(options && options.resetFromLeft);
  const indeterminateText = String((options && options.indeterminateText) || "Still analyzing...");
  const ceilingDelayMs = Number((options && options.ceilingDelayMs) || 1800);
  stopImageProgressTimer();
  setImageProgressIndeterminate(false);
  setPreviewLoading(true, message, { processingMode: true });
  if (resetFromLeft) {
    setImageProgressInstant(0);
  }
  renderImageProgress(startValue);
  state.imageProgressTimer = setInterval(() => {
    const cur = state.imageProgressValue;
    if (cur >= ceiling) {
      return;
    }
    let step = 1;
    if (cur < 45) {
      step = 5;
    } else if (cur < 75) {
      step = 3;
    } else {
      step = 1;
    }
    const nextValue = Math.min(ceiling, cur + step);
    renderImageProgress(nextValue);
    if (nextValue >= ceiling && !state.imageProgressCeilingTimer) {
      state.imageProgressCeilingTimer = setTimeout(() => {
        state.imageProgressCeilingTimer = null;
        if (!state.imageProgressTimer || state.imageProgressValue < ceiling) {
          return;
        }
        setImageProgressIndeterminate(true, indeterminateText);
      }, ceilingDelayMs);
    }
  }, 220);
}

function completeImageProgress(message) {
  stopImageProgressTimer();
  setImageProgressIndeterminate(false);
  setPreviewLoading(true, message, { processingMode: true });
  renderImageProgress(100);
}

function holdImageProgressOverlay(message = "Preparing next image...") {
  stopImageProgressTimer();
  setImageProgressIndeterminate(false);
  renderImageProgress(100);
  setPreviewLoading(true, message, { processingMode: true });
}

function setDropHint(visible) {
  if (!dropHint) {
    return;
  }
  dropHint.classList.toggle("hidden", !visible);
}

function setCurrentFileLabel(value) {
  if (!currentFileText) {
    return;
  }
  const text = String(value || "No image loaded.");
  currentFileText.textContent = text;
  currentFileText.title = text;
}

async function showSelectedPreview() {
  if (!state.items.length) {
    clearPreview();
    return;
  }
  try {
    setPreviewLoading(true, "Loading image preview...");
    const firstItem = state.items[0];
    if (state.sourceMode === "local") {
      showLocalPreview(firstItem);
      return;
    }
    const file = await itemToFile(firstItem);
    showPreview(file, firstItem);
  } catch (error) {
    appendLog(`Preview load failed: ${error.message}`);
    clearPreview();
    setPreviewLoading(false);
  }
}

function setSelectionNone() {
  resetSelectionScanStats();
  state.items = [];
  state.allItems = [];
  state.sourceMode = "none";
  state.localSessionId = null;
  state.localFolderHydrationSessionId = "";
  state.localSkipPrescan = { sessionId: "", skipIndices: [] };
  state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
  state.selectedLabel = "None";
  state.handleWritePermission = false;
  state.resumeNextIndex = 0;
  state.resumeStats = defaultRunStats();
  state.currentIndex = 0;
  state.runStartCompletedCount = 0;
  state.lastProgressCompleted = 0;
  state.lastProgressTotal = 0;
  state.metadataIndex = {};
  state.qcFindings = [];
  state.lastQcReport = null;
  state.duplicateMap = {};
  updateQcDownloadButton();
  setSkipActivityMessage("");
  updateExportVisibility();
  updateSelectionInfo();
  clearPreview();
}

function showLocalPreview(item) {
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  clearMetadataView();
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
  const sid = encodeURIComponent(state.localSessionId);
  previewImage.onload = () => {
    if (!state.processing && !state.imageProgressTimer) {
      setPreviewLoading(false);
    }
  };
  previewImage.onerror = () => {
    if (!state.processing && !state.imageProgressTimer) {
      setPreviewLoading(false);
    }
  };
  previewImage.src = `/api/local/preview/${sid}/${item.localIndex}?t=${Date.now()}`;
  previewImage.style.display = "block";
  if (previewWrap) {
    previewWrap.classList.add("has-image");
  }
  setCurrentFileLabel(item.relativePath);
  state.currentItem = item;
  setDropHint(false);
}

async function walkDirectory(handle, prefix = "", onProgress = null) {
  const items = [];
  for await (const [name, child] of handle.entries()) {
    const relPath = prefix ? `${prefix}/${name}` : name;
    if (child.kind === "directory") {
      if (typeof onProgress === "function") {
        onProgress({ type: "directory", path: relPath });
      }
      const nested = await walkDirectory(child, relPath, onProgress);
      items.push(...nested);
      continue;
    }
    if (child.kind === "file" && isSupportedName(name)) {
      if (typeof onProgress === "function") {
        onProgress({ type: "image", path: relPath });
      }
      items.push({
        name,
        relativePath: relPath,
        fileHandle: child,
      });
    }
  }
  return items;
}

async function walkDirectoryIncremental(
  handle,
  prefix = "",
  onProgress = null,
  onBatch = null,
  batchSize = 2000,
) {
  const effectiveBatchSize = Math.max(1, Number(batchSize) || 2000);
  const yieldEveryEntries = 500;
  const pending = [];
  let processedSinceYield = 0;
  const flush = async () => {
    if (!pending.length || typeof onBatch !== "function") {
      return;
    }
    const batch = pending.splice(0, pending.length);
    await onBatch(batch);
  };

  const maybeYield = async (force = false) => {
    if (!force && processedSinceYield < yieldEveryEntries) {
      return;
    }
    processedSinceYield = 0;
    await flush();
    await waitForUiPaint();
  };

  const stack = [{ handle, prefix }];
  while (stack.length) {
    const current = stack.pop();
    if (!current || !current.handle) {
      continue;
    }
    const childDirectories = [];
    for await (const [name, child] of current.handle.entries()) {
      const relPath = current.prefix ? `${current.prefix}/${name}` : name;
      processedSinceYield += 1;
      const supportedImage = child.kind === "file" && isSupportedName(name);

      if (typeof onProgress === "function") {
        onProgress({
          type: child.kind === "directory" ? "directory" : "file",
          path: relPath,
          supported: supportedImage,
        });
      }

      if (child.kind === "directory") {
        childDirectories.push({ handle: child, prefix: relPath });
        await maybeYield();
        continue;
      }

      if (supportedImage) {
        pending.push({
          name,
          relativePath: relPath,
          fileHandle: child,
        });
        if (pending.length >= effectiveBatchSize) {
          await flush();
          await maybeYield(true);
          continue;
        }
      }
      await maybeYield();
    }
    for (let i = childDirectories.length - 1; i >= 0; i -= 1) {
      stack.push(childDirectories[i]);
    }
  }

  await maybeYield(true);
  await flush();
}

async function selectFolderViaPicker() {
  if (!window.showDirectoryPicker) {
    setStatus("This browser does not support direct folder access. Try Select Image instead.");
    return;
  }
  if (state.pickerBusy) {
    setStatus("A file picker is already active. Close it, then try again.");
    return;
  }

  setPickerBusy(true);
  try {
    saveLastSourceChoice("folder");
    resetSelectionScanStats();
    beginSelectionDiagnostics("Browser folder scan");
    setSelectionLoading(true, "Scanning folder...");
    setStatus("Scanning selected folder for images...", { log: false, toast: false });
    await waitForUiPaint();
    const pickerOptions = { id: PICKER_LOCATION_ID };
    if (state.lastDirectoryHandle) {
      pickerOptions.startIn = state.lastDirectoryHandle;
    }
    const dirHandle = await window.showDirectoryPicker(pickerOptions);
    const existingReadPerm = await dirHandle.queryPermission({ mode: "read" });
    let readPerm = existingReadPerm;
    if (readPerm !== "granted") {
      readPerm = await dirHandle.requestPermission({ mode: "read" });
    }
    if (readPerm !== "granted") {
      throw new Error("Read permission was not granted.");
    }

    const existingWritePerm = await dirHandle.queryPermission({ mode: "readwrite" });
    let writePerm = existingWritePerm;
    if (writePerm !== "granted") {
      writePerm = await dirHandle.requestPermission({ mode: "readwrite" });
    }
    state.handleWritePermission = writePerm === "granted";

    state.items = [];
    state.allItems = [];
    state.sourceMode = "handle";
    state.localSessionId = null;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    updateQcDownloadButton();
    state.selectedLabel = `Folder: ${dirHandle.name}`;
    state.lastDirectoryHandle = dirHandle;
    await persistHandleResumeStateFromCurrentSelection("directory", {
      directoryHandle: dirHandle,
      selectedLabel: state.selectedLabel,
    });
    updateSelectionInfo();

    let foldersScanned = 0;
    let imagesFound = 0;
    let entriesScanned = 0;
    let lastProgressTick = 0;
    let previewShown = false;
    const onScanProgress = (entry) => {
      entriesScanned += 1;
      if (entry && entry.type === "directory") {
        foldersScanned += 1;
      } else if (entry && entry.type === "file" && entry.supported) {
        imagesFound += 1;
      }
      updateSelectionScanStats({
        imagesFound,
        entriesChecked: entriesScanned,
        foldersScanned,
      });
      maybeLogSelectionDiagnostics(imagesFound, entriesScanned, foldersScanned);
      const now = Date.now();
      if (now - lastProgressTick >= 120) {
        setSelectionLoading(
          true,
          formatFolderScanMessage(imagesFound, entriesScanned, foldersScanned)
        );
        lastProgressTick = now;
      }
    };
    const onBatch = async (batch) => {
      if (!Array.isArray(batch) || !batch.length) {
        return;
      }
      state.items.push(...batch);
      state.allItems = state.items;
      updateSelectionInfo();
      if (!previewShown && state.items.length) {
        try {
          await showSelectedPreview();
          previewShown = true;
        } catch (_) {
          // Preview can wait for a later batch or final pass.
        }
      }
      setSelectionLoading(
        true,
        formatFolderScanMessage(state.items.length, entriesScanned, foldersScanned)
      );
    };
    await walkDirectoryIncremental(dirHandle, "", onScanProgress, onBatch, 2000);
    setSelectionLoading(false);
    updateSelectionInfo();
    maybeRestoreRunCheckpointForSelection();
    if (!previewShown && state.items.length) {
      await showSelectedPreview();
    }
    const summary = finishSelectionDiagnostics(state.items.length, entriesScanned, foldersScanned);
    if (!state.items.length) {
      setStatus(summary);
    } else if (state.handleWritePermission) {
      setStatus(`${summary} Click Start Processing to begin.`);
    } else {
      setStatus(`${summary} Read access is available, but write access was not granted up front. Click Start Processing to begin.`);
    }
  } catch (error) {
    setSelectionLoading(false);
    const name = String(error && error.name ? error.name : "");
    const message = String(error && error.message ? error.message : "");
    const lower = message.toLowerCase();
    const pickerAlreadyActive = (
      name === "InvalidStateError"
      || lower.includes("file picker already active")
      || lower.includes("picker already active")
    );
    const canceled = (
      name === "AbortError"
      || lower.includes("user aborted")
      || lower.includes("user canceled")
      || lower.includes("user cancelled")
    );
    if (pickerAlreadyActive) {
      setStatus("File picker is already open. Close the open picker and try again.");
      return;
    }
    if (canceled) {
      setStatus("Folder selection canceled.");
      return;
    }
    setStatus(`Folder selection failed: ${message || "unknown error"}`);
  } finally {
    setPickerBusy(false);
    setSelectionLoading(false);
  }
}

async function selectSingleImage() {
  if (!window.showOpenFilePicker) {
    setStatus("This browser does not support direct file access in this browser.");
    return;
  }
  if (state.pickerBusy) {
    setStatus("A file picker is already active. Close it, then try again.");
    return;
  }

  setPickerBusy(true);
  try {
    saveLastSourceChoice("image");
    const pickerOptions = {
      multiple: false,
      types: [{ description: "Images", accept: PICKER_ACCEPT }],
      excludeAcceptAllOption: false,
      id: PICKER_LOCATION_ID,
      startIn: state.lastDirectoryHandle || "pictures",
    };
    const handles = await window.showOpenFilePicker(pickerOptions);
    if (!handles || !handles.length) {
      return;
    }

    const fileHandle = handles[0];
    const file = await fileHandle.getFile();
    if (!isSupportedName(file.name)) {
      setStatus(`Unsupported image extension: ${extensionOf(file.name) || "(none)"}`);
      return;
    }

    const existingReadPerm = await fileHandle.queryPermission({ mode: "read" });
    let readPerm = existingReadPerm;
    if (readPerm !== "granted") {
      readPerm = await fileHandle.requestPermission({ mode: "read" });
    }
    if (readPerm !== "granted") {
      throw new Error("Read permission was not granted.");
    }

    const existingWritePerm = await fileHandle.queryPermission({ mode: "readwrite" });
    let writePerm = existingWritePerm;
    if (writePerm !== "granted") {
      writePerm = await fileHandle.requestPermission({ mode: "readwrite" });
    }
    state.handleWritePermission = writePerm === "granted";

    state.items = [
      {
        name: file.name,
        relativePath: file.name,
        fileHandle,
      },
    ];
    state.allItems = [...state.items];
    state.sourceMode = "handle";
    state.localSessionId = null;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    updateQcDownloadButton();
    state.selectedLabel = `Image: ${file.name}`;
    await persistHandleResumeStateFromCurrentSelection("files", {
      selectedLabel: state.selectedLabel,
    });
    updateSelectionInfo();
    maybeRestoreRunCheckpointForSelection();
    await showSelectedPreview();
    if (state.handleWritePermission) {
      setStatus("Single image selected with write access.");
    } else {
      setStatus("Single image selected. Read access granted, but write access was not granted up front.");
    }
    await autoStartSingleImage("Single image selected.");
  } catch (error) {
    const name = String(error && error.name ? error.name : "");
    const message = String(error && error.message ? error.message : "");
    const lower = message.toLowerCase();
    const pickerAlreadyActive = (
      name === "InvalidStateError"
      || lower.includes("file picker already active")
      || lower.includes("picker already active")
    );
    const canceled = (
      name === "AbortError"
      || lower.includes("user aborted")
      || lower.includes("user canceled")
      || lower.includes("user cancelled")
    );
    if (pickerAlreadyActive) {
      setStatus("File picker is already open. Close the open picker and try again.");
      return;
    }
    if (canceled) {
      setStatus("Image selection canceled.");
      return;
    }
    setStatus(`Image selection failed: ${message || "unknown error"}`);
  } finally {
    setPickerBusy(false);
  }
}

function mapLocalItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => ({
    name: String(item.name || ""),
    relativePath: String(item.relative_path || item.name || ""),
    localIndex: Number(item.index),
    local: true,
  }));
}

async function readJsonResponse(response) {
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function preScanLocalSkipIndices() {
  if (state.sourceMode !== "local" || !state.localSessionId) {
    return new Set();
  }
  if (
    state.localSkipPrescan
    && state.localSkipPrescan.sessionId === state.localSessionId
    && Array.isArray(state.localSkipPrescan.skipIndices)
  ) {
    return new Set(
      state.localSkipPrescan.skipIndices
        .map((idx) => Number(idx))
        .filter((idx) => Number.isFinite(idx) && idx >= 0)
    );
  }

  const response = await fetch("/api/local/prescan-skip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: state.localSessionId }),
    signal: state.activePreScanAbortController ? state.activePreScanAbortController.signal : undefined,
  });
  const payload = await readJsonResponse(response);
  const rawIndices = Array.isArray(payload.skip_indices) ? payload.skip_indices : [];
  const skipIndices = rawIndices
    .map((idx) => Number(idx))
    .filter((idx) => Number.isFinite(idx) && idx >= 0);
  state.localSkipPrescan = {
    sessionId: state.localSessionId,
    skipIndices,
  };
  const total = Number(payload.total);
  const elapsedMs = Number(payload.elapsed_ms);
  appendLog(
    `Pre-scan complete: ${skipIndices.length}/${Number.isFinite(total) ? total : state.items.length} ` +
    `files already have keywords (${Number.isFinite(elapsedMs) ? `${elapsedMs}ms` : "timing unavailable"}).`
  );
  return new Set(skipIndices);
}

async function verifyBatchKeywordPresence(batchEntries) {
  const entries = Array.isArray(batchEntries) ? batchEntries : [];
  if (!entries.length) {
    return [];
  }
  const formData = new FormData();
  const itemIndices = [];
  for (const entry of entries) {
    if (!entry || !entry.file) {
      continue;
    }
    formData.append("images", entry.file, entry.file.name);
    itemIndices.push(clampInteger(entry.index, 0, 10000000));
  }
  formData.append("item_indices", JSON.stringify(itemIndices));

  const response = await fetch("/api/verify-batch-keywords", {
    method: "POST",
    body: formData,
    signal: state.activePreScanAbortController ? state.activePreScanAbortController.signal : undefined,
  });
  const payload = await readJsonResponse(response);
  const rows = Array.isArray(payload.results) ? payload.results : [];
  return rows.map((row) => ({
    index: clampInteger(row && row.index, 0, 10000000),
    hasKeywords: Boolean(row && row.has_keywords),
  }));
}

async function preScanHandleSkipIndices() {
  if (state.sourceMode !== "handle" || !Array.isArray(state.items) || !state.items.length) {
    return new Set();
  }
  const selectionFingerprint = buildSelectionFingerprint(state.items, state.sourceMode);
  if (
    state.handleSkipPrescan
    && state.handleSkipPrescan.selectionFingerprint === selectionFingerprint
    && Array.isArray(state.handleSkipPrescan.skipIndices)
  ) {
    return new Set(
      state.handleSkipPrescan.skipIndices
        .map((idx) => Number(idx))
        .filter((idx) => Number.isFinite(idx) && idx >= 0)
    );
  }

  const total = state.items.length;
  const startMs = nowMs();
  const skipIndices = [];
  let scanned = 0;
  let buffered = [];
  const throwIfPreScanCanceled = () => {
    if (state.stopRequested) {
      throw new DOMException("Pre-scan canceled.", "AbortError");
    }
    if (state.activePreScanAbortController && state.activePreScanAbortController.signal.aborted) {
      throw new DOMException("Pre-scan canceled.", "AbortError");
    }
  };
  const flushBuffered = async () => {
    throwIfPreScanCanceled();
    if (!buffered.length) {
      return;
    }
    const results = await verifyBatchKeywordPresence(buffered);
    scanned += buffered.length;
    for (const row of results) {
      if (row.hasKeywords) {
        skipIndices.push(row.index);
      }
    }
    buffered = [];
    setPreScanLoading(true, "Pre-scanning existing metadata...", {
      scanned,
      total,
      skippable: skipIndices.length,
    });
  };

  for (let index = 0; index < total; index += 1) {
    throwIfPreScanCanceled();
    const item = state.items[index];
    if (!item || !item.fileHandle) {
      continue;
    }
    let file = null;
    try {
      file = await itemToFile(item);
    } catch (_) {
      continue;
    }
    buffered.push({ index, file });
    if (buffered.length < HANDLE_SKIP_PRESCAN_BATCH_SIZE) {
      continue;
    }
    await flushBuffered();
  }
  await flushBuffered();

  state.handleSkipPrescan = {
    selectionFingerprint,
    skipIndices,
  };
  const elapsedMs = Math.max(0, Math.round(nowMs() - startMs));
  appendLog(`Handle pre-scan complete: ${skipIndices.length}/${total} files already have keywords (${elapsedMs}ms).`);
  return new Set(skipIndices);
}

async function selectLocalFolderServer() {
  if (state.pickerBusy) {
    setStatus("A picker is already active. Close it, then try again.");
    return;
  }
  setPickerBusy(true);
  try {
    saveLastSourceChoice("folder");
    resetSelectionScanStats();
    beginSelectionDiagnostics("Local folder scan");
    setSelectionLoading(true, "Loading folder images...");
    setStatus("Loading folder images...", { log: false, toast: false });
    await waitForUiPaint();
    const response = await fetch("/api/local/select-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await readJsonResponse(response);
    state.items = mapLocalItems(payload.items);
    state.allItems = [...state.items];
    state.sourceMode = "local";
    state.localSessionId = payload.session_id;
    state.localFolderHydrationSessionId = payload.session_id;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    updateQcDownloadButton();
    state.selectedLabel = payload.selected_label || "Folder";
    state.handleWritePermission = false;
    updateSelectionInfo();
    void hydrateLocalFolderSession(payload.session_id);
  } catch (error) {
    const message = String(error && error.message ? error.message : "");
    const lower = message.toLowerCase();
    const canceled = lower.includes("no folder selected") || lower.includes("cancel");
    if (canceled) {
      setStatus("Folder selection canceled.");
      return;
    }
    setSelectionNone();
    setStatus(`Local folder selection failed: ${message || "unknown error"}`);
  } finally {
    setPickerBusy(false);
    if (state.localFolderHydrationSessionId !== state.localSessionId) {
      setSelectionLoading(false);
    }
  }
}

async function selectLocalImageServer() {
  if (state.pickerBusy) {
    setStatus("A picker is already active. Close it, then try again.");
    return;
  }
  setPickerBusy(true);
  try {
    saveLastSourceChoice("image");
    setSelectionLoading(true, "Loading image...");
    const response = await fetch("/api/local/select-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await readJsonResponse(response);
    state.items = mapLocalItems(payload.items);
    state.allItems = [...state.items];
    state.sourceMode = "local";
    state.localSessionId = payload.session_id;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    updateQcDownloadButton();
    state.selectedLabel = payload.selected_label || "Image";
    state.handleWritePermission = false;
    updateSelectionInfo();
    maybeRestoreRunCheckpointForSelection();
    await showSelectedPreview();
    if (state.items.length) {
      setStatus("Local image selected.");
      await autoStartSingleImage("Local image selected.");
    } else {
      setStatus("No supported image selected.");
    }
  } catch (error) {
    const message = String(error && error.message ? error.message : "");
    const lower = message.toLowerCase();
    const canceled = lower.includes("no image selected") || lower.includes("cancel");
    if (canceled) {
      setStatus("Image selection canceled.");
      return;
    }
    setSelectionNone();
    setStatus(`Local image selection failed: ${message || "unknown error"}`);
  } finally {
    setPickerBusy(false);
    setSelectionLoading(false);
  }
}

async function hydrateLocalFolderSession(sessionId) {
  const sessionKey = String(sessionId || "").trim();
  if (!sessionKey) {
    setSelectionLoading(false);
    return;
  }

  let offset = Array.isArray(state.items) ? state.items.length : 0;
  let previewShown = offset > 0;

  while (state.localSessionId === sessionKey && state.localFolderHydrationSessionId === sessionKey) {
    let payload = null;
    try {
      const response = await fetch(
        `/api/local/session-items/${encodeURIComponent(sessionKey)}?offset=${offset}&limit=10000`
      );
      payload = await readJsonResponse(response);
    } catch (error) {
      if (state.localSessionId === sessionKey) {
        setSelectionLoading(false);
        setStatus(`Local folder loading failed: ${error.message || "unknown error"}`);
      }
      return;
    }

    if (state.localSessionId !== sessionKey || state.localFolderHydrationSessionId !== sessionKey) {
      return;
    }

    const incomingItems = mapLocalItems(payload.items);
    if (incomingItems.length) {
      state.items.push(...incomingItems);
      state.allItems = state.items;
      offset = state.items.length;
      updateSelectionInfo();
      if (!previewShown) {
        try {
          await showSelectedPreview();
          previewShown = true;
        } catch (_) {
          // Preview can wait for the next successful poll.
        }
      }
    }

    const loadedCount = Number.isFinite(Number(payload.loaded_count))
      ? Math.max(0, Math.floor(Number(payload.loaded_count)))
      : state.items.length;
    const entriesChecked = Number.isFinite(Number(payload.entries_checked))
      ? Math.max(0, Math.floor(Number(payload.entries_checked)))
      : loadedCount;
    const foldersScanned = Number.isFinite(Number(payload.folders_scanned))
      ? Math.max(0, Math.floor(Number(payload.folders_scanned)))
      : 0;
    updateSelectionScanStats({
      imagesFound: loadedCount,
      entriesChecked,
      foldersScanned,
    });
    maybeLogSelectionDiagnostics(loadedCount, entriesChecked, foldersScanned);
    const scanComplete = Boolean(payload.scan_complete);
    const scanError = String(payload.scan_error || "").trim();

    if (scanError) {
      state.localFolderHydrationSessionId = "";
      setSelectionLoading(false);
      setStatus(`Local folder loading failed: ${scanError}`);
      return;
    }

    const fullyHydrated = scanComplete && offset >= loadedCount;

    if (fullyHydrated) {
      state.localFolderHydrationSessionId = "";
      setSelectionLoading(false);
      maybeRestoreRunCheckpointForSelection();
      if (!previewShown && state.items.length) {
        await showSelectedPreview();
      }
      const summary = finishSelectionDiagnostics(loadedCount, entriesChecked, foldersScanned);
      setStatus(
        state.items.length
          ? `${summary} Click Start Processing to begin.`
          : summary
      );
      return;
    }

    setSelectionLoading(true, formatFolderScanMessage(loadedCount, entriesChecked, foldersScanned));
    await new Promise((resolve) => setTimeout(resolve, incomingItems.length ? 40 : 120));
  }
}

async function tryRestoreLocalSessionFromServer() {
  if (state.processing || state.items.length) {
    return false;
  }
  if (!autoResumeEnabled()) {
    return false;
  }
  const checkpoint = loadRunCheckpoint();
  if (!checkpoint) {
    return false;
  }
  if (String(checkpoint.source_mode || "").toLowerCase() !== "local") {
    return false;
  }

  setSelectionLoading(true, "Restoring previous local session...");
  try {
    const response = await fetch("/api/local/restore-session");
    const payload = await readJsonResponse(response);
    if (!payload.available) {
      setSelectionLoading(false);
      return false;
    }
    state.items = mapLocalItems(payload.items);
    state.allItems = [...state.items];
    state.sourceMode = "local";
    state.localSessionId = payload.session_id;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    updateQcDownloadButton();
    state.selectedLabel = payload.selected_label || "Restored Local Session";
    state.handleWritePermission = false;
    updateSelectionInfo();
    const resumed = maybeRestoreRunCheckpointForSelection();
    await showSelectedPreview();
    setSelectionLoading(false);

    if (resumed) {
      const total = state.items.length;
      const next = clampInteger(state.resumeNextIndex, 0, total);
      if (next > 0 && next < total) {
        setStatus(`Restored previous session at ${next}/${total}. Resuming processing...`);
        if (!state.processing) {
          await startProcessing();
        }
      } else {
        setStatus("Restored previous local session.");
      }
    } else {
      setStatus("Restored previous local session.");
    }
    return true;
  } catch (error) {
    setSelectionLoading(false);
    appendLog(`Auto-restore skipped: ${error.message}`);
    return false;
  }
}

function checkpointAllowsAutoResume(checkpoint) {
  if (!checkpoint || typeof checkpoint !== "object") {
    return false;
  }
  if (!checkpoint.options || typeof checkpoint.options !== "object") {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(checkpoint.options, "auto_resume")) {
    return true;
  }
  return Boolean(checkpoint.options.auto_resume);
}

async function restoreHandleItemsFromState(savedState, options = {}) {
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const expectedTotal = clampInteger(options.expectedTotal, 0, 10000000);
  if (!savedState || typeof savedState !== "object") {
    return { ok: false, error: "No saved handle session." };
  }
  const mode = String(savedState.selection_mode || "").toLowerCase();
  if (mode === "directory") {
    const dirHandle = savedState.directory_handle;
    if (!dirHandle || dirHandle.kind !== "directory") {
      return { ok: false, error: "Saved folder handle is unavailable." };
    }
    const readPerm = await dirHandle.queryPermission({ mode: "read" });
    if (readPerm !== "granted") {
      return { ok: false, error: "Folder read permission is not currently granted. Re-select the folder to resume." };
    }
    let foldersScanned = 0;
    let imagesFound = 0;
    let lastProgressTick = 0;
    if (typeof onProgress === "function") {
      onProgress({
        phase: "start",
        imagesFound: 0,
        foldersScanned: 0,
        expectedTotal,
        percent: expectedTotal > 0 ? 0 : null,
      });
    }
    const scanProgress = (entry) => {
      if (entry && entry.type === "directory") {
        foldersScanned += 1;
      } else if (entry && entry.type === "image") {
        imagesFound += 1;
      }
      const now = Date.now();
      if (now - lastProgressTick >= 650 && typeof onProgress === "function") {
        const percent = expectedTotal > 0
          ? Math.min(99, Math.max(0, Math.round((imagesFound / expectedTotal) * 100)))
          : null;
        onProgress({
          phase: "scanning",
          imagesFound,
          foldersScanned,
          expectedTotal,
          percent,
        });
        lastProgressTick = now;
      }
    };
    const items = await walkDirectory(dirHandle, "", scanProgress);
    items.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    if (typeof onProgress === "function") {
      onProgress({
        phase: "done",
        imagesFound: items.length,
        foldersScanned,
        expectedTotal,
        percent: 100,
      });
    }
    return {
      ok: true,
      items,
      selectedLabel: String(savedState.selected_label || `Folder: ${dirHandle.name}`),
      directoryHandle: dirHandle,
    };
  }

  const savedItems = Array.isArray(savedState.items) ? savedState.items : [];
  if (!savedItems.length) {
    return { ok: false, error: "Saved file handles are unavailable." };
  }
  const restoredItems = [];
  for (const entry of savedItems) {
    if (!entry || !entry.file_handle) {
      continue;
    }
    const fileHandle = entry.file_handle;
    if (fileHandle.kind !== "file") {
      continue;
    }
    const readPerm = await fileHandle.queryPermission({ mode: "read" });
    if (readPerm !== "granted") {
      return { ok: false, error: "Saved file read permission is not currently granted. Re-select files to resume." };
    }
    restoredItems.push({
      name: String(entry.name || fileHandle.name || ""),
      relativePath: String(entry.relative_path || entry.name || fileHandle.name || ""),
      fileHandle,
    });
  }
  restoredItems.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  if (!restoredItems.length) {
    return { ok: false, error: "Saved file handles are unavailable." };
  }
  return {
    ok: true,
    items: restoredItems,
    selectedLabel: String(savedState.selected_label || (restoredItems.length === 1 ? `Image: ${restoredItems[0].name}` : `Selected ${restoredItems.length} image(s)`)),
    directoryHandle: null,
  };
}

async function tryRestoreHandleSessionFromIndexedDb(checkpoint = null) {
  if (state.processing || state.items.length) {
    return false;
  }
  if (!autoResumeEnabled()) {
    return false;
  }
  const activeCheckpoint = checkpoint || loadRunCheckpoint();
  if (!activeCheckpoint) {
    return false;
  }
  if (!checkpointAllowsAutoResume(activeCheckpoint)) {
    return false;
  }
  if (String(activeCheckpoint.source_mode || "").toLowerCase() !== "handle") {
    return false;
  }
  const expectedTotal = clampInteger(activeCheckpoint.total, 0, 10000000);
  const restoreStartedAtMs = Date.now();
  let lastUiProgressTick = 0;

  setSelectionLoading(true, "Restoring previous file selection...");
  try {
    const savedState = await loadHandleResumeState();
    const restored = await restoreHandleItemsFromState(savedState, {
      expectedTotal,
      onProgress: (progress) => {
        const now = Date.now();
        const data = progress && typeof progress === "object" ? progress : {};
        const imagesFound = clampInteger(data.imagesFound, 0, 10000000);
        const foldersScanned = clampInteger(data.foldersScanned, 0, 10000000);
        const knownTotal = clampInteger(data.expectedTotal, 0, 10000000);
        const percent = Number.isFinite(Number(data.percent)) ? clampInteger(data.percent, 0, 100) : null;
        let etaSuffix = "";
        const restoreElapsedMs = Math.max(1, Date.now() - restoreStartedAtMs);
        const restoreMinSamples = Math.min(300, Math.max(40, Math.ceil(knownTotal * 0.003)));
        const hasStableRestoreRate = (
          knownTotal > 0
          && imagesFound >= restoreMinSamples
          && restoreElapsedMs >= 15000
          && Number.isFinite(percent)
          && percent >= 3
        );
        if (hasStableRestoreRate && String(data.phase || "") !== "done") {
          const elapsedMs = Math.max(1, Date.now() - restoreStartedAtMs);
          const imagesPerMs = imagesFound / elapsedMs;
          if (imagesPerMs > 0) {
            const remainingImages = Math.max(0, knownTotal - imagesFound);
            const remainingMs = Math.round(remainingImages / imagesPerMs);
            if (remainingMs > 0) {
              etaSuffix = ` | Remaining: ${formatElapsed(remainingMs)} | ETA: ${formatEtaClock(remainingMs)}`;
            }
          }
        }
        let message = "Restoring previous session. Still working...";
        if (knownTotal > 0 && percent !== null) {
          message = `Still working... ${percent}% (${imagesFound}/${knownTotal}) scanned.${etaSuffix}`;
        } else if (imagesFound > 0 || foldersScanned > 0) {
          message = `Still working... reloading folder (${imagesFound} images, ${foldersScanned} folders scanned).`;
        }
        if (String(data.phase || "") === "done") {
          message = knownTotal > 0
            ? `Folder scan complete: ${imagesFound}/${knownTotal} images loaded.`
            : `Folder scan complete: ${imagesFound} images loaded.`;
        }
        const phase = String(data.phase || "");
        const shouldRender = (
          phase === "start"
          || phase === "done"
          || (now - lastUiProgressTick) >= 650
        );
        if (!shouldRender) {
          return;
        }
        lastUiProgressTick = now;
        setSelectionLoading(true, message);
      },
    });
    if (!restored.ok) {
      setSelectionLoading(false);
      appendLog(`Auto-restore skipped: ${restored.error}`);
      return false;
    }

    state.items = restored.items;
    state.allItems = [...restored.items];
    state.sourceMode = "handle";
    state.localSessionId = null;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    state.selectedLabel = restored.selectedLabel;
    state.lastDirectoryHandle = restored.directoryHandle || null;
    state.handleWritePermission = await computeHandleWritePermission(restored.items);
    updateQcDownloadButton();
    updateSelectionInfo();
    const resumed = maybeRestoreRunCheckpointForSelection();
    await showSelectedPreview();
    setSelectionLoading(false);

    if (!resumed) {
      setStatus("Restored previous file selection.");
      return true;
    }

    const total = state.items.length;
    const next = clampInteger(state.resumeNextIndex, 0, total);
    if (next > 0 && next < total) {
      const canAutoStart = await ensureWritablePermissionsForRun(false);
      if (!canAutoStart) {
        setStatus(`Restored previous session at ${next}/${total}. Click Start Processing to re-grant write permission and resume.`);
        return true;
      }
      setStatus(`Restored previous session at ${next}/${total}. Resuming processing...`);
      if (!state.processing) {
        await startProcessing();
      }
      return true;
    }

    setStatus("Restored previous file selection.");
    return true;
  } catch (error) {
    setSelectionLoading(false);
    appendLog(`Auto-restore skipped: ${error.message}`);
    return false;
  }
}

async function tryRestorePreviousSession() {
  if (state.processing || state.items.length) {
    return false;
  }
  if (!autoResumeEnabled()) {
    return false;
  }
  const checkpoint = loadRunCheckpoint();
  if (!checkpoint) {
    return false;
  }
  if (!checkpointAllowsAutoResume(checkpoint)) {
    return false;
  }
  const sourceMode = String(checkpoint.source_mode || "").toLowerCase();
  if (sourceMode === "local") {
    return tryRestoreLocalSessionFromServer();
  }
  if (sourceMode === "handle") {
    return tryRestoreHandleSessionFromIndexedDb(checkpoint);
  }
  return false;
}

async function itemToFile(item) {
  if (item.fileHandle) {
    return item.fileHandle.getFile();
  }
  if (item.file) {
    return item.file;
  }
  throw new Error("Could not read selected file.");
}

function normalizeMetadata(metadata) {
  const normalizeConfidence = (value) => {
    if (!value || typeof value !== "object") {
      return {};
    }
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const num = Number(raw);
      if (Number.isFinite(num)) {
        out[String(key)] = Math.max(0, Math.min(1, num));
      }
    }
    return out;
  };
  const normalizeIpRisk = (value) => {
    if (!value || typeof value !== "object") {
      return { level: "none", score: 0, matches: [] };
    }
    const levelRaw = String(value.level || "none").trim().toLowerCase();
    const level = ["none", "low", "medium", "high"].includes(levelRaw) ? levelRaw : "none";
    const scoreRaw = Number(value.score);
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(1, scoreRaw)) : 0;
    const matches = Array.isArray(value.matches)
      ? dedupeListCaseInsensitive(value.matches.map((x) => String(x).trim()).filter(Boolean)).slice(0, 20)
      : [];
    const reason = String(value.reason || "").trim();
    return reason
      ? { level, score, matches, reason }
      : { level, score, matches };
  };
  if (!metadata || typeof metadata !== "object") {
    return {
      description: "",
      objects: [],
      actions: [],
      custom_tags: [],
      categories: [],
      colors: [],
      confidence: {},
      ip_risk: { level: "none", score: 0, matches: [] },
    };
  }
  const description = String(metadata.description || "").trim();
  const objects = Array.isArray(metadata.objects)
    ? metadata.objects
      .map((x) => String(x).trim())
      .filter((value) => value && !isObjectNoiseTerm(value))
    : [];
  return {
    description,
    objects: cleanObjectsAgainstDescription(objects, description),
    actions: Array.isArray(metadata.actions) ? metadata.actions.map((x) => String(x).trim()).filter(Boolean) : [],
    custom_tags: Array.isArray(metadata.custom_tags)
      ? metadata.custom_tags.map((x) => String(x).trim()).filter(Boolean)
      : (Array.isArray(metadata.tags) ? metadata.tags.map((x) => String(x).trim()).filter(Boolean) : []),
    categories: Array.isArray(metadata.categories)
      ? metadata.categories.map((x) => String(x).trim()).filter(Boolean)
      : (metadata.category ? [String(metadata.category).trim()].filter(Boolean) : []),
    colors: Array.isArray(metadata.colors) ? metadata.colors : [],
    confidence: normalizeConfidence(metadata.confidence),
    ip_risk: normalizeIpRisk(metadata.ip_risk || metadata.ipRisk),
  };
}

function summarizeExistingSkipMetadata(metadata) {
  const normalized = normalizeMetadata(metadata);
  const keywordCount = Array.isArray(normalized.objects) ? normalized.objects.length : 0;
  const categoryCount = Array.isArray(normalized.categories) ? normalized.categories.length : 0;
  return {
    keywordCount,
    categoryCount,
    hasAny: (keywordCount + categoryCount) > 0,
  };
}

function isObjectNoiseTerm(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return true;
  }
  if (OBJECT_NOISE_TERMS.has(text)) {
    return true;
  }
  return false;
}

function cleanObjectsAgainstDescription(objects, description) {
  const list = Array.isArray(objects) ? objects.map((x) => String(x).trim()).filter(Boolean) : [];
  if (!list.length) {
    return [];
  }
  const desc = String(description || "").toLowerCase();
  const hasBandana = list.some((x) => x.toLowerCase() === "bandana");
  const mentionsBandana = /\bbandana\b/i.test(desc);
  const mentionsBanana = /\bbanana\b/i.test(desc);
  if (hasBandana && mentionsBandana && !mentionsBanana) {
    return list.filter((x) => x.toLowerCase() !== "banana");
  }
  return list;
}

function parseCommaList(text) {
  return String(text || "")
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseColorList(text, existingColors = []) {
  const names = dedupeListCaseInsensitive(parseCommaList(text));
  const existingByName = new Map();
  for (const row of Array.isArray(existingColors) ? existingColors : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const name = String(row.name || "").trim();
    if (!name) {
      continue;
    }
    existingByName.set(name.toLowerCase(), row);
  }
  return names.map((name) => {
    const existing = existingByName.get(name.toLowerCase());
    if (existing && typeof existing === "object") {
      return { ...existing, name };
    }
    return { name };
  });
}

function setConfirmationControls(waiting) {
  const isWaiting = Boolean(waiting);
  state.confirmControlsActive = isWaiting;
  if (confirmAddBtn) {
    confirmAddBtn.textContent = isWaiting ? "Save Metadata to Continue" : "Save Metadata";
    confirmAddBtn.classList.toggle("action-primary", Boolean(isWaiting || state.metadataDirty));
  }
  if (removeMetadataBtn) {
    removeMetadataBtn.disabled = isWaiting;
    removeMetadataBtn.setAttribute("aria-disabled", isWaiting ? "true" : "false");
  }
  if (isWaiting) {
    setRunStateMessage("Review the generated metadata, then click Save Metadata to continue. Use Stop Processing to cancel.");
  } else if (state.currentStage === "confirming" || state.pendingConfirm) {
    setRunStateMessage("");
  }
}

function announceRunControlsAvailable() {
  if (!confirmControlsAnnouncer) {
    return;
  }
  confirmControlsAnnouncer.textContent = "";
  window.setTimeout(() => {
    confirmControlsAnnouncer.textContent = "Stop Processing is available during processing.";
  }, 20);
}

function renderMetadataView() {
  const metadata = normalizeMetadata(state.currentMetadata);
  state.currentMetadata = metadata;

  const level = String(metadata.ip_risk && metadata.ip_risk.level ? metadata.ip_risk.level : "none").toLowerCase();
  const normalizedLevel = ["low", "medium", "high"].includes(level) ? level : "none";
  const riskMatches = Array.isArray(metadata.ip_risk && metadata.ip_risk.matches)
    ? metadata.ip_risk.matches.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const riskReason = String(metadata.ip_risk && metadata.ip_risk.reason ? metadata.ip_risk.reason : "").trim();
  if (metaIpRiskDetected) {
    let detectedLabel = "none";
    if (riskMatches.length === 1) {
      detectedLabel = riskMatches[0];
    } else if (riskMatches.length > 1) {
      detectedLabel = `${riskMatches[0]} +${riskMatches.length - 1}`;
    } else if (riskReason) {
      detectedLabel = riskReason;
    } else if (normalizedLevel !== "none") {
      detectedLabel = "detected";
    }
    metaIpRiskDetected.textContent = detectedLabel;
    metaIpRiskDetected.title = detectedLabel;
  }
  const riskChips = [
    { el: metaIpRiskLow, level: "low" },
    { el: metaIpRiskMedium, level: "medium" },
    { el: metaIpRiskHigh, level: "high" },
  ];
  for (const chip of riskChips) {
    if (!chip.el) {
      continue;
    }
    const active = normalizedLevel === chip.level;
    chip.el.classList.toggle("active", active);
    chip.el.classList.toggle("disabled", !active);
  }
  if (metaIpRiskScore) {
    const score = Number(metadata.ip_risk && metadata.ip_risk.score);
    const pct = Number.isFinite(score) ? Math.round(Math.max(0, Math.min(1, score)) * 100) : 0;
    metaIpRiskScore.textContent = `${pct}%`;
  }
  if (metaIpRiskMatches) {
    metaIpRiskMatches.innerHTML = "";
  }

  if (metaDescriptionEdit) {
    metaDescriptionEdit.value = metadata.description;
  }
  if (metaObjectsEdit) {
    metaObjectsEdit.value = metadata.objects.join(", ");
  }
  if (metaActionsEdit) {
    metaActionsEdit.value = metadata.actions.join(", ");
  }
  if (metaCustomTagsEdit) {
    metaCustomTagsEdit.value = metadata.custom_tags.join(", ");
  }
  if (metaCategoriesEdit) {
    metaCategoriesEdit.value = metadata.categories.join(", ");
  }
  if (metaColorsEdit) {
    const colorNames = dedupeListCaseInsensitive(
      (Array.isArray(metadata.colors) ? metadata.colors : [])
        .map((row) => String(row && row.name ? row.name : "").trim())
        .filter(Boolean)
    );
    metaColorsEdit.value = colorNames.join(", ");
  }

  metaJson.textContent = JSON.stringify(metadata, null, 2);
  updateMetadataDirtyState();
  updateFlowStepper();
}

function renderMetadata(metadata) {
  state.currentMetadata = normalizeMetadata(metadata);
  renderMetadataView();
}

function applyMetadataEdits(notify = true) {
  const current = normalizeMetadata(state.currentMetadata);
  const description = metaDescriptionEdit ? metaDescriptionEdit.value.trim() : current.description;
  const objectsRaw = metaObjectsEdit ? parseCommaList(metaObjectsEdit.value) : current.objects;
  const updated = {
    ...current,
    description,
    objects: cleanObjectsAgainstDescription(objectsRaw, description),
    actions: metaActionsEdit ? parseCommaList(metaActionsEdit.value) : current.actions,
    custom_tags: metaCustomTagsEdit ? parseCommaList(metaCustomTagsEdit.value) : current.custom_tags,
    categories: metaCategoriesEdit ? parseCommaList(metaCategoriesEdit.value) : current.categories,
    colors: metaColorsEdit ? parseColorList(metaColorsEdit.value, current.colors) : current.colors,
    confidence: current.confidence,
    ip_risk: current.ip_risk,
  };
  state.currentMetadata = updated;
  renderMetadataView();
  if (notify) {
    setStatus("Metadata edits saved for current image.");
  }
  return updated;
}

function clampLogText(value, maxLen = 180) {
  const text = String(value || "").trim();
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
}

function logWrittenMetadata(itemPath, metadata) {
  const normalized = normalizeMetadata(metadata);
  const description = normalized.description || "(none)";
  const objects = normalized.objects.length ? normalized.objects.join(", ") : "(none)";
  const actions = normalized.actions.length ? normalized.actions.join(", ") : "(none)";
  const customTags = normalized.custom_tags.length ? normalized.custom_tags.join(", ") : "(none)";
  const categories = normalized.categories.length ? normalized.categories.join(", ") : "(none)";
  const ipRiskLevel = normalized.ip_risk ? String(normalized.ip_risk.level || "none") : "none";
  const ipRiskMatches = normalized.ip_risk && Array.isArray(normalized.ip_risk.matches) && normalized.ip_risk.matches.length
    ? normalized.ip_risk.matches.join(", ")
    : "(none)";
  const overallConfidence = normalized.confidence && Number.isFinite(Number(normalized.confidence.overall))
    ? `${Math.round(Number(normalized.confidence.overall) * 100)}%`
    : "(unknown)";
  const colors = Array.isArray(normalized.colors) && normalized.colors.length
    ? normalized.colors
      .map((color) => {
        const name = String(color && color.name ? color.name : "unknown");
        const percent = Number(color && color.percent);
        if (Number.isFinite(percent)) {
          return `${name} (${percent}%)`;
        }
        return name;
      })
      .join(", ")
    : "(none)";

  appendLog(`Metadata added to ${itemPath}`);
  appendLog(
    `Added metadata details | description: ${clampLogText(description, 220)} | objects: ${clampLogText(objects)} | actions: ${clampLogText(actions)} | custom tags: ${clampLogText(customTags)} | categories: ${clampLogText(categories)} | ip risk: ${ipRiskLevel} (${clampLogText(ipRiskMatches)}) | confidence: ${overallConfidence} | colors: ${clampLogText(colors, 220)}`
  );
}

function showPreview(file, item) {
  clearMetadataView();
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  state.previewUrl = URL.createObjectURL(file);
  previewImage.onload = () => {
    if (!state.processing && !state.imageProgressTimer) {
      setPreviewLoading(false);
    }
  };
  previewImage.onerror = () => {
    if (!state.processing && !state.imageProgressTimer) {
      setPreviewLoading(false);
    }
  };
  previewImage.src = state.previewUrl;
  previewImage.style.display = "block";
  if (previewWrap) {
    previewWrap.classList.add("has-image");
  }
  setCurrentFileLabel(item.relativePath);
  state.currentItem = item;
  setDropHint(false);
}

async function collectDroppedItems(dataTransfer) {
  const handleItems = [];
  const filesFromList = [];
  const transferItems = dataTransfer && dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const transferFiles = dataTransfer && dataTransfer.files ? Array.from(dataTransfer.files) : [];

  if (transferItems.length) {
    for (const entry of transferItems) {
      if (entry.kind !== "file") {
        continue;
      }
      if (typeof entry.getAsFileSystemHandle !== "function") {
        continue;
      }
      try {
        const handle = await entry.getAsFileSystemHandle();
        if (!handle) {
          continue;
        }
        if (handle.kind === "directory") {
          const nested = await walkDirectory(handle, handle.name);
          handleItems.push(...nested);
          continue;
        }
        if (handle.kind === "file" && isSupportedName(handle.name)) {
          handleItems.push({
            name: handle.name,
            relativePath: handle.name,
            fileHandle: handle,
          });
        }
      } catch (_) {
        // Some browsers reject handle access for drag-and-drop entries.
      }
    }
  }

  // Use DataTransfer.files as authoritative for multi-file drops.
  if (transferFiles.length) {
    for (const file of transferFiles) {
      if (isSupportedFile(file)) {
        filesFromList.push(file);
      }
    }
  }

  // Fallback for browsers that populate items but not files.
  if (!filesFromList.length && transferItems.length) {
    for (const entry of transferItems) {
      if (entry.kind !== "file" || !entry.getAsFile) {
        continue;
      }
      const file = entry.getAsFile();
      if (isSupportedFile(file)) {
        filesFromList.push(file);
      }
    }
  }

  const makeNameKey = (name) => String(name || "").trim().toLowerCase();
  const handleBucketsByName = new Map();
  for (const item of handleItems) {
    if (!item || !item.fileHandle) {
      continue;
    }
    const key = makeNameKey(item.name);
    if (!key) {
      continue;
    }
    const bucket = handleBucketsByName.get(key) || [];
    bucket.push(item.fileHandle);
    handleBucketsByName.set(key, bucket);
  }

  if (filesFromList.length) {
    const dropStamp = Date.now();
    const fileItems = filesFromList.map((file, index) => {
      const key = makeNameKey(file.name);
      const bucket = key ? handleBucketsByName.get(key) : null;
      const fileHandle = bucket && bucket.length ? bucket.shift() : null;
      return {
        name: file.name,
        relativePath: file.webkitRelativePath || file.name,
        file,
        fileHandle: fileHandle || undefined,
        // Preserve distinct files from a single drop, even with similar metadata.
        dropUid: `${dropStamp}-${index}`,
      };
    });
    fileItems.sort((a, b) => String(a.relativePath || "").localeCompare(String(b.relativePath || "")));
    return fileItems;
  }

  // Handle-only fallback (primarily directory drops).
  const dedupedHandles = [];
  const seenPaths = new Set();
  for (const item of handleItems) {
    if (!item || !item.fileHandle) {
      continue;
    }
    const key = makeNameKey(item.relativePath || item.name);
    if (!key || seenPaths.has(key)) {
      continue;
    }
    seenPaths.add(key);
    dedupedHandles.push(item);
  }
  dedupedHandles.sort((a, b) => String(a.relativePath || "").localeCompare(String(b.relativePath || "")));
  return dedupedHandles;
}

function mergeDroppedItems(existingItems, newItems) {
  const merged = [];
  const seenHandlePaths = new Set();
  const source = [...(Array.isArray(existingItems) ? existingItems : []), ...(Array.isArray(newItems) ? newItems : [])];
  for (const item of source) {
    if (!item) {
      continue;
    }
    // Only de-dupe items that resolve to the same writable filesystem path.
    // Plain dropped files (no handle/path identity) are preserved.
    if (item.fileHandle) {
      const handlePathKey = String(item.relativePath || item.name || "").toLowerCase();
      if (handlePathKey) {
        if (seenHandlePaths.has(handlePathKey)) {
          continue;
        }
        seenHandlePaths.add(handlePathKey);
      }
    }
    merged.push(item);
  }
  merged.sort((a, b) => String(a.relativePath || a.name || "").localeCompare(String(b.relativePath || b.name || "")));
  return merged;
}

async function handleDrop(event) {
  event.preventDefault();
  if (state.processing) {
    return;
  }

  previewWrap.classList.remove("drop-active");
  setPreviewLoading(true, "Loading dropped images...");

  try {
    const droppedInputCount = event.dataTransfer && event.dataTransfer.files
      ? Number(event.dataTransfer.files.length || 0)
      : 0;
    if (droppedInputCount > 1) {
      setPreviewLoading(false);
      const warningMessage =
        `Dropped ${droppedInputCount} files. Drag/drop supports one image at a time because browsers often ` +
        "do not provide reliable writable handles for multi-file drops. Use Select Folder for batch runs.";
      showDropWarningAlert(warningMessage);
      setStatus(warningMessage, { toast: false });
      appendLog(`Rejected multi-file drop (${droppedInputCount} files). Single-file drop only.`);
      return;
    }
    const droppedItems = await collectDroppedItems(event.dataTransfer);
    if (!droppedItems.length) {
      setPreviewLoading(false);
      setStatus("No supported images were dropped.");
      return;
    }
    if (droppedItems.length > 1) {
      setPreviewLoading(false);
      const warningMessage =
        `Dropped ${droppedItems.length} supported images. Drag/drop supports one image at a time because browsers ` +
        "may not provide writable handles for multiple files. Use Select Folder for batch runs.";
      showDropWarningAlert(warningMessage);
      setStatus(warningMessage, { toast: false });
      appendLog(`Rejected multi-file drop (${droppedItems.length} supported images). Single-file drop only.`);
      return;
    }

    const previousCount = Array.isArray(state.items) ? state.items.length : 0;
    const isAppendDrop = state.sourceMode === "handle" && previousCount > 0;
    const mergedItems = isAppendDrop
      ? mergeDroppedItems(state.items, droppedItems)
      : droppedItems;

    state.items = mergedItems;
    state.allItems = [...mergedItems];
    state.sourceMode = "handle";
    state.localSessionId = null;
    state.localSkipPrescan = { sessionId: "", skipIndices: [] };
    state.handleSkipPrescan = { selectionFingerprint: "", skipIndices: [] };
    state.metadataIndex = {};
    state.qcFindings = [];
    state.lastQcReport = null;
    state.duplicateMap = {};
    updateQcDownloadButton();
    state.selectedLabel = mergedItems.length === 1 ? `Dropped: ${mergedItems[0].name}` : `Dropped: ${mergedItems.length} images`;
    state.handleWritePermission = false;
    await persistHandleResumeStateFromCurrentSelection("files", {
      selectedLabel: state.selectedLabel,
    });
    updateSelectionInfo();
    maybeRestoreRunCheckpointForSelection();
    const latestDropped = droppedItems[droppedItems.length - 1] || null;
    const latestKey = String(latestDropped && (latestDropped.relativePath || latestDropped.name) || "").toLowerCase();
    const previewItem = (latestKey
      ? mergedItems.find((item) => String(item && (item.relativePath || item.name) || "").toLowerCase() === latestKey)
      : null)
      || latestDropped
      || mergedItems[0]
      || null;
    if (previewItem) {
      try {
        setPreviewLoading(true, "Loading image preview...");
        const file = await itemToFile(previewItem);
        showPreview(file, previewItem);
      } catch (error) {
        appendLog(`Preview load failed: ${error.message}`);
        await showSelectedPreview();
      }
    } else {
      await showSelectedPreview();
    }

    const writableCount = mergedItems.filter((item) => Boolean(item.fileHandle)).length;
    const addedCount = isAppendDrop ? Math.max(0, mergedItems.length - previousCount) : mergedItems.length;
    const droppedCountLabel = droppedInputCount > 0 ? droppedInputCount : droppedItems.length;
    const supportNote = droppedItems.length < droppedCountLabel
      ? ` (${droppedItems.length}/${droppedCountLabel} supported image files)`
      : "";
    const loadedMessage = isAppendDrop
      ? `Dropped ${droppedCountLabel} file(s)${supportNote}. Added ${Math.max(0, addedCount)} new item(s). Queue now has ${mergedItems.length} image(s).`
      : `Dropped ${droppedCountLabel} file(s)${supportNote}. Queue now has ${mergedItems.length} image(s).`;
    if (writableCount === mergedItems.length) {
      setStatus(loadedMessage);
      if (!isAppendDrop && mergedItems.length === 1) {
        await autoStartSingleImage("Single dropped image loaded.");
      }
      return;
    }

    setStatus(
      `${loadedMessage} Direct write access is unavailable for ${mergedItems.length - writableCount}/${mergedItems.length} image(s). ` +
      "Use Select Image/Folder for in-place metadata saving."
    );
    if (!isAppendDrop && mergedItems.length === 1) {
      await autoStartSingleImage("Single dropped image loaded.");
    } else {
      appendLog("Dropped files loaded. Waiting for manual Start Processing.");
    }
  } catch (error) {
    setPreviewLoading(false);
    setStatus(`Drop failed: ${error.message}`);
  }
}

async function analyzeFile(file, options = {}) {
  const { runId = null, signal = null } = options;
  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("high_recall", highRecallToggle && highRecallToggle.checked ? "1" : "0");
  formData.append("fast_mode", fastModeToggle && fastModeToggle.checked ? "1" : "0");
  formData.append("caption_model", selectedCaptionModel());
  formData.append("detector_model", selectedDetectorModel());
  if (runId) {
    formData.append("run_id", runId);
  }

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
    signal,
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Analyze request failed.");
  }
  return payload.metadata;
}

async function analyzeLocalItem(item, options = {}) {
  const { runId = null, signal = null } = options;
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const payloadBody = {
    session_id: state.localSessionId,
    index: item.localIndex,
    high_recall: Boolean(highRecallToggle && highRecallToggle.checked),
    fast_mode: Boolean(fastModeToggle && fastModeToggle.checked),
    caption_model: selectedCaptionModel(),
    detector_model: selectedDetectorModel(),
  };
  if (runId) {
    payloadBody.run_id = runId;
  }
  const response = await fetch("/api/local/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadBody),
    signal,
  });
  const payload = await readJsonResponse(response);
  return payload.metadata;
}

async function cancelServerRun(runId) {
  if (!runId) {
    return;
  }
  try {
    await fetch("/api/cancel-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
    });
  } catch (_) {
    // Best effort; client abort already stops waiting on the request.
  }
}

async function embedFile(file, metadata) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("metadata", JSON.stringify(metadata));

  const response = await fetch("/api/embed", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorJson = JSON.parse(text);
      throw new Error(errorJson.error || "Embed request failed.");
    } catch (_) {
      throw new Error(text || "Embed request failed.");
    }
  }

  return response.blob();
}

async function removeFileMetadata(file) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  const response = await fetch("/api/remove", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorJson = JSON.parse(text);
      throw new Error(errorJson.error || "Remove metadata request failed.");
    } catch (_) {
      throw new Error(text || "Remove metadata request failed.");
    }
  }
  return response.blob();
}

async function saveUpdatedImage(item, blob, filename) {
  if (!item.fileHandle) {
    throw new Error("In-place save requires file handle access. Re-select using Select Folder or Select Image.");
  }
  const query = await item.fileHandle.queryPermission({ mode: "readwrite" });
  if (query !== "granted") {
    throw new Error(
      `Write permission not granted for ${filename}. Click Start Processing to grant permission first, then run again.`
    );
  }
  const writable = await item.fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function ensureWritablePermissionsForRun(interactive = false) {
  if (state.sourceMode !== "handle") {
    return true;
  }
  if (!state.items.length) {
    return true;
  }

  const handleItems = state.items.filter((item) => Boolean(item.fileHandle));
  if (handleItems.length !== state.items.length) {
    return false;
  }

  if (interactive) {
    // User activation can be lost after awaited calls; request permissions immediately.
    const results = await Promise.all(handleItems.map(async (item) => {
      try {
        return await item.fileHandle.requestPermission({ mode: "readwrite" });
      } catch (_) {
        return "denied";
      }
    }));
    return results.every((perm) => perm === "granted");
  }

  for (const item of handleItems) {
    const perm = await item.fileHandle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      return false;
    }
  }
  return true;
}

async function embedLocalItem(item, metadata) {
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const response = await fetch("/api/local/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.localSessionId,
      index: item.localIndex,
      metadata,
    }),
  });
  await readJsonResponse(response);
}

async function removeLocalItemMetadata(item) {
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const response = await fetch("/api/local/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.localSessionId,
      index: item.localIndex,
    }),
  });
  await readJsonResponse(response);
}

async function verifyFileMetadata(file, options = {}) {
  const { signal = null, runId = "" } = options;
  const formData = new FormData();
  formData.append("image", file, file.name);
  if (runId) {
    formData.append("run_id", String(runId));
  }
  const response = await fetch("/api/verify", {
    method: "POST",
    body: formData,
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Verify request failed.");
  }
  return payload.metadata;
}

async function verifyLocalItem(item, options = {}) {
  const { signal = null, runId = "" } = options;
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const response = await fetch("/api/local/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.localSessionId,
      index: item.localIndex,
      run_id: runId || undefined,
    }),
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Verify request failed.");
  }
  return payload.metadata;
}

async function checkFileMetadata(file, metadata, options = {}) {
  const { signal = null, runId = "" } = options;
  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("metadata", JSON.stringify(metadata || {}));
  if (runId) {
    formData.append("run_id", String(runId));
  }
  const response = await fetch("/api/check-metadata", {
    method: "POST",
    body: formData,
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Metadata check request failed.");
  }
  return payload;
}

async function checkLocalItemMetadata(item, metadata, options = {}) {
  const { signal = null, runId = "" } = options;
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const response = await fetch("/api/local/check-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.localSessionId,
      index: item.localIndex,
      metadata,
      run_id: runId || undefined,
    }),
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Metadata check request failed.");
  }
  return payload;
}

async function checkFileIpRisk(file, metadata, options = {}) {
  const { signal = null, runId = "" } = options;
  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("metadata", JSON.stringify(metadata || {}));
  if (runId) {
    formData.append("run_id", String(runId));
  }
  const response = await fetch("/api/check-ip-risk", {
    method: "POST",
    body: formData,
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "IP risk check request failed.");
  }
  return payload;
}

async function checkLocalItemIpRisk(item, metadata, options = {}) {
  const { signal = null, runId = "" } = options;
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const response = await fetch("/api/local/check-ip-risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.localSessionId,
      index: item.localIndex,
      metadata,
      run_id: runId || undefined,
    }),
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "IP risk check request failed.");
  }
  return payload;
}

async function auditFileMetadata(file, options = {}) {
  const {
    metadata = null,
    metadataCheck = true,
    ipRiskCheck = false,
    signal = null,
    runId = "",
  } = options;
  const formData = new FormData();
  formData.append("image", file, file.name);
  if (metadata && typeof metadata === "object") {
    formData.append("metadata", JSON.stringify(metadata));
  }
  formData.append("metadata_check", metadataCheck ? "1" : "0");
  formData.append("ip_risk_check", ipRiskCheck ? "1" : "0");
  if (runId) {
    formData.append("run_id", String(runId));
  }
  const response = await fetch("/api/audit", {
    method: "POST",
    body: formData,
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Audit request failed.");
  }
  return payload;
}

async function auditLocalItemMetadata(item, options = {}) {
  if (!state.localSessionId) {
    throw new Error("Missing local session.");
  }
  const {
    metadata = null,
    metadataCheck = true,
    ipRiskCheck = false,
    signal = null,
    runId = "",
  } = options;
  const response = await fetch("/api/local/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.localSessionId,
      index: item.localIndex,
      metadata,
      metadata_check: Boolean(metadataCheck),
      ip_risk_check: Boolean(ipRiskCheck),
      run_id: runId || undefined,
    }),
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Local audit request failed.");
  }
  return payload;
}

async function auditMetadataForItem(item, options = {}, fileHint = null) {
  const merged = {
    metadata: null,
    metadataCheck: true,
    ipRiskCheck: false,
    ...options,
  };
  if (state.sourceMode === "local") {
    return await auditLocalItemMetadata(item, merged);
  }
  return await auditFileMetadata(fileHint || await itemToFile(item), merged);
}

function metadataCheckEnabled() {
  return Boolean(checkMetadataToggle && checkMetadataToggle.checked);
}

function collectMissingMetadataFields(metadata) {
  const normalized = normalizeMetadata(metadata);
  const missing = [];
  if (!normalized.description) {
    missing.push("description");
  }
  if (!normalized.objects.length) {
    missing.push("keywords");
  }
  if (!normalized.actions.length) {
    missing.push("actions");
  }
  if (!normalized.categories.length) {
    missing.push("categories");
  }
  if (!Array.isArray(normalized.colors) || !normalized.colors.length) {
    missing.push("colors");
  }
  return missing;
}

function metadataNeedsFullAnalysisAfterCheck(issues = [], missing = []) {
  const normalizedMissing = Array.isArray(missing)
    ? missing.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (normalizedMissing.length) {
    return true;
  }
  const normalizedIssues = Array.isArray(issues)
    ? issues.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  return normalizedIssues.some((issue) => (
    issue === "description invalid"
    || issue === "description corrected"
    || issue === "low-confidence-metadata"
    || issue === "low-confidence-categories"
  ));
}

async function checkMetadataForItem(item, metadata, fileHint = null, force = false, options = {}) {
  if (!force && !metadataCheckEnabled()) {
    return {
      metadata,
      changed: false,
      issues: [],
      missing: collectMissingMetadataFields(metadata),
      elapsed_ms: 0,
    };
  }

  const signal = options && options.signal ? options.signal : null;
  const runId = options && options.runId ? String(options.runId) : "";
  const payload = state.sourceMode === "local"
    ? await checkLocalItemMetadata(item, metadata, { signal, runId })
    : await checkFileMetadata(fileHint || await itemToFile(item), metadata, { signal, runId });

  return {
    metadata: payload.metadata || metadata,
    changed: Boolean(payload.changed),
    issues: Array.isArray(payload.issues) ? payload.issues.map((x) => String(x).trim()).filter(Boolean) : [],
    missing: Array.isArray(payload.missing) ? payload.missing.map((x) => String(x).trim()).filter(Boolean) : [],
    elapsed_ms: Number(payload.elapsed_ms || 0),
  };
}

function metadataIpRiskLevel(metadata) {
  const normalized = normalizeMetadata(metadata);
  return String(normalized.ip_risk && normalized.ip_risk.level ? normalized.ip_risk.level : "none").toLowerCase();
}

function metadataHasIpRiskSignal(metadata) {
  const normalized = normalizeMetadata(metadata);
  const risk = normalized.ip_risk || {};
  const level = String(risk.level || "none").toLowerCase();
  const score = Number(risk.score);
  const matches = Array.isArray(risk.matches) ? risk.matches.filter(Boolean) : [];
  return level !== "none" || (Number.isFinite(score) && score > 0) || matches.length > 0;
}

async function checkIpRiskForItem(item, metadata, fileHint = null, force = false, options = {}) {
  if (!force && !ipRiskCheckEnabled()) {
    return {
      metadata,
      changed: false,
      ip_risk: normalizeMetadata(metadata).ip_risk,
      elapsed_ms: 0,
    };
  }

  const signal = options && options.signal ? options.signal : null;
  const runId = options && options.runId ? String(options.runId) : "";
  const payload = state.sourceMode === "local"
    ? await checkLocalItemIpRisk(item, metadata, { signal, runId })
    : await checkFileIpRisk(fileHint || await itemToFile(item), metadata, { signal, runId });
  const nextMeta = payload.metadata || metadata;
  return {
    metadata: nextMeta,
    changed: Boolean(payload.changed),
    ip_risk: normalizeMetadata(nextMeta).ip_risk,
    elapsed_ms: Number(payload.elapsed_ms || 0),
  };
}

async function runWithAbortController(task) {
  const controller = new AbortController();
  state.activeAnalyzeAbortController = controller;
  try {
    return await task(controller.signal);
  } finally {
    if (state.activeAnalyzeAbortController === controller) {
      state.activeAnalyzeAbortController = null;
    }
  }
}

function repairOnlyEnabled() {
  return Boolean(repairOnlyToggle && repairOnlyToggle.checked);
}

function auditOnlyEnabled() {
  return Boolean(auditOnlyToggle && auditOnlyToggle.checked);
}

function removeOnlyEnabled() {
  return Boolean(removeOnlyToggle && removeOnlyToggle.checked);
}

function duplicateDetectionEnabled() {
  return Boolean(detectDuplicatesToggle && detectDuplicatesToggle.checked);
}

function ipRiskCheckEnabled() {
  return Boolean(ipRiskToggle && ipRiskToggle.checked);
}

function updateQcDownloadButton() {}

function metadataOverallConfidence(metadata) {
  const normalized = normalizeMetadata(metadata);
  const conf = normalized.confidence || {};
  const values = Object.values(conf)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  if (!values.length) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function addQcFinding(item, metadata, issues = [], missing = [], extras = {}) {
  const overall = metadataOverallConfidence(metadata);
  const entry = {
    file: String(item && item.relativePath ? item.relativePath : ""),
    issues: Array.isArray(issues) ? issues : [],
    missing: Array.isArray(missing) ? missing : [],
    confidence: Number.isFinite(overall) ? Number(overall.toFixed(3)) : 0,
    ...extras,
  };
  if (entry.confidence < 0.5) {
    entry.issues = [...entry.issues, "low-confidence-metadata"];
  }
  if (entry.issues.length || entry.missing.length) {
    state.qcFindings.push(entry);
  }
}

async function readEmbeddedMetadataForItem(item) {
  if (state.sourceMode === "local") {
    try {
      return await verifyLocalItem(item);
    } catch (_) {
      return null;
    }
  }
  try {
    const file = await itemToFile(item);
    return await verifyFileMetadata(file);
  } catch (_) {
    return null;
  }
}

function downloadTextFile(filename, text) {
  const blob = new Blob([String(text || "")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function exportMetadataIndexJsonl() {
  if (!state.allItems.length) {
    setStatus("No files selected for export.");
    return;
  }
  setStatus("Exporting metadata index (.jsonl)...");
  const lines = [];
  for (let i = 0; i < state.allItems.length; i += 1) {
    const item = state.allItems[i];
    const metadata = await readEmbeddedMetadataForItem(item);
    const normalized = normalizeMetadata(metadata || {});
    lines.push(JSON.stringify({
      path: item.relativePath,
      metadata: normalized,
      missing: collectMissingMetadataFields(normalized),
      confidence: metadataOverallConfidence(normalized),
    }));
    if ((i + 1) % 50 === 0 || i + 1 === state.allItems.length) {
      setStatus(`Exporting metadata index ${i + 1}/${state.allItems.length}`, { log: false });
    }
  }
  downloadTextFile("metadata_index.jsonl", `${lines.join("\n")}\n`);
  setStatus(`Metadata index exported (${lines.length} row(s)).`);
}

function exportLiveLogText() {
  if (!liveLog || !liveLog.childElementCount) {
    setStatus("No live log entries to export.");
    return;
  }
  const lines = Array.from(liveLog.children)
    .map((node) => String(node && node.textContent ? node.textContent : "").trim())
    .filter(Boolean);
  if (!lines.length) {
    setStatus("No live log entries to export.");
    return;
  }
  downloadTextFile("image_metadata_live_log.txt", `${lines.join("\n")}\n`);
  setStatus(`Live log exported (${lines.length} line(s)).`);
}

function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 64;
  }
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      out += 1;
    }
  }
  return out;
}

async function imageBlobForItem(item, fileHint = null) {
  if (state.sourceMode === "local") {
    if (!state.localSessionId) {
      return null;
    }
    const sid = encodeURIComponent(state.localSessionId);
    const response = await fetch(`/api/local/preview/${sid}/${item.localIndex}?t=${Date.now()}`);
    if (!response.ok) {
      return null;
    }
    return await response.blob();
  }
  const file = fileHint || await itemToFile(item);
  return file;
}

async function computeDHashForItem(item, fileHint = null) {
  try {
    const blob = await imageBlobForItem(item, fileHint);
    if (!blob) {
      return "";
    }
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return "";
    }
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, 9, 8).data;
    let bits = "";
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const idxA = (y * 9 + x) * 4;
        const idxB = (y * 9 + (x + 1)) * 4;
        const grayA = (pixels[idxA] * 299 + pixels[idxA + 1] * 587 + pixels[idxA + 2] * 114);
        const grayB = (pixels[idxB] * 299 + pixels[idxB + 1] * 587 + pixels[idxB + 2] * 114);
        bits += grayA > grayB ? "1" : "0";
      }
    }
    return bits;
  } catch (_) {
    return "";
  }
}

function registerDuplicateFingerprint(itemPath, hash) {
  if (!hash) {
    return null;
  }
  const keys = Object.keys(state.duplicateMap || {});
  for (const existingHash of keys) {
    const dist = hammingDistance(existingHash, hash);
    if (dist <= 4) {
      return { duplicateOf: state.duplicateMap[existingHash], distance: dist };
    }
  }
  state.duplicateMap[hash] = itemPath;
  return null;
}

function listContainsAllCaseInsensitive(actualList, expectedList) {
  const actual = new Set((actualList || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
  for (const entry of expectedList || []) {
    const key = String(entry || "").trim().toLowerCase();
    if (!key) {
      continue;
    }
    if (!actual.has(key)) {
      return false;
    }
  }
  return true;
}

function metadataLooksPersisted(actualMetadata, expectedMetadata) {
  const actual = normalizeMetadata(actualMetadata);
  const expected = normalizeMetadata(expectedMetadata);

  const expectedDescription = String(expected.description || "").trim();
  const actualDescription = String(actual.description || "").trim();
  if (expectedDescription) {
    if (!actualDescription) {
      return false;
    }
    if (actualDescription !== expectedDescription) {
      const actualNorm = actualDescription.toLowerCase();
      const expectedNorm = expectedDescription.toLowerCase();
      if (!(expectedNorm.startsWith(actualNorm) || actualNorm.startsWith(expectedNorm))) {
        return false;
      }
    }
  }
  if (!listContainsAllCaseInsensitive(actual.objects, expected.objects)) {
    return false;
  }
  if (!listContainsAllCaseInsensitive(actual.actions, expected.actions)) {
    return false;
  }
  if (!listContainsAllCaseInsensitive(actual.custom_tags, expected.custom_tags)) {
    return false;
  }
  if (!listContainsAllCaseInsensitive(actual.categories, expected.categories)) {
    return false;
  }
  if (Array.isArray(expected.colors) && expected.colors.length) {
    if (!Array.isArray(actual.colors) || !actual.colors.length) {
      return false;
    }
  }
  const expectedIpLevel = metadataIpRiskLevel(expected);
  if (expectedIpLevel !== "none") {
    const actualIpLevel = metadataIpRiskLevel(actual);
    if (actualIpLevel !== expectedIpLevel) {
      return false;
    }
  }
  return true;
}

function metadataSemanticallyEquivalent(a, b) {
  return metadataLooksPersisted(a, b) && metadataLooksPersisted(b, a);
}

async function verifyWritePersisted(item, expectedMetadata) {
  let persisted;
  if (state.sourceMode === "local") {
    persisted = await verifyLocalItem(item);
  } else {
    const verifyFile = await itemToFile(item);
    persisted = await verifyFileMetadata(verifyFile);
  }
  if (!metadataLooksPersisted(persisted, expectedMetadata)) {
    throw new Error("Metadata write could not be verified from the saved file.");
  }
}

async function writeMetadataForItem(item, metadata, fileHint = null, options = {}) {
  const verifyAfterWrite = options.verifyAfterWrite !== false;
  if (state.sourceMode === "local") {
    await embedLocalItem(item, metadata);
    if (verifyAfterWrite) {
      await verifyWritePersisted(item, metadata);
    }
    return;
  }
  const file = fileHint || await itemToFile(item);
  if (!item.fileHandle) {
    throw new Error("This dropped file does not provide direct write access. Re-select using Select Image/Folder.");
  }
  const updatedBlob = await embedFile(file, metadata);
  await saveUpdatedImage(item, updatedBlob, item.name);
  if (verifyAfterWrite) {
    await verifyWritePersisted(item, metadata);
  }
}

async function removeMetadataForItem(item, fileHint = null) {
  if (state.sourceMode === "local") {
    await removeLocalItemMetadata(item);
    return;
  }
  const file = fileHint || await itemToFile(item);
  if (!item.fileHandle) {
    throw new Error("This dropped file does not provide direct write access. Re-select using Select Image/Folder.");
  }
  const updatedBlob = await removeFileMetadata(file);
  await saveUpdatedImage(item, updatedBlob, item.name);
}

async function tryLoadEmbeddedMetadata(item, file = null, options = {}) {
  const { signal = null, runId = "" } = options;
  try {
    if (state.sourceMode === "local") {
      return await verifyLocalItem(item, { signal, runId });
    }
    const sourceFile = file || await itemToFile(item);
    return await verifyFileMetadata(sourceFile, { signal, runId });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw error;
    }
    const message = String(error && error.message ? error.message : "");
    if (message.toLowerCase().includes("no embedded metadata found")) {
      return null;
    }
    appendLog(`Embedded metadata read failed on ${item.relativePath}: ${message || "unknown error"}`);
    return null;
  }
}

function dedupeListCaseInsensitive(items) {
  const out = [];
  const seen = new Set();
  for (const raw of items || []) {
    const value = String(raw || "").trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizeTextForComparison(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filenameStemFromPath(pathText) {
  const raw = String(pathText || "").split("/").pop() || "";
  return raw.replace(/\.[^.]+$/, "");
}

function looksLikeFilenameDescription(description, itemPath = "") {
  const text = String(description || "").trim();
  if (!text) {
    return false;
  }
  const normalized = normalizeTextForComparison(text);
  const stem = filenameStemFromPath(itemPath);
  const stemNormalized = normalizeTextForComparison(stem);
  if (stemNormalized && (normalized.includes(stemNormalized) || stemNormalized.includes(normalized))) {
    return true;
  }
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(text)) {
    return true;
  }
  if (/--profile|job id|--v[_ -]?\d+|run\d+/i.test(text)) {
    return true;
  }
  if (normalized.split(" ").length <= 3 && /[_-]/.test(text)) {
    return true;
  }
  return false;
}

function applyDescriptionCorrections(text) {
  const input = String(text || "").trim();
  if (!input) {
    return "";
  }
  const normalizedInput = input.replace(/\bdart(?=\s+(?:vader|maul|sidious|revan)\b)/gi, (match) => {
    if (match === match.toUpperCase()) {
      return "DARTH";
    }
    if (match[0] === match[0].toUpperCase()) {
      return "Darth";
    }
    return "darth";
  });
  return normalizedInput.replace(/[A-Za-z][A-Za-z'-]{2,}/g, (token) => {
    const lower = token.toLowerCase();
    const replacement = DESCRIPTION_TYPO_CORRECTIONS.get(lower);
    if (!replacement) {
      return token;
    }
    if (token === token.toUpperCase()) {
      return replacement.toUpperCase();
    }
    if (token[0] === token[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

function chooseMergedDescription(existingDescription, generatedDescription, item = null) {
  const existing = applyDescriptionCorrections(existingDescription);
  const generated = applyDescriptionCorrections(generatedDescription);
  if (!existing) {
    return generated;
  }
  if (!generated) {
    return existing;
  }

  const itemPath = item && item.relativePath ? item.relativePath : "";
  const existingFilenameLike = looksLikeFilenameDescription(existing, itemPath);
  const generatedFilenameLike = looksLikeFilenameDescription(generated, itemPath);
  if (existingFilenameLike && !generatedFilenameLike) {
    return generated;
  }
  return existing;
}

function mergeGeneratedWithExisting(generated, existing, item = null) {
  const generatedMeta = normalizeMetadata(generated);
  if (!existing) {
    return generatedMeta;
  }
  const existingMeta = normalizeMetadata(existing);
  const generatedRisk = generatedMeta.ip_risk || { level: "none", score: 0, matches: [] };
  const generatedRiskLevel = String(generatedRisk.level || "none").toLowerCase();
  const generatedRiskScore = Number(generatedRisk.score || 0);
  const generatedRiskMatches = Array.isArray(generatedRisk.matches) ? generatedRisk.matches : [];
  const generatedHasRiskSignal = (
    (generatedRiskLevel !== "none")
    || (Number.isFinite(generatedRiskScore) && generatedRiskScore > 0)
    || generatedRiskMatches.length > 0
  );
  return {
    description: chooseMergedDescription(existingMeta.description, generatedMeta.description, item),
    objects: dedupeListCaseInsensitive([...existingMeta.objects, ...generatedMeta.objects]),
    actions: dedupeListCaseInsensitive([...existingMeta.actions, ...generatedMeta.actions]),
    custom_tags: dedupeListCaseInsensitive([...existingMeta.custom_tags, ...generatedMeta.custom_tags]),
    categories: dedupeListCaseInsensitive([...existingMeta.categories, ...generatedMeta.categories]),
    colors: Array.isArray(generatedMeta.colors) && generatedMeta.colors.length ? generatedMeta.colors : existingMeta.colors,
    confidence: (generatedMeta.confidence && Object.keys(generatedMeta.confidence).length)
      ? generatedMeta.confidence
      : existingMeta.confidence,
    ip_risk: generatedHasRiskSignal
      ? generatedMeta.ip_risk
      : existingMeta.ip_risk,
  };
}

function askForConfirmation() {
  setConfirmationControls(true);
  setStatus("Review the generated metadata, then click Save Metadata to continue.", {
    toast: false,
    allowProcessingToast: true,
  });
  return new Promise((resolve) => {
    state.pendingConfirm = resolve;
  });
}

function resolveConfirmation(value) {
  if (!state.pendingConfirm) {
    return;
  }
  const resolver = state.pendingConfirm;
  state.pendingConfirm = null;
  setConfirmationControls(false);
  resolver(value);
}

async function startProcessing() {
  if (!state.items.length || state.processing) {
    return;
  }

  if (state.sourceMode === "handle") {
    persistHandleResumeStateFromCurrentSelection(
      state.lastDirectoryHandle ? "directory" : "files",
      { directoryHandle: state.lastDirectoryHandle || null, selectedLabel: state.selectedLabel }
    ).catch((error) => {
      appendLog(`Handle resume save skipped: ${error && error.message ? error.message : "unknown error"}`);
    });
  }

  const total = state.items.length;
  const modeAudit = auditOnlyEnabled();
  const modeRepairOnly = repairOnlyEnabled();
  const modeRemoveOnly = removeOnlyEnabled();
  const modeCheck = !modeRemoveOnly && (metadataCheckEnabled() || modeRepairOnly || modeAudit);
  const modeDuplicate = !modeRemoveOnly && duplicateDetectionEnabled();
  const modeIpRisk = !modeRemoveOnly && ipRiskCheckEnabled();
  const checkpointMatched = state.ignoreCheckpointOnce ? false : applyCheckpointToCurrentSelection({ announce: false });
  state.ignoreCheckpointOnce = false;
  const startIndex = checkpointMatched ? clampInteger(state.resumeNextIndex, 0, total) : 0;
  const restoredStats = checkpointMatched ? normalizeRunStats(state.resumeStats) : defaultRunStats();

  state.processing = true;
  state.stopRequested = false;
  state.skipCurrentRequested = false;
  state.skipNextRequested = false;
  state.currentStage = "starting";
  state.runId = createRunId();
  state.activeAnalyzeAbortController = null;
  state.activePreScanAbortController = null;
  state.currentIndex = startIndex;
  state.runStartCompletedCount = startIndex;
  state.lastProgressCompleted = startIndex;
  state.lastProgressTotal = total;
  state.qcFindings = [];
  state.duplicateMap = {};
  startRunElapsedTimer();
  setRunStateMessage("");
  setConfirmationControls(false);
  setControlsForRun(true);
  announceRunControlsAvailable();

  let added = restoredStats.added;
  let skipped = restoredStats.skipped;
  let failed = restoredStats.failed;
  let completed = startIndex;
  let writesPerformed = 0;
  const runTiming = {
    items: 0,
    totalMs: 0,
    readMs: 0,
    analyzeMs: 0,
    writeMs: 0,
    confirmMs: 0,
  };
  const logItemTiming = (itemPath, status, timing) => {
    const safeTiming = timing || {};
    const totalMs = Math.max(0, Number(safeTiming.totalMs || 0));
    const readMs = Math.max(0, Number(safeTiming.readMs || 0));
    const analyzeMs = Math.max(0, Number(safeTiming.analyzeMs || 0));
    const writeMs = Math.max(0, Number(safeTiming.writeMs || 0));
    const confirmMs = Math.max(0, Number(safeTiming.confirmMs || 0));
    runTiming.items += 1;
    runTiming.totalMs += totalMs;
    runTiming.readMs += readMs;
    runTiming.analyzeMs += analyzeMs;
    runTiming.writeMs += writeMs;
    runTiming.confirmMs += confirmMs;
    const avgMs = runTiming.items > 0 ? runTiming.totalMs / runTiming.items : totalMs;
    const parts = [
      `Timing ${itemPath}`,
      `status=${status}`,
      `total=${formatDurationMs(totalMs)}`,
      `read=${formatDurationMs(readMs)}`,
      `analyze=${formatDurationMs(analyzeMs)}`,
      `write=${formatDurationMs(writeMs)}`,
    ];
    if (confirmMs > 0) {
      parts.push(`confirm=${formatDurationMs(confirmMs)}`);
    }
    parts.push(`avg=${formatDurationMs(avgMs)}`);
    appendLog(parts.join(" | "));
  };
  const hideImageLoadingUi = () => {
    stopImageProgressTimer();
    renderImageProgress(0);
    setPreviewLoading(false);
  };
  const showSkipLoadingUi = () => {
    showSkipOverlay("Skipping files already with metadata");
  };
  const updateRunProgress = () => {
    const progressSideMetric = modeAudit && !modeRepairOnly ? added : skipped;
    updateProgress(completed, total, progressSideMetric);
  };
  let fatalError = null;
  updateRunProgress();
  const modeLabel = highRecallToggle && highRecallToggle.checked ? "ON" : "OFF";
  const fastModeLabel = fastModeToggle && fastModeToggle.checked ? "ON" : "OFF";
  const captionModelLabel = selectedCaptionModel();
  const detectorModelLabel = selectedDetectorModel();
  if (startIndex > 0) {
    appendLog(`Resuming from checkpoint at ${startIndex}/${total}.`);
    setResumeBanner(`Resuming from ${startIndex}/${total}...`);
  } else {
    setResumeBanner("");
  }
  let preSkippedLocalSet = new Set();
  let preSkippedHandleSet = new Set();
  const preSkipEnabled = (!skipExistingToggle || skipExistingToggle.checked) && !modeRepairOnly && !modeAudit && !modeRemoveOnly && !modeIpRisk;
  if (preSkipEnabled) {
    setSkipActivityMessage("Skip-existing mode enabled. Preparing skip scan...");
  } else {
    setSkipActivityMessage("");
  }
  const updateSkipActivityMessage = (reason = "") => {
    if (!preSkipEnabled) {
      return;
    }
    const detail = reason ? `${reason}. ` : "";
    setSkipActivityMessage(`${detail}Skipped so far: ${skipped}/${total}.`);
  };
  if (preSkipEnabled && state.sourceMode === "local" && !modeCheck && !modeIpRisk) {
    state.activePreScanAbortController = new AbortController();
    state.currentStage = "pre-scan";
    setPreScanLoading(true, "Pre-scanning local files for existing keywords/categories...");
    setStatus("Pre-scanning local files for existing keywords/categories...", { log: false, toast: false });
    persistRunCheckpointSnapshot({
      nextIndex: completed,
      stage: "pre-scan",
      status: "running",
      stats: { added, skipped, failed },
    });
    try {
      preSkippedLocalSet = await preScanLocalSkipIndices();
    } catch (error) {
      if (isAbortLikeError(error) || state.stopRequested) {
        state.stopRequested = true;
        appendLog("Pre-scan canceled by user.");
      } else {
        appendLog(`Pre-scan failed: ${error.message}. Continuing without pre-scan skips.`);
      }
      preSkippedLocalSet = new Set();
    } finally {
      state.activePreScanAbortController = null;
      setPreScanLoading(false);
    }
  } else if (preSkipEnabled && state.sourceMode === "handle") {
    state.activePreScanAbortController = new AbortController();
    state.currentStage = "pre-scan";
    setPreScanLoading(true, "Pre-scanning files for existing keywords/categories...");
    setStatus("Pre-scanning files for existing keywords/categories...", { log: false, toast: false });
    persistRunCheckpointSnapshot({
      nextIndex: completed,
      stage: "pre-scan",
      status: "running",
      stats: { added, skipped, failed },
    });
    try {
      preSkippedHandleSet = await preScanHandleSkipIndices();
    } catch (error) {
      if (isAbortLikeError(error) || state.stopRequested) {
        state.stopRequested = true;
        appendLog("Pre-scan canceled by user.");
      } else {
        appendLog(`Pre-scan failed: ${error.message}. Continuing without pre-scan skips.`);
      }
      preSkippedHandleSet = new Set();
    } finally {
      state.activePreScanAbortController = null;
      setPreScanLoading(false);
  }
}

  if (preSkipEnabled) {
    const preScanMatches = state.sourceMode === "local" ? preSkippedLocalSet.size : preSkippedHandleSet.size;
    if (preScanMatches > 0) {
      setSkipActivityMessage(`Skip-existing mode active. Pre-scan found ${preScanMatches} file(s) to skip. Skipped so far: ${skipped}/${total}.`);
    } else {
      setSkipActivityMessage("Skip-existing mode active. Checking files for existing metadata...");
    }
  }
  appendLog(`Run started for ${total} image(s). High recall: ${modeLabel}.`);
  appendLog(`Fast analysis mode: ${fastModeLabel}.`);
  appendLog(`Description model: ${captionModelLabel}.`);
  appendLog(
    `Object detection model: ${detectorModelLabel === DETECTOR_DISABLED_MODEL ? "Disabled (description keywords only)" : detectorModelLabel}.`
  );
  appendLog(`Skip existing keywords/categories: ${skipExistingToggle && skipExistingToggle.checked ? "ON" : "OFF"}.`);
  appendLog(`Metadata check: ${modeCheck ? "ON" : "OFF"}.`);
  const runModeText = modeRemoveOnly ? "remove-only" : (modeAudit ? "audit-only" : (modeRepairOnly ? "repair-only" : "analyze+write"));
  appendLog(`Run mode: ${runModeText}.`);
  appendLog(`Duplicate detection: ${modeDuplicate ? "ON" : "OFF"}.`);
  appendLog(`IP risk check: ${modeIpRisk ? "ON" : "OFF"}.`);
  if (modeAudit) {
    appendLog("Audit optimization: using consolidated per-image audit requests.");
  }
  if ((skipExistingToggle && skipExistingToggle.checked) && (modeCheck || modeDuplicate || modeIpRisk) && !modeRepairOnly && !modeAudit) {
    if (modeIpRisk) {
      appendLog("Skip-existing optimization active. Files missing IP risk metadata will still run IP risk detection.");
    } else {
      appendLog("Fast-skip priority active: files with existing keywords/categories are skipped before metadata/duplicate checks.");
    }
  }
  appendLog(`Write verification: first image and every ${BULK_VERIFY_INTERVAL} image(s) during bulk run.`);
  persistRunCheckpointSnapshot({
    nextIndex: completed,
    stage: "starting",
    status: "running",
    stats: { added, skipped, failed },
  });

  try {
    for (let index = startIndex; index < total; index += 1) {
      state.currentIndex = index;
      if (state.stopRequested) {
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "stopping",
          status: "stopping",
          stats: { added, skipped, failed },
        });
        break;
      }

      const item = state.items[index];
      const itemStartMs = nowMs();
      const itemTiming = {
        readMs: 0,
        analyzeMs: 0,
        writeMs: 0,
        confirmMs: 0,
      };
      persistRunCheckpointSnapshot({
        nextIndex: completed,
        stage: "queued",
        status: "running",
        currentItem: item.relativePath,
        stats: { added, skipped, failed },
      });
      state.skipCurrentRequested = Boolean(state.skipNextRequested);
      state.skipNextRequested = false;
      if (state.skipCurrentRequested) {
        showSkipLoadingUi();
        skipped += 1;
        completed += 1;
        state.currentIndex = completed;
        updateRunProgress();
        updateSkipActivityMessage("Skipped by user request");
        appendLog(`Skipped ${item.relativePath}`);
        logItemTiming(item.relativePath, "skipped", {
          ...itemTiming,
          totalMs: nowMs() - itemStartMs,
        });
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "skipped",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
        });
        state.skipCurrentRequested = false;
        continue;
      }

      if (state.sourceMode === "local") {
        const itemLocalIndex = Number(item.localIndex);
        if (Number.isFinite(itemLocalIndex) && preSkippedLocalSet.has(itemLocalIndex)) {
          showSkipLoadingUi();
          added += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          updateSkipActivityMessage("Skipping existing metadata (pre-scan)");
          setStatus(`[${index + 1}/${total}] Skipping (existing keywords/categories): ${item.relativePath}`, { log: false });
          appendLog(`Skipped ${item.relativePath} (pre-scan: existing keywords/categories).`);
          logItemTiming(item.relativePath, "skip-existing-prescan", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "skipped-existing-prescan",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          continue;
        }
      }
      if (state.sourceMode === "handle" && preSkippedHandleSet.has(index)) {
        showSkipLoadingUi();
        skipped += 1;
        completed += 1;
        state.currentIndex = completed;
        updateRunProgress();
        updateSkipActivityMessage("Skipping existing metadata (pre-scan)");
        setStatus(`[${index + 1}/${total}] Skipping (existing keywords/categories): ${item.relativePath}`, { log: false });
        appendLog(`Skipped ${item.relativePath} (pre-scan: existing keywords/categories).`);
        logItemTiming(item.relativePath, "skip-existing-prescan", {
          ...itemTiming,
          totalMs: nowMs() - itemStartMs,
        });
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "skipped-existing-prescan",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
        });
        continue;
      }

      try {
        let file = null;
        if (state.sourceMode !== "local") {
          const fileLoadStartMs = nowMs();
          file = await itemToFile(item);
          itemTiming.readMs += nowMs() - fileLoadStartMs;
        }

        if (modeRemoveOnly) {
          state.currentItem = item;
          setCurrentFileLabel(item.relativePath);

          let shouldApplyRemove = true;
          if (!autoApplyToggle.checked) {
            state.currentStage = "confirming";
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "confirming",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            setStatus(`[${index + 1}/${total}] Confirm metadata removal: ${item.relativePath}`);
            const confirmStartMs = nowMs();
            const decision = await askForConfirmation();
            itemTiming.confirmMs += nowMs() - confirmStartMs;
            if (decision === null) {
              state.stopRequested = true;
              break;
            }
            shouldApplyRemove = decision;
          }

          if (!shouldApplyRemove) {
            skipped += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            appendLog(`Skipped ${item.relativePath}`);
            logItemTiming(item.relativePath, "skipped", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "skipped",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            continue;
          }

          state.currentStage = "writing";
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "writing",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          setStatus(`[${index + 1}/${total}] Removing metadata: ${item.relativePath}`);
          startImageProgress("Removing metadata...", 84, 98);
          const removeStartMs = nowMs();
          await removeMetadataForItem(item, file);
          itemTiming.writeMs += nowMs() - removeStartMs;
          completeImageProgress("Metadata removed");
          if (state.processing && !state.stopRequested) {
            holdImageProgressOverlay("Preparing next image...");
          } else {
            setPreviewLoading(false);
          }
          state.currentMetadata = normalizeMetadata({});
          renderMetadataView();
          writesPerformed += 1;
          added += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          appendLog(`Removed metadata from ${item.relativePath}`);
          logItemTiming(item.relativePath, "removed", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "written",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          state.currentStage = "idle";
          continue;
        }

        if (modeAudit && !modeRepairOnly) {
          state.currentStage = "checking";
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "checking",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          setStatus(`[${index + 1}/${total}] Auditing metadata quality: ${item.relativePath}`);
          const auditStartMs = nowMs();
          const auditedResult = await runWithAbortController((signal) => auditMetadataForItem(
            item,
            {
              metadata: null,
              metadataCheck: modeCheck,
              ipRiskCheck: modeIpRisk,
              runId: state.runId,
              signal,
            },
            file
          ));
          itemTiming.readMs += nowMs() - auditStartMs;
          if (state.stopRequested) {
            appendLog(`Stop requested while auditing ${item.relativePath}.`);
            break;
          }
          const auditedMetadata = normalizeMetadata(auditedResult.metadata || {});
          const issues = Array.isArray(auditedResult.issues) ? auditedResult.issues : [];
          const missing = Array.isArray(auditedResult.missing) ? auditedResult.missing : collectMissingMetadataFields(auditedMetadata);
          const combinedIssues = [...issues];
          const findingExtras = { source: "audit" };

          if (!Boolean(auditedResult.has_embedded_metadata)) {
            appendLog(`No embedded metadata found for ${item.relativePath}.`);
          }

          if (modeIpRisk) {
            const ipLevel = metadataIpRiskLevel(auditedMetadata);
            const ipMatches = auditedMetadata.ip_risk && Array.isArray(auditedMetadata.ip_risk.matches)
              ? auditedMetadata.ip_risk.matches
              : [];
            if (ipMatches.length > 0 || ipLevel === "high" || ipLevel === "medium") {
              combinedIssues.push(`ip-risk-${ipLevel}`);
              findingExtras.ip_matches = ipMatches;
            }
          }

          if (modeDuplicate) {
            const hash = await computeDHashForItem(item, file);
            if (state.stopRequested) {
              appendLog(`Stop requested while checking duplicates for ${item.relativePath}.`);
              break;
            }
            const duplicateInfo = registerDuplicateFingerprint(item.relativePath, hash);
            if (duplicateInfo) {
              appendLog(
                `Duplicate detected for ${item.relativePath} (matches ${duplicateInfo.duplicateOf}, distance=${duplicateInfo.distance}).`
              );
              combinedIssues.push("duplicate-image");
              findingExtras.duplicate_of = duplicateInfo.duplicateOf;
              findingExtras.distance = duplicateInfo.distance;
            }
          }

          const dedupedIssues = dedupeListCaseInsensitive(combinedIssues);
          if (dedupedIssues.length || missing.length || Boolean(auditedResult.changed)) {
            const issueText = dedupedIssues.length ? `issues: ${dedupedIssues.join(", ")}` : "issues: none";
            const missingText = missing.length ? `missing: ${missing.join(", ")}` : "missing: none";
            appendLog(`Audit ${item.relativePath} | ${issueText} | ${missingText}.`);
          }

          state.currentMetadata = auditedMetadata;
          state.currentItem = item;
          setCurrentFileLabel(item.relativePath);
          renderMetadataView();
          hideImageLoadingUi();
          addQcFinding(item, auditedMetadata, dedupedIssues, missing, findingExtras);

          skipped += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          logItemTiming(item.relativePath, "audited-fast", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "audited",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          continue;
        }

        state.currentStage = "reading";
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "reading",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
        });
        setStatus(`[${index + 1}/${total}] Reading existing metadata: ${item.relativePath}`);
        const readStartMs = nowMs();
        let existingMetadata = await runWithAbortController((signal) => tryLoadEmbeddedMetadata(item, file, { signal, runId: state.runId }));
        itemTiming.readMs += nowMs() - readStartMs;
        if (state.stopRequested) {
          break;
        }
        if (existingMetadata && (!skipExistingToggle || skipExistingToggle.checked) && !modeRepairOnly && !modeAudit) {
          const existingSummary = summarizeExistingSkipMetadata(existingMetadata);
          const canSkipExistingForIpMode = !modeIpRisk || metadataHasIpRiskSignal(existingMetadata);
          if (existingSummary.hasAny && canSkipExistingForIpMode) {
            showSkipLoadingUi();
            skipped += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            updateSkipActivityMessage("Skipping existing metadata");
            setStatus(`[${index + 1}/${total}] Skipping (existing keywords/categories): ${item.relativePath}`, { log: false });
            appendLog(
              `Skipped ${item.relativePath} (existing keywords: ${existingSummary.keywordCount}, categories: ${existingSummary.categoryCount}).`
            );
            logItemTiming(item.relativePath, "skip-existing-fast", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "skipped-existing-fast",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            continue;
          }
        }
        let checkedExistingResult = null;
        let existingMetadataQualityChanged = false;
        let existingMetadataNeedsFullAnalysis = false;
        const baseMetadataForCheck = existingMetadata || normalizeMetadata({});
        if ((modeCheck || modeIpRisk) && (existingMetadata || modeRepairOnly || modeAudit)) {
          if (modeCheck) {
            state.currentStage = "checking";
            setStatus(`[${index + 1}/${total}] Checking metadata quality: ${item.relativePath}`);
            const checkStartMs = nowMs();
            const metadataBeforeCheck = normalizeMetadata(existingMetadata || baseMetadataForCheck);
            checkedExistingResult = await runWithAbortController((signal) => checkMetadataForItem(
              item,
              baseMetadataForCheck,
              file,
              modeCheck,
              { signal, runId: state.runId }
            ));
            itemTiming.readMs += nowMs() - checkStartMs;
            if (state.stopRequested) {
              appendLog(`Stop requested while checking metadata for ${item.relativePath}.`);
              break;
            }
            const metadataAfterCheck = normalizeMetadata(checkedExistingResult.metadata || existingMetadata || baseMetadataForCheck);
            existingMetadata = metadataAfterCheck;
            const checkerMarkedChanged = Boolean(checkedExistingResult.changed);
            const materialChange = !metadataSemanticallyEquivalent(metadataBeforeCheck, metadataAfterCheck);
            existingMetadataQualityChanged = materialChange;
            if (checkerMarkedChanged && !materialChange) {
              appendLog(`Metadata check on ${item.relativePath} reported changes but no material delta was detected; skipping write.`);
            }

            const issues = Array.isArray(checkedExistingResult.issues) ? checkedExistingResult.issues : [];
            const missing = Array.isArray(checkedExistingResult.missing) ? checkedExistingResult.missing : [];
            existingMetadataNeedsFullAnalysis = metadataNeedsFullAnalysisAfterCheck(issues, missing);
            addQcFinding(item, checkedExistingResult.metadata || baseMetadataForCheck, issues, missing, {
              source: "existing-check",
            });
            if (issues.length || missing.length || checkedExistingResult.changed) {
              const issueText = issues.length ? `issues: ${issues.join(", ")}` : "issues: none";
              const missingText = missing.length ? `missing: ${missing.join(", ")}` : "missing: none";
              appendLog(`Metadata check ${item.relativePath} | ${issueText} | ${missingText}.`);
            }
          }

          if (modeIpRisk) {
            state.currentStage = "ip-risk";
            setStatus(`[${index + 1}/${total}] Checking IP risk: ${item.relativePath}`);
            const ipStartMs = nowMs();
            const ipBase = normalizeMetadata(existingMetadata || baseMetadataForCheck);
            const ipChecked = await runWithAbortController((signal) => checkIpRiskForItem(
              item,
              ipBase,
              file,
              modeIpRisk,
              { signal, runId: state.runId }
            ));
            itemTiming.readMs += nowMs() - ipStartMs;
            if (state.stopRequested) {
              appendLog(`Stop requested while checking IP risk for ${item.relativePath}.`);
              break;
            }
            existingMetadata = ipChecked.metadata || existingMetadata || ipBase;
            const ipLevel = metadataIpRiskLevel(existingMetadata);
            const ipMatches = normalizeMetadata(existingMetadata).ip_risk.matches || [];
            if (ipMatches.length > 0 || ipLevel === "high" || ipLevel === "medium") {
              addQcFinding(item, existingMetadata, [`ip-risk-${ipLevel}`], [], {
                source: "ip-risk-existing",
                ip_matches: ipMatches,
              });
            }
            if (ipChecked.changed || ipLevel !== "none") {
              appendLog(
                `IP risk ${item.relativePath} | level: ${ipLevel}${ipMatches.length ? ` | matches: ${ipMatches.slice(0, 6).join(", ")}` : ""}.`
              );
            }
          }

          if (existingMetadataQualityChanged && !modeAudit && !modeRepairOnly && !existingMetadataNeedsFullAnalysis) {
            if (state.sourceMode === "local") {
              setPreviewLoading(true, "Loading image...");
              showLocalPreview(item);
            } else {
              setPreviewLoading(true, "Loading image...");
              showPreview(file, item);
            }
            renderMetadata(existingMetadata);
            setPreviewLoading(false);

            let shouldApplyCheckFix = true;
            if (!autoApplyToggle.checked) {
              state.currentStage = "confirming";
              persistRunCheckpointSnapshot({
                nextIndex: completed,
                stage: "confirming",
                status: "running",
                currentItem: item.relativePath,
                stats: { added, skipped, failed },
              });
              setStatus(`[${index + 1}/${total}] Confirm metadata fixes: ${item.relativePath}`);
              const confirmStartMs = nowMs();
              const decision = await askForConfirmation();
              itemTiming.confirmMs += nowMs() - confirmStartMs;
              if (decision === null) {
                state.stopRequested = true;
                break;
              }
              shouldApplyCheckFix = decision;
            }

            if (!shouldApplyCheckFix) {
              showSkipLoadingUi();
              skipped += 1;
              completed += 1;
              state.currentIndex = completed;
              updateRunProgress();
              appendLog(`Skipped ${item.relativePath}`);
              logItemTiming(item.relativePath, "skipped", {
                ...itemTiming,
                totalMs: nowMs() - itemStartMs,
              });
              persistRunCheckpointSnapshot({
                nextIndex: completed,
                stage: "skipped",
                status: "running",
                currentItem: item.relativePath,
                stats: { added, skipped, failed },
              });
              continue;
            }

            state.currentStage = "writing";
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "writing",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            setStatus(`[${index + 1}/${total}] Writing metadata fixes: ${item.relativePath}`);
            startImageProgress("Writing metadata...", 84, 98);
            const metadataToWrite = applyMetadataEdits(false);
            const verifyAfterWrite = (writesPerformed === 0)
              || (BULK_VERIFY_INTERVAL > 0 && ((writesPerformed + 1) % BULK_VERIFY_INTERVAL === 0));
            const writeStartMs = nowMs();
            await writeMetadataForItem(item, metadataToWrite, file, { verifyAfterWrite });
            itemTiming.writeMs += nowMs() - writeStartMs;
            completeImageProgress("Write complete");
            if (state.processing && !state.stopRequested) {
              holdImageProgressOverlay("Preparing next image...");
            } else {
              setPreviewLoading(false);
            }
            writesPerformed += 1;
            added += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            logWrittenMetadata(item.relativePath, metadataToWrite);
            logItemTiming(item.relativePath, "checked-fixed", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "written",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            state.currentStage = "idle";
            continue;
          }
          if (existingMetadataQualityChanged && existingMetadataNeedsFullAnalysis && !modeAudit && !modeRepairOnly) {
            appendLog(`Metadata check improved ${item.relativePath}, but full analysis will continue because required fields are still missing or low confidence.`);
          }
        }
        let duplicateInfo = null;
        if (modeDuplicate) {
          const hash = await computeDHashForItem(item, file);
          if (state.stopRequested) {
            appendLog(`Stop requested while checking duplicates for ${item.relativePath}.`);
            break;
          }
          duplicateInfo = registerDuplicateFingerprint(item.relativePath, hash);
          if (duplicateInfo) {
            appendLog(
              `Duplicate detected for ${item.relativePath} (matches ${duplicateInfo.duplicateOf}, distance=${duplicateInfo.distance}).`
            );
            addQcFinding(item, existingMetadata || baseMetadataForCheck, ["duplicate-image"], [], {
              duplicate_of: duplicateInfo.duplicateOf,
              distance: duplicateInfo.distance,
            });
          }
        }

        if (modeAudit || modeRepairOnly) {
          if (state.stopRequested) {
            appendLog(`Stop requested before finalizing metadata for ${item.relativePath}.`);
            break;
          }
          const repaired = normalizeMetadata((checkedExistingResult && checkedExistingResult.metadata) || existingMetadata || baseMetadataForCheck);
          if (duplicateInfo) {
            repaired.custom_tags = dedupeListCaseInsensitive([
              ...repaired.custom_tags,
              "duplicate",
              `duplicate_of:${duplicateInfo.duplicateOf}`,
            ]);
          }
          if (state.sourceMode === "local") {
            setPreviewLoading(true, "Loading image...");
            showLocalPreview(item);
          } else {
            setPreviewLoading(true, "Loading image...");
            showPreview(file, item);
          }
          renderMetadata(repaired);
          setPreviewLoading(false);

          const repairChanged = Boolean(
            duplicateInfo
            || !metadataSemanticallyEquivalent(baseMetadataForCheck, repaired)
          );
          const missingFields = checkedExistingResult && Array.isArray(checkedExistingResult.missing)
            ? checkedExistingResult.missing
            : collectMissingMetadataFields(repaired);
          addQcFinding(item, repaired, [], missingFields, { source: modeAudit ? "audit" : "repair" });

          if (modeAudit) {
            added += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            logItemTiming(item.relativePath, "audited", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "audited",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            continue;
          }

          if (!repairChanged) {
            skipped += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            appendLog(`Repair-only: no metadata changes needed for ${item.relativePath}.`);
            logItemTiming(item.relativePath, "repair-nochange", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "repair-nochange",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            continue;
          }

          let shouldApplyRepair = true;
          if (!autoApplyToggle.checked) {
            state.currentStage = "confirming";
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "confirming",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            setStatus(`[${index + 1}/${total}] Confirm repaired metadata: ${item.relativePath}`);
            const confirmStartMs = nowMs();
            const decision = await askForConfirmation();
            itemTiming.confirmMs += nowMs() - confirmStartMs;
            if (decision === null) {
              state.stopRequested = true;
              break;
            }
            shouldApplyRepair = decision;
          }

          if (!shouldApplyRepair) {
            skipped += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            appendLog(`Skipped ${item.relativePath}`);
            logItemTiming(item.relativePath, "skipped", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "skipped",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            continue;
          }

          state.currentStage = "writing";
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "writing",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          setStatus(`[${index + 1}/${total}] Writing repaired metadata: ${item.relativePath}`);
          startImageProgress("Writing metadata...", 84, 98);
          state.currentMetadata = repaired;
          renderMetadataView();
          const metadataToWrite = applyMetadataEdits(false);
          const verifyAfterWrite = (writesPerformed === 0)
            || (BULK_VERIFY_INTERVAL > 0 && ((writesPerformed + 1) % BULK_VERIFY_INTERVAL === 0));
          const writeStartMs = nowMs();
          await writeMetadataForItem(item, metadataToWrite, file, { verifyAfterWrite });
          itemTiming.writeMs += nowMs() - writeStartMs;
          completeImageProgress("Write complete");
          if (state.processing && !state.stopRequested) {
            holdImageProgressOverlay("Preparing next image...");
          } else {
            setPreviewLoading(false);
          }
          writesPerformed += 1;
          added += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          logWrittenMetadata(item.relativePath, metadataToWrite);
          logItemTiming(item.relativePath, "repaired", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "written",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          state.currentStage = "idle";
          continue;
        }
        if (existingMetadata && (!skipExistingToggle || skipExistingToggle.checked)) {
          const existingSummary = summarizeExistingSkipMetadata(existingMetadata);
          const checkedMissing = checkedExistingResult && Array.isArray(checkedExistingResult.missing)
            ? checkedExistingResult.missing.length
            : 0;
          const canSkipExistingForIpMode = !modeIpRisk || metadataHasIpRiskSignal(existingMetadata);
          const canSkipExisting = existingSummary.hasAny && (checkedMissing === 0) && canSkipExistingForIpMode;
          if (canSkipExisting) {
            showSkipLoadingUi();
            skipped += 1;
            completed += 1;
            state.currentIndex = completed;
            updateRunProgress();
            updateSkipActivityMessage("Skipping existing metadata");
            appendLog(
              `Skipped ${item.relativePath} (existing keywords: ${existingSummary.keywordCount}, categories: ${existingSummary.categoryCount}).`
            );
            logItemTiming(item.relativePath, "skip-existing", {
              ...itemTiming,
              totalMs: nowMs() - itemStartMs,
            });
            persistRunCheckpointSnapshot({
              nextIndex: completed,
              stage: "skipped-existing",
              status: "running",
              currentItem: item.relativePath,
              stats: { added, skipped, failed },
            });
            continue;
          }
        }
        if (state.skipCurrentRequested) {
          showSkipLoadingUi();
          skipped += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          appendLog(`Skipped ${item.relativePath}`);
          logItemTiming(item.relativePath, "skipped", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "skipped",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          state.skipCurrentRequested = false;
          continue;
        }

        if (state.sourceMode === "local") {
          setPreviewLoading(true, "Loading image...");
          showLocalPreview(item);
        } else {
          setPreviewLoading(true, "Loading image...");
          showPreview(file, item);
        }

        state.currentStage = "analyzing";
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "analyzing",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
        });
        setStatus(`[${index + 1}/${total}] Analyzing ${item.relativePath}`);
        startImageProgress("Analyzing image...", 36, 84, { resetFromLeft: true });
        const analyzeController = new AbortController();
        state.activeAnalyzeAbortController = analyzeController;
        let generatedMetadata;
        const analyzeStartMs = nowMs();
        try {
          generatedMetadata = state.sourceMode === "local"
            ? await analyzeLocalItem(item, { runId: state.runId, signal: analyzeController.signal })
            : await analyzeFile(file, { runId: state.runId, signal: analyzeController.signal });
        } finally {
          itemTiming.analyzeMs += nowMs() - analyzeStartMs;
          if (state.activeAnalyzeAbortController === analyzeController) {
            state.activeAnalyzeAbortController = null;
          }
        }
        if (state.stopRequested) {
          break;
        }
        if (state.skipCurrentRequested) {
          showSkipLoadingUi();
          skipped += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          appendLog(`Skipped ${item.relativePath}`);
          logItemTiming(item.relativePath, "skipped", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "skipped",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          state.skipCurrentRequested = false;
          continue;
        }
        let metadata = mergeGeneratedWithExisting(generatedMetadata, existingMetadata, item);
        if (duplicateInfo) {
          metadata.custom_tags = dedupeListCaseInsensitive([
            ...(Array.isArray(metadata.custom_tags) ? metadata.custom_tags : []),
            "duplicate",
            `duplicate_of:${duplicateInfo.duplicateOf}`,
          ]);
        }
        if (modeCheck) {
          state.currentStage = "checking";
          setStatus(`[${index + 1}/${total}] Checking generated metadata: ${item.relativePath}`);
          const checkStartMs = nowMs();
          const checkedGenerated = await runWithAbortController((signal) => checkMetadataForItem(
            item,
            metadata,
            file,
            modeCheck,
            { signal, runId: state.runId }
          ));
          itemTiming.readMs += nowMs() - checkStartMs;
          if (state.stopRequested) {
            appendLog(`Stop requested while checking generated metadata for ${item.relativePath}.`);
            break;
          }
          metadata = checkedGenerated.metadata || metadata;
          const issues = Array.isArray(checkedGenerated.issues) ? checkedGenerated.issues : [];
          const missing = Array.isArray(checkedGenerated.missing) ? checkedGenerated.missing : [];
          addQcFinding(item, metadata, issues, missing, { source: "generated-check" });
          if (issues.length || missing.length || checkedGenerated.changed) {
            const issueText = issues.length ? `issues: ${issues.join(", ")}` : "issues: none";
            const missingText = missing.length ? `missing: ${missing.join(", ")}` : "missing: none";
            appendLog(`Generated metadata check ${item.relativePath} | ${issueText} | ${missingText}.`);
          }
        }
        if (modeIpRisk) {
          state.currentStage = "ip-risk";
          setStatus(`[${index + 1}/${total}] Checking IP risk: ${item.relativePath}`);
          const ipStartMs = nowMs();
          const ipChecked = await runWithAbortController((signal) => checkIpRiskForItem(
            item,
            metadata,
            file,
            modeIpRisk,
            { signal, runId: state.runId }
          ));
          itemTiming.readMs += nowMs() - ipStartMs;
          if (state.stopRequested) {
            appendLog(`Stop requested while checking IP risk for ${item.relativePath}.`);
            break;
          }
          metadata = ipChecked.metadata || metadata;
          const ipLevel = metadataIpRiskLevel(metadata);
          const ipMatches = normalizeMetadata(metadata).ip_risk.matches || [];
          if (ipMatches.length > 0 || ipLevel === "high" || ipLevel === "medium") {
            addQcFinding(item, metadata, [`ip-risk-${ipLevel}`], [], {
              source: "ip-risk-generated",
              ip_matches: ipMatches,
            });
          }
          if (ipChecked.changed || ipLevel !== "none") {
            appendLog(
              `IP risk ${item.relativePath} | level: ${ipLevel}${ipMatches.length ? ` | matches: ${ipMatches.slice(0, 6).join(", ")}` : ""}.`
            );
          }
        }
        completeImageProgress("Analysis complete");
        renderMetadata(metadata);
        if (autoApplyToggle.checked && state.processing && !state.stopRequested) {
          holdImageProgressOverlay("Preparing next step...");
        } else {
          setPreviewLoading(false);
        }
        if (existingMetadata) {
          appendLog(`Merged with existing metadata for ${item.relativePath} to preserve user/app tags.`);
        }

        let shouldApply = true;
        if (!autoApplyToggle.checked) {
          state.currentStage = "confirming";
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "confirming",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          setStatus(`[${index + 1}/${total}] Waiting for confirmation: ${item.relativePath}`);
          const confirmStartMs = nowMs();
          const decision = await askForConfirmation();
          itemTiming.confirmMs += nowMs() - confirmStartMs;
          if (decision === null) {
            state.stopRequested = true;
            break;
          }
          shouldApply = decision;
        }

        if (!shouldApply) {
          showSkipLoadingUi();
          skipped += 1;
          completed += 1;
          state.currentIndex = completed;
          updateRunProgress();
          appendLog(`Skipped ${item.relativePath}`);
          logItemTiming(item.relativePath, "skipped", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "skipped",
            status: "running",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          continue;
        }

        state.currentStage = "writing";
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "writing",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
        });
        setStatus(`[${index + 1}/${total}] Writing metadata: ${item.relativePath}`);
        startImageProgress("Writing metadata...", 84, 98);
        const metadataToWrite = applyMetadataEdits(false);
        const verifyAfterWrite = (writesPerformed === 0)
          || (BULK_VERIFY_INTERVAL > 0 && ((writesPerformed + 1) % BULK_VERIFY_INTERVAL === 0));
        const writeStartMs = nowMs();
        await writeMetadataForItem(item, metadataToWrite, file, { verifyAfterWrite });
        itemTiming.writeMs += nowMs() - writeStartMs;
        completeImageProgress("Write complete");
        if (state.processing && !state.stopRequested) {
          holdImageProgressOverlay("Preparing next image...");
        } else {
          setPreviewLoading(false);
        }
        writesPerformed += 1;
        added += 1;
        completed += 1;
        state.currentIndex = completed;
        updateRunProgress();
        logWrittenMetadata(item.relativePath, metadataToWrite);
        logItemTiming(item.relativePath, "added", {
          ...itemTiming,
          totalMs: nowMs() - itemStartMs,
        });
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "written",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
        });
        state.currentStage = "idle";
      } catch (error) {
        const canceled = isAbortLikeError(error);
        if (state.stopRequested) {
          const suffix = canceled ? "" : ` (${error && error.message ? error.message : "interrupted"})`;
          appendLog(`Analysis stopped for ${item.relativePath}${suffix}.`);
          logItemTiming(item.relativePath, "canceled", {
            ...itemTiming,
            totalMs: nowMs() - itemStartMs,
          });
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "canceled",
            status: "stopped",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
          });
          break;
        }
        if (isLikelyServerConnectionError(error)) {
          stopImageProgressTimer();
          renderImageProgress(0);
          setPreviewLoading(false);
          fatalError = new Error(`Server connection lost while processing ${item.relativePath}: ${error.message}`);
          appendLog(fatalError.message);
          setStatus("Server connection lost. Resume will continue from the last checkpoint after restart.");
          persistRunCheckpointSnapshot({
            nextIndex: completed,
            stage: "connection-lost",
            status: "crashed",
            currentItem: item.relativePath,
            stats: { added, skipped, failed },
            error: fatalError.message,
          });
          break;
        }
        stopImageProgressTimer();
        renderImageProgress(0);
        setPreviewLoading(false);
        failed += 1;
        setStatus(`Error on ${item.relativePath}: ${error.message}`);
        completed += 1;
        state.currentIndex = completed;
        updateRunProgress();
        logItemTiming(item.relativePath, "failed", {
          ...itemTiming,
          totalMs: nowMs() - itemStartMs,
        });
        persistRunCheckpointSnapshot({
          nextIndex: completed,
          stage: "error",
          status: "running",
          currentItem: item.relativePath,
          stats: { added, skipped, failed },
          error: error.message,
        });
        state.currentStage = "idle";
      }
    }
  } catch (error) {
    fatalError = error;
    appendLog(`Run interrupted by unexpected error: ${error.message}`);
    setStatus(`Run crashed: ${error.message}. You can resume from the last checkpoint.`);
    persistRunCheckpointSnapshot({
      nextIndex: clampInteger(state.currentIndex, 0, total),
      stage: "fatal",
      status: "crashed",
      stats: { added, skipped, failed },
      error: error.message,
    });
  }

  state.processing = false;
  state.currentStage = "idle";
  state.skipCurrentRequested = false;
  state.skipNextRequested = false;
  state.activeAnalyzeAbortController = null;
  state.activePreScanAbortController = null;
  state.currentIndex = completed;
  state.runId = null;
  stopRunElapsedTimer();
  setRunStateMessage("");
  setSkipActivityMessage("");
  stopImageProgressTimer();
  renderImageProgress(0);
  setPreviewLoading(false);
  setConfirmationControls(false);
  state.pendingConfirm = null;
  setControlsForRun(false);
  updateRunEstimateDisplay();

  const finishedAll = !fatalError && !state.stopRequested && completed >= total;
  if (finishedAll) {
    clearRunCheckpoint();
    state.resumeNextIndex = 0;
    state.resumeStats = defaultRunStats();
    setResumeBanner("");
    setResumeDetails("");
  } else {
    state.resumeNextIndex = clampInteger(completed, 0, total);
    state.resumeStats = normalizeRunStats({ added, skipped, failed });
    persistRunCheckpointSnapshot({
      nextIndex: state.resumeNextIndex,
      stage: fatalError ? "fatal" : (state.stopRequested ? "stopped" : "paused"),
      status: fatalError ? "crashed" : (state.stopRequested ? "stopped" : "paused"),
      stats: state.resumeStats,
      error: fatalError ? fatalError.message : "",
    });
    setResumeBanner(`Resume available at image ${state.resumeNextIndex} out of ${total} images. Click Start Processing to continue.`);
    const nextItem = state.items[state.resumeNextIndex] ? state.items[state.resumeNextIndex].relativePath : "unknown";
    setResumeDetails(`Source: ${state.sourceMode} | Updated: ${new Date().toLocaleString()} | Next: ${nextItem}`);
  }

  state.lastQcReport = null;
  updateQcDownloadButton();

  if (runTiming.items > 0) {
    const avgTotal = runTiming.totalMs / runTiming.items;
    const avgRead = runTiming.readMs / runTiming.items;
    const avgAnalyze = runTiming.analyzeMs / runTiming.items;
    const avgWrite = runTiming.writeMs / runTiming.items;
    const avgConfirm = runTiming.confirmMs / runTiming.items;
    const summary = [
      `Timing summary`,
      `images=${runTiming.items}`,
      `avg_total=${formatDurationMs(avgTotal)}`,
      `avg_read=${formatDurationMs(avgRead)}`,
      `avg_analyze=${formatDurationMs(avgAnalyze)}`,
      `avg_write=${formatDurationMs(avgWrite)}`,
    ];
    if (runTiming.confirmMs > 0) {
      summary.push(`avg_confirm=${formatDurationMs(avgConfirm)}`);
    }
    appendLog(summary.join(" | "));
  }

  if (fatalError) {
    hideStatusToast();
    return;
  }
  const stopMessage = state.stopRequested ? " Stopped early." : "";
  const resumeMessage = state.stopRequested && completed < total
    ? " Click Start Processing to resume from the checkpoint."
    : "";
  const modeText = modeRemoveOnly ? "remove-only" : (modeAudit ? "audit-only" : (modeRepairOnly ? "repair-only" : "standard"));
  if (modeRemoveOnly) {
    setStatus(`Done (${modeText}). Removed: ${added}, skipped: ${skipped}, failed: ${failed}.${stopMessage}${resumeMessage}`);
  } else if (modeAudit) {
    setStatus(`Done (${modeText}). Reviewed: ${added}, skipped: ${skipped}, failed: ${failed}.${stopMessage}${resumeMessage}`);
  } else {
    setStatus(`Done (${modeText}). Added: ${added}, skipped: ${skipped}, failed: ${failed}.${stopMessage}${resumeMessage}`);
  }
  hideStatusToast();
}

async function beginProcessingFromUi(options = {}) {
  const { interactivePermissions = true } = options;

  if (!state.items.length) {
    if (!autoResumeEnabled()) {
      setStatus("No images selected. Select a folder/image or enable checkpoint resume, then click Start Processing.");
      return false;
    }
    const checkpoint = loadRunCheckpoint();
    const restored = await tryRestorePreviousSession();
    if (!restored || !state.items.length) {
      if (checkpoint) {
        const checkpointSourceMode = String(checkpoint.source_mode || "").toLowerCase();
        if (checkpointSourceMode === "handle") {
          setStatus("Checkpoint found, but the previous browser file/folder access could not be restored. Re-select the same folder or image, then click Start Processing to continue from the checkpoint.");
        } else if (checkpointSourceMode === "local") {
          setStatus("Checkpoint found, but the previous local session could not be restored. Re-select the folder or image, then click Start Processing to continue from the checkpoint.");
        } else {
          setStatus("Checkpoint found, but the previous session could not be restored automatically. Re-select the source, then click Start Processing to continue from the checkpoint.");
        }
      } else {
        setStatus("No restorable session found. Select a folder or image and try again.");
      }
      return false;
    }
    if (state.processing) {
      return false;
    }
  }

  const writeModeEnabled = !auditOnlyEnabled();
  if (state.sourceMode === "handle" && writeModeEnabled) {
    const totalItems = state.items.length;
    const writableItems = countWritableHandleItems();
    if (writableItems < totalItems) {
      const missingCount = totalItems - writableItems;
      setStatus(
        `In-place write access is unavailable for ${missingCount}/${totalItems} dropped image(s) in this browser. ` +
        "Use Select Image/Folder for writable handles, or enable Read-only Audit mode."
      );
      return false;
    }
  }

  const ready = await ensureWritablePermissionsForRun(Boolean(interactivePermissions));
  if (!ready) {
    setStatus(
      "Write permission was denied for one or more selected files. " +
      "Grant permission in the browser prompt, or re-select with Select Image/Folder."
    );
    return false;
  }

  await startProcessing();
  return true;
}

async function autoStartSingleImage(contextLabel) {
  if (state.processing || state.items.length !== 1) {
    return;
  }
  try {
    setStatus(`${contextLabel} Starting processing...`, { log: false, toast: false });
    await beginProcessingFromUi({ interactivePermissions: false });
  } catch (error) {
    setStatus(`Could not start processing: ${error.message}`);
  }
}

async function requestStopProcessing() {
  if (state.pendingConfirm) {
    state.stopRequested = true;
    setRunStateMessage("Cancelling...");
    persistRunCheckpointSnapshot({
      nextIndex: clampInteger(state.currentIndex, 0, state.items.length),
      stage: "stopping",
      status: "stopping",
      stats: state.resumeStats,
    });
    resolveConfirmation(null);
    return;
  }
  if (!state.processing) {
    setRunStateMessage("");
    setStatus("No active run to stop.");
    return;
  }
  if (state.stopRequested) {
    setStatus("Stop already requested.");
    return;
  }
  state.stopRequested = true;
  setRunStateMessage("Cancelling...");
  persistRunCheckpointSnapshot({
    nextIndex: clampInteger(state.currentIndex, 0, state.items.length),
    stage: "stopping",
    status: "stopping",
    stats: state.resumeStats,
  });
  if (state.activeAnalyzeAbortController) {
    try {
      state.activeAnalyzeAbortController.abort();
    } catch (_) {
      // ignore abort race
    }
  }
  if (state.activePreScanAbortController) {
    try {
      state.activePreScanAbortController.abort();
    } catch (_) {
      // ignore abort race
    }
  }
  setStatus("Stop requested. Attempting to interrupt current processing.");
  cancelServerRun(state.runId);
}

function persistCheckpointOnUnexpectedError(message, stage = "error") {
  if (!state.processing) {
    return;
  }
  const text = String(message || "unknown error");
  appendLog(`Crash guard captured: ${text}`);
  persistRunCheckpointSnapshot({
    nextIndex: clampInteger(state.currentIndex, 0, state.items.length),
    stage,
    status: "error",
    stats: state.resumeStats,
    error: text,
  });
}

function initializeCheckpointRecoveryNotice() {
  if (!autoResumeEnabled()) {
    setResumeBanner("");
    setResumeDetails("");
    updateRunControlButton();
    return;
  }
  const checkpoint = loadRunCheckpoint();
  if (!checkpoint) {
    setResumeBanner("");
    setResumeDetails("");
    return;
  }
  const completed = clampInteger(checkpoint.next_index, 0, 1000000);
  const total = clampInteger(checkpoint.total, 0, 1000000);
  const sourceMode = String(checkpoint.source_mode || "unknown").toLowerCase();
  const restoreHint = sourceMode === "handle"
    ? "Click Start Processing to try restore and resume. If browser access is no longer available, re-select the same folder or image."
    : "Click Start Processing to restore and resume.";
  setResumeBanner(`Checkpoint found: ${completed}/${total} completed. ${restoreHint}`);
  const updatedAt = Number(checkpoint.updated_at);
  const updatedText = Number.isFinite(updatedAt) ? new Date(updatedAt).toLocaleString() : "unknown";
  const nextItem = String(checkpoint.current_item || "unknown");
  setResumeDetails(`Source: ${sourceMode} | Updated: ${updatedText} | Next: ${nextItem}`);
  setStatus(
    `Checkpoint detected from a previous run (${completed}/${total}). ${restoreHint}`,
    { log: false }
  );
  appendLog("Checkpoint found from previous run. Click Start Processing to restore and continue.");
  updateRunControlButton();
}

clearMetadataView();
loadAutoResumePreference();
loadDiagnosticsPreference();
loadLastSourceChoice();
initializeCheckpointRecoveryNotice();
updateRunControlButton();
updateFlowStepper();

window.addEventListener("error", (event) => {
  const message = event && event.message ? event.message : "Unhandled runtime error";
  persistCheckpointOnUnexpectedError(message, "window-error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event && "reason" in event ? event.reason : "";
  const message = reason && reason.message ? reason.message : String(reason || "Unhandled promise rejection");
  persistCheckpointOnUnexpectedError(message, "unhandled-rejection");
});

window.addEventListener("beforeunload", () => {
  if (!state.processing) {
    return;
  }
  persistRunCheckpointSnapshot({
    nextIndex: clampInteger(state.currentIndex, 0, state.items.length),
    stage: state.currentStage || "unload",
    status: "interrupted",
    stats: state.resumeStats,
  });
});

applySourceButtonVisibilityForBrowser();

selectFolderBtn.addEventListener("click", selectFolderViaPicker);
selectImageBtn.addEventListener("click", selectSingleImage);
if (serverFolderBtn) {
  serverFolderBtn.addEventListener("click", selectLocalFolderServer);
}
if (serverImageBtn) {
  serverImageBtn.addEventListener("click", selectLocalImageServer);
}
if (inlineStatusCloseBtn) {
  inlineStatusCloseBtn.addEventListener("click", (event) => {
    event.preventDefault();
    hideInlineStatusAlert();
  });
}
async function handleStartButtonActivate() {
  if (state.processing) {
    await requestStopProcessing();
    return;
  }
  if (startBtn.getAttribute("aria-disabled") === "true") {
    return;
  }
  try {
    await beginProcessingFromUi({ interactivePermissions: true });
  } catch (error) {
    setStatus(`Could not start processing: ${error.message}`);
  }
}

startBtn.addEventListener("pointerdown", (event) => {
  if (!state.processing || state.stopRequested) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void requestStopProcessing();
});

startBtn.addEventListener("click", async () => {
  if (state.processing && state.stopRequested) {
    return;
  }
  await handleStartButtonActivate();
});

if (restartBtn) {
  restartBtn.addEventListener("click", async () => {
    if (restartBtn.getAttribute("aria-disabled") === "true") {
      return;
    }
    state.ignoreCheckpointOnce = true;
    state.resumeNextIndex = 0;
    state.resumeStats = defaultRunStats();
    clearRunCheckpoint();
    setResumeBanner("");
    setResumeDetails("");
    updateProgress(0, state.items.length, 0);
    updateRunControlButton();
    try {
      await beginProcessingFromUi({ interactivePermissions: true });
    } catch (error) {
      setStatus(`Could not restart scan: ${error.message}`);
    }
  });
}

if (repairOnlyToggle && checkMetadataToggle) {
  repairOnlyToggle.addEventListener("change", () => {
    if (repairOnlyToggle.checked) {
      checkMetadataToggle.checked = true;
      if (auditOnlyToggle) {
        auditOnlyToggle.checked = false;
      }
      if (removeOnlyToggle) {
        removeOnlyToggle.checked = false;
      }
    }
    updateSelectionInfo();
    updateRemoveOnlyDangerUi();
    updateOptionGroupSummaries();
  });
}

if (auditOnlyToggle && checkMetadataToggle) {
  auditOnlyToggle.addEventListener("change", () => {
    if (auditOnlyToggle.checked) {
      checkMetadataToggle.checked = true;
      if (repairOnlyToggle) {
        repairOnlyToggle.checked = false;
      }
      if (removeOnlyToggle) {
        removeOnlyToggle.checked = false;
      }
    }
    updateSelectionInfo();
    updateRemoveOnlyDangerUi();
    updateOptionGroupSummaries();
    setPreviewLoading(false);
  });
}

if (removeOnlyToggle) {
  removeOnlyToggle.addEventListener("change", () => {
    if (removeOnlyToggle.checked) {
      if (repairOnlyToggle) {
        repairOnlyToggle.checked = false;
      }
      if (auditOnlyToggle) {
        auditOnlyToggle.checked = false;
      }
    }
    updateSelectionInfo();
    updateRemoveOnlyDangerUi();
    updateOptionGroupSummaries();
  });
}

if (checkMetadataToggle) {
  checkMetadataToggle.addEventListener("change", () => {
    if (!checkMetadataToggle.checked) {
      if (repairOnlyToggle) {
        repairOnlyToggle.checked = false;
      }
      if (auditOnlyToggle) {
        auditOnlyToggle.checked = false;
      }
    }
    updateSelectionInfo();
    updateRemoveOnlyDangerUi();
    updateOptionGroupSummaries();
  });
}

if (ipRiskToggle) {
  ipRiskToggle.addEventListener("change", () => {
    updateSelectionInfo();
    updateOptionGroupSummaries();
  });
}

if (diagnosticsToggle) {
  diagnosticsToggle.addEventListener("change", () => {
    saveDiagnosticsPreference();
    updateOptionGroupSummaries();
  });
}

if (autoResumeToggle) {
  autoResumeToggle.addEventListener("change", () => {
    saveAutoResumePreference();
    if (!autoResumeEnabled()) {
      setResumeBanner("");
      setResumeDetails("");
      state.resumeNextIndex = 0;
      state.resumeStats = defaultRunStats();
    } else {
      initializeCheckpointRecoveryNotice();
    }
    updateRunControlButton();
    updateOptionGroupSummaries();
  });
}

function isTypingTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], md-outlined-text-field"));
}

window.addEventListener("keydown", (event) => {
  const key = String(event.key || "");
  const lowerKey = key.toLowerCase();

  if ((event.metaKey || event.ctrlKey) && lowerKey === "s") {
    event.preventDefault();
    if (confirmAddBtn && !confirmAddBtn.disabled) {
      confirmAddBtn.click();
    }
    return;
  }

  if (key === "Escape") {
    return;
  }

  const noModifiers = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  if (key === "Enter" && noModifiers) {
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button, a")) {
      return;
    }
    if (startBtn && !startBtn.disabled) {
      event.preventDefault();
      startBtn.click();
    }
  }
});

if (exportIndexBtn) {
  exportIndexBtn.addEventListener("click", async () => {
    try {
      await exportMetadataIndexJsonl();
    } catch (error) {
      setStatus(`Export failed: ${error.message}`);
    }
  });
}

if (exportLogBtn) {
  exportLogBtn.addEventListener("click", () => {
    try {
      exportLiveLogText();
    } catch (error) {
      setStatus(`Log export failed: ${error.message}`);
    }
  });
}

updateQcDownloadButton();
updateRemoveOnlyDangerUi();
updateOptionGroupSummaries();
initializeOptionAccordions();

document.querySelectorAll(".option-group .option-toggle").forEach((input) => {
  input.addEventListener("change", () => {
    updateOptionGroupSummaries();
  });
});

window.addEventListener("dragover", (event) => {
  event.preventDefault();
});

window.addEventListener("drop", (event) => {
  event.preventDefault();
});

if (previewWrap) {
  const openImagePickerFromPreview = () => {
    const preferredButton = !selectImageBtn || selectImageBtn.classList.contains("hidden")
      ? serverImageBtn
      : selectImageBtn;
    if (!preferredButton || preferredButton.disabled) {
      return;
    }
    preferredButton.click();
  };

  previewWrap.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".drop-warning-card")) {
      return;
    }
    openImagePickerFromPreview();
  });

  previewWrap.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openImagePickerFromPreview();
  });

  previewWrap.addEventListener("dragenter", (event) => {
    event.preventDefault();
    if (!state.processing) {
      previewWrap.classList.add("drop-active");
    }
  });

  previewWrap.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  });

  previewWrap.addEventListener("dragleave", (event) => {
    event.preventDefault();
    if (event.currentTarget === previewWrap) {
      previewWrap.classList.remove("drop-active");
    }
  });

  previewWrap.addEventListener("drop", handleDrop);
}

if (showLogToggle) {
  const syncLogVisibilityFromToggle = () => {
    setLogVisibility(readToggleState(showLogToggle));
  };
  syncLogVisibilityFromToggle();
  showLogToggle.addEventListener("change", syncLogVisibilityFromToggle);
  showLogToggle.addEventListener("input", syncLogVisibilityFromToggle);
}

[
  metaDescriptionEdit,
  metaObjectsEdit,
  metaActionsEdit,
  metaCustomTagsEdit,
  metaCategoriesEdit,
  metaColorsEdit,
].forEach((field) => {
  if (!field) {
    return;
  }
  field.addEventListener("input", updateMetadataDirtyState);
  field.addEventListener("change", updateMetadataDirtyState);
});

if (dropWarningCloseBtn) {
  dropWarningCloseBtn.addEventListener("click", (event) => {
    event.preventDefault();
    hideDropWarningAlert();
  });
}

if (liveLog) {
  liveLog.addEventListener("scroll", () => {
    state.logAutoScroll = isLiveLogNearBottom();
  });
}

if (confirmAddBtn) {
  confirmAddBtn.addEventListener("click", async () => {
    if (state.pendingConfirm) {
      applyMetadataEdits(false);
      resolveConfirmation(true);
      return;
    }

    if (state.processing) {
      setStatus("Processing is running. Wait for the current step to finish before manual save.");
      return;
    }

    const item = state.currentItem || state.items[0];
    if (!item) {
      setStatus("No image selected to save metadata.");
      return;
    }

    try {
      const metadataToWrite = applyMetadataEdits(false);
      setStatus(`Writing metadata: ${item.relativePath}`);
      startImageProgress("Writing metadata...", 84, 98);
      await writeMetadataForItem(item, metadataToWrite);
      completeImageProgress("Write complete");
      setPreviewLoading(false);
      logWrittenMetadata(item.relativePath, metadataToWrite);
      setStatus(`Metadata saved to ${item.relativePath}`);
    } catch (error) {
      stopImageProgressTimer();
      renderImageProgress(0);
      setPreviewLoading(false);
      setStatus(`Save failed on ${item.relativePath}: ${error.message}`);
    }
  });
}

if (removeMetadataBtn) {
  removeMetadataBtn.addEventListener("click", async () => {
    if (state.pendingConfirm) {
      setStatus("Finish or cancel the current confirmation before removing metadata.");
      return;
    }
    if (state.processing) {
      setStatus("Processing is running. Stop processing before removing metadata.");
      return;
    }

    const item = state.currentItem || state.items[0];
    if (!item) {
      setStatus("No image selected to remove metadata.");
      return;
    }

    const confirmed = window.confirm(`Remove embedded metadata from ${item.relativePath}?`);
    if (!confirmed) {
      return;
    }

    try {
      setStatus(`Removing metadata: ${item.relativePath}`);
      startImageProgress("Removing metadata...", 84, 98);
      await removeMetadataForItem(item);
      completeImageProgress("Metadata removed");
      setPreviewLoading(false);
      state.currentMetadata = normalizeMetadata({});
      renderMetadataView();
      appendLog(`Removed metadata from ${item.relativePath}`);
      setStatus(`Metadata removed from ${item.relativePath}`);
    } catch (error) {
      stopImageProgressTimer();
      renderImageProgress(0);
      setPreviewLoading(false);
      setStatus(`Remove metadata failed on ${item.relativePath}: ${error.message}`);
    }
  });
}
