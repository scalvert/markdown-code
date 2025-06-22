import type { ArgumentsCamelCase } from 'yargs';
import { loadConfig, validateConfig, type ConfigOverrides } from '../config.js';

export interface BaseArgs {
  config?: string;
  snippetRoot?: string;
  markdownGlob?: string;
  excludeGlob?: string;
  includeExtensions?: string;
}

export function buildConfigOverrides(
  argv: ArgumentsCamelCase<BaseArgs>,
): ConfigOverrides {
  const overrides: ConfigOverrides = {};
  if (argv.snippetRoot) overrides.snippetRoot = argv.snippetRoot;
  if (argv.markdownGlob) overrides.markdownGlob = argv.markdownGlob;
  if (argv.excludeGlob) overrides.excludeGlob = argv.excludeGlob;
  if (argv.includeExtensions)
    overrides.includeExtensions = argv.includeExtensions;
  return overrides;
}

export async function getValidatedConfig(argv: ArgumentsCamelCase<BaseArgs>) {
  const overrides = buildConfigOverrides(argv);
  const config = await loadConfig(argv.config, overrides);
  validateConfig(config);
  return config;
}

export function handleError(error: unknown): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(errorMessage);
  process.exit(1);
}

export function logWarningsAndErrors(
  warnings: Array<string>,
  errors: Array<string>,
): boolean {
  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach((warning) => console.log(`  ${warning}`));
  }

  if (errors.length > 0) {
    console.error('Errors:');
    errors.forEach((error) => console.error(`  ${error}`));
    process.exit(1);
  }

  return warnings.length > 0 || errors.length > 0;
}
