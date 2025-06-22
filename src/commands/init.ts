import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ArgumentsCamelCase, Argv } from 'yargs';
import { DEFAULT_CONFIG } from '../config.js';
import { extractSnippets } from '../sync.js';
import { fileExists } from '../utils.js';
import {
  getValidatedConfig,
  handleError,
  logWarningsAndErrors,
  type BaseArgs,
} from './shared.js';

interface InitArgs extends BaseArgs {
  extract?: boolean;
}

export const command = 'init';
export const describe = 'Create a default configuration file';

export const builder = (yargs: Argv) => {
  return yargs.option('extract', {
    type: 'boolean',
    describe:
      'Extract snippets from existing code blocks after creating config',
    default: false,
  });
};

async function createDefaultConfig(): Promise<void> {
  const configPath = resolve('.markdown-coderc.json');
  const snippetsDir = resolve('snippets');

  if (await fileExists(configPath)) {
    console.log('Configuration file already exists at .markdown-coderc.json');
    return;
  }

  const defaultConfig = { ...DEFAULT_CONFIG, snippetRoot: './snippets' };

  try {
    await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('Created .markdown-coderc.json with default configuration');

    if (!(await fileExists(snippetsDir))) {
      await mkdir(snippetsDir, { recursive: true });
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

function logExtractionResults(result: {
  extracted: Array<string>;
  snippetsCreated: number;
}) {
  if (result.extracted.length > 0) {
    console.log(`Extracted ${result.snippetsCreated} snippets from:`);
    result.extracted.forEach((file) => console.log(`  ${file}`));
  } else {
    console.log('No code blocks found to extract.');
  }
}

async function handleExtraction(argv: ArgumentsCamelCase<InitArgs>) {
  console.log('Extracting snippets from existing code blocks...');

  const config = await getValidatedConfig(argv);
  const result = await extractSnippets(config);

  logWarningsAndErrors(result.warnings, result.errors);
  logExtractionResults(result);
}

export const handler = async (argv: ArgumentsCamelCase<InitArgs>) => {
  try {
    await createDefaultConfig();

    if (argv.extract) {
      await handleExtraction(argv);
    }
  } catch (error) {
    handleError(error);
  }
};
