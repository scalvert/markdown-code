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
      vi.mocked(fetch).mockResolvedValue(new Response(mockContent));

      const result = await fetchRemoteContent('https://example.com/file.ts');
      expect(result).toBe(mockContent);
    });

    it('should strip hash fragment when fetching', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('content'));

      await fetchRemoteContent('https://example.com/file.ts#L10-L20');

      // Verify fetch was called without the hash
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://example.com/file.ts',
        expect.any(Object),
      );
    });

    it('should throw on 404', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

      await expect(
        fetchRemoteContent('https://example.com/missing.ts'),
      ).rejects.toThrow('Remote file not found');
    });

    it('cancels the body of an error response', async () => {
      let cancelled = false;
      const body = new ReadableStream({
        cancel() {
          cancelled = true;
        },
      });
      vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 500 }));

      await expect(
        fetchRemoteContent('https://example.com/file.ts'),
      ).rejects.toThrow('HTTP 500');
      expect(cancelled).toBe(true);
    });

    it('should throw on other HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

      await expect(
        fetchRemoteContent('https://example.com/file.ts'),
      ).rejects.toThrow('HTTP 500');
    });

    it('should include User-Agent header', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('content'));

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

    describe('redirects', () => {
      function redirect(location: string, status = 302) {
        return new Response('moved', { status, headers: { location } });
      }

      function requestedUrls() {
        return vi.mocked(fetch).mock.calls.map(([input]) => String(input));
      }

      it('rejects a redirect to HTTP without requesting it', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          redirect('http://example.com/file.ts'),
        );

        await expect(
          fetchRemoteContent('https://example.com/file.ts'),
        ).rejects.toThrow(
          'Remote file redirected to an insecure HTTP URL: https://example.com/file.ts -> http://example.com/file.ts',
        );
        expect(requestedUrls()).toEqual(['https://example.com/file.ts']);
      });

      it('rejects an HTTP hop in the middle of a redirect chain', async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce(redirect('https://a.example.com/one'))
          .mockResolvedValueOnce(redirect('http://b.example.com/two'));

        await expect(
          fetchRemoteContent('https://example.com/file.ts'),
        ).rejects.toThrow('-> http://b.example.com/two');
        expect(requestedUrls()).toEqual([
          'https://example.com/file.ts',
          'https://a.example.com/one',
        ]);
      });

      it('follows HTTP hops when allowInsecureHttp is true', async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce(redirect('http://example.com/two', 301))
          .mockResolvedValueOnce(redirect('https://example.com/three', 308))
          .mockResolvedValueOnce(new Response('content'));

        await expect(
          fetchRemoteContent('https://example.com/file.ts', {
            allowInsecureHttp: true,
          }),
        ).resolves.toBe('content');
        expect(requestedUrls()).toEqual([
          'https://example.com/file.ts',
          'http://example.com/two',
          'https://example.com/three',
        ]);
      });

      it('resolves a relative Location against the current URL', async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce(redirect('../raw/file.ts#L1-L2', 307))
          .mockResolvedValueOnce(new Response('content'));

        await expect(
          fetchRemoteContent('https://example.com/blob/file.ts'),
        ).resolves.toBe('content');
        expect(requestedUrls()).toEqual([
          'https://example.com/blob/file.ts',
          'https://example.com/raw/file.ts',
        ]);
      });

      it('rejects a redirect to a non-HTTP scheme', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(redirect('file:///etc/passwd'));

        await expect(
          fetchRemoteContent('https://example.com/file.ts'),
        ).rejects.toThrow(
          'Remote file redirected to an unsupported URL: https://example.com/file.ts -> file:///etc/passwd',
        );
      });

      it('rejects a redirect to a URL with credentials without echoing them', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          redirect('https://user:secret@example.com/file.ts'),
        );

        const error = await fetchRemoteContent(
          'https://example.com/file.ts',
        ).catch((caught: unknown) => caught as Error);

        expect(error.message).toBe(
          'Remote file redirected to a URL with credentials: https://example.com/file.ts',
        );
      });

      it('names the URL when the redirect Location is invalid', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(redirect('http://[::1'));

        await expect(
          fetchRemoteContent('https://example.com/file.ts'),
        ).rejects.toThrow(
          'Remote file sent an invalid redirect: https://example.com/file.ts',
        );
      });

      it('gives up after 10 redirects', async () => {
        vi.mocked(fetch).mockImplementation(() =>
          Promise.resolve(redirect('https://example.com/again')),
        );

        await expect(
          fetchRemoteContent('https://example.com/file.ts'),
        ).rejects.toThrow('Too many redirects: https://example.com/file.ts');
        expect(requestedUrls()).toHaveLength(11);
      });

      it('treats a 3xx without a Location as the final response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(null, { status: 304 }),
        );

        await expect(
          fetchRemoteContent('https://example.com/file.ts'),
        ).rejects.toThrow('HTTP 304');
      });
    });

    describe('size limit', () => {
      function streamOf(chunks: Array<Uint8Array>): ReadableStream<Uint8Array> {
        return new ReadableStream({
          start(controller) {
            chunks.forEach((chunk) => controller.enqueue(chunk));
            controller.close();
          },
        });
      }

      it('rejects a declared Content-Length over the limit', async () => {
        vi.mocked(fetch).mockResolvedValue(
          new Response('x', { headers: { 'content-length': '11' } }),
        );

        await expect(
          fetchRemoteContent('https://example.com/big.ts', { maxBytes: 10 }),
        ).rejects.toThrow(
          'Remote file is larger than 10 bytes: https://example.com/big.ts',
        );
      });

      it('stops reading a body that grows past the limit', async () => {
        vi.mocked(fetch).mockResolvedValue(
          new Response(
            streamOf([new Uint8Array(6), new Uint8Array(6), new Uint8Array(6)]),
          ),
        );

        await expect(
          fetchRemoteContent('https://example.com/big.ts', { maxBytes: 10 }),
        ).rejects.toThrow('Remote file is larger than 10 bytes');
      });

      it('accepts a body exactly at the limit', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response('0123456789'));

        await expect(
          fetchRemoteContent('https://example.com/ok.ts', { maxBytes: 10 }),
        ).resolves.toBe('0123456789');
      });

      it('decodes UTF-8 characters split across chunks', async () => {
        const bytes = new TextEncoder().encode('café → 🚀');
        vi.mocked(fetch).mockResolvedValue(
          new Response(
            streamOf([bytes.slice(0, 4), bytes.slice(4, 9), bytes.slice(9)]),
          ),
        );

        await expect(
          fetchRemoteContent('https://example.com/utf8.ts'),
        ).resolves.toBe('café → 🚀');
      });
    });

    it('should allow HTTP when allowInsecureHttp is true', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('content'));

      await expect(
        fetchRemoteContent('http://example.com/file.ts', {
          allowInsecureHttp: true,
        }),
      ).resolves.toBe('content');
    });
  });
});
