import { writeFile, rm, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { ArgumentsCamelCase, Argv } from 'yargs';
import fg from 'fast-glob';
import { configExists } from '../config.js';
import { parseMarkdownFile } from '../parser.js';
import { fileExists } from '../utils.js';
import {
  getValidatedConfig,
  handleError,
  logWarningsAndErrors,
  type BaseArgs,
} from './shared.js';

interface EjectArgs extends BaseArgs {}

export const command = 'eject';
export const describe = false;

export const builder = (yargs: Argv) => {
  return yargs.usage(
    'Remove all snippets, snippet directives, and configuration (destructive)',
  );
};

async function confirmEjection(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(
      '⚠️  WARNING: This action is destructive and cannot be undone!',
    );
    console.log('This will:');
    console.log('  • Delete all snippet files');
    console.log('  • Remove snippet directives from markdown files');
    console.log('  • Delete the configuration file');
    console.log('');

    const answer = await rl.question(
      'Are you sure you want to proceed? (y/N): ',
    );
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function removeSnippetDirectives(config: any) {
  const result = {
    processed: [] as string[],
    warnings: [] as string[],
    errors: [] as string[],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
    });

    for (const filePath of markdownFiles) {
      try {
        const markdownFile = await parseMarkdownFile(filePath);
        const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
          (cb) => cb.snippet,
        );

        if (codeBlocksWithSnippets.length === 0) {
          continue;
        }

        let updatedContent = markdownFile.content;
        let hasChanges = false;

        for (const codeBlock of codeBlocksWithSnippets) {
          const originalHeader = `\`\`\`${codeBlock.language} snippet=${
            codeBlock.snippet!.filePath
          }`;
          const newHeader = `\`\`\`${codeBlock.language}`;

          if (updatedContent.includes(originalHeader)) {
            updatedContent = updatedContent.replace(originalHeader, newHeader);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await writeFile(filePath, updatedContent, 'utf-8');
          result.processed.push(filePath);
        }
      } catch (error) {
        result.errors.push(`Error processing ${filePath}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Error finding markdown files: ${error}`);
  }

  return result;
}

async function deleteSnippetDirectory(snippetRoot: string) {
  const result = {
    deleted: false,
    warnings: [] as string[],
    errors: [] as string[],
  };

  try {
    const resolvedPath = resolve(snippetRoot);

    if (await fileExists(resolvedPath)) {
      await rm(resolvedPath, { recursive: true, force: true });
      result.deleted = true;
      console.log(`Deleted snippet directory: ${snippetRoot}`);
    } else {
      result.warnings.push(`Snippet directory not found: ${snippetRoot}`);
    }
  } catch (error) {
    result.errors.push(`Error deleting snippet directory: ${error}`);
  }

  return result;
}

async function deleteConfigFile(configPath?: string) {
  const result = {
    deleted: false,
    warnings: [] as string[],
    errors: [] as string[],
  };

  try {
    const defaultPath = resolve('.markdown-coderc.json');
    const pathToDelete = configPath ? resolve(configPath) : defaultPath;

    if (await fileExists(pathToDelete)) {
      await unlink(pathToDelete);
      result.deleted = true;
      console.log(`Deleted configuration file: ${pathToDelete}`);
    } else {
      result.warnings.push(`Configuration file not found: ${pathToDelete}`);
    }
  } catch (error) {
    result.errors.push(`Error deleting configuration file: ${error}`);
  }

  return result;
}

export const handler = async (argv: ArgumentsCamelCase<EjectArgs>) => {
  try {
    if (!(await configExists(argv.config))) {
      console.log('No configuration file found. Nothing to eject.');
      return;
    }

    const confirmed = await confirmEjection();
    if (!confirmed) {
      console.log('Ejection cancelled.');
      return;
    }

    console.log('Starting ejection process...');

    const config = await getValidatedConfig(argv);

    console.log('Removing snippet directives from markdown files...');
    const directiveResult = await removeSnippetDirectives(config);

    if (directiveResult.processed.length > 0) {
      console.log(
        `Removed snippet directives from ${directiveResult.processed.length} files:`,
      );
      directiveResult.processed.forEach((file) => console.log(`  ${file}`));
    } else {
      console.log('No snippet directives found to remove.');
    }

    console.log('Deleting snippet directory...');
    const snippetResult = await deleteSnippetDirectory(config.snippetRoot);

    console.log('Deleting configuration file...');
    const configResult = await deleteConfigFile(argv.config);

    const allWarnings = [
      ...directiveResult.warnings,
      ...snippetResult.warnings,
      ...configResult.warnings,
    ];

    const allErrors = [
      ...directiveResult.errors,
      ...snippetResult.errors,
      ...configResult.errors,
    ];

    logWarningsAndErrors(allWarnings, allErrors);

    if (allErrors.length === 0) {
      console.log('✅ Ejection completed successfully!');
    } else {
      console.log('⚠️  Ejection completed with errors. See above for details.');
    }
  } catch (error) {
    handleError(error);
  }
};
