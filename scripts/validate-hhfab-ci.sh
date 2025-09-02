#!/usr/bin/env bash
# CI wrapper script for hhfab validation
set -euo pipefail

# Get script directory
SCRIPT_DIR="$(dirname "$0")"

# Load environment from .env file (if it exists)
source "$SCRIPT_DIR/load-env.sh" .env

# Check if HHFAB is configured
if [ -n "${HHFAB:-}" ]; then
  echo "✓ HHFAB configured at: $HHFAB"
  exec node tools/hhfab-validate.mjs "$@"
else
  echo "⚠️  HHFAB not configured, skipping validation"
  echo "To enable hhfab validation, set HHFAB=/path/to/hhfab in your environment"
  exit 0
fi