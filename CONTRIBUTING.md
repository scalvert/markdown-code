# Contributing to md-code

Thank you for your interest in contributing to md-code! This document provides guidelines for development and contributing.

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## Project Structure

```tree
src/
├── cli.ts              # Main CLI entry point (yargs setup)
├── commands/           # Individual command implementations
│   ├── sync.ts        # Default sync command
│   ├── check.ts       # Check for sync status
│   ├── init.ts        # Initialize project
│   └── extract.ts     # Extract code blocks to files
├── config.ts          # Configuration handling
├── parser.ts          # Markdown parsing logic
├── sync.ts            # Core sync functionality
└── types.ts           # TypeScript type definitions

test/
├── *.test.ts          # Unit tests
├── fixtures/          # Test fixtures with input/output examples
└── integration.test.ts # End-to-end tests
```

## Development Workflow

1. **Make your changes** in the `src/` directory
2. **Run tests** to ensure everything works: `npm test`
3. **Test the CLI** locally: `npm run build && node dist/cli.js`
4. **Add tests** for new functionality in the `test/` directory
5. **Update documentation** if needed

## Testing

The project uses Vitest for testing with extensive test fixtures:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Fixtures

Test fixtures are in `test/fixtures/` and include:

- Input markdown files
- Expected output markdown files
- Corresponding source files
- Integration test scenarios

When adding new features, please add corresponding test fixtures.

## Code Style

- **TypeScript**: All code should be properly typed
- **ESLint + Prettier**: Code is automatically formatted
- **No inline comments**: Code should be self-documenting
- **Descriptive naming**: Use clear, descriptive variable and function names

## Pull Request Process

1. **Fork** the repository
2. **Create your feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Pull Request Guidelines

- Include a clear description of what your PR does
- Reference any related issues
- Include tests for new functionality
- Ensure all tests pass
- Update documentation if needed
- Keep PRs focused and atomic

## Release Process

Releases are handled by maintainers:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a git tag
4. Publish to npm

## Questions?

Feel free to open an issue for questions about contributing or development! 