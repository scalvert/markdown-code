import type { SnippetDirective } from './types.js';
import { isRemoteUrl } from './remote.js';

export interface SnippetDirectiveToken {
  start: number;
  end: number;
  value: string;
}

const DIRECTIVE_PREFIX = 'snippet=';

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/.test(character);
}

function findQuotedValueEnd(
  info: string,
  valueStart: number,
): number | undefined {
  const quote = info[valueStart];
  let valueEnd = valueStart + 1;

  while (valueEnd < info.length) {
    if (info[valueEnd] === quote && info[valueEnd - 1] !== '\\') {
      break;
    }
    valueEnd++;
  }

  if (
    valueEnd >= info.length ||
    (valueEnd + 1 < info.length && !isWhitespace(info[valueEnd + 1]))
  ) {
    return undefined;
  }

  return valueEnd;
}

function skipToken(info: string, index: number): number {
  let quote: string | undefined;

  while (index < info.length) {
    const character = info[index]!;
    if (quote) {
      if (character === quote && info[index - 1] !== '\\') {
        quote = undefined;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (isWhitespace(character)) {
      break;
    }
    index++;
  }

  return index;
}

export function findSnippetDirectiveToken(
  info: string,
): SnippetDirectiveToken | undefined {
  let index = 0;

  while (index < info.length) {
    while (index < info.length && isWhitespace(info[index])) {
      index++;
    }

    if (index >= info.length) {
      return undefined;
    }

    if (!info.startsWith(DIRECTIVE_PREFIX, index)) {
      index = skipToken(info, index);
      continue;
    }

    const valueStart = index + DIRECTIVE_PREFIX.length;
    if (valueStart >= info.length || isWhitespace(info[valueStart])) {
      return undefined;
    }

    const quote = info[valueStart];
    if (quote === '"' || quote === "'") {
      const valueEnd = findQuotedValueEnd(info, valueStart);
      if (valueEnd === undefined) {
        return undefined;
      }
      return {
        start: index,
        end: valueEnd + 1,
        value: info.substring(valueStart + 1, valueEnd),
      };
    }

    let valueEnd = valueStart;
    while (valueEnd < info.length && !isWhitespace(info[valueEnd])) {
      valueEnd++;
    }
    return {
      start: index,
      end: valueEnd,
      value: info.substring(valueStart, valueEnd),
    };
  }

  return undefined;
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
