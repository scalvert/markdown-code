import type { ArgumentsCamelCase } from 'yargs';
import { configExists } from '../config.js';
import { checkMarkdownFiles, discoverCodeBlocks } from '../sync.js';
import { format, hasErrors, hasIssues } from '../formatter.js';
import type { FileIssues } from '../types.js';
import { getValidatedConfig, handleError, type BaseArgs } from './shared.js';

interface CheckArgs extends BaseArgs {}

export const command = 'check';
export const describe =
  'Check if markdown files are in sync (exit non-zero on mismatch)';

async function handleDiscoveryMode(
  config: any,
  configPath?: string,
): Promise<boolean> {
  if (await configExists(configPath)) {
    return false;
  }

  const discovery = await discoverCodeBlocks(
    config.markdownGlob,
    config.excludeGlob,
  );

  if (discovery.totalCodeBlocks === 0) {
    return false;
  }

  const discoveryIssues: Array<FileIssues> = discovery.fileDetails.map(
    (file) => ({
      filePath: file.filePath,
      issues: [
        {
          line: 1,
          column: 1,
          type: 'file-missing',
          message: `${file.codeBlocks} code blocks available (${file.languages.join(', ')})`,
          ruleId: 'markdown-code/discovery',
        },
      ],
    }),
  );

  const output = format(discoveryIssues);
  if (output) {
    console.log(output);
    console.log('');
    console.log('To start managing these code blocks, run:');
    console.log('  npx markdown-code init --extract');
    return true;
  }

  return false;
}

export const handler = async (argv: ArgumentsCamelCase<CheckArgs>) => {
  try {
    const config = await getValidatedConfig(argv);

    console.log('Checking markdown files...');
    const result = await checkMarkdownFiles(config);

    let hasDiscoveryIssues = false;

    if (!hasIssues(result.fileIssues)) {
      hasDiscoveryIssues = await handleDiscoveryMode(config, argv.config);
    }

    const output = format(result.fileIssues);
    if (output) {
      console.log(output);
    } else if (!hasDiscoveryIssues) {
      console.log('All markdown files are in sync.');
    }

    if (hasErrors(result.fileIssues)) {
      process.exit(1);
    }
  } catch (error: unknown) {
    handleError(error);
  }
};
