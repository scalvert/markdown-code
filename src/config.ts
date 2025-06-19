import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { Config } from './types.js';

const DEFAULT_CONFIG: Config = {
  snippetRoot: '.',
  markdownGlob: '**/*.md',
  includeExtensions: [
    '.ts',
    '.js',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.go',
    '.rs',
    '.php',
    '.rb',
    '.swift',
    '.kt',
  ],
};

export interface ConfigOverrides {
  snippetRoot?: string;
  markdownGlob?: string;
  includeExtensions?: string;
}

export function loadConfig(
  configPath?: string,
  overrides: ConfigOverrides = {}
): Config {
  let config = { ...DEFAULT_CONFIG };

  if (!configPath) {
    const defaultPath = resolve('.markdown-coderc.json');

    try {
      const content = readFileSync(defaultPath, 'utf-8');
      config = { ...config, ...JSON.parse(content) };
    } catch {
      // Use defaults if no config file found
    }
  } else {
    try {
      const content = readFileSync(resolve(configPath), 'utf-8');
      config = { ...config, ...JSON.parse(content) };
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('ENOENT')) {
        throw new Error(`Config file not found: ${configPath}`);
      }

      throw new Error(
        `Failed to load config from ${configPath}: ${errorMessage}`
      );
    }
  }

  if (overrides.snippetRoot) {
    config.snippetRoot = overrides.snippetRoot;
  }

  if (overrides.markdownGlob) {
    config.markdownGlob = overrides.markdownGlob;
  }

  if (overrides.includeExtensions) {
    config.includeExtensions = overrides.includeExtensions
      .split(',')
      .map((ext) => ext.trim())
      .filter((ext) => ext.length > 0);
  }

  return config;
}

export function validateConfig(config: Config): void {
  if (!config.snippetRoot || typeof config.snippetRoot !== 'string') {
    throw new Error('Config: snippetRoot must be a non-empty string');
  }

  if (!config.markdownGlob || typeof config.markdownGlob !== 'string') {
    throw new Error('Config: markdownGlob must be a non-empty string');
  }

  if (!Array.isArray(config.includeExtensions)) {
    throw new Error('Config: includeExtensions must be an array');
  }
}
