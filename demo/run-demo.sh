#!/bin/bash

# Demo runner for markdown-code
# This script sets up and runs the VHS demo

set -e

echo "🎬 Setting up markdown-code demo..."

# Make sure we're in the demo directory
cd "$(dirname "$0")"

# Build the CLI if needed
echo "📦 Building CLI..."
cd ..
npm run build
cd demo

# Clean up any previous demo artifacts
echo "🧹 Cleaning up previous demo..."
rm -f .markdown-coderc.json
rm -rf snippets/
rm -f demo.gif

echo "🎥 Recording demo with VHS..."
vhs demo.tape

echo "✅ Demo completed!"
echo "🎬 Generated: demo.gif"
echo ""
echo "📖 You can now add this GIF to your README or documentation!" 