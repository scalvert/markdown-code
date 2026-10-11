import { describe, it, expect } from 'vitest';
import { parseFencedBlockAt, renderFencedBlock } from '../src/fenced-block.js';

function blockIn(source: string) {
  return parseFencedBlockAt(source, source.search(/`{3}|~{3}/), source.length);
}

describe('parseFencedBlockAt', () => {
  it('splits the opening fence, info string, body and closing fence', () => {
    const block = blockIn(
      'intro\n> - ````ts snippet=a.ts\r\n>   x\r\n>   ````',
    );

    expect(block.lineEnding).toBe('\r\n');
    expect(block).toMatchInlineSnapshot(`
      {
        "bodyPrefix": ">   ",
        "end": {
          "kind": "closing-fence",
          "line": ">   \`\`\`\`",
        },
        "fence": "\`\`\`\`",
        "info": "ts snippet=a.ts",
        "lineEnding": "
      ",
        "rawBody": "
      >   x
      ",
      }
    `);
  });

  it.each([
    ['', ''],
    ['  ', '  '],
    ['\t', '    '],
    ['- ', '  '],
    ['-\t', '    '],
    ['10) ', '    '],
    ['> ', '> '],
    ['>', '> '],
    ['>>', '> > '],
    ['>\t', '>   '],
    ['>>\t', '> >  '],
    ['>- ', '>   '],
    ['> 1. ', '>    '],
    ['  > ', '  > '],
  ])('continues the line prefix %j as %j', (linePrefix, bodyPrefix) => {
    expect(blockIn(`${linePrefix}\`\`\`js\n\`\`\``).bodyPrefix).toBe(
      bodyPrefix,
    );
  });

  it.each([
    [
      'a matching fence',
      '```ts\nx\n```',
      { kind: 'closing-fence', line: '```' },
    ],
    [
      'a longer fence',
      '```ts\nx\n`````',
      { kind: 'closing-fence', line: '`````' },
    ],
    [
      'a fence behind its blockquote marker',
      '> ```ts\n> x\n>   ```',
      { kind: 'closing-fence', line: '>   ```' },
    ],
    ['a trailing line break', '```ts\nx\n', { kind: 'line-break' }],
    ['a shorter fence', '~~~~ts\nx\n~~~', { kind: 'unterminated' }],
    [
      'a fence of the other character',
      '```ts\nx\n~~~',
      { kind: 'unterminated' },
    ],
    [
      'a fence behind an extra blockquote marker',
      '```ts\n> ```',
      { kind: 'unterminated' },
    ],
    ['only an opening line', '```ts', { kind: 'unterminated' }],
  ])('ends a block at %s', (_, source, end) => {
    expect(blockIn(source).end).toEqual(end);
  });

  it('rejects text that does not start with a fence', () => {
    expect(() => parseFencedBlockAt('    code', 0, 8)).toThrow(
      'Not the start of a fenced code block',
    );
  });
});

describe('renderFencedBlock', () => {
  it('prefixes every body line and gives blank lines the trimmed prefix', () => {
    const block = blockIn('> ```js\n> old\n> ```');

    expect(renderFencedBlock(block, { content: 'a\n\n  b' })).toBe(
      '```js\n> a\n>\n>   b\n> ```',
    );
  });

  it('writes an empty body as no lines', () => {
    expect(renderFencedBlock(blockIn('```js\nold\n```'), { content: '' })).toBe(
      '```js\n```',
    );
  });

  it('keeps everything after the opening line when only the info changes', () => {
    const block = blockIn('> ```js snippet=a.js\r\n>   odd  \n>  ```');

    expect(renderFencedBlock(block, { directive: null })).toBe(
      '```js\r\n>   odd  \n>  ```',
    );
  });

  it('keeps the line break that ends an unclosed block', () => {
    expect(renderFencedBlock(blockIn('```js\nold\n'), { content: 'new' })).toBe(
      '```js\nnew\n',
    );
  });

  it('drops trailing blank lines from the body of an unclosed block', () => {
    expect(
      renderFencedBlock(blockIn('```js\nold'), { content: 'new\n\n' }),
    ).toBe('```js\nnew');
    expect(
      renderFencedBlock(blockIn('```js\nold\n'), { content: 'new\n' }),
    ).toBe('```js\nnew\n');
    expect(
      renderFencedBlock(blockIn('```js\nold\n```'), { content: 'new\n' }),
    ).toBe('```js\nnew\n\n```');
  });

  it('reads the line prefix after a lone carriage return', () => {
    expect(blockIn('p\r\r- ```js\r  a\r  ```\r').bodyPrefix).toBe('  ');
  });

  it('writes a body into a block that only has an opening line', () => {
    expect(renderFencedBlock(blockIn('```js'), { content: 'x' })).toBe(
      '```js\nx',
    );
  });
});
