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

export function loadConfig(configPath?: string): Config {
  if (!configPath) {
    const defaultPath = resolve('.markdown-coderc.json');

    try {
      const content = readFileSync(defaultPath, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  try {
    const content = readFileSync(resolve(configPath), 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('ENOENT')) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    
    throw new Error(`Failed to load config from ${configPath}: ${errorMessage}`);
  }
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
