import type { SnippetDirective } from './types.js';
import { withDirective } from './fence-info.js';
import { getLineEnding, type LineEnding } from './line-endings.js';

export interface BlockEdit {
  content?: string | undefined;
  directive?: SnippetDirective | null | undefined;
}

export interface FencedBlock {
  readonly fence: string;
  readonly info: string;
  readonly afterOpening: string;
  readonly closing: string | undefined;
  readonly bodyPrefix: string;
  readonly lineEnding: LineEnding;
}

const LINE_BREAK = /\r\n|\r|\n/;
const OPENING_LINE = /^(`{3,}|~{3,})(.*)$/;
const CLOSING_LINE = /^[ \t>]*(`{3,}|~{3,})[ \t]*$/;
const BODY_FENCE_LINE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;
const FENCE_RUN = /`{3,}|~{3,}/;
const LIST_MARKER_CHARACTER = /[^ \t>]/g;
const BARE_BLOCKQUOTE_MARKER = />(?![ \t])/g;

export function linePrefixAt(source: string, offset: number): string {
  return source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset);
}

function bodyPrefixFor(linePrefix: string): string {
  return linePrefix
    .replace(LIST_MARKER_CHARACTER, ' ')
    .replace(BARE_BLOCKQUOTE_MARKER, '> ');
}

function closes(fence: string, line: string): boolean {
  const run = CLOSING_LINE.exec(line)?.[1];
  return run !== undefined && run[0] === fence[0] && run.length >= fence.length;
}

export function parseFencedBlock(
  text: string,
  linePrefix: string,
): FencedBlock {
  const lines = text.split(LINE_BREAK);
  const opening = lines[0]!;
  const match = OPENING_LINE.exec(opening);
  if (!match) {
    throw new Error(`Not the start of a fenced code block: ${opening}`);
  }

  const fence = match[1]!;
  const info = match[2]!;
  const last = lines.length > 1 ? lines.at(-1) : undefined;

  return {
    fence,
    info,
    afterOpening: text.slice(opening.length),
    closing: last !== undefined && closes(fence, last) ? last : undefined,
    bodyPrefix: bodyPrefixFor(linePrefix),
    lineEnding: getLineEnding(text),
  };
}

function longestFenceRun(content: string, fenceChar: string): number {
  return content.split(LINE_BREAK).reduce((longest, line) => {
    const run = BODY_FENCE_LINE.exec(line)?.[1];
    return run?.[0] === fenceChar ? Math.max(longest, run.length) : longest;
  }, 0);
}

function fenceFor(content: string, fence: string): string {
  const fenceChar = fence[0]!;
  const longest = longestFenceRun(content, fenceChar);
  return longest >= fence.length ? fenceChar.repeat(longest + 1) : fence;
}

function lengthenFence(line: string, fence: string): string {
  return line.replace(FENCE_RUN, (run) =>
    run.length >= fence.length ? run : fence,
  );
}

function bodyLines(content: string, prefix: string): Array<string> {
  const blankLinePrefix = prefix.trimEnd();
  return content
    .split(LINE_BREAK)
    .map((line) => (line === '' ? blankLinePrefix : prefix + line));
}

export function renderFencedBlock(block: FencedBlock, edit: BlockEdit): string {
  const info =
    edit.directive === undefined
      ? block.info
      : withDirective(block.info, edit.directive);

  if (edit.content === undefined) {
    return block.fence + info + block.afterOpening;
  }

  const fence = fenceFor(edit.content, block.fence);
  const closing =
    block.closing === undefined ? [] : [lengthenFence(block.closing, fence)];

  return [
    fence + info,
    ...bodyLines(edit.content, block.bodyPrefix),
    ...closing,
  ].join(block.lineEnding);
}
