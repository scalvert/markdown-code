import type { ArgumentsCamelCase } from 'yargs';
import { loadConfig, validateConfig, type ConfigOverrides } from '../config.js';
import { syncMarkdownFiles } from '../sync.js';
import { formatEslintStyle, hasErrors, hasIssues } from '../formatter.js';

interface SyncArgs {
  config?: string;
  snippetRoot?: string;
  markdownGlob?: string;
  includeExtensions?: string;
}

export const command = ['sync', '$0'];
export const describe = 'Update markdown files with snippet content (default)';

export const handler = async (argv: ArgumentsCamelCase<SyncArgs>) => {
  try {
    const overrides: ConfigOverrides = {};
    if (argv.snippetRoot) overrides.snippetRoot = argv.snippetRoot;
    if (argv.markdownGlob) overrides.markdownGlob = argv.markdownGlob;
    if (argv.includeExtensions) overrides.includeExtensions = argv.includeExtensions;

    const config = loadConfig(argv.config, overrides);
    validateConfig(config);

    console.log('Syncing markdown files...');
    const result = await syncMarkdownFiles(config);

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

    if (hasIssues(result.fileIssues)) {
      const formattedOutput = formatEslintStyle(result.fileIssues);
      console.error(formattedOutput);
      
      if (hasErrors(result.fileIssues)) {
        process.exit(1);
      }
    }

    if (result.updated.length > 0) {
      console.log('Updated files:');
      for (const file of result.updated) {
        console.log(`  ${file}`);
      }
    } else {
      console.log('All files are already in sync.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(errorMessage);
    process.exit(1);
  }
};