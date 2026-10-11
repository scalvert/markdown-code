import { describe, it, expect } from 'vitest';
import { decodeString } from 'micromark-util-decode-string';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Code } from 'mdast';
import { decodeInfoString, encodeInfoString } from '../src/info-string.js';

const alphabet = ['\\', '&', '#', '9', ';', '`', '_', 'x', ' ', '"'];
const references = [
  '&amp;',
  '&quot;',
  '&AMP;',
  '&bogus;',
  '&#32;',
  '&#x60;',
  '&#0;',
  '&#x1F600;',
  '\\&amp;',
  'a\\_b',
];

function* strings(length: number): Generator<string> {
  if (length === 0) {
    yield '';
    return;
  }
  for (const shorter of strings(length - 1)) {
    for (const character of alphabet) {
      yield shorter + character;
    }
  }
}

const samples = [
  ...[0, 1, 2, 3, 4].flatMap((length) => [...strings(length)]),
  ...references,
  ...references.map((reference) => `a ${reference} b`),
];

function remarkMeta(info: string): string | null | undefined {
  const tree = unified().use(remarkParse).parse(`~~~js m${info}m\n~~~`);
  return (tree.children[0] as Code | undefined)?.meta;
}

describe('decodeInfoString', () => {
  it('decodes like micromark', () => {
    const mismatches = samples.filter(
      (source) => decodeInfoString(source).value !== decodeString(source),
    );
    expect(mismatches).toEqual([]);
  });

  it('decodes fence metadata like remark', () => {
    const mismatches = samples.filter(
      (source) => remarkMeta(source) !== decodeInfoString(`m${source}m`).value,
    );
    expect(mismatches).toEqual([]);
  });

  it('maps every decoded boundary back to a source boundary', () => {
    const mismatches = samples.filter((source) => {
      const decoded = decodeInfoString(source);
      return Array.from({ length: decoded.value.length + 1 }, (_, index) => {
        const { start } = decoded.sourceRange({ start: index, end: index });
        return (
          decodeString(source.slice(0, start)) +
            decodeString(source.slice(start)) ===
          decoded.value
        );
      }).includes(false);
    });
    expect(mismatches).toEqual([]);
  });

  it('maps a decoded range to the source text that produced it', () => {
    const decoded = decodeInfoString('title=a&#32;snippet=a\\_b.ts x');
    const start = decoded.value.indexOf('snippet=');
    const end = decoded.value.indexOf(' x');

    expect(decoded.value).toBe('title=a snippet=a_b.ts x');
    expect(decoded.sourceRange({ start: start - 1, end })).toEqual({
      start: 7,
      end: 27,
    });
  });
});

describe('encodeInfoString', () => {
  it('encodes text so it decodes back unchanged and contains no backticks', () => {
    const mismatches = samples.filter((value) => {
      const encoded = encodeInfoString(value);
      return decodeString(encoded) !== value || encoded.includes('`');
    });
    expect(mismatches).toEqual([]);
  });

  it('leaves text without escapes, references or backticks alone', () => {
    expect(encodeInfoString('snippet="my docs/a.ts#L1-L2" C:\\dir')).toBe(
      'snippet="my docs/a.ts#L1-L2" C:\\dir',
    );
  });

  it('escapes only what would otherwise decode', () => {
    expect(encodeInfoString('a\\_b &amp; &bogus; `x`')).toBe(
      'a\\\\_b \\&amp; \\&bogus; &#96;x&#96;',
    );
  });
});
