import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateConfig, DEFAULT_CONFIG } from '../src/config.js';
import type { Config } from '../src/types.js';

import { join } from 'node:path';
import { Project } from 'fixturify-project';

describe('config', () => {
  let project: Project;
  let tempDir: string;

  beforeEach(() => {
    project = new Project();
    tempDir = project.baseDir;
  });

  afterEach(() => {
    project.dispose();
  });

  it('should validate valid config', () => {
    const config: Config = {
      snippetRoot: './examples',
      markdownGlob: '**/*.md',
      excludeGlob: ['node_modules/**'],
      includeExtensions: ['.ts', '.js'],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should throw error for invalid snippetRoot', () => {
    const config = {
      snippetRoot: '',
      markdownGlob: '**/*.md',
      excludeGlob: [],
      includeExtensions: ['.ts'],
    } as Config;

    expect(() => validateConfig(config)).toThrow(
      'snippetRoot must be a non-empty string',
    );
  });

  it('should throw error for invalid markdownGlob', () => {
    const config = {
      snippetRoot: './examples',
      markdownGlob: '',
      excludeGlob: [],
      includeExtensions: ['.ts'],
    } as Config;

    expect(() => validateConfig(config)).toThrow(
      'markdownGlob must be a non-empty string',
    );
  });

  it('should throw error for invalid excludeGlob', () => {
    const config = {
      snippetRoot: './examples',
      markdownGlob: '**/*.md',
      excludeGlob: 'not-an-array',
      includeExtensions: ['.ts'],
    } as unknown as Config;

    expect(() => validateConfig(config)).toThrow(
      'excludeGlob must be an array',
    );
  });

  it('should throw error for invalid includeExtensions', () => {
    const config = {
      snippetRoot: './examples',
      markdownGlob: '**/*.md',
      excludeGlob: [],
      includeExtensions: 'not-an-array',
    } as unknown as Config;

    expect(() => validateConfig(config)).toThrow(
      'includeExtensions must be an array',
    );
  });

  it('configExists returns false when file is missing', async () => {
    const { configExists } = await import('../src/config.js');
    const exists = await configExists(join(tempDir, 'missing.json'));
    expect(exists).toBe(false);
  });

  it('configExists returns true for existing non-empty file', async () => {
    const { configExists } = await import('../src/config.js');
    const filePath = join(tempDir, '.markdown-coderc.json');
    await project.write({
      '.markdown-coderc.json': JSON.stringify(DEFAULT_CONFIG),
    });
    const exists = await configExists(filePath);
    expect(exists).toBe(true);
  });

  it('loadConfig merges file content with overrides', async () => {
    const { loadConfig } = await import('../src/config.js');
    const filePath = join(tempDir, 'custom.json');
    await project.write({
      'custom.json': JSON.stringify({ snippetRoot: './snips' }),
    });
    const config = await loadConfig(filePath, { markdownGlob: 'docs/*.md' });

    // Check that workingDir is set but don't snapshot it (it's runtime-specific)
    expect(config.workingDir).toBeDefined();

    // Snapshot only the config properties
    const { workingDir, ...configWithoutRuntime } = config;
    expect(configWithoutRuntime).toMatchInlineSnapshot(`
      {
        "excludeGlob": [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
          "coverage/**",
          ".next/**",
          ".nuxt/**",
          "out/**",
          "target/**",
          "vendor/**",
        ],
        "includeExtensions": [
          ".ts",
          ".js",
          ".py",
          ".java",
          ".cpp",
          ".c",
          ".go",
          ".rs",
          ".php",
          ".rb",
          ".swift",
          ".kt",
        ],
        "markdownGlob": "docs/*.md",
        "snippetRoot": "./snips",
      }
    `);
  });

  it('loadConfig throws for missing config file', async () => {
    const { loadConfig } = await import('../src/config.js');
    await expect(loadConfig(join(tempDir, 'nofile.json'))).rejects.toThrow(
      /Config file not found/,
    );
  });
});
