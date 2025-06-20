import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ArgumentsCamelCase, Argv } from 'yargs';
import { loadConfig, validateConfig, type ConfigOverrides } from '../config.js';
import { extractSnippets } from '../sync.js';

interface InitArgs {
  extract?: boolean;
  config?: string;
  snippetRoot?: string;
  markdownGlob?: string;
  includeExtensions?: string;
}

export const command = 'init';
export const describe = 'Create a default configuration file';

export const builder = (yargs: Argv) => {
  return yargs.option('extract', {
    type: 'boolean',
    describe: 'Extract snippets from existing code blocks after creating config',
    default: false,
  });
};

function createDefaultConfig(): void {
  const configPath = resolve('.markdown-coderc.json');
  const snippetsDir = resolve('snippets');

  if (existsSync(configPath)) {
    console.log('Configuration file already exists at .markdown-coderc.json');
    return;
  }

  const defaultConfig = {
    snippetRoot: './snippets',
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

  try {
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('Created .markdown-coderc.json with default configuration');

    if (!existsSync(snippetsDir)) {
      mkdirSync(snippetsDir, { recursive: true });
      console.log('Created snippets/ directory for your source files');
    }

    console.log('\nNext steps:');
    console.log('1. Place your source files in the snippets/ directory');
    console.log(
      '2. Add snippet directives to your markdown files: ```js snippet=example.js',
    );
    console.log('3. Run `md-code` to sync your code examples');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create configuration: ${errorMessage}`);
  }
}

export const handler = async (argv: ArgumentsCamelCase<InitArgs>) => {
  try {
    createDefaultConfig();

    if (argv.extract) {
      console.log('Extracting snippets from existing code blocks...');

      const overrides: ConfigOverrides = {};
      if (argv.snippetRoot) overrides.snippetRoot = argv.snippetRoot;
      if (argv.markdownGlob) overrides.markdownGlob = argv.markdownGlob;
      if (argv.includeExtensions) overrides.includeExtensions = argv.includeExtensions;

      const config = loadConfig(argv.config, overrides);
      validateConfig(config);

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
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(errorMessage);
    process.exit(1);
  }
};