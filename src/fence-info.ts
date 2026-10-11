import type { SnippetDirective } from './types.js';
import {
  findSnippetDirectiveToken,
  formatSnippetDirective,
  parseSnippetDirective,
} from './snippet-directive.js';
import { decodeInfoString, encodeInfoString } from './info-string.js';

const LANGUAGE = /^[ \t]*\S*/;
const WHITESPACE = /\s/;

function splitLanguage(info: string): [language: string, meta: string] {
  const language = LANGUAGE.exec(info)?.[0] ?? '';
  return [language, info.slice(language.length)];
}

export function readDirective(info: string): SnippetDirective | undefined {
  const [, meta] = splitLanguage(info);
  return parseSnippetDirective(decodeInfoString(meta).value);
}

function withMetaDirective(
  meta: string,
  directive: SnippetDirective | null,
): string {
  const decoded = decodeInfoString(meta);
  const token = findSnippetDirectiveToken(decoded.value);
  const replacement = directive
    ? encodeInfoString(formatSnippetDirective(directive))
    : '';

  if (!token) {
    return replacement ? `${meta} ${replacement}` : meta;
  }

  const separated =
    !directive && WHITESPACE.test(decoded.value.charAt(token.start - 1));
  const { start, end } = decoded.sourceRange({
    start: separated ? token.start - 1 : token.start,
    end: token.end,
  });
  return meta.slice(0, start) + replacement + meta.slice(end);
}

export function withDirective(
  info: string,
  directive: SnippetDirective | null,
): string {
  const [language, meta] = splitLanguage(info);
  return language + withMetaDirective(meta, directive);
}
