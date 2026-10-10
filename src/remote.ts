export interface FetchOptions {
  timeout?: number | undefined;
  allowInsecureHttp?: boolean | undefined;
  maxBytes?: number | undefined;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function tooLarge(url: string, maxBytes: number): Error {
  return new Error(`Remote file is larger than ${maxBytes} bytes: ${url}`);
}

async function readBody(
  response: Response,
  url: string,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > maxBytes) {
    await response.body?.cancel();
    throw tooLarge(url, maxBytes);
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw tooLarge(url, maxBytes);
    }
    text += decoder.decode(value, { stream: true });
  }
}

/**
 * Check if a path is a remote URL (HTTP or HTTPS)
 */
export function isRemoteUrl(path: string): boolean {
  if (!URL.canParse(path)) {
    return false;
  }
  const parsed = new URL(path);
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Parse a remote URL and extract line specification from hash fragment.
 *
 * Example: https://raw.githubusercontent.com/user/repo/main/file.ts#L10-L20
 * Returns: { baseUrl: "https://..../file.ts", lineSpec: "L10-L20" }
 */
export function parseRemoteUrl(url: string): {
  baseUrl: string;
  lineSpec?: string;
} {
  const parsed = new URL(url);

  // URL.hash includes the '#' prefix, so we remove it
  const fragment = parsed.hash.slice(1);

  if (!fragment) {
    return { baseUrl: url };
  }

  // Matches: L10, L10-L20, L10-20, 10, 10-20
  const isLineSpec =
    /^L?\d+(-L?\d+)?$/.test(fragment) || /^\d+(-\d+)?$/.test(fragment);

  if (isLineSpec) {
    parsed.hash = '';
    return {
      baseUrl: parsed.toString(),
      lineSpec: fragment,
    };
  }

  // Fragment is not a line spec (e.g., anchor link), keep full URL
  return { baseUrl: url };
}

/**
 * Validate URL protocol for security.
 */
export function validateRemoteUrl(
  url: string,
  options: FetchOptions = {},
): void {
  const parsed = new URL(url); // Throws TypeError if invalid URL

  if (parsed.protocol === 'http:' && !options.allowInsecureHttp) {
    throw new Error(
      'Insecure HTTP URLs are not allowed. ' +
        `Use HTTPS or set allowInsecureHttp: true in config. URL: ${url}`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid URL protocol: ${parsed.protocol}. Only HTTP and HTTPS are supported.`,
    );
  }
}

/**
 * Fetch content from a remote URL.
 */
const MAX_REDIRECTS = 10;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function redirectTarget(
  url: string,
  from: string,
  location: string,
  options: FetchOptions,
): string {
  const target = new URL(location, from);
  target.hash = '';

  if (target.protocol === 'http:' && !options.allowInsecureHttp) {
    throw new Error(
      `Remote file redirected to an insecure HTTP URL: ${url} -> ${target}. ` +
        'Use HTTPS or set allowInsecureHttp: true in config.',
    );
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error(
      `Remote file redirected to an unsupported URL: ${url} -> ${target}`,
    );
  }
  return target.toString();
}

async function fetchFollowingRedirects(
  url: string,
  fetchUrl: string,
  options: FetchOptions,
  signal: AbortSignal,
): Promise<Response> {
  let current = fetchUrl;

  for (let redirects = 0; ; redirects++) {
    const response = await fetch(current, {
      signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'markdown-code',
        Accept: 'text/plain, */*',
      },
    });

    const location = response.headers.get('location');
    if (!REDIRECT_STATUSES.has(response.status) || location === null) {
      return response;
    }

    await response.body?.cancel();
    if (redirects === MAX_REDIRECTS) {
      throw new Error(`Too many redirects: ${url}`);
    }
    current = redirectTarget(url, current, location, options);
  }
}

export async function fetchRemoteContent(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  validateRemoteUrl(url, options);

  // Strip hash fragment for fetching (servers don't receive fragments)
  const parsed = new URL(url);
  parsed.hash = '';
  const fetchUrl = parsed.toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchFollowingRedirects(
      url,
      fetchUrl,
      options,
      controller.signal,
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Remote file not found: ${url}`);
      }
      throw new Error(
        `Failed to fetch remote file: ${url} (HTTP ${response.status})`,
      );
    }

    return await readBody(response, url, options.maxBytes ?? DEFAULT_MAX_BYTES);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${url}`);
      }
      throw error;
    }
    throw new Error(`Failed to fetch remote file: ${url}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
