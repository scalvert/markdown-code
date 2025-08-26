import { relative } from 'node:path';
import type { ArgumentsCamelCase } from 'yargs';
import { syncMarkdownFiles } from '../sync.js';
import { format, hasErrors, hasIssues } from '../formatter.js';
import {
  getValidatedConfig,
  handleError,
  logWarningsAndErrors,
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

    logWarningsAndErrors(result.warnings, result.errors);

    if (hasIssues(result.fileIssues)) {
      const formattedOutput = format(result.fileIssues);
      console.error(formattedOutput);

      if (hasErrors(result.fileIssues)) {
        process.exit(1);
      }
    }

    if (result.updated.length > 0) {
      console.log('Updated files:');
      result.updated.forEach((file) => {
        const relativePath = relative(config.workingDir, file);
        console.log(`  ${relativePath}`);
      });
    } else {
      console.log('All files are already in sync.');
    }
  } catch (error) {
    handleError(error);
  }
};
