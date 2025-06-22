# Repository Guidelines for Codex

This file provides instructions for Codex agents working on **markdown-code**.
Follow these guidelines when modifying the repository.

## Setup

- Use **Node.js 22.16** (or the version specified in `mise.toml`). Node 18+ is required.
- Install dependencies with `npm install`.
- Run the TypeScript build with `npm run build` (or `npm run dev` for watch mode).
- Run the linter with `npm run lint` (use `npm run lint:fix` to autofix).
- Format code with `npm run format`.
- Execute tests with `npm test`. Additional test commands:
  - `npm run test:watch` for watch mode
  - `npm run test:coverage` for coverage reports

## Repository Structure

- `src/` – TypeScript source files.
- `src/commands/` – individual CLI commands.
- `dist/` – compiled output (do not edit manually).
- `test/` – Vitest unit and integration tests.
- `test/fixtures/` – fixture data used by tests.
- `snippets/` – default directory for snippet files when running `md-code init`.

## Coding Standards

- All code is written in **TypeScript** with strict compiler options.
- ESLint configuration is in `eslint.config.js` and should pass before committing.
- Prettier formatting uses: single quotes, semi-colons, 2‑space indentation, 80‑character print width.
- Avoid inline comments; prefer clear naming and self-documenting code.
- Add tests for new functionality and update documentation when needed.
- When verifying objects with many properties, prefer using inline snapshots in tests for clarity.

## Pull Requests

- Keep PRs focused and atomic with clear descriptions of changes.
- Reference related issues if applicable.
- Ensure `npm run lint`, `npm run build`, and `npm test` succeed before pushing.
- When preparing a release, follow the steps in `RELEASE.md` and label merged PRs appropriately (`breaking`, `enhancement`, `bug`, `documentation`, `internal`).

## Continuous Integration

- GitHub Actions (`.github/workflows/ci.yml`) install dependencies, run linting, build the project, and execute tests on Node 20, 22, and 24.

## Useful Scripts

- `npm run dev` – build in watch mode.
- `npm run typecheck` – run TypeScript type checking with `tsc --noEmit`.

## License

This project is licensed under the MIT License (`LICENSE`).
