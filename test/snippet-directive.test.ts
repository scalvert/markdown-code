import { describe, it, expect } from 'vitest';
import { parseSnippetDirective } from '../src/parser.js';

describe('snippet directive parsing', () => {
  describe('parseSnippetDirective', () => {
    it('should parse basic snippet path', () => {
      const result = parseSnippetDirective('snippet=test.ts');
      expect(result).toEqual({ filePath: 'test.ts' });
    });

    it('should parse snippet with line range', () => {
      const result = parseSnippetDirective('snippet=utils.js#L5-L10');
      expect(result).toEqual({
        filePath: 'utils.js',
        startLine: 5,
        endLine: 10,
      });
    });

    it('should parse snippet with single line', () => {
      const result = parseSnippetDirective('snippet=main.py#L15');
      expect(result).toEqual({
        filePath: 'main.py',
        startLine: 15,
        endLine: 15,
      });
    });

    it('should parse snippet with start line only (dash but no end)', () => {
      const result = parseSnippetDirective('snippet=file.cpp#L20-');
      expect(result).toEqual({
        filePath: 'file.cpp',
        startLine: 20,
      });
    });

    it('should handle complex file paths', () => {
      const result = parseSnippetDirective('snippet=src/components/Button.tsx#L1-L5');
      expect(result).toEqual({
        filePath: 'src/components/Button.tsx',
        startLine: 1,
        endLine: 5,
      });
    });

    it('should handle deeply nested paths', () => {
      const result = parseSnippetDirective('snippet=packages/core/src/utils/helpers.ts#L100-L150');
      expect(result).toEqual({
        filePath: 'packages/core/src/utils/helpers.ts',
        startLine: 100,
        endLine: 150,
      });
    });

    it('should handle file extensions with dots', () => {
      const result = parseSnippetDirective('snippet=config.test.js#L5-L10');
      expect(result).toEqual({
        filePath: 'config.test.js',
        startLine: 5,
        endLine: 10,
      });
    });

    it('should handle filenames with hyphens and underscores', () => {
      const result = parseSnippetDirective('snippet=my-file_name.ts#L1-L2');
      expect(result).toEqual({
        filePath: 'my-file_name.ts',
        startLine: 1,
        endLine: 2,
      });
    });

    it('should handle large line numbers', () => {
      const result = parseSnippetDirective('snippet=large-file.js#L1000-L2000');
      expect(result).toEqual({
        filePath: 'large-file.js',
        startLine: 1000,
        endLine: 2000,
      });
    });

    it('should handle zero line numbers gracefully', () => {
      const result = parseSnippetDirective('snippet=test.ts#L0-L5');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 0,
        endLine: 5,
      });
    });

    it('should handle negative line numbers gracefully', () => {
      const result = parseSnippetDirective('snippet=test.ts#L-5-L10');
      expect(result).toMatchInlineSnapshot(`
        {
          "filePath": "test.ts#L-5-L10",
        }
      `);
    });

    it('should return undefined for missing snippet directive', () => {
      const result = parseSnippetDirective('language=typescript');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty snippet value', () => {
      const result = parseSnippetDirective('snippet=');
      expect(result).toBeUndefined();
    });

    it('should handle snippet directive with extra spaces', () => {
      const result = parseSnippetDirective('lang=ts snippet=test.ts#L1-L5 extra=value');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 1,
        endLine: 5,
      });
    });

    it('should handle invalid line numbers', () => {
      const result = parseSnippetDirective('snippet=test.ts#Labc-Ldef');
      expect(result).toMatchInlineSnapshot(`
        {
          "filePath": "test.ts#Labc-Ldef",
        }
      `);
    });

    it('should handle mixed valid/invalid line numbers', () => {
      const result = parseSnippetDirective('snippet=test.ts#L5-Labc');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 5,
      });
    });

    it('should handle multiple hash symbols', () => {
      const result = parseSnippetDirective('snippet=file#with#hash.ts#L1-L5');
      expect(result).toEqual({
        filePath: 'file#with#hash.ts',
        startLine: 1,
        endLine: 5,
      });
    });

    it('should handle files without extensions', () => {
      const result = parseSnippetDirective('snippet=Makefile#L1-L10');
      expect(result).toEqual({
        filePath: 'Makefile',
        startLine: 1,
        endLine: 10,
      });
    });

    it('should handle reversed line ranges', () => {
      const result = parseSnippetDirective('snippet=test.ts#L10-L5');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 10,
        endLine: 5,
      });
    });

    it('should handle same start and end line', () => {
      const result = parseSnippetDirective('snippet=test.ts#L5-L5');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 5,
        endLine: 5,
      });
    });

    it('should handle line range with L prefix missing on end', () => {
      const result = parseSnippetDirective('snippet=test.ts#L5-10');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 5,
        endLine: 10,
      });
    });

    it('should handle single line without L prefix', () => {
      const result = parseSnippetDirective('snippet=test.ts#5');
      expect(result).toEqual({
        filePath: 'test.ts',
        startLine: 5,
        endLine: 5,
      });
    });
  });
}); 