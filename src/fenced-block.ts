import type { SnippetDirective } from './types.js';
import { withDirective } from './fence-info.js';
import { getLineEnding, splitLines, type LineEnding } from './line-endings.js';

export interface BlockEdit {
  content?: string | undefined;
  directive?: SnippetDirective | null | undefined;
}

export type BlockEnd =
  | { readonly kind: 'closing-fence'; readonly line: string }
  | { readonly kind: 'line-break' }
  | { readonly kind: 'unterminated' };

export interface FencedBlock {
  readonly fence: string;
  readonly info: string;
  readonly rawBody: string;
  readonly end: BlockEnd;
  readonly bodyPrefix: string;
  readonly lineEnding: LineEnding;
}

const TAB_SIZE = 4;
const BLOCKQUOTE_MARKER = '>';
const OPENING_LINE = /^(`{3,}|~{3,})(.*)$/;
const BODY_FENCE_LINE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;
const FENCE_RUN = /`{3,}|~{3,}/;
const STARTS_WITH_WHITESPACE = /^[ \t]/;
const ENDS_WITH_LINE_BREAK = /(?:\r\n|\r|\n)$/;

function columnAfter(text: string, startColumn: number): number {
  return [...text].reduce(
    (column, character) =>
      character === '\t' ? column + TAB_SIZE - (column % TAB_SIZE) : column + 1,
    startColumn,
  );
}

function bodyPrefixFor(linePrefix: string): string {
  const [outsideQuotes = '', ...quoted] = linePrefix.split(BLOCKQUOTE_MARKER);
  const initial = columnAfter(outsideQuotes, 0);

  return quoted.reduce(
    ({ column, prefix }, segment) => {
      const start = column + BLOCKQUOTE_MARKER.length;
      const end = columnAfter(segment, start);
      const optionalSpace = STARTS_WITH_WHITESPACE.test(segment) ? 1 : 0;
      const indent = ' '.repeat(end - start - optionalSpace);
      return { column: end, prefix: `${prefix}${BLOCKQUOTE_MARKER} ${indent}` };
    },
    { column: initial, prefix: ' '.repeat(initial) },
  ).prefix;
}

function closingFencePattern(fence: string, quoteDepth: number): RegExp {
  const blockquoteMarkers = `(?:[ \\t]*${BLOCKQUOTE_MARKER}){${quoteDepth}}`;
  const fenceRun = `${fence.charAt(0)}{${fence.length},}`;
  return new RegExp(`^${blockquoteMarkers}[ \\t]*${fenceRun}[ \\t]*$`);
}

function blockEnd(
  lines: ReadonlyArray<string>,
  fence: string,
  quoteDepth: number,
): BlockEnd {
  const last = lines.length > 1 ? lines.at(-1) : undefined;
  if (last === '') {
    return { kind: 'line-break' };
  }
  if (last !== undefined && closingFencePattern(fence, quoteDepth).test(last)) {
    return { kind: 'closing-fence', line: last };
  }
  return { kind: 'unterminated' };
}

function endText(end: BlockEnd): string {
  return end.kind === 'closing-fence' ? end.line : '';
}

function linePrefixAt(source: string, offset: number): string {
  return source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset);
}

export function parseFencedBlockAt(
  source: string,
  start: number,
  end: number,
): FencedBlock {
  const text = source.slice(start, end);
  const lines = splitLines(text);
  const [opening = ''] = lines;
  const match = OPENING_LINE.exec(opening);
  if (!match) {
    throw new Error(`Not the start of a fenced code block: ${opening}`);
  }

  const [, fence = '', info = ''] = match;
  const linePrefix = linePrefixAt(source, start);
  const quoteDepth = linePrefix.split(BLOCKQUOTE_MARKER).length - 1;
  const blockEnding = blockEnd(lines, fence, quoteDepth);

  return {
    fence,
    info,
    rawBody: text.slice(
      opening.length,
      text.length - endText(blockEnding).length,
    ),
    end: blockEnding,
    bodyPrefix: bodyPrefixFor(linePrefix),
    lineEnding: getLineEnding(text),
  };
}

function longestFenceRun(content: string, fenceChar: string): number {
  return splitLines(content).reduce((longest, line) => {
    const run = BODY_FENCE_LINE.exec(line)?.[1];
    return run?.charAt(0) === fenceChar
      ? Math.max(longest, run.length)
      : longest;
  }, 0);
}

function fenceFor(content: string, fence: string): string {
  const fenceChar = fence.charAt(0);
  const longest = longestFenceRun(content, fenceChar);
  return longest >= fence.length ? fenceChar.repeat(longest + 1) : fence;
}

function lengthenFence(line: string, fence: string): string {
  return line.replace(FENCE_RUN, (run) =>
    run.length >= fence.length ? run : fence,
  );
}

function bodyLines(content: string, prefix: string): Array<string> {
  if (content === '') {
    return [];
  }
  const blankLinePrefix = prefix.trimEnd();
  return splitLines(content).map((line) =>
    line === '' ? blankLinePrefix : prefix + line,
  );
}

function endFor(end: BlockEnd, content: string): BlockEnd {
  return end.kind === 'unterminated' && ENDS_WITH_LINE_BREAK.test(content)
    ? { kind: 'line-break' }
    : end;
}

function endLines(end: BlockEnd, fence: string): Array<string> {
  if (end.kind === 'closing-fence') {
    return [lengthenFence(end.line, fence)];
  }
  return end.kind === 'line-break' ? [''] : [];
}

export function renderFencedBlock(block: FencedBlock, edit: BlockEdit): string {
  const info =
    edit.directive === undefined
      ? block.info
      : withDirective(block.info, edit.directive);

  if (edit.content === undefined) {
    return block.fence + info + block.rawBody + endText(block.end);
  }

  const fence = fenceFor(edit.content, block.fence);

  return [
    fence + info,
    ...bodyLines(edit.content, block.bodyPrefix),
    ...endLines(endFor(block.end, edit.content), fence),
  ].join(block.lineEnding);
}
