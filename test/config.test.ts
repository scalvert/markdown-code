import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config.js';
import type { Config } from '../src/types.js';

describe('config', () => {
  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const config: Config = {
        snippetRoot: './examples',
        markdownGlob: '**/*.md',
        excludeGlob: ['node_modules/**'],
        includeExtensions: ['.ts', '.js'],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error for invalid snippetRoot', () => {
      const config = {
        snippetRoot: '',
        markdownGlob: '**/*.md',
        excludeGlob: [],
        includeExtensions: ['.ts'],
      } as Config;

      expect(() => validateConfig(config)).toThrow('snippetRoot must be a non-empty string');
    });

    it('should throw error for invalid markdownGlob', () => {
      const config = {
        snippetRoot: './examples',
        markdownGlob: '',
        excludeGlob: [],
        includeExtensions: ['.ts'],
      } as Config;

      expect(() => validateConfig(config)).toThrow('markdownGlob must be a non-empty string');
    });

    it('should throw error for invalid excludeGlob', () => {
      const config = {
        snippetRoot: './examples',
        markdownGlob: '**/*.md',
        excludeGlob: 'not-an-array',
        includeExtensions: ['.ts'],
      } as unknown as Config;

      expect(() => validateConfig(config)).toThrow('excludeGlob must be an array');
    });

    it('should throw error for invalid includeExtensions', () => {
      const config = {
        snippetRoot: './examples',
        markdownGlob: '**/*.md',
        excludeGlob: [],
        includeExtensions: 'not-an-array',
      } as unknown as Config;

      expect(() => validateConfig(config)).toThrow('includeExtensions must be an array');
    });
  });
}); 