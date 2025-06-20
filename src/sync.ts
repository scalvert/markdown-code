import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import fg from 'fast-glob';
import type { Config, SyncResult, CheckResult, ExtractResult } from './types.js';
import {
  parseMarkdownFile,
  parseMarkdownForExtraction,
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

          try {
            const fullPath = resolve(
              config.snippetRoot,
              codeBlock.snippet.filePath,
            );
            const resolvedRoot = resolve(config.snippetRoot);

            if (!fullPath.startsWith(resolvedRoot)) {
              result.errors.push(
                `Path traversal attempt detected: ${codeBlock.snippet.filePath}`,
              );
              continue;
            }
          } catch (error) {
            result.errors.push(
              `Error validating path ${codeBlock.snippet.filePath}: ${error}`,
            );
            continue;
          }

          const snippetPath = join(
            config.snippetRoot,
            codeBlock.snippet.filePath,
          );

          if (!existsSync(snippetPath)) {
            result.warnings.push(`Snippet file not found: ${snippetPath}`);
            continue;
          }

          try {
            const snippetContent = loadSnippetContent(
              codeBlock.snippet.filePath,
              config.snippetRoot,
            );
            const extractedContent = extractLines(
              snippetContent,
              codeBlock.snippet.startLine,
              codeBlock.snippet.endLine,
            );

            // Skip update if extracted content is empty and we have line ranges
            // (likely invalid range)
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
                extractedContent,
              );
              hasChanges = true;
            }
          } catch (error) {
            result.errors.push(
              `Error loading snippet ${snippetPath}: ${error}`,
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

          try {
            const fullPath = resolve(
              config.snippetRoot,
              codeBlock.snippet.filePath,
            );
            const resolvedRoot = resolve(config.snippetRoot);

            if (!fullPath.startsWith(resolvedRoot)) {
              result.errors.push(
                `Path traversal attempt detected: ${codeBlock.snippet.filePath}`,
              );
              continue;
            }
          } catch (error) {
            result.errors.push(
              `Error validating path ${codeBlock.snippet.filePath}: ${error}`,
            );
            continue;
          }

          const snippetPath = join(
            config.snippetRoot,
            codeBlock.snippet.filePath,
          );

          if (!existsSync(snippetPath)) {
            result.warnings.push(`Snippet file not found: ${snippetPath}`);
            continue;
          }

          try {
            const snippetContent = loadSnippetContent(
              codeBlock.snippet.filePath,
              config.snippetRoot,
            );
            const extractedContent = extractLines(
              snippetContent,
              codeBlock.snippet.startLine,
              codeBlock.snippet.endLine,
            );

            if (extractedContent !== codeBlock.content) {
              isFileInSync = false;
              break;
            }
          } catch (error) {
            result.errors.push(
              `Error loading snippet ${snippetPath}: ${error}`,
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

export async function extractSnippets(config: Config): Promise<ExtractResult> {
  const result: ExtractResult = {
    extracted: [],
    snippetsCreated: 0,
    warnings: [],
    errors: [],
  };

  try {
    const markdownFiles = await fg(config.markdownGlob);

    for (const filePath of markdownFiles) {
      try {
        const markdownFile = parseMarkdownForExtraction(filePath);

        if (markdownFile.codeBlocks.length === 0) {
          continue;
        }

        const baseFileName = basename(filePath, '.md');
        const dirName = baseFileName.toLowerCase();
        const outputDir = join(config.snippetRoot, dirName);

        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        let hasChanges = false;
        let updatedContent = markdownFile.content;
        let snippetIndex = 1;

        const supportedExtensions = config.includeExtensions.map(ext => ext.replace('.', ''));

        for (const codeBlock of markdownFile.codeBlocks) {
          const lang = codeBlock.language;

          if (!supportedExtensions.includes(lang)) {
            continue;
          }

          const extension = config.includeExtensions.find(ext => ext.replace('.', '') === lang);
          if (!extension) {
            continue;
          }

          let snippetFileName = `snippet${snippetIndex}${extension}`;
          let snippetFilePath = join(outputDir, snippetFileName);

          while (existsSync(snippetFilePath)) {
            snippetIndex++;
            snippetFileName = `snippet${snippetIndex}${extension}`;
            snippetFilePath = join(outputDir, snippetFileName);
          }

          writeFileSync(snippetFilePath, codeBlock.content, 'utf-8');
          result.snippetsCreated++;

          const snippetReference = `${dirName}/${snippetFileName}`;

          const newCodeBlockStart = '```' + lang + ' snippet=' + snippetReference;

          updatedContent = updatedContent.replace(
            new RegExp('^```' + lang + '$', 'm'),
            newCodeBlockStart,
          );

          hasChanges = true;
          snippetIndex++;
        }

        if (hasChanges) {
          writeFileSync(filePath, updatedContent, 'utf-8');
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
