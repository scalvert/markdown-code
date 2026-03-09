import { writeFile, rm, unlink, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { ArgumentsCamelCase, Argv } from 'yargs';
import fg from 'fast-glob';
import { configExists } from '../config.js';
import { parseMarkdownFile } from '../parser.js';
import type { RuntimeConfig } from '../types.js';
import { fileExists, isInWorkingDir } from '../utils.js';
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

async function removeSnippetDirectives(config: RuntimeConfig) {
  const result = {
    processed: [] as string[],
    warnings: [] as string[],
    errors: [] as string[],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
      cwd: config.workingDir,
      absolute: true,
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

        // Process in reverse order so earlier position offsets remain valid
        for (const codeBlock of [...codeBlocksWithSnippets].reverse()) {
          const fenceStart = codeBlock.position.start;
          const fenceLineEnd = updatedContent.indexOf('\n', fenceStart);
          if (fenceLineEnd === -1) {
            continue;
          }
          updatedContent =
            updatedContent.slice(0, fenceStart) +
            `\`\`\`${codeBlock.language}` +
            updatedContent.slice(fenceLineEnd);
          hasChanges = true;
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

async function deleteSnippetDirectory(snippetRoot: string, workingDir: string) {
  const result = {
    deleted: false,
    warnings: [] as string[],
    errors: [] as string[],
  };

  try {
    const resolvedPath = resolve(workingDir, snippetRoot);

    let realPath: string;
    try {
      realPath = await realpath(resolvedPath);
    } catch {
      result.warnings.push(`Snippet directory not found: ${snippetRoot}`);
      return result;
    }

    if (!isInWorkingDir(realPath, workingDir)) {
      result.errors.push(
        `Snippet directory is outside the working directory: ${snippetRoot}`,
      );
      return result;
    }

    await rm(realPath, { recursive: true, force: true });
    result.deleted = true;
    console.log(`Deleted snippet directory: ${snippetRoot}`);
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
    const snippetResult = await deleteSnippetDirectory(config.snippetRoot, config.workingDir);

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

    console.log('✅ Ejection completed successfully!');
  } catch (error) {
    handleError(error);
  }
};
