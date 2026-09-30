import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
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
import {
  loadSnippetContent,
  resolveSnippetPath,
  extractLines,
} from './parser.js';
import { normalizeLineEndings } from './line-endings.js';
import {
  MarkdownDocument,
  isMdxPath,
  type DocumentCodeBlock,
} from './markdown-document.js';
import { formatSnippetDirective } from './snippet-directive.js';

const require = createRequire(import.meta.url);
const languageMap = require('language-map');

export async function readMarkdownDocument(
  filePath: string,
): Promise<{ content: string; document: MarkdownDocument }> {
  const content = await readFile(filePath, 'utf-8');
  const document = MarkdownDocument.parse(content, {
    mdx: isMdxPath(filePath),
  });
  return { content, document };
}

// Resolves a single code block's snippet content, pushing any issue into fileIssues.
// Returns the extracted content string, or null if the block should be skipped.
async function resolveCodeBlockContent(
  codeBlock: DocumentCodeBlock,
  config: RuntimeConfig,
  markdownFilePath: string,
  fileIssues: Array<Issue>,
): Promise<string | null> {
  const snippet = codeBlock.directive!;
  const { lineEnding } = codeBlock;

  if (snippet.isRemote) {
    try {
      const snippetContent = await loadSnippetContent(
        snippet.filePath,
        config,
        markdownFilePath,
      );
      const extractedContent = extractLines(
        snippetContent,
        snippet.startLine,
        snippet.endLine,
      );
      if (extractedContent === '' && (snippet.startLine ?? snippet.endLine)) {
        return null;
      }
      return normalizeLineEndings(extractedContent, lineEnding);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : error;
      fileIssues.push({
        type: 'remote-error',
        message: `Error fetching remote snippet: ${errMsg}`,
        line: codeBlock.line,
        column: codeBlock.column,
        ruleId: 'remote-fetch-error',
      });
      return null;
    }
  }

  let snippetPath: string;
  try {
    snippetPath = await resolveSnippetPath(
      snippet.filePath,
      config,
      markdownFilePath,
    );
  } catch (error) {
    fileIssues.push({
      type: 'load-failed',
      message: `Error resolving path ${snippet.filePath}: ${error}`,
      line: codeBlock.line,
      column: codeBlock.column,
      ruleId: 'path-validation',
    });
    return null;
  }

  // Resolve symlinks to get the real path, and detect missing files in one step
  let realSnippetPath: string;
  try {
    realSnippetPath = await realpath(snippetPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      fileIssues.push({
        type: 'file-missing',
        severity: config.missingSnippetSeverity ?? 'error',
        message: `Snippet file not found: ${snippet.filePath}`,
        line: codeBlock.line,
        column: codeBlock.column,
        ruleId: 'snippet-not-found',
      });
    } else {
      fileIssues.push({
        type: 'load-failed',
        message: `Error accessing snippet ${snippet.filePath}: ${err.message}`,
        line: codeBlock.line,
        column: codeBlock.column,
        ruleId: 'snippet-load-error',
      });
    }
    return null;
  }

  const workingDir = resolve(config.workingDir);
  const snippetRoot = resolve(workingDir, config.snippetRoot || '.');
  const allowedRoots =
    snippetRoot !== workingDir ? [workingDir, snippetRoot] : [workingDir];

  if (!isInWorkingDir(realSnippetPath, allowedRoots)) {
    fileIssues.push({
      type: 'invalid-path',
      message: `Path traversal attempt detected: ${snippet.filePath}`,
      line: codeBlock.line,
      column: codeBlock.column,
      ruleId: 'path-traversal',
    });
    return null;
  }

  try {
    const snippetContent = await loadSnippetContent(
      snippet.filePath,
      config,
      markdownFilePath,
    );
    const extractedContent = extractLines(
      snippetContent,
      snippet.startLine,
      snippet.endLine,
    );
    if (extractedContent === '' && (snippet.startLine ?? snippet.endLine)) {
      return null;
    }
    return normalizeLineEndings(extractedContent, lineEnding);
  } catch (error) {
    fileIssues.push({
      type: 'load-failed',
      message: `Error loading snippet ${snippetPath}: ${error}`,
      line: codeBlock.line,
      column: codeBlock.column,
      ruleId: 'snippet-load-error',
    });
    return null;
  }
}

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

        for (const codeBlock of document.codeBlocks) {
          if (!codeBlock.directive) {
            continue;
          }

          const extractedContent = await resolveCodeBlockContent(
            codeBlock,
            config,
            filePath,
            fileIssues,
          );

          if (
            extractedContent !== null &&
            extractedContent !== codeBlock.content
          ) {
            document.setBody(codeBlock, extractedContent);
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

        for (const codeBlock of document.codeBlocks) {
          if (!codeBlock.directive) {
            continue;
          }

          const extractedContent = await resolveCodeBlockContent(
            codeBlock,
            config,
            filePath,
            fileIssues,
          );

          if (
            extractedContent !== null &&
            extractedContent !== codeBlock.content
          ) {
            fileIssues.push({
              type: 'sync-needed',
              message: `Code block out of sync with ${formatSnippetDirective(codeBlock.directive)}`,
              line: codeBlock.line,
              column: codeBlock.column,
              ruleId: 'content-mismatch',
            });
            isFileInSync = false;
          }
        }

        if (fileIssues.length > 0) {
          result.fileIssues.push({ filePath, issues: fileIssues });
        }

        if (
          fileIssues.some(
            (issue) =>
              issue.type !== 'file-missing' || issue.severity !== 'warning',
          )
        ) {
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
