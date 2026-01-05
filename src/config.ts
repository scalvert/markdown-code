import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Config, RuntimeConfig } from './types.js';
import { fileExists } from './utils.js';

export const DEFAULT_CONFIG: Config = {
  snippetRoot: '.',
  markdownGlob: '**/*.md',
  excludeGlob: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '.next/**',
    '.nuxt/**',
    'out/**',
    'target/**',
    'vendor/**',
  ],
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
  remoteTimeout: 30000,
  allowInsecureHttp: false,
};

export interface ConfigOverrides {
  snippetRoot?: string;
  markdownGlob?: string;
  excludeGlob?: string;
  includeExtensions?: string;
  remoteTimeout?: number;
  allowInsecureHttp?: boolean;
}

export async function configExists(configPath?: string): Promise<boolean> {
  const defaultPath = resolve('.markdown-coderc.json');
  const pathToCheck = configPath ? resolve(configPath) : defaultPath;

  if (!(await fileExists(pathToCheck))) {
    return false;
  }

  try {
    const content = await readFile(pathToCheck, 'utf-8');
    return content.length > 0;
  } catch {
    return false;
  }
}

export async function loadConfig(
  configPath?: string,
  overrides: ConfigOverrides = {},
  workingDir?: string,
): Promise<RuntimeConfig> {
  let config = { ...DEFAULT_CONFIG };

  if (!configPath) {
    const defaultPath = resolve('.markdown-coderc.json');

    try {
      const content = await readFile(defaultPath, 'utf-8');
      config = { ...config, ...JSON.parse(content) };
    } catch {
      // Use defaults if no config file found
    }
  } else {
    try {
      const content = await readFile(resolve(configPath), 'utf-8');
      config = { ...config, ...JSON.parse(content) };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('ENOENT')) {
        throw new Error(`Config file not found: ${configPath}`);
      }

      throw new Error(
        `Failed to load config from ${configPath}: ${errorMessage}`,
      );
    }
  }

  if (overrides.snippetRoot) {
    config.snippetRoot = overrides.snippetRoot;
  }

  if (overrides.markdownGlob) {
    config.markdownGlob = overrides.markdownGlob;
  }

  if (overrides.excludeGlob) {
    config.excludeGlob = overrides.excludeGlob
      .split(',')
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern.length > 0);
  }

  if (overrides.includeExtensions) {
    config.includeExtensions = overrides.includeExtensions
      .split(',')
      .map((ext) => ext.trim())
      .filter((ext) => ext.length > 0);
  }

  if (overrides.remoteTimeout !== undefined) {
    config.remoteTimeout = overrides.remoteTimeout;
  }

  if (overrides.allowInsecureHttp !== undefined) {
    config.allowInsecureHttp = overrides.allowInsecureHttp;
  }

  // Create RuntimeConfig with workingDir
  return {
    ...config,
    workingDir: workingDir ?? process.cwd(),
  };
}

export function validateConfig(config: Config): void {
  if (!config.snippetRoot || typeof config.snippetRoot !== 'string') {
    throw new Error('Config: snippetRoot must be a non-empty string');
  }

  if (!config.markdownGlob || typeof config.markdownGlob !== 'string') {
    throw new Error('Config: markdownGlob must be a non-empty string');
  }

  if (!Array.isArray(config.excludeGlob)) {
    throw new Error('Config: excludeGlob must be an array');
  }

  if (!Array.isArray(config.includeExtensions)) {
    throw new Error('Config: includeExtensions must be an array');
  }

  if (config.remoteTimeout !== undefined) {
    if (typeof config.remoteTimeout !== 'number' || config.remoteTimeout < 0) {
      throw new Error('Config: remoteTimeout must be a positive number');
    }
  }

  if (config.allowInsecureHttp !== undefined) {
    if (typeof config.allowInsecureHttp !== 'boolean') {
      throw new Error('Config: allowInsecureHttp must be a boolean');
    }
  }
}
