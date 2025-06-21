# 🎬 markdown-code Demo

This directory contains a complete demo setup for showcasing the `markdown-code` package using [VHS](https://github.com/charmbracelet/vhs).

## 📁 Demo Structure

```
demo/
├── README.md           # Sample markdown with snippet directives
├── config.json         # Configuration file to be synced
├── src/
│   ├── greet.ts        # TypeScript greeting functions
│   ├── utils.js        # JavaScript utility functions
│   └── api.ts          # Express API server example
├── demo.tape           # VHS recording script
├── run-demo.sh         # Demo runner script
└── DEMO.md            # This file
```

## 🎥 What the Demo Shows

The demo demonstrates the complete `markdown-code` workflow:

1. **📄 Initial State**: Shows a README with outdated snippet content
2. **🚀 Initialization**: Runs `md-code init` to create configuration
3. **🔍 Status Check**: Runs `md-code check` to show out-of-sync files
4. **🔄 Sync Process**: Runs `md-code sync` to update documentation
5. **✅ Verification**: Shows that files are now in sync
6. **🔧 Change Detection**: Modifies source code to demonstrate drift detection
7. **🚨 Out-of-Sync Alert**: Shows how the tool detects when docs are stale
8. **🔄 Re-sync**: Demonstrates bringing docs back into sync

## 🛠️ Prerequisites

VHS is installed via Homebrew, which handles all dependencies automatically:

```bash
# Install VHS (includes ffmpeg and ttyd dependencies)
brew install vhs

# Install project dependencies
npm install
```

## 🎬 Running the Demo

### Easiest Method: npm script

```bash
# From the project root
npm run demo
```

This will automatically:

- Build the CLI if needed
- Run the demo using VHS
- Generate the GIF

### Alternative Methods

```bash
# Run the script directly
demo/run-demo.sh

# Manual VHS (after brew install vhs)
cd demo
vhs demo.tape
```

## 📤 Output

The demo generates:

- **`demo.gif`**: An animated GIF showing the complete workflow
- **Temporary files**: `.markdown-coderc.json` and `snippets/` directory (cleaned up automatically)

## 🎨 Customization

### Modify the Tape File

Edit `demo.tape` to:

- Change terminal theme: `Set Theme "Your Theme"`
- Adjust timing: Modify `Sleep` values
- Add/remove steps: Add more `Type` and `Enter` commands
- Change dimensions: Modify `Set Width` and `Set Height`

### Available VHS Themes

- `Catppuccin Mocha` (default)
- `GitHub Dark`
- `Dracula`
- `Monokai`
- And many more!

### Custom Content

Modify the source files in `src/` and `README.md` to demonstrate different scenarios:

- Different programming languages
- Complex line ranges
- Multiple snippet files
- Error scenarios

## 🚀 Using the Demo

### In Documentation

Add the generated GIF to your README:

```markdown
![markdown-code Demo](demo/demo.gif)
```

### In Presentations

Use the GIF in slides, blog posts, or documentation to show the tool in action.

### For Testing

Use the demo setup to test new features or reproduce issues.

## 🛠️ Troubleshooting

### VHS Not Found

```bash
# Check if VHS is in PATH
which vhs

# Install if missing (recommended method)
brew install vhs
```

### Permission Denied

```bash
chmod +x run-demo.sh
```

### CLI Not Found

```bash
# Build the CLI first
npm run build
```

## 📝 Notes

- The demo runs in isolation and cleans up after itself
- All file modifications are temporary and local to the demo directory
- The recording captures real terminal interaction, showing actual CLI output
- Colors and formatting in the GIF match the terminal theme
