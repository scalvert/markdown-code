import { writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fg from 'fast-glob';
import type { Config, SyncResult, CheckResult } from './types.js';
import {
  parseMarkdownFile,
  loadSnippetContent,
  extractLines,
  replaceCodeBlock,
} from './parser.js';

export async function syncMarkdownFiles(config: Config): Promise<SyncResult> {
  const result: SyncResult = {
    updated: [],
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob);

    for (const filePath of markdownFiles) {
      try {
        const markdownFile = parseMarkdownFile(filePath);
        let hasChanges = false;
        let updatedContent = markdownFile.content;

        for (const codeBlock of markdownFile.codeBlocks) {
          if (!codeBlock.snippet) {
            continue;
          }

          // Security check for path traversal
          try {
            const fullPath = resolve(
              config.snippetRoot,
              codeBlock.snippet.filePath
            );
            const resolvedRoot = resolve(config.snippetRoot);

            if (!fullPath.startsWith(resolvedRoot)) {
              result.errors.push(
                `Path traversal attempt detected: ${codeBlock.snippet.filePath}`
              );
              continue;
            }
          } catch (error) {
            result.errors.push(
              `Error validating path ${codeBlock.snippet.filePath}: ${error}`
            );
            continue;
          }

          const snippetPath = join(
            config.snippetRoot,
            codeBlock.snippet.filePath
          );

          if (!existsSync(snippetPath)) {
            result.warnings.push(`Snippet file not found: ${snippetPath}`);
            continue;
          }

          try {
            const snippetContent = loadSnippetContent(
              codeBlock.snippet.filePath,
              config.snippetRoot
            );
            const extractedContent = extractLines(
              snippetContent,
              codeBlock.snippet.startLine,
              codeBlock.snippet.endLine
            );

            // Skip update if extracted content is empty and we have line ranges (likely invalid range)
            if (
              extractedContent === '' &&
              (codeBlock.snippet.startLine || codeBlock.snippet.endLine)
            ) {
              continue;
            }

            if (extractedContent !== codeBlock.content) {
              updatedContent = replaceCodeBlock(
                updatedContent,
                codeBlock,
                extractedContent
              );
              hasChanges = true;
            }
          } catch (error) {
            result.errors.push(
              `Error loading snippet ${snippetPath}: ${error}`
            );
          }
        }

        if (hasChanges) {
          writeFileSync(filePath, updatedContent, 'utf-8');
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
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob);

    for (const filePath of markdownFiles) {
      try {
        const markdownFile = parseMarkdownFile(filePath);
        let isFileInSync = true;

        for (const codeBlock of markdownFile.codeBlocks) {
          if (!codeBlock.snippet) {
            continue;
          }

          // Security check for path traversal
          try {
            const fullPath = resolve(
              config.snippetRoot,
              codeBlock.snippet.filePath
            );
            const resolvedRoot = resolve(config.snippetRoot);

            if (!fullPath.startsWith(resolvedRoot)) {
              result.errors.push(
                `Path traversal attempt detected: ${codeBlock.snippet.filePath}`
              );
              continue;
            }
          } catch (error) {
            result.errors.push(
              `Error validating path ${codeBlock.snippet.filePath}: ${error}`
            );
            continue;
          }

          const snippetPath = join(
            config.snippetRoot,
            codeBlock.snippet.filePath
          );

          if (!existsSync(snippetPath)) {
            result.warnings.push(`Snippet file not found: ${snippetPath}`);
            continue;
          }

          try {
            const snippetContent = loadSnippetContent(
              codeBlock.snippet.filePath,
              config.snippetRoot
            );
            const extractedContent = extractLines(
              snippetContent,
              codeBlock.snippet.startLine,
              codeBlock.snippet.endLine
            );

            if (extractedContent !== codeBlock.content) {
              isFileInSync = false;
              break;
            }
          } catch (error) {
            result.errors.push(
              `Error loading snippet ${snippetPath}: ${error}`
            );
          }
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
