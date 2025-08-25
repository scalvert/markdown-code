import { access } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a path is safely contained within one or more root directories.
 * Prevents path traversal attacks by ensuring the resolved path doesn't escape the allowed roots.
 *
 * @param targetPath - The absolute path to check
 * @param allowedRoots - One or more absolute root directories that contain allowed paths
 * @returns true if the path is within at least one allowed root, false otherwise
 */
export function isInWorkingDir(
  targetPath: string,
  allowedRoots: string | string[],
): boolean {
  const roots = Array.isArray(allowedRoots) ? allowedRoots : [allowedRoots];

  return roots.some((root) => {
    const rel = relative(root, targetPath);
    // Path is within root if the relative path doesn't start with '..' and isn't absolute
    return !rel.startsWith('..') && !isAbsolute(rel);
  });
}
