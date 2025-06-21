#!/bin/bash

# Run all markdown-code demos
# This script builds both extraction and reference demos

set -e

echo "🎬 Building all markdown-code demos..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build extraction demo
echo "📦 Building extraction demo..."
cd "$SCRIPT_DIR/extraction"
./run-demo.sh
cd "$SCRIPT_DIR"

echo ""

# Build reference demo  
echo "📦 Building reference demo..."
cd "$SCRIPT_DIR/reference"
./run-demo.sh
cd "$SCRIPT_DIR"

echo ""
echo "✅ All demos completed!"
echo "🎬 Generated:"
echo "  - extraction/extraction-demo.gif"
echo "  - reference/reference-demo.gif"
echo ""
echo "📖 You can now add these GIFs to your README!" 