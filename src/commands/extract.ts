import type { ArgumentsCamelCase } from 'yargs';
import { extractSnippets } from '../sync.js';
import {
  getValidatedConfig,
  handleError,
  logWarningsAndErrors,
  type BaseArgs,
} from './shared.js';

interface ExtractArgs extends BaseArgs {}

export const command = 'extract';
export const describe = 'Extract code blocks from markdown to snippet files';

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

export const handler = async (argv: ArgumentsCamelCase<ExtractArgs>) => {
  try {
    const config = await getValidatedConfig(argv);

    console.log('Extracting snippets from code blocks...');
    const result = await extractSnippets(config);

    logWarningsAndErrors(result.warnings, result.errors);
    logExtractionResults(result);
  } catch (error) {
    handleError(error);
  }
};
