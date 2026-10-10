import { relative } from 'node:path';
import type { ArgumentsCamelCase } from 'yargs';
import { syncMarkdownFiles } from '../sync.js';
import { format, hasErrors, hasIssues } from '../formatter.js';
import {
  getValidatedConfig,
  handleError,
  logWarningsAndErrors,
  markFailed,
  type BaseArgs,
} from './shared.js';

interface SyncArgs extends BaseArgs {}

export const command = ['sync', '$0'];
export const describe = 'Update markdown files with snippet content (default)';

export const handler = async (argv: ArgumentsCamelCase<SyncArgs>) => {
  try {
    const config = await getValidatedConfig(argv);

    console.log('Syncing markdown files...');
    const result = await syncMarkdownFiles(config);

    const hasProcessingErrors = logWarningsAndErrors(
      result.warnings,
      result.errors,
    );
    const failed = hasProcessingErrors || hasErrors(result.fileIssues);

    if (hasIssues(result.fileIssues)) {
      console.error(format(result.fileIssues));
    }

    if (result.updated.length > 0) {
      console.log('Updated files:');
      result.updated.forEach((file) => {
        const relativePath = relative(config.workingDir, file);
        console.log(`  ${relativePath}`);
      });
    } else if (!failed) {
      console.log('All files are already in sync.');
    }

    if (failed) {
      markFailed();
    }
  } catch (error) {
    handleError(error);
  }
};
