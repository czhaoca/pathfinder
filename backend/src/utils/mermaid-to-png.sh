#!/bin/bash

# Mermaid to PNG converter script with architecture support
# Usage: ./scripts/mermaid-to-png.sh <input.mmd> [output.png]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if setup has been run
if [ ! -f "$SCRIPT_DIR/mermaid-wrapper.sh" ]; then
    echo "First time setup required. Running setup script..."
    "$SCRIPT_DIR/setup-mermaid.sh"
    if [ $? -ne 0 ]; then
        echo "Setup failed. Please run ./scripts/setup-mermaid.sh manually"
        exit 1
    fi
fi

if [ $# -eq 0 ]; then
    echo "Usage: $0 <input.mmd> [output.png]"
    echo "Example: $0 diagram.mmd diagram.png"
    echo "If output is not specified, it will use the input filename with .png extension"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-${INPUT_FILE%.mmd}.png}"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found"
    exit 1
fi

echo "Converting $INPUT_FILE to $OUTPUT_FILE..."

# Use the wrapper script that handles architecture differences
"$SCRIPT_DIR/mermaid-wrapper.sh" -i "$INPUT_FILE" -o "$OUTPUT_FILE" -t dark -b transparent --width 2048

if [ $? -eq 0 ]; then
    echo "Successfully generated: $OUTPUT_FILE"
else
    echo "Error: Failed to generate PNG"
    echo "Try running: $SCRIPT_DIR/setup-mermaid.sh"
    exit 1
fi