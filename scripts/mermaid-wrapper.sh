#!/bin/bash

# Wrapper script for mmdc that handles ARM compatibility

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ARCH=$(uname -m)

# Find Chromium executable
if command -v chromium &> /dev/null; then
    CHROME_PATH=$(which chromium)
elif command -v chromium-browser &> /dev/null; then
    CHROME_PATH=$(which chromium-browser)
elif command -v google-chrome &> /dev/null; then
    CHROME_PATH=$(which google-chrome)
else
    echo "Warning: No Chrome/Chromium found. Trying default path..."
    CHROME_PATH=""
fi

if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    # For ARM, use system Chromium if available
    if [ -n "$CHROME_PATH" ]; then
        export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
        export PUPPETEER_EXECUTABLE_PATH="$CHROME_PATH"
    fi
fi

# Use local mmdc if available, otherwise use global
if [ -f "$PROJECT_ROOT/node_modules/.bin/mmdc" ]; then
    "$PROJECT_ROOT/node_modules/.bin/mmdc" "$@"
else
    mmdc "$@"
fi
