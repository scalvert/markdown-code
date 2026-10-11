import type { SnippetDirective } from './types.js';
import {
  findSnippetDirectiveToken,
  formatSnippetDirective,
  parseSnippetDirective,
  type SnippetDirectiveToken,
} from './snippet-directive.js';
import {
  decodeInfoString,
  encodeInfoString,
  type DecodedInfoString,
} from './info-string.js';

const LANGUAGE = /^[ \t]*[^ \t]*/;
const WHITESPACE = /\s/;

function splitLanguage(info: string): [language: string, meta: string] {
  const language = LANGUAGE.exec(info)?.[0] ?? '';
  return [language, info.slice(language.length)];
}

export function readDirective(info: string): SnippetDirective | undefined {
  const [, meta] = splitLanguage(info);
  return parseSnippetDirective(decodeInfoString(meta).value);
}

function spliceDecoded(
  meta: string,
  decoded: DecodedInfoString,
  start: number,
  end: number,
  replacement: string,
): string {
  return (
    meta.slice(0, decoded.sourceOffset(start)) +
    replacement +
    meta.slice(decoded.sourceOffset(end))
  );
}

function removeDirective(
  meta: string,
  decoded: DecodedInfoString,
  token: SnippetDirectiveToken,
): string {
  const separatorAfter = WHITESPACE.test(decoded.value.charAt(token.end));
  const separatorBefore = WHITESPACE.test(
    decoded.value.charAt(token.start - 1),
  );

  if (separatorAfter) {
    return spliceDecoded(meta, decoded, token.start, token.end + 1, '');
  }
  const start = separatorBefore ? token.start - 1 : token.start;
  return spliceDecoded(meta, decoded, start, token.end, '');
}

function replaceDirective(
  meta: string,
  decoded: DecodedInfoString,
  token: SnippetDirectiveToken | undefined,
  directive: SnippetDirective,
): string {
  const encoded = encodeInfoString(formatSnippetDirective(directive));
  return token
    ? spliceDecoded(meta, decoded, token.start, token.end, encoded)
    : `${meta} ${encoded}`;
}

export function withDirective(
  info: string,
  directive: SnippetDirective | null,
): string {
  const [language, meta] = splitLanguage(info);
  const decoded = decodeInfoString(meta);
  const token = findSnippetDirectiveToken(decoded.value);

  if (directive) {
    return language + replaceDirective(meta, decoded, token, directive);
  }
  return token ? language + removeDirective(meta, decoded, token) : info;
}
