import type { ArgumentsCamelCase } from 'yargs';
import { extractSnippets } from '../sync.js';
import {
  getValidatedConfig,
  handleError,
  logExtractionResults,
  logWarningsAndErrors,
  markFailed,
  type BaseArgs,
} from './shared.js';

interface ExtractArgs extends BaseArgs {}

export const command = 'extract';
export const describe = 'Extract code blocks from markdown to snippet files';

export const handler = async (argv: ArgumentsCamelCase<ExtractArgs>) => {
  try {
    const config = await getValidatedConfig(argv);

    console.log('Extracting snippets from code blocks...');
    const result = await extractSnippets(config);

    const hasProcessingErrors = logWarningsAndErrors(
      result.warnings,
      result.errors,
    );
    logExtractionResults(result, hasProcessingErrors);

    if (hasProcessingErrors) {
      markFailed();
    }
  } catch (error) {
    handleError(error);
  }
};
