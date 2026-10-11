import type { SnippetDirective } from './types.js';
import {
  findSnippetDirectiveToken,
  formatSnippetDirective,
} from './snippet-directive.js';

const LANGUAGE = /^[ \t]*\S*/;
const WHITESPACE = /[ \t]/;

function splitLanguage(info: string): [language: string, meta: string] {
  const language = LANGUAGE.exec(info)?.[0] ?? '';
  return [language, info.slice(language.length)];
}

function withMetaDirective(
  meta: string,
  directive: SnippetDirective | null,
): string {
  const token = findSnippetDirectiveToken(meta);

  if (!token) {
    return directive ? `${meta} ${formatSnippetDirective(directive)}` : meta;
  }

  if (directive) {
    return (
      meta.slice(0, token.start) +
      formatSnippetDirective(directive) +
      meta.slice(token.end)
    );
  }

  const separated = WHITESPACE.test(meta.charAt(token.start - 1));
  return (
    meta.slice(0, token.start - (separated ? 1 : 0)) + meta.slice(token.end)
  );
}

export function withDirective(
  info: string,
  directive: SnippetDirective | null,
): string {
  const [language, meta] = splitLanguage(info);
  return language + withMetaDirective(meta, directive);
}
