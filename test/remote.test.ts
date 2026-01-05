import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRemoteUrl,
  parseRemoteUrl,
  validateRemoteUrl,
  fetchRemoteContent,
} from '../src/remote.js';

describe('remote', () => {
  describe('isRemoteUrl', () => {
    it('should detect HTTPS URLs', () => {
      expect(isRemoteUrl('https://example.com/file.ts')).toBe(true);
    });

    it('should detect HTTP URLs', () => {
      expect(isRemoteUrl('http://example.com/file.ts')).toBe(true);
    });

    it('should return false for local paths', () => {
      expect(isRemoteUrl('src/file.ts')).toBe(false);
      expect(isRemoteUrl('./file.ts')).toBe(false);
      expect(isRemoteUrl('/absolute/path.ts')).toBe(false);
    });

    it('should return false for paths containing http in name', () => {
      expect(isRemoteUrl('http-client.ts')).toBe(false);
    });

    it('should return false for file:// URLs', () => {
      expect(isRemoteUrl('file:///path/to/file.ts')).toBe(false);
    });

    it('should detect GitHub raw URLs', () => {
      expect(
        isRemoteUrl('https://raw.githubusercontent.com/user/repo/main/file.ts'),
      ).toBe(true);
    });

    it('should return false for relative paths with http in directory', () => {
      expect(isRemoteUrl('http-utils/client.ts')).toBe(false);
    });
  });

  describe('parseRemoteUrl', () => {
    it('should parse URL without line specification', () => {
      const result = parseRemoteUrl('https://example.com/file.ts');
      expect(result).toEqual({ baseUrl: 'https://example.com/file.ts' });
    });

    it('should parse URL with line range and extract lineSpec', () => {
      const result = parseRemoteUrl('https://example.com/file.ts#L10-L20');
      expect(result).toEqual({
        baseUrl: 'https://example.com/file.ts',
        lineSpec: 'L10-L20',
      });
    });

    it('should parse URL with single line spec', () => {
      const result = parseRemoteUrl('https://example.com/file.ts#L15');
      expect(result).toEqual({
        baseUrl: 'https://example.com/file.ts',
        lineSpec: 'L15',
      });
    });

    it('should preserve non-line fragments as part of URL', () => {
      const result = parseRemoteUrl('https://example.com/file.ts#section-name');
      expect(result).toEqual({
        baseUrl: 'https://example.com/file.ts#section-name',
      });
    });

    it('should handle numeric line specs without L prefix', () => {
      const result = parseRemoteUrl('https://example.com/file.ts#10-20');
      expect(result).toEqual({
        baseUrl: 'https://example.com/file.ts',
        lineSpec: '10-20',
      });
    });

    it('should handle single numeric line spec', () => {
      const result = parseRemoteUrl('https://example.com/file.ts#42');
      expect(result).toEqual({
        baseUrl: 'https://example.com/file.ts',
        lineSpec: '42',
      });
    });

    it('should handle mixed L prefix format', () => {
      const result = parseRemoteUrl('https://example.com/file.ts#L5-10');
      expect(result).toEqual({
        baseUrl: 'https://example.com/file.ts',
        lineSpec: 'L5-10',
      });
    });
  });

  describe('validateRemoteUrl', () => {
    it('should reject HTTP when allowInsecureHttp is false', () => {
      expect(() => validateRemoteUrl('http://example.com/file.ts')).toThrow(
        'Insecure HTTP URLs are not allowed',
      );
    });

    it('should allow HTTP when allowInsecureHttp is true', () => {
      expect(() =>
        validateRemoteUrl('http://example.com/file.ts', {
          allowInsecureHttp: true,
        }),
      ).not.toThrow();
    });

    it('should allow HTTPS by default', () => {
      expect(() =>
        validateRemoteUrl('https://example.com/file.ts'),
      ).not.toThrow();
    });

    it('should reject non-HTTP protocols', () => {
      expect(() => validateRemoteUrl('ftp://example.com/file.ts')).toThrow(
        'Invalid URL protocol',
      );
    });

    it('should throw on malformed URLs', () => {
      expect(() => validateRemoteUrl('not-a-url')).toThrow();
    });
  });

  describe('fetchRemoteContent', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should fetch content from valid URL', async () => {
      const mockContent = 'const x = 1;';
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockContent),
      } as Response);

      const result = await fetchRemoteContent('https://example.com/file.ts');
      expect(result).toBe(mockContent);
    });

    it('should strip hash fragment when fetching', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      } as Response);

      await fetchRemoteContent('https://example.com/file.ts#L10-L20');

      // Verify fetch was called without the hash
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://example.com/file.ts',
        expect.any(Object),
      );
    });

    it('should throw on 404', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(
        fetchRemoteContent('https://example.com/missing.ts'),
      ).rejects.toThrow('Remote file not found');
    });

    it('should throw on other HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        fetchRemoteContent('https://example.com/file.ts'),
      ).rejects.toThrow('HTTP 500');
    });

    it('should include User-Agent header', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      } as Response);

      await fetchRemoteContent('https://example.com/file.ts');

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'markdown-code',
          }),
        }),
      );
    });

    it('should reject HTTP URLs by default', async () => {
      await expect(
        fetchRemoteContent('http://example.com/file.ts'),
      ).rejects.toThrow('Insecure HTTP URLs are not allowed');
    });

    it('should allow HTTP when allowInsecureHttp is true', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      } as Response);

      await expect(
        fetchRemoteContent('http://example.com/file.ts', {
          allowInsecureHttp: true,
        }),
      ).resolves.toBe('content');
    });
  });
});
