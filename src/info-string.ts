import { decodeString } from 'micromark-util-decode-string';

export interface DecodedInfoString {
  readonly value: string;
  sourceOffset(index: number): number;
}

interface Segment {
  readonly start: number;
  readonly value: string;
  readonly decoded: boolean;
}

const ASCII_PUNCTUATION = '[!-/:-@[-`{-~]';
const REFERENCE_NAME = '(?:#(?:\\d{1,7}|x[\\da-f]{1,6})|[\\da-z]{1,31});';
const SEGMENT = new RegExp(
  `\\\\${ASCII_PUNCTUATION}|&${REFERENCE_NAME}|[^\\\\&]+|[\\\\&]`,
  'gi',
);
const DECODABLE = new RegExp(
  `\\\\(?=${ASCII_PUNCTUATION}|$)|&(?=${REFERENCE_NAME})`,
  'gi',
);
const BACKTICK = /`/g;

function segments(source: string): Array<Segment> {
  return [...source.matchAll(SEGMENT)].map(({ 0: text, index }) => {
    const value = decodeString(text);
    return { start: index, value, decoded: value !== text };
  });
}

function sourceOffsets(
  parts: ReadonlyArray<Segment>,
  sourceLength: number,
): Array<number> {
  return [
    ...parts.flatMap(({ start, value, decoded }) =>
      Array.from({ length: value.length }, (_, index) =>
        decoded ? start : start + index,
      ),
    ),
    sourceLength,
  ];
}

export function decodeInfoString(source: string): DecodedInfoString {
  const parts = segments(source);
  const offsets = sourceOffsets(parts, source.length);

  return {
    value: parts.map((part) => part.value).join(''),
    sourceOffset: (index) => offsets[index] ?? source.length,
  };
}

export function encodeInfoString(value: string): string {
  return value.replace(DECODABLE, '\\$&').replace(BACKTICK, '&#96;');
}
