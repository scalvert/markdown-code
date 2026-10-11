import { describe, it, expect } from 'vitest';
import { readDirective, withDirective } from '../src/fence-info.js';

describe('readDirective', () => {
  it.each([
    ['ts snippet=a.ts', 'a.ts'],
    ['ts snippet=a\\_b.ts', 'a_b.ts'],
    ['ts snippet=a&amp;b.ts', 'a&b.ts'],
    ['ts snippet=&quot;my docs/a.ts&quot;', 'my docs/a.ts'],
    ['ts snippet=a&#96;b.ts', 'a`b.ts'],
    ['ts title=x&#32;snippet=a.ts', 'a.ts'],
  ])('reads %j as %j', (info, filePath) => {
    expect(readDirective(info)?.filePath).toBe(filePath);
  });

  it('does not read a directive in the language position', () => {
    expect(readDirective('snippet=a.ts')).toBeUndefined();
  });

  it.each(['js\u00a0snippet=a.ts', 'js\u3000snippet=a.ts'])(
    'only splits the language at a space or tab, not in %j',
    (info) => {
      expect(readDirective(info)).toBeUndefined();
      expect(withDirective(info, null)).toBe(info);
    },
  );
});

describe('withDirective', () => {
  it.each([
    ['ts', 'ts snippet=a.ts'],
    [' ts', ' ts snippet=a.ts'],
    ['ts title="x"', 'ts title="x" snippet=a.ts'],
    ['ts snippet=old.ts title="x"', 'ts snippet=a.ts title="x"'],
  ])('sets the directive on %j', (info, expected) => {
    expect(withDirective(info, { filePath: 'a.ts' })).toBe(expected);
  });

  it.each([
    ['ts snippet=a.ts', 'ts'],
    ['ts title="x" snippet=a.ts', 'ts title="x"'],
    ['ts snippet=a.ts title="x"', 'ts title="x"'],
    ['ts title="snippet=fake.ts"', 'ts title="snippet=fake.ts"'],
  ])('removes the directive from %j', (info, expected) => {
    expect(withDirective(info, null)).toBe(expected);
  });

  it('does not edit a directive in the language position', () => {
    expect(withDirective('snippet=a.ts', null)).toBe('snippet=a.ts');
  });

  it.each([
    ['ts snippet=a\\_b.ts title=x', 'ts snippet=c.ts title=x'],
    ['ts snippet=a.ts&#32;title=x', 'ts snippet=c.ts&#32;title=x'],
    ['ts snippet=&quot;my docs/a.ts&quot; x', 'ts snippet=c.ts x'],
  ])('replaces only the source of the directive in %j', (info, expected) => {
    expect(withDirective(info, { filePath: 'c.ts' })).toBe(expected);
  });

  it('removes a separator written as a character reference', () => {
    expect(withDirective('ts title=x&#32;snippet=a.ts', null)).toBe(
      'ts title=x',
    );
  });

  it.each([
    ['ts snippet=a.ts&#32;title=x', 'ts title=x'],
    ['ts x\\ snippet=c.ts&#32;y', 'ts x\\ y'],
  ])(
    'keeps the words around a removed directive apart in %j',
    (info, expected) => {
      expect(withDirective(info, null)).toBe(expected);
    },
  );

  it('escapes a trailing backslash so it cannot escape what follows', () => {
    const info = withDirective('ts snippet=a.ts&nbsp;title=x', {
      filePath: 'c:\\dir\\',
    });

    expect(info).toBe('ts snippet=c:\\dir\\\\&nbsp;title=x');
    expect(readDirective(info)?.filePath).toBe('c:\\dir\\');
  });

  it('encodes what would otherwise decode or end the fence', () => {
    expect(withDirective('ts', { filePath: 'a\\_b`c&amp;.ts' })).toBe(
      'ts snippet=a\\\\_b&#96;c\\&amp;.ts',
    );
  });
});
