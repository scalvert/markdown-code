import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Code } from 'mdast';
import type { CodeBlock, SnippetDirective } from './types.js';
import {
  findSnippetDirectiveToken,
  formatSnippetDirective,
  parseSnippetDirective,
} from './snippet-directive.js';
import {
  getLineEnding,
  normalizeLineEndings,
  type LineEnding,
} from './line-endings.js';

export interface ParseOptions {
  mdx?: boolean;
}

export interface DocumentCodeBlock {
  readonly language: string;
  readonly content: string;
  readonly directive?: SnippetDirective;
  readonly line: number;
  readonly column: number;
  readonly lineEnding: LineEnding;
}

export interface BlockEdit {
  content?: string | undefined;
  directive?: SnippetDirective | null | undefined;
}

interface BlockRecord {
  block: DocumentCodeBlock;
  start: number;
  end: number;
}

const OPENING_FENCE_PREFIX = /^[ \t]*(?:`{3,}|~{3,})[ \t]*\S*/;
const FENCE_MARKER = /^[ \t]*(`{3,}|~{3,})/;
const CLOSING_FENCE = /^[ \t>]*(`{3,}|~{3,})[ \t]*$/;

function closesFence(openingLine: string, candidate: string): boolean {
  const opening = openingLine.match(FENCE_MARKER)?.[1];
  const closing = candidate.match(CLOSING_FENCE)?.[1];
  return (
    opening !== undefined &&
    closing !== undefined &&
    closing[0] === opening[0] &&
    closing.length >= opening.length
  );
}

const legacyOffsets = new WeakMap<
  DocumentCodeBlock,
  { start: number; end: number }
>();

export function isMdxPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.mdx');
}

function createProcessor(options: ParseOptions) {
  if (options.mdx) {
    return unified().use(remarkParse).use(remarkFrontmatter).use(remarkMdx);
  }
  return unified().use(remarkParse);
}

function splitLineEnding(line: string): [string, string] {
  return line.endsWith('\r') ? [line.slice(0, -1), '\r'] : [line, ''];
}

function rewriteOpeningFence(
  line: string,
  directive: SnippetDirective | null,
): string {
  const [text, lineEnding] = splitLineEnding(line);
  const metaStart = text.match(OPENING_FENCE_PREFIX)?.[0].length ?? text.length;
  const head = text.slice(0, metaStart);
  const meta = text.slice(metaStart);
  const existing = findSnippetDirectiveToken(meta);

  if (existing) {
    const after = meta.slice(existing.end);

    if (directive) {
      const before = meta.slice(0, existing.start);
      return (
        head + before + formatSnippetDirective(directive) + after + lineEnding
      );
    }

    const separatorStart =
      existing.start > 0 && /[ \t]/.test(meta[existing.start - 1]!)
        ? existing.start - 1
        : existing.start;
    return head + meta.slice(0, separatorStart) + after + lineEnding;
  }

  if (!directive) {
    return line;
  }

  return `${text} ${formatSnippetDirective(directive)}${lineEnding}`;
}

function indentBody(
  content: string,
  column: number,
  lineEnding: LineEnding,
): string {
  const normalized = normalizeLineEndings(content, lineEnding);
  const indent = ' '.repeat(Math.max(0, column - 1));
  if (indent === '') {
    return normalized;
  }
  return normalized
    .split(lineEnding)
    .map((line) => (line === '' ? line : indent + line))
    .join(lineEnding);
}

export function renderBlock(
  blockText: string,
  column: number,
  edit: BlockEdit,
): string {
  const firstNewlineIndex = blockText.indexOf('\n');
  const openingLine =
    firstNewlineIndex === -1
      ? blockText
      : blockText.slice(0, firstNewlineIndex);
  const rest =
    firstNewlineIndex === -1 ? '' : blockText.slice(firstNewlineIndex);

  const opening =
    edit.directive === undefined
      ? openingLine
      : rewriteOpeningFence(openingLine, edit.directive);

  if (edit.content === undefined || firstNewlineIndex === -1) {
    return opening + rest;
  }

  const lineEnding = getLineEnding(blockText);
  const lastLine = blockText.slice(blockText.lastIndexOf('\n') + 1);
  const closing = closesFence(openingLine, lastLine)
    ? `${lineEnding}${lastLine}`
    : '';
  const body = indentBody(edit.content, column, lineEnding);

  return `${opening}\n${body}${closing}`;
}

export class MarkdownDocument {
  readonly codeBlocks: ReadonlyArray<DocumentCodeBlock>;
  readonly #source: string;
  readonly #records: ReadonlyArray<BlockRecord>;
  readonly #edits = new Map<DocumentCodeBlock, BlockEdit>();

  private constructor(source: string, records: Array<BlockRecord>) {
    this.#source = source;
    this.#records = records;
    this.codeBlocks = records.map((record) => record.block);
  }

  static parse(content: string, options: ParseOptions = {}): MarkdownDocument {
    const tree = createProcessor(options).parse(content);
    const records: Array<BlockRecord> = [];

    visit(tree, 'code', (node: Code) => {
      if (!node.lang) {
        return;
      }

      const start = node.position?.start.offset ?? 0;
      const end = node.position?.end.offset ?? 0;
      const directive = node.meta
        ? parseSnippetDirective(node.meta)
        : undefined;
      const block: DocumentCodeBlock = {
        language: node.lang,
        content: node.value,
        ...(directive ? { directive } : {}),
        line: node.position?.start.line ?? 1,
        column: node.position?.start.column ?? 1,
        lineEnding: getLineEnding(content.slice(start, end)),
      };

      legacyOffsets.set(block, { start, end });
      records.push({ block, start, end });
    });

    return new MarkdownDocument(content, records);
  }

  setBody(block: DocumentCodeBlock, content: string): void {
    this.#edit(block, { content });
  }

  setDirective(
    block: DocumentCodeBlock,
    directive: SnippetDirective | undefined,
  ): void {
    const current = block.directive && formatSnippetDirective(block.directive);
    const next = directive && formatSnippetDirective(directive);
    this.#edit(block, {
      directive: current === next ? undefined : (directive ?? null),
    });
  }

  toString(): string {
    const edited = this.#records
      .filter((record) => this.#edits.has(record.block))
      .sort((a, b) => b.start - a.start);

    let output = this.#source;
    for (const { block, start, end } of edited) {
      const rendered = renderBlock(
        this.#source.slice(start, end),
        block.column,
        this.#edits.get(block)!,
      );
      output = output.slice(0, start) + rendered + output.slice(end);
    }
    return output;
  }

  #edit(block: DocumentCodeBlock, edit: BlockEdit): void {
    if (!this.codeBlocks.includes(block)) {
      throw new Error('Code block does not belong to this document');
    }
    const merged = { ...this.#edits.get(block), ...edit };
    if (merged.content === undefined && merged.directive === undefined) {
      this.#edits.delete(block);
      return;
    }
    this.#edits.set(block, merged);
  }
}

export function toLegacyCodeBlocks(
  document: MarkdownDocument,
): Array<CodeBlock> {
  return document.codeBlocks.map((block) => ({
    language: block.language,
    content: block.content,
    ...(block.directive ? { snippet: block.directive } : {}),
    position: legacyOffsets.get(block) ?? { start: 0, end: 0 },
    lineNumber: block.line,
    columnNumber: block.column,
  }));
}
