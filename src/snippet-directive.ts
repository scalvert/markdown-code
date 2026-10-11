import type { SnippetDirective } from './types.js';
import { isRemoteUrl } from './remote.js';

export interface SnippetDirectiveToken {
  start: number;
  end: number;
  value: string;
}

const DIRECTIVE_PREFIX = 'snippet=';
const META_TOKEN = /(?:"[^"]*"?|'[^']*'?|[^\s"'])+/g;
const QUOTED_VALUE = /^(?:"([^"]*)"|'([^']*)')(?=\s|$)/;
const UNQUOTED_VALUE = /^[^\s"']\S*/;

interface DirectiveValue {
  readonly length: number;
  readonly value: string;
}

function directiveValue(text: string): DirectiveValue | undefined {
  const quoted = QUOTED_VALUE.exec(text);
  if (quoted) {
    return { length: quoted[0].length, value: quoted[1] ?? quoted[2] ?? '' };
  }
  const unquoted = UNQUOTED_VALUE.exec(text)?.[0];
  return unquoted === undefined
    ? undefined
    : { length: unquoted.length, value: unquoted };
}

export function findSnippetDirectiveToken(
  info: string,
): SnippetDirectiveToken | undefined {
  const token = [...info.matchAll(META_TOKEN)].find((match) =>
    match[0].startsWith(DIRECTIVE_PREFIX),
  );
  if (!token) {
    return undefined;
  }

  const valueStart = token.index + DIRECTIVE_PREFIX.length;
  const found = directiveValue(info.slice(valueStart));
  return (
    found && {
      start: token.index,
      end: valueStart + found.length,
      value: found.value,
    }
  );
}

function parsePositiveLineNumber(value: string): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const line = Number(value);
  if (!Number.isSafeInteger(line) || line < 1) {
    return undefined;
  }

  return line;
}

export function parseSnippetDirective(
  info: string,
): SnippetDirective | undefined {
  const snippetPath = findSnippetDirectiveToken(info)?.value;

  if (!snippetPath) {
    return undefined;
  }

  const isRemote = isRemoteUrl(snippetPath);
  const lastHashIndex = snippetPath.lastIndexOf('#');

  if (lastHashIndex === -1) {
    return { filePath: snippetPath, isRemote };
  }

  const filePath = snippetPath.substring(0, lastHashIndex);
  const lineSpec = snippetPath.substring(lastHashIndex + 1);

  if (lineSpec.startsWith('L')) {
    const lineRange = lineSpec.substring(1);
    const rangeParts = lineRange.split('-');

    if (rangeParts.length === 1) {
      const line = parsePositiveLineNumber(rangeParts[0]!);
      if (line === undefined) {
        return { filePath: snippetPath, isRemote };
      }
      return {
        filePath,
        startLine: line,
        endLine: line,
        isRemote,
      };
    }

    if (rangeParts.length === 2) {
      const startLine = parsePositiveLineNumber(rangeParts[0]!);

      if (startLine === undefined) {
        return { filePath: snippetPath, isRemote };
      }

      if (rangeParts[1] === '') {
        return {
          filePath,
          startLine,
          isRemote,
        };
      }

      const endLine = parsePositiveLineNumber(rangeParts[1]!.replace(/^L/, ''));

      if (endLine === undefined || endLine < startLine) {
        return { filePath: snippetPath, isRemote };
      }

      return {
        filePath,
        startLine,
        endLine,
        isRemote,
      };
    }

    return { filePath: snippetPath, isRemote };
  }

  const lineNumber = parsePositiveLineNumber(lineSpec);
  if (lineNumber !== undefined) {
    return {
      filePath,
      startLine: lineNumber,
      endLine: lineNumber,
      isRemote,
    };
  }

  return { filePath: snippetPath, isRemote };
}

function formatLineRange(directive: SnippetDirective): string {
  const { startLine, endLine } = directive;

  if (startLine === undefined) {
    return '';
  }

  if (endLine === undefined) {
    return `#L${startLine}-`;
  }

  if (endLine === startLine) {
    return `#L${startLine}`;
  }

  return `#L${startLine}-L${endLine}`;
}

function quoteIfNeeded(reference: string): string {
  if (!/[\s"']/.test(reference)) {
    return reference;
  }

  const quote = reference.includes('"') ? "'" : '"';
  if (reference.includes(quote)) {
    throw new Error(
      `Snippet reference cannot contain both quote characters: ${reference}`,
    );
  }

  return `${quote}${reference}${quote}`;
}

export function formatSnippetDirective(directive: SnippetDirective): string {
  const reference = `${directive.filePath}${formatLineRange(directive)}`;
  return `${DIRECTIVE_PREFIX}${quoteIfNeeded(reference)}`;
}
