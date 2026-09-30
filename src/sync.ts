import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, basename, extname } from 'node:path';
import { createRequire } from 'node:module';
import fg from 'fast-glob';
import { fileExists, isInWorkingDir } from './utils.js';
import type {
  RuntimeConfig,
  SyncResult,
  CheckResult,
  ExtractResult,
  Issue,
  DiscoveryResult,
} from './types.js';
import { readMarkdownDocument } from './parser.js';
import { normalizeLineEndings } from './line-endings.js';
import { formatSnippetDirective } from './snippet-directive.js';
import { isManagedCodeBlock, resolveSnippet } from './snippet-resolution.js';
import { createIssue, isError } from './issues.js';

const require = createRequire(import.meta.url);
const languageMap = require('language-map');

export async function syncMarkdownFiles(
  config: RuntimeConfig,
): Promise<SyncResult> {
  const result: SyncResult = {
    updated: [],
    fileIssues: [],
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
      cwd: config.workingDir,
      absolute: true,
    });

    for (const filePath of markdownFiles) {
      const fileIssues: Array<Issue> = [];

      try {
        const { content, document } = await readMarkdownDocument(filePath);

        for (const codeBlock of document.codeBlocks.filter(
          isManagedCodeBlock,
        )) {
          const snippet = await resolveSnippet(codeBlock, {
            config,
            markdownFilePath: filePath,
          });

          if (snippet.status === 'failed') {
            fileIssues.push(snippet.issue);
          } else if (
            snippet.status === 'resolved' &&
            snippet.content !== codeBlock.content
          ) {
            document.setBody(codeBlock, snippet.content);
          }
        }

        if (fileIssues.length > 0) {
          result.fileIssues.push({ filePath, issues: fileIssues });
        }

        const updatedContent = document.toString();
        if (updatedContent !== content) {
          await writeFile(filePath, updatedContent, 'utf-8');
          result.updated.push(filePath);
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

export async function checkMarkdownFiles(
  config: RuntimeConfig,
): Promise<CheckResult> {
  const result: CheckResult = {
    inSync: true,
    outOfSync: [],
    fileIssues: [],
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
      cwd: config.workingDir,
      absolute: true,
    });

    for (const filePath of markdownFiles) {
      const fileIssues: Array<Issue> = [];

      try {
        const { document } = await readMarkdownDocument(filePath);
        let isFileInSync = true;

        for (const codeBlock of document.codeBlocks.filter(
          isManagedCodeBlock,
        )) {
          const snippet = await resolveSnippet(codeBlock, {
            config,
            markdownFilePath: filePath,
          });

          if (snippet.status === 'failed') {
            fileIssues.push(snippet.issue);
          } else if (
            snippet.status === 'resolved' &&
            snippet.content !== codeBlock.content
          ) {
            fileIssues.push(
              createIssue(
                'content-mismatch',
                codeBlock,
                `Code block out of sync with ${formatSnippetDirective(codeBlock.directive)}`,
              ),
            );
            isFileInSync = false;
          }
        }

        if (fileIssues.length > 0) {
          result.fileIssues.push({ filePath, issues: fileIssues });
        }

        if (fileIssues.some(isError)) {
          isFileInSync = false;
        }

        if (!isFileInSync) {
          result.outOfSync.push(filePath);
          result.inSync = false;
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

function getExtensionForLanguage(
  language: string,
  configuredExtensions: Array<string>,
): string | null {
  const normalizedLang = language.toLowerCase();

  for (const [langName, langData] of Object.entries(languageMap)) {
    const isMatchingLanguage =
      langName.toLowerCase() === normalizedLang ||
      (langData as any).aliases?.some(
        (alias: string) => alias.toLowerCase() === normalizedLang,
      );

    if (isMatchingLanguage) {
      const availableExtensions = (langData as any).extensions ?? [];

      for (const configExt of configuredExtensions) {
        if (availableExtensions.includes(configExt)) {
          return configExt;
        }
      }

      return availableExtensions[0] ?? null;
    }
  }

  return null;
}

export function ensureTrailingNewline(
  content: string,
  lineEnding: '\n' | '\r\n' = '\n',
): string {
  return content.endsWith('\n') ? content : content + lineEnding;
}

function buildSnippetFileName(
  index: number,
  digits: number,
  extension: string,
): string {
  const padded = String(index).padStart(digits, '0');
  return `snippet-${padded}${extension}`;
}

export async function extractSnippets(
  config: RuntimeConfig,
): Promise<ExtractResult> {
  const result: ExtractResult = {
    extracted: [],
    snippetsCreated: 0,
    warnings: [],
    errors: [],
  };

  const workingDir = config.workingDir ? resolve(config.workingDir) : undefined;
  const snippetRoot = resolve(
    workingDir ?? process.cwd(),
    config.snippetRoot || '.',
  );

  if (workingDir && !isInWorkingDir(snippetRoot, workingDir)) {
    result.errors.push(
      `Snippet root is outside the working directory: ${config.snippetRoot}`,
    );
    return result;
  }

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
      cwd: workingDir ?? process.cwd(),
      absolute: true,
    });

    for (const filePath of markdownFiles) {
      try {
        const { document } = await readMarkdownDocument(filePath);
        const plainBlocks = document.codeBlocks.filter(
          (codeBlock) => !codeBlock.directive,
        );

        if (plainBlocks.length === 0) {
          continue;
        }

        const baseFileName = basename(filePath, extname(filePath));
        const dirName = baseFileName.toLowerCase();
        const outputDir = join(snippetRoot, dirName);

        await mkdir(outputDir, { recursive: true });

        let hasChanges = false;
        let snippetIndex = 1;
        const eligibleBlocks = plainBlocks.filter((cb) => {
          const ext = getExtensionForLanguage(
            cb.language,
            config.includeExtensions,
          );
          return ext && config.includeExtensions.includes(ext);
        });
        const digits = Math.max(2, String(eligibleBlocks.length).length);

        for (const codeBlock of eligibleBlocks) {
          const lang = codeBlock.language;
          const mappedExtension = getExtensionForLanguage(
            lang,
            config.includeExtensions,
          )!;

          let snippetFileName = buildSnippetFileName(
            snippetIndex,
            digits,
            mappedExtension,
          );
          let snippetFilePath = join(outputDir, snippetFileName);

          while (await fileExists(snippetFilePath)) {
            snippetIndex++;
            snippetFileName = buildSnippetFileName(
              snippetIndex,
              digits,
              mappedExtension,
            );
            snippetFilePath = join(outputDir, snippetFileName);
          }

          const contentWithNewline = ensureTrailingNewline(
            normalizeLineEndings(codeBlock.content, codeBlock.lineEnding),
            codeBlock.lineEnding,
          );
          await writeFile(snippetFilePath, contentWithNewline, 'utf-8');
          result.snippetsCreated++;

          document.setDirective(codeBlock, {
            filePath: `${dirName}/${snippetFileName}`,
          });

          hasChanges = true;
          snippetIndex++;
        }

        if (hasChanges) {
          await writeFile(filePath, document.toString(), 'utf-8');
          result.extracted.push(filePath);
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

export async function discoverCodeBlocks(
  markdownGlob: string = '**/*.md',
  excludeGlob: Array<string> = [],
  workingDir: string = process.cwd(),
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    markdownFiles: [],
    totalCodeBlocks: 0,
    fileDetails: [],
  };

  try {
    const markdownFiles = await fg(markdownGlob, {
      ignore: excludeGlob,
      cwd: workingDir,
      absolute: true,
    });

    for (const filePath of markdownFiles) {
      try {
        const { document } = await readMarkdownDocument(filePath);
        const plainBlocks = document.codeBlocks.filter(
          (codeBlock) => !codeBlock.directive,
        );

        if (plainBlocks.length > 0) {
          const languages = [...new Set(plainBlocks.map((cb) => cb.language))];

          result.markdownFiles.push(filePath);
          result.totalCodeBlocks += plainBlocks.length;
          result.fileDetails.push({
            filePath,
            codeBlocks: plainBlocks.length,
            languages,
          });
        }
      } catch (error) {
        console.warn(`Warning: Could not process ${filePath}: ${error}`);
      }
    }
  } catch (error) {
    console.warn(`Warning: Error finding markdown files: ${error}`);
  }

  return result;
}
