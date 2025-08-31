#!/usr/bin/env bash
# Wrapper script for hhfab validation
set -euo pipefail

# Get script directory
SCRIPT_DIR="$(dirname "$0")"

# Load environment from .env file
source "$SCRIPT_DIR/load-env.sh" .env

# Run validation with all arguments
exec node tools/hhfab-validate.mjs "$@"