#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$ROOT_DIR/web_app.py"
VENV_ACTIVATE="$ROOT_DIR/.venv/bin/activate"

if pgrep -f "$APP_PATH" >/dev/null 2>&1; then
  pkill -f "$APP_PATH" || true
  sleep 1
fi

if [[ ! -f "$VENV_ACTIVATE" ]]; then
  echo "Virtualenv not found at $VENV_ACTIVATE"
  echo "Create it first: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# shellcheck disable=SC1090
source "$VENV_ACTIVATE"
export TOKENIZERS_PARALLELISM=false
exec python3 "$APP_PATH"
