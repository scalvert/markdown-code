import { decodeString } from 'micromark-util-decode-string';

export interface TextRange {
  readonly start: number;
  readonly end: number;
}

export interface DecodedInfoString {
  readonly value: string;
  sourceRange(range: TextRange): TextRange;
}

interface Segment {
  readonly source: string;
  readonly value: string;
}

const ASCII_PUNCTUATION = '[!-/:-@[-`{-~]';
const REFERENCE_NAME = '(?:#(?:\\d{1,7}|x[\\da-f]{1,6})|[\\da-z]{1,31});';
const ESCAPE_OR_REFERENCE = new RegExp(
  `(\\\\${ASCII_PUNCTUATION}|&${REFERENCE_NAME})`,
  'i',
);
const START_OF_ESCAPE_OR_REFERENCE = new RegExp(
  `\\\\(?=${ASCII_PUNCTUATION})|&(?=${REFERENCE_NAME})`,
  'gi',
);
const BACKTICK = /`/g;

function segments(source: string): Array<Segment> {
  return source.split(ESCAPE_OR_REFERENCE).map((part, index) => {
    const isEscapeOrReference = index % 2 === 1;
    return {
      source: part,
      value: isEscapeOrReference ? decodeString(part) : part,
    };
  });
}

function sourceOffsets(parts: ReadonlyArray<Segment>): Array<number> {
  const { offsets, length } = parts.reduce(
    (state, { source, value }) => ({
      offsets: [
        ...state.offsets,
        ...Array.from(
          { length: value.length },
          (_, index) => state.length + (value === source ? index : 0),
        ),
      ],
      length: state.length + source.length,
    }),
    { offsets: new Array<number>(), length: 0 },
  );
  return [...offsets, length];
}

export function decodeInfoString(source: string): DecodedInfoString {
  const parts = segments(source);
  const offsets = sourceOffsets(parts);
  const offsetOf = (index: number) => offsets[index] ?? source.length;

  return {
    value: parts.map((part) => part.value).join(''),
    sourceRange: ({ start, end }) => ({
      start: offsetOf(start),
      end: offsetOf(end),
    }),
  };
}

export function encodeInfoString(value: string): string {
  return value
    .replace(START_OF_ESCAPE_OR_REFERENCE, '\\$&')
    .replace(BACKTICK, '&#96;');
}
