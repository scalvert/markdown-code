import { describe, it, expect } from 'vitest';
import { withDirective } from '../src/fence-info.js';

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

  it('does not read a directive in the language position', () => {
    expect(withDirective('snippet=a.ts', null)).toBe('snippet=a.ts');
  });
});
