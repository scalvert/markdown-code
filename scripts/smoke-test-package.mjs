import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf-8'),
);
const allowedFiles = new Set([
  'LICENSE',
  'README.md',
  'package.json',
  'markdown-code.png',
]);
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('Run this through npm: npm run test:package');
}

if (!existsSync(join(repoRoot, 'dist', 'index.js'))) {
  throw new Error('dist/ is missing. Run npm run build first.');
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function npm(args, cwd) {
  return run(process.execPath, [npmCli, ...args], cwd);
}

function mdCode(bin, args, cwd) {
  return npm(['exec', '--no', '--', bin, ...args], cwd);
}

const workDir = mkdtempSync(join(tmpdir(), 'md-code-package-'));

try {
  const [packed] = JSON.parse(
    npm(['pack', '--json', '--pack-destination', workDir], repoRoot),
  );
  const unexpected = packed.files
    .map((file) => file.path)
    .filter((path) => !path.startsWith('dist/') && !allowedFiles.has(path));
  assert.deepEqual(unexpected, [], 'unexpected files in the package');
  assert.ok(
    packed.files.some((file) => file.path === 'dist/index.d.ts'),
    'package is missing dist/index.d.ts',
  );

  const project = join(workDir, 'project');
  mkdirSync(join(project, 'snippets'), { recursive: true });
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'smoke', version: '0.0.0', private: true }),
  );
  npm(
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      join(workDir, packed.filename),
    ],
    project,
  );

  for (const bin of ['md-code', 'markdown-code']) {
    assert.equal(
      mdCode(bin, ['--version'], project),
      version,
      `${bin} --version`,
    );
  }

  writeFileSync(join(project, 'snippets', 'add.js'), 'const sum = 1 + 1;\n');
  writeFileSync(
    join(project, 'README.md'),
    '# Smoke\n\n```js snippet=add.js\nstale\n```\n',
  );
  writeFileSync(
    join(project, '.markdown-coderc.json'),
    JSON.stringify({ snippetRoot: './snippets', markdownGlob: 'README.md' }),
  );

  mdCode('md-code', ['sync'], project);
  assert.equal(
    readFileSync(join(project, 'README.md'), 'utf-8'),
    '# Smoke\n\n```js snippet=add.js\nconst sum = 1 + 1;\n```\n',
  );
  mdCode('md-code', ['check'], project);

  const exported = run(
    'node',
    [
      '--input-type=module',
      '--eval',
      "const m = await import('markdown-code'); console.log([typeof m.syncMarkdownFiles, m.VERSION].join(' '));",
    ],
    project,
  );
  assert.equal(exported, `function ${version}`, 'library import');
  assert.ok(
    existsSync(
      join(project, 'node_modules', 'markdown-code', 'dist', 'index.d.ts'),
    ),
  );

  console.log(`markdown-code@${version} package smoke test passed`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
