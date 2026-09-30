import { describe, it, expect } from 'vitest';
import { MarkdownDocument, isMdxPath } from '../src/markdown-document.js';

function parse(content: string, mdx = false): MarkdownDocument {
  return MarkdownDocument.parse(content, { mdx });
}

describe('MarkdownDocument', () => {
  describe('parse', () => {
    it('exposes fenced code blocks with a language, with and without directives', () => {
      const document = parse(`# Test

\`\`\`ts snippet=test.ts
old content
\`\`\`

\`\`\`js
plain
\`\`\`

\`\`\`
no language
\`\`\`

    indented code
`);

      expect(document.codeBlocks).toMatchInlineSnapshot(`
        [
          {
            "column": 1,
            "content": "old content",
            "directive": {
              "filePath": "test.ts",
              "isRemote": false,
            },
            "language": "ts",
            "line": 3,
            "lineEnding": "
        ",
          },
          {
            "column": 1,
            "content": "plain",
            "language": "js",
            "line": 7,
            "lineEnding": "
        ",
          },
        ]
      `);
    });

    it('parses directive line ranges', () => {
      const document = parse(`\`\`\`js snippet=utils.js#L5-L10
a
\`\`\`

\`\`\`py snippet=main.py#L15
b
\`\`\`

\`\`\`cpp snippet=src/main.cpp#L20-
c
\`\`\``);

      expect(document.codeBlocks.map((block) => block.directive))
        .toMatchInlineSnapshot(`
        [
          {
            "endLine": 10,
            "filePath": "utils.js",
            "isRemote": false,
            "startLine": 5,
          },
          {
            "endLine": 15,
            "filePath": "main.py",
            "isRemote": false,
            "startLine": 15,
          },
          {
            "filePath": "src/main.cpp",
            "isRemote": false,
            "startLine": 20,
          },
        ]
      `);
    });

    it('does not treat a directive in the language position as a directive', () => {
      const document = parse('``` snippet=test.js\nno language\n```');
      expect(document.codeBlocks).toMatchInlineSnapshot(`
        [
          {
            "column": 1,
            "content": "no language",
            "language": "snippet=test.js",
            "line": 1,
            "lineEnding": "
        ",
          },
        ]
      `);
    });

    it('finds fences nested inside JSX when parsing MDX', () => {
      const document = parse(
        `---
title: Uses {braces}
---

<Tabs>
  <TabItem value="a">

    \`\`\`ts
    const nested = 2;
    \`\`\`

  </TabItem>
</Tabs>

<CardGroup cols={2}>
  <Card title="Indented prose" />
</CardGroup>
`,
        true,
      );

      expect(document.codeBlocks).toMatchInlineSnapshot(`
        [
          {
            "column": 5,
            "content": "const nested = 2;",
            "language": "ts",
            "line": 8,
            "lineEnding": "
        ",
          },
        ]
      `);
    });

    it('returns the source unchanged when nothing is edited', () => {
      const source = '# T\r\n\r\n~~~ts snippet=a.ts\r\nx\r\n~~~\r\n';
      expect(parse(source).toString()).toBe(source);
    });
  });

  describe('setBody', () => {
    it('replaces the body and preserves the fences and surrounding content', () => {
      const document = parse(`# Before

\`\`\`ts snippet=test.ts title="x"
old
\`\`\`

## After`);

      document.setBody(document.codeBlocks[0]!, 'new line 1\nnew line 2');

      expect(document.toString()).toMatchInlineSnapshot(`
        "# Before

        \`\`\`ts snippet=test.ts title="x"
        new line 1
        new line 2
        \`\`\`

        ## After"
      `);
    });

    it('keeps tilde and long backtick fences intact', () => {
      const document = parse(`~~~ts snippet=a.ts
old
~~~

\`\`\`\`md snippet=b.md
old
\`\`\`\``);

      for (const block of document.codeBlocks) {
        document.setBody(block, 'new');
      }

      expect(document.toString()).toMatchInlineSnapshot(`
        "~~~ts snippet=a.ts
        new
        ~~~

        \`\`\`\`md snippet=b.md
        new
        \`\`\`\`"
      `);
    });

    it('re-indents the body of a fence nested in a list', () => {
      const document = parse(`- item

  \`\`\`ts snippet=a.ts
  old
  \`\`\`
`);

      document.setBody(document.codeBlocks[0]!, 'one\n\ntwo');

      expect(document.toString()).toMatchInlineSnapshot(`
        "- item

          \`\`\`ts snippet=a.ts
          one

          two
          \`\`\`
        "
      `);
    });

    it('fills an empty block', () => {
      const document = parse('```ts snippet=a.ts\n```\n');

      document.setBody(document.codeBlocks[0]!, 'filled');

      expect(document.toString()).toBe('```ts snippet=a.ts\nfilled\n```\n');
    });

    it.each([
      { name: 'LF', lineEnding: '\n' },
      { name: 'CRLF', lineEnding: '\r\n' },
    ])(
      'writes the body with the block $name line endings',
      ({ lineEnding }) => {
        const source = ['```ts snippet=test.ts', 'old', '```', 'After'].join(
          lineEnding,
        );
        const document = parse(source);

        expect(document.codeBlocks[0]!.lineEnding).toBe(lineEnding);

        document.setBody(document.codeBlocks[0]!, 'new line 1\r\nnew line 2');

        expect(document.toString()).toBe(
          [
            '```ts snippet=test.ts',
            'new line 1',
            'new line 2',
            '```',
            'After',
          ].join(lineEnding),
        );
      },
    );

    it('does not invent a closing fence for an unclosed block', () => {
      const document = parse('```ts snippet=a.ts\nold');

      document.setBody(document.codeBlocks[0]!, 'new');

      expect(document.toString()).toBe('```ts snippet=a.ts\nnew');
    });
  });

  describe('setDirective', () => {
    it('appends a directive after existing meta', () => {
      const document = parse('```ts title="plain.ts"\ncode\n```');

      document.setDirective(document.codeBlocks[0]!, {
        filePath: 'doc/snippet-01.ts',
      });

      expect(document.toString()).toBe(
        '```ts title="plain.ts" snippet=doc/snippet-01.ts\ncode\n```',
      );
    });

    it('appends before a CRLF line ending', () => {
      const document = parse('```ts\r\ncode\r\n```\r\n');

      document.setDirective(document.codeBlocks[0]!, { filePath: 'a.ts' });

      expect(document.toString()).toBe('```ts snippet=a.ts\r\ncode\r\n```\r\n');
    });

    it('replaces an existing directive in place with canonical line ranges', () => {
      const document = parse('```ts snippet=old.ts title="x"\ncode\n```');

      document.setDirective(document.codeBlocks[0]!, {
        filePath: 'new.ts',
        startLine: 3,
        endLine: 7,
      });

      expect(document.toString()).toBe(
        '```ts snippet=new.ts#L3-L7 title="x"\ncode\n```',
      );
    });

    it('removes a directive and keeps other meta and the fence marker', () => {
      const document = parse(`~~~ts snippet=a.ts title="x"
const a = 1;
~~~

\`\`\`js title="y" snippet=b.js#L1-L2
const b = 2;
\`\`\`

- item

  \`\`\`ts snippet=a.ts
  const a = 1;
  \`\`\`
`);

      for (const block of document.codeBlocks) {
        document.setDirective(block, undefined);
      }

      expect(document.toString()).toMatchInlineSnapshot(`
        "~~~ts title="x"
        const a = 1;
        ~~~

        \`\`\`js title="y"
        const b = 2;
        \`\`\`

        - item

          \`\`\`ts
          const a = 1;
          \`\`\`
        "
      `);
    });

    it('removes a quoted directive and ignores snippet= inside other meta', () => {
      const document = parse(
        '```ts title="snippet=fake.ts" snippet="my docs/a.ts#L2" data-x=1\ncode\n```',
      );

      expect(document.codeBlocks[0]!.directive).toEqual({
        filePath: 'my docs/a.ts',
        startLine: 2,
        endLine: 2,
        isRemote: false,
      });

      document.setDirective(document.codeBlocks[0]!, undefined);

      expect(document.toString()).toBe(
        '```ts title="snippet=fake.ts" data-x=1\ncode\n```',
      );
    });

    it('quotes a directive whose path contains whitespace', () => {
      const document = parse('```ts\ncode\n```');

      document.setDirective(document.codeBlocks[0]!, {
        filePath: 'my guide/snippet-01.ts',
      });
      const output = document.toString();

      expect(output).toBe('```ts snippet="my guide/snippet-01.ts"\ncode\n```');
      expect(parse(output).codeBlocks[0]!.directive?.filePath).toBe(
        'my guide/snippet-01.ts',
      );
    });

    it('round-trips: removing an added directive restores the source', () => {
      const source =
        '```ts title="x"\ncode\n```\n\n    ```py\n    x\n    ```\n';
      const annotated = parse(source);
      for (const block of annotated.codeBlocks) {
        annotated.setDirective(block, { filePath: 'ref.ts' });
      }

      const stripped = parse(annotated.toString());
      for (const block of stripped.codeBlocks) {
        stripped.setDirective(block, undefined);
      }

      expect(stripped.toString()).toBe(source);
    });
  });

  it('applies body and directive edits to several blocks in one pass', () => {
    const document = parse(`\`\`\`ts snippet=a.ts
a
\`\`\`

\`\`\`js
b
\`\`\`
`);
    const [first, second] = document.codeBlocks;

    document.setBody(first!, 'a2');
    document.setDirective(first!, undefined);
    document.setDirective(second!, { filePath: 'b.js' });
    document.setBody(second!, 'b2');

    expect(document.toString()).toMatchInlineSnapshot(`
      "\`\`\`ts
      a2
      \`\`\`

      \`\`\`js snippet=b.js
      b2
      \`\`\`
      "
    `);
  });

  it('rejects code blocks from another document', () => {
    const other = parse('```ts\nx\n```');
    const document = parse('```ts\ny\n```');

    expect(() => document.setBody(other.codeBlocks[0]!, 'z')).toThrow(
      'Code block does not belong to this document',
    );
  });

  it('detects MDX paths by extension', () => {
    expect(isMdxPath('docs/Guide.MDX')).toBe(true);
    expect(isMdxPath('README.md')).toBe(false);
  });
});
