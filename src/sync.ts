import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { createRequire } from 'node:module';
import fg from 'fast-glob';
import { fileExists } from './utils.js';
import type {
  Config,
  SyncResult,
  CheckResult,
  ExtractResult,
  Issue,
  DiscoveryResult,
} from './types.js';
import {
  parseMarkdownFile,
  parseMarkdownForExtraction,
  loadSnippetContent,
  extractLines,
  replaceCodeBlock,
} from './parser.js';

const require = createRequire(import.meta.url);
const languageMap = require('language-map');

export async function syncMarkdownFiles(config: Config): Promise<SyncResult> {
  const result: SyncResult = {
    updated: [],
    fileIssues: [],
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
    });

    for (const filePath of markdownFiles) {
      const fileIssues: Array<Issue> = [];

      try {
        const markdownFile = await parseMarkdownFile(filePath);
        let hasChanges = false;
        let updatedContent = markdownFile.content;

        for (const codeBlock of markdownFile.codeBlocks) {
          if (!codeBlock.snippet) {
            continue;
          }

          try {
            const fullPath = resolve(
              config.snippetRoot,
              codeBlock.snippet.filePath,
            );
            const resolvedRoot = resolve(config.snippetRoot);

            if (!fullPath.startsWith(resolvedRoot)) {
              fileIssues.push({
                type: 'invalid-path',
                message: `Path traversal attempt detected: ${codeBlock.snippet.filePath}`,
                line: codeBlock.lineNumber ?? 1,
                column: codeBlock.columnNumber ?? 1,
                ruleId: 'path-traversal',
              });
              continue;
            }
          } catch (error) {
            fileIssues.push({
              type: 'load-failed',
              message: `Error validating path ${codeBlock.snippet.filePath}: ${error}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'path-validation',
            });
            continue;
          }

          const snippetPath = join(
            config.snippetRoot,
            codeBlock.snippet.filePath,
          );

          if (!(await fileExists(snippetPath))) {
            fileIssues.push({
              type: 'file-missing',
              message: `Snippet file not found: ${snippetPath}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'snippet-not-found',
            });
            continue;
          }

          try {
            const snippetContent = await loadSnippetContent(
              codeBlock.snippet.filePath,
              config.snippetRoot,
            );
            const extractedContent = extractLines(
              snippetContent,
              codeBlock.snippet.startLine,
              codeBlock.snippet.endLine,
            );

            if (
              extractedContent === '' &&
              (codeBlock.snippet.startLine ?? codeBlock.snippet.endLine)
            ) {
              continue;
            }

            if (extractedContent !== codeBlock.content) {
              updatedContent = replaceCodeBlock(
                updatedContent,
                codeBlock,
                extractedContent,
              );
              hasChanges = true;
            }
          } catch (error) {
            fileIssues.push({
              type: 'load-failed',
              message: `Error loading snippet ${snippetPath}: ${error}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'snippet-load-error',
            });
          }
        }

        if (fileIssues.length > 0) {
          result.fileIssues.push({
            filePath,
            issues: fileIssues,
          });
        }

        if (hasChanges) {
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

export async function checkMarkdownFiles(config: Config): Promise<CheckResult> {
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
    });

    for (const filePath of markdownFiles) {
      const fileIssues: Array<Issue> = [];

      try {
        const markdownFile = await parseMarkdownFile(filePath);
        let isFileInSync = true;

        for (const codeBlock of markdownFile.codeBlocks) {
          if (!codeBlock.snippet) {
            continue;
          }

          try {
            const fullPath = resolve(
              config.snippetRoot,
              codeBlock.snippet.filePath,
            );
            const resolvedRoot = resolve(config.snippetRoot);

            if (!fullPath.startsWith(resolvedRoot)) {
              fileIssues.push({
                type: 'invalid-path',
                message: `Path traversal attempt detected: ${codeBlock.snippet.filePath}`,
                line: codeBlock.lineNumber ?? 1,
                column: codeBlock.columnNumber ?? 1,
                ruleId: 'path-traversal',
              });
              continue;
            }
          } catch (error) {
            fileIssues.push({
              type: 'load-failed',
              message: `Error validating path ${codeBlock.snippet.filePath}: ${error}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'path-validation',
            });
            continue;
          }

          const snippetPath = join(
            config.snippetRoot,
            codeBlock.snippet.filePath,
          );

          if (!(await fileExists(snippetPath))) {
            fileIssues.push({
              type: 'file-missing',
              message: `Snippet file not found: ${snippetPath}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'snippet-not-found',
            });
            continue;
          }

          try {
            const snippetContent = await loadSnippetContent(
              codeBlock.snippet.filePath,
              config.snippetRoot,
            );
            const extractedContent = extractLines(
              snippetContent,
              codeBlock.snippet.startLine,
              codeBlock.snippet.endLine,
            );

            if (extractedContent !== codeBlock.content) {
              const endLineText = codeBlock.snippet.endLine
                ? `-L${codeBlock.snippet.endLine}`
                : '';
              const rangeText = codeBlock.snippet.startLine
                ? `#L${codeBlock.snippet.startLine}${endLineText}`
                : '';

              const snippetRef = `snippet://${codeBlock.snippet.filePath}${rangeText}`;

              fileIssues.push({
                type: 'sync-needed',
                message: `Code block out of sync with ${snippetRef}`,
                line: codeBlock.lineNumber ?? 1,
                column: codeBlock.columnNumber ?? 1,
                ruleId: 'content-mismatch',
              });

              isFileInSync = false;
            }
          } catch (error) {
            fileIssues.push({
              type: 'load-failed',
              message: `Error loading snippet ${snippetPath}: ${error}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'snippet-load-error',
            });
          }
        }

        if (fileIssues.length > 0) {
          result.fileIssues.push({
            filePath,
            issues: fileIssues,
          });
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

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : content + '\n';
}

export async function extractSnippets(config: Config): Promise<ExtractResult> {
  const result: ExtractResult = {
    extracted: [],
    snippetsCreated: 0,
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
    });

    for (const filePath of markdownFiles) {
      try {
        const markdownFile = await parseMarkdownForExtraction(filePath);

        if (markdownFile.codeBlocks.length === 0) {
          continue;
        }

        const baseFileName = basename(filePath, '.md');
        const dirName = baseFileName.toLowerCase();
        const outputDir = join(config.snippetRoot, dirName);

        await mkdir(outputDir, { recursive: true });

        let hasChanges = false;
        let updatedContent = markdownFile.content;
        let snippetIndex = 1;

        for (const codeBlock of markdownFile.codeBlocks) {
          const lang = codeBlock.language;
          const mappedExtension = getExtensionForLanguage(
            lang,
            config.includeExtensions,
          );

          if (
            !mappedExtension ||
            !config.includeExtensions.includes(mappedExtension)
          ) {
            continue;
          }

          let snippetFileName = `snippet${snippetIndex}${mappedExtension}`;
          let snippetFilePath = join(outputDir, snippetFileName);

          while (await fileExists(snippetFilePath)) {
            snippetIndex++;
            snippetFileName = `snippet${snippetIndex}${mappedExtension}`;
            snippetFilePath = join(outputDir, snippetFileName);
          }

          const contentWithNewline = ensureTrailingNewline(codeBlock.content);
          await writeFile(snippetFilePath, contentWithNewline, 'utf-8');
          result.snippetsCreated++;

          const snippetReference = `${dirName}/${snippetFileName}`;

          const newCodeBlockStart =
            '```' + lang + ' snippet=' + snippetReference;

          updatedContent = updatedContent.replace(
            new RegExp('^```' + lang + '$', 'm'),
            newCodeBlockStart,
          );

          hasChanges = true;
          snippetIndex++;
        }

        if (hasChanges) {
          await writeFile(filePath, updatedContent, 'utf-8');
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
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    markdownFiles: [],
    totalCodeBlocks: 0,
    fileDetails: [],
  };

  try {
    const markdownFiles = await fg(markdownGlob, {
      ignore: excludeGlob,
    });

    for (const filePath of markdownFiles) {
      try {
        const markdownFile = await parseMarkdownForExtraction(filePath);

        if (markdownFile.codeBlocks.length > 0) {
          const languages = [
            ...new Set(markdownFile.codeBlocks.map((cb) => cb.language)),
          ];

          result.markdownFiles.push(filePath);
          result.totalCodeBlocks += markdownFile.codeBlocks.length;
          result.fileDetails.push({
            filePath,
            codeBlocks: markdownFile.codeBlocks.length,
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
