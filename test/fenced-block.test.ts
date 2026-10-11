import { describe, it, expect } from 'vitest';
import {
  linePrefixAt,
  parseFencedBlock,
  renderFencedBlock,
} from '../src/fenced-block.js';

describe('linePrefixAt', () => {
  it.each([
    ['```js', 0, ''],
    ['intro\n> - ```js', 10, '> - '],
    ['a\r\n\t```js', 4, '\t'],
  ])('returns the text before offset %#', (source, offset, expected) => {
    expect(linePrefixAt(source, offset)).toBe(expected);
  });
});

describe('parseFencedBlock', () => {
  it('splits the opening fence, info string and closing fence', () => {
    const block = parseFencedBlock(
      '````ts snippet=a.ts\r\n> x\r\n>   ````',
      '> - ',
    );

    expect(block.lineEnding).toBe('\r\n');
    expect(block.afterOpening).toBe('\r\n> x\r\n>   ````');
    expect(block).toMatchInlineSnapshot(`
      {
        "afterOpening": "
      > x
      >   \`\`\`\`",
        "bodyPrefix": ">   ",
        "closing": ">   \`\`\`\`",
        "fence": "\`\`\`\`",
        "info": "ts snippet=a.ts",
        "lineEnding": "
      ",
      }
    `);
  });

  it.each([
    ['> ', '> '],
    ['>', '> '],
    ['>>', '> > '],
    ['>\t', '>\t'],
    ['  ', '  '],
    ['\t', '\t'],
    ['- ', '  '],
    ['-\t', ' \t'],
    ['10) ', '    '],
    ['> 1. ', '>    '],
    ['  > ', '  > '],
  ])('continues the line prefix %j as %j', (linePrefix, bodyPrefix) => {
    expect(parseFencedBlock('```js\n```', linePrefix).bodyPrefix).toBe(
      bodyPrefix,
    );
  });

  it('has no closing fence when the last line does not close it', () => {
    expect(parseFencedBlock('~~~~ts\nold\n~~~', '').closing).toBeUndefined();
    expect(parseFencedBlock('```ts', '').closing).toBeUndefined();
  });

  it('rejects text that does not start with a fence', () => {
    expect(() => parseFencedBlock('    code', '')).toThrow(
      'Not the start of a fenced code block',
    );
  });
});

describe('renderFencedBlock', () => {
  it('prefixes every body line and gives blank lines the trimmed prefix', () => {
    const block = parseFencedBlock('```js\n> old\n> ```', '> ');

    expect(renderFencedBlock(block, { content: 'a\n\n  b' })).toBe(
      '```js\n> a\n>\n>   b\n> ```',
    );
  });

  it('keeps everything after the opening line when only the info changes', () => {
    const text = '```js snippet=a.js\r\n>   odd  \n>  ```';
    const block = parseFencedBlock(text, '> ');

    expect(renderFencedBlock(block, { directive: null })).toBe(
      '```js\r\n>   odd  \n>  ```',
    );
  });

  it('writes a body into a block that only has an opening line', () => {
    const block = parseFencedBlock('```js', '');

    expect(renderFencedBlock(block, { content: 'x' })).toBe('```js\nx');
  });
});
