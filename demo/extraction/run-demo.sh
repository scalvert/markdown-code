#!/bin/bash

# Extraction Demo runner for markdown-code
# This script sets up and runs the extraction workflow demo

set -e

echo "🎬 Setting up markdown-code extraction demo..."

# Make sure we're in the extraction demo directory
cd "$(dirname "$0")"

# Build the CLI if needed
echo "📦 Building CLI..."
cd ../..
npm run build
cd demo/extraction

# Clean up any previous demo artifacts
echo "🧹 Cleaning up previous demo..."
rm -f .markdown-coderc.json
rm -rf snippets/
rm -f extraction-demo.gif
rm -f README.md

# Set up demo files
echo "📝 Setting up demo files..."
cp _README.md README.md

# Create template snippet files for later use in demo
mkdir -p _snippets_modified
cp _snippet1_modified.ts _snippets_modified/

echo "🎥 Recording extraction demo with VHS..."
vhs demo.tape

echo "✅ Extraction demo completed!"
echo "🎬 Generated: extraction-demo.gif"
echo ""
echo "📖 You can now add this GIF to your README or documentation!" 