#!/bin/bash

# Reference Demo runner for markdown-code
# This script sets up and runs the reference workflow demo

set -e

echo "🎬 Setting up markdown-code reference demo..."

# Make sure we're in the reference demo directory
cd "$(dirname "$0")"

# Build the CLI if needed
echo "📦 Building CLI..."
cd ../..
npm run build
cd demo/reference

# Clean up any previous demo artifacts
echo "🧹 Cleaning up previous demo..."
rm -f .markdown-coderc.json
rm -f reference-demo.gif
rm -f README.md

# Set up demo files
echo "📝 Setting up demo files..."
cp _README.md README.md

# Initialize markdown-code config
echo "🔧 Setting up markdown-code config..."
../../dist/cli.js init

echo "🎥 Recording reference demo with VHS..."
vhs demo.tape

echo "✅ Reference demo completed!"
echo "🎬 Generated: reference-demo.gif"
echo ""
echo "📖 You can now add this GIF to your README or documentation!" 