import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
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
import {
  parseMarkdownFile,
  parseMarkdownForExtraction,
  loadSnippetContent,
  resolveSnippetPath,
  extractLines,
  replaceCodeBlock,
} from './parser.js';

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
        const markdownFile = await parseMarkdownFile(filePath);
        let hasChanges = false;
        let updatedContent = markdownFile.content;

        for (const codeBlock of markdownFile.codeBlocks) {
          if (!codeBlock.snippet) {
            continue;
          }

          if (codeBlock.snippet.isRemote) {
            try {
              const snippetContent = await loadSnippetContent(
                codeBlock.snippet.filePath,
                config,
                filePath,
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
              const errMsg = error instanceof Error ? error.message : error;
              fileIssues.push({
                type: 'remote-error',
                message: `Error fetching remote snippet: ${errMsg}`,
                line: codeBlock.lineNumber ?? 1,
                column: codeBlock.columnNumber ?? 1,
                ruleId: 'remote-fetch-error',
              });
            }
            continue;
          }

          let snippetPath: string;
          try {
            snippetPath = await resolveSnippetPath(
              codeBlock.snippet.filePath,
              config,
              filePath,
            );

            const workingDir = resolve(config.workingDir);
            const snippetRoot = resolve(workingDir, config.snippetRoot || '.');

            const allowedRoots = [workingDir];
            if (snippetRoot !== workingDir) {
              allowedRoots.push(snippetRoot);
            }

            if (!isInWorkingDir(snippetPath, allowedRoots)) {
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
              message: `Error resolving path ${codeBlock.snippet.filePath}: ${error}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'path-validation',
            });
            continue;
          }

          if (!(await fileExists(snippetPath))) {
            fileIssues.push({
              type: 'file-missing',
              message: `Snippet file not found: ${codeBlock.snippet.filePath}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'snippet-not-found',
            });
            continue;
          }

          try {
            const snippetContent = await loadSnippetContent(
              codeBlock.snippet.filePath,
              config,
              filePath,
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
        const markdownFile = await parseMarkdownFile(filePath);
        let isFileInSync = true;

        for (const codeBlock of markdownFile.codeBlocks) {
          if (!codeBlock.snippet) {
            continue;
          }

          if (codeBlock.snippet.isRemote) {
            try {
              const snippetContent = await loadSnippetContent(
                codeBlock.snippet.filePath,
                config,
                filePath,
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
              const errMsg = error instanceof Error ? error.message : error;
              fileIssues.push({
                type: 'remote-error',
                message: `Error fetching remote snippet: ${errMsg}`,
                line: codeBlock.lineNumber ?? 1,
                column: codeBlock.columnNumber ?? 1,
                ruleId: 'remote-fetch-error',
              });
            }
            continue;
          }

          let snippetPath: string;
          try {
            snippetPath = await resolveSnippetPath(
              codeBlock.snippet.filePath,
              config,
              filePath,
            );

            const workingDir = resolve(config.workingDir);
            const snippetRoot = resolve(workingDir, config.snippetRoot || '.');

            const allowedRoots = [workingDir];
            if (snippetRoot !== workingDir) {
              allowedRoots.push(snippetRoot);
            }

            if (!isInWorkingDir(snippetPath, allowedRoots)) {
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
              message: `Error resolving path ${codeBlock.snippet.filePath}: ${error}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'path-validation',
            });
            continue;
          }

          if (!(await fileExists(snippetPath))) {
            fileIssues.push({
              type: 'file-missing',
              message: `Snippet file not found: ${codeBlock.snippet.filePath}`,
              line: codeBlock.lineNumber ?? 1,
              column: codeBlock.columnNumber ?? 1,
              ruleId: 'snippet-not-found',
            });
            continue;
          }

          try {
            const snippetContent = await loadSnippetContent(
              codeBlock.snippet.filePath,
              config,
              filePath,
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

export function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : content + '\n';
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

  try {
    const markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
      cwd: config.workingDir,
      absolute: true,
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
        const eligibleBlocks = markdownFile.codeBlocks.filter((cb) => {
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
