import type { ArgumentsCamelCase } from 'yargs';
import { loadConfig, validateConfig, type ConfigOverrides } from '../config.js';
import { checkMarkdownFiles } from '../sync.js';

interface CheckArgs {
  config?: string;
  snippetRoot?: string;
  markdownGlob?: string;
  includeExtensions?: string;
}

export const command = 'check';
export const describe = 'Check if markdown files are in sync (exit non-zero on mismatch)';

export const handler = async (argv: ArgumentsCamelCase<CheckArgs>) => {
  try {
    const overrides: ConfigOverrides = {};
    if (argv.snippetRoot) overrides.snippetRoot = argv.snippetRoot;
    if (argv.markdownGlob) overrides.markdownGlob = argv.markdownGlob;
    if (argv.includeExtensions) overrides.includeExtensions = argv.includeExtensions;

    const config = loadConfig(argv.config, overrides);
    validateConfig(config);

    console.log('Checking markdown files...');
    const result = await checkMarkdownFiles(config);

    if (result.warnings.length > 0) {
      console.log('Warnings:');
      for (const warning of result.warnings) {
        console.log(`  ${warning}`);
      }
    }

    if (result.errors.length > 0) {
      console.error('Errors:');
      for (const error of result.errors) {
        console.error(`  ${error}`);
      }
      process.exit(1);
    }

    if (result.inSync) {
      console.log('All markdown files are in sync.');
    } else {
      console.error('The following files are out of sync:');
      for (const file of result.outOfSync) {
        console.error(`  ${file}`);
      }
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(errorMessage);
    process.exit(1);
  }
};