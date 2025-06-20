import type { ArgumentsCamelCase } from 'yargs';
import { loadConfig, validateConfig, type ConfigOverrides } from '../config.js';
import { extractSnippets } from '../sync.js';

interface ExtractArgs {
  config?: string;
  snippetRoot?: string;
  markdownGlob?: string;
  includeExtensions?: string;
}

export const command = 'extract';
export const describe = 'Extract code blocks from markdown to snippet files';

export const handler = async (argv: ArgumentsCamelCase<ExtractArgs>) => {
  try {
    const overrides: ConfigOverrides = {};
    if (argv.snippetRoot) overrides.snippetRoot = argv.snippetRoot;
    if (argv.markdownGlob) overrides.markdownGlob = argv.markdownGlob;
    if (argv.includeExtensions) overrides.includeExtensions = argv.includeExtensions;

    const config = loadConfig(argv.config, overrides);
    validateConfig(config);

    console.log('Extracting snippets from code blocks...');
    const result = await extractSnippets(config);

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

    if (result.extracted.length > 0) {
      console.log(`Extracted ${result.snippetsCreated} snippets from:`);
      for (const file of result.extracted) {
        console.log(`  ${file}`);
      }
    } else {
      console.log('No code blocks found to extract.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(errorMessage);
    process.exit(1);
  }
}; 