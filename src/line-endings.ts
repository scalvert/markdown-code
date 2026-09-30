export type LineEnding = '\n' | '\r\n';

export function getLineEnding(content: string): LineEnding {
  return content.match(/\r\n|\n/)?.[0] === '\r\n' ? '\r\n' : '\n';
}

export function normalizeLineEndings(
  content: string,
  lineEnding: LineEnding,
): string {
  return content.replace(/\r\n|\r|\n/g, lineEnding);
}
