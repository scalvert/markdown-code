import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Code } from 'mdast';
import type { CodeBlock, SnippetDirective } from './types.js';
import {
  formatSnippetDirective,
  parseSnippetDirective,
} from './snippet-directive.js';
import {
  linePrefixAt,
  parseFencedBlock,
  renderFencedBlock,
  type BlockEdit,
  type FencedBlock,
} from './fenced-block.js';
import type { LineEnding } from './line-endings.js';

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

interface BlockRecord {
  readonly block: DocumentCodeBlock;
  readonly start: number;
  readonly end: number;
  readonly source: FencedBlock;
}

interface Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
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

function replaceRanges(
  source: string,
  replacements: ReadonlyArray<Replacement>,
): string {
  return [...replacements]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (output, { start, end, text }) =>
        output.slice(0, start) + text + output.slice(end),
      source,
    );
}

function toRecord(content: string, node: Code): BlockRecord {
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? 0;
  const source = parseFencedBlock(
    content.slice(start, end),
    linePrefixAt(content, start),
  );
  const directive = node.meta ? parseSnippetDirective(node.meta) : undefined;
  const block: DocumentCodeBlock = {
    language: node.lang!,
    content: node.value,
    ...(directive ? { directive } : {}),
    line: node.position?.start.line ?? 1,
    column: node.position?.start.column ?? 1,
    lineEnding: source.lineEnding,
  };

  legacyOffsets.set(block, { start, end });
  return { block, start, end, source };
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
      if (node.lang) {
        records.push(toRecord(content, node));
      }
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
    return replaceRanges(
      this.#source,
      this.#records.flatMap(({ block, start, end, source }) => {
        const edit = this.#edits.get(block);
        return edit
          ? [{ start, end, text: renderFencedBlock(source, edit) }]
          : [];
      }),
    );
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
