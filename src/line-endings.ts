export type LineEnding = '\n' | '\r\n';

const LINE_BREAK = /\r\n|\r|\n/;

export function getLineEnding(content: string): LineEnding {
  return content.match(/\r\n|\n/)?.[0] === '\r\n' ? '\r\n' : '\n';
}

export function splitLines(content: string): Array<string> {
  return content.split(LINE_BREAK);
}

export function normalizeLineEndings(
  content: string,
  lineEnding: LineEnding,
): string {
  return splitLines(content).join(lineEnding);
}
