export interface FetchOptions {
  timeout?: number | undefined;
  allowInsecureHttp?: boolean | undefined;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Check if a path is a remote URL (HTTP or HTTPS)
 * Uses URL.canParse() for robust detection (Node 18.17+)
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
 * Uses Node's built-in URL class for robust parsing.
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
 * Uses URL class for parsing - throws if URL is malformed.
 */
export function validateRemoteUrl(
  url: string,
  options: FetchOptions = {},
): void {
  const parsed = new URL(url); // Throws TypeError if invalid URL

  if (parsed.protocol === 'http:' && !options.allowInsecureHttp) {
    throw new Error(
      `Insecure HTTP URLs are not allowed. Use HTTPS or set allowInsecureHttp: true in config. URL: ${url}`,
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
 * Strips hash fragment before fetching (fragments are client-side only).
 */
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
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'markdown-code',
        Accept: 'text/plain, */*',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Remote file not found: ${url}`);
      }
      throw new Error(
        `Failed to fetch remote file: ${url} (HTTP ${response.status})`,
      );
    }

    return await response.text();
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
