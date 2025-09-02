#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="${1:-.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi