import { readFile } from 'node:fs/promises';
import type { MarkdownFile, CodeBlock } from './types.js';
import {
  MarkdownDocument,
  isMdxPath,
  renderBlock,
  toLegacyCodeBlocks,
} from './markdown-document.js';

export { parseSnippetDirective } from './snippet-directive.js';
export {
  extractLines,
  loadSnippetContent,
  resolveSnippetPath,
  trimBlankLines,
} from './snippet-resolution.js';
export {
  getLineEnding,
  normalizeLineEndings,
  type LineEnding,
} from './line-endings.js';

export async function readMarkdownDocument(
  filePath: string,
): Promise<{ content: string; document: MarkdownDocument }> {
  const content = await readFile(filePath, 'utf-8');
  const document = MarkdownDocument.parse(content, {
    mdx: isMdxPath(filePath),
  });
  return { content, document };
}

async function readLegacyCodeBlocks(
  filePath: string,
): Promise<{ content: string; codeBlocks: Array<CodeBlock> }> {
  const { content, document } = await readMarkdownDocument(filePath);
  return { content, codeBlocks: toLegacyCodeBlocks(document) };
}

/**
 * @deprecated Use `MarkdownDocument.parse` and filter `codeBlocks` by
 * `directive`. Will be removed in 2.0.
 */
export async function parseMarkdownFile(
  filePath: string,
): Promise<MarkdownFile> {
  const { content, codeBlocks } = await readLegacyCodeBlocks(filePath);
  return {
    filePath,
    content,
    codeBlocks: codeBlocks.filter((block) => block.snippet),
  };
}

/**
 * @deprecated Use `MarkdownDocument.parse` and filter `codeBlocks` by
 * `!directive`. Will be removed in 2.0.
 */
export async function parseMarkdownForExtraction(
  filePath: string,
): Promise<MarkdownFile> {
  const { content, codeBlocks } = await readLegacyCodeBlocks(filePath);
  return {
    filePath,
    content,
    codeBlocks: codeBlocks
      .filter((block) => !block.snippet)
      .map(({ language, content: body, position }) => ({
        language,
        content: body,
        position,
      })),
  };
}

/**
 * @deprecated Use `MarkdownDocument#setBody` followed by `toString()`.
 * Will be removed in 2.0.
 */
export function replaceCodeBlock(
  markdownContent: string,
  codeBlock: CodeBlock,
  newContent: string,
): string {
  const { start, end } = codeBlock.position;
  const rendered = renderBlock(
    markdownContent.slice(start, end),
    codeBlock.columnNumber ?? 1,
    { content: newContent },
  );
  return (
    markdownContent.slice(0, start) + rendered + markdownContent.slice(end)
  );
}
