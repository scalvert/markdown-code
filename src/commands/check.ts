import type { ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  validateConfig,
  configExists,
  type ConfigOverrides,
} from '../config.js';
import { checkMarkdownFiles, discoverCodeBlocks } from '../sync.js';
import { format, hasErrors, hasIssues } from '../formatter.js';
import type { FileIssues } from '../types.js';

interface CheckArgs {
  config?: string;
  snippetRoot?: string;
  markdownGlob?: string;
  includeExtensions?: string;
}

export const command = 'check';
export const describe =
  'Check if markdown files are in sync (exit non-zero on mismatch)';

export const handler = async (argv: ArgumentsCamelCase<CheckArgs>) => {
  try {
    const overrides: ConfigOverrides = {};
    if (argv.snippetRoot) overrides.snippetRoot = argv.snippetRoot;
    if (argv.markdownGlob) overrides.markdownGlob = argv.markdownGlob;
    if (argv.includeExtensions) {
      overrides.includeExtensions = argv.includeExtensions;
    }

    const config = loadConfig(argv.config, overrides);
    validateConfig(config);

    const result = await checkMarkdownFiles(config);

    if (!hasIssues(result.fileIssues)) {
      const hasConfig = configExists(argv.config);

      if (!hasConfig) {
        const discovery = await discoverCodeBlocks(config.markdownGlob);

        if (discovery.totalCodeBlocks > 0) {
          const discoveryIssues: Array<FileIssues> = discovery.fileDetails.map(
            (file) => {
              const langs = file.languages.join(', ');
              return {
                filePath: file.filePath,
                issues: [
                  {
                    line: 1,
                    column: 1,
                    type: 'file-missing',
                    message: `${file.codeBlocks} code blocks available (${langs})`,
                    ruleId: 'markdown-code/discovery',
                  },
                ],
              };
            },
          );

          const output = format(discoveryIssues);
          if (output) {
            console.log(output);
            console.log('');
            console.log('To start managing these code blocks, run:');
            console.log('  npx markdown-code init --extract');
          }
        }
      }
    }

    const output = format(result.fileIssues);
    if (output) {
      console.log(output);
    }

    if (hasErrors(result.fileIssues)) {
      process.exit(1);
    }
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
};
