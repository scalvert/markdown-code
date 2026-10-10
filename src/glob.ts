import { resolve } from 'node:path';
import { glob } from 'tinyglobby';

export function toGlobPattern(
  pattern: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === 'win32' ? pattern.replaceAll('\\', '/') : pattern;
}

export interface MarkdownFileQuery {
  markdownGlob: string;
  excludeGlob: ReadonlyArray<string>;
  workingDir: string;
}

export async function findMarkdownFiles({
  markdownGlob,
  excludeGlob,
  workingDir,
}: MarkdownFileQuery): Promise<Array<string>> {
  if (markdownGlob.trim() === '') {
    throw new TypeError('markdownGlob must be a non-empty pattern');
  }

  const files = await glob(toGlobPattern(markdownGlob), {
    ignore: excludeGlob.map((pattern) => toGlobPattern(pattern)),
    cwd: workingDir,
    absolute: true,
    expandDirectories: false,
  });
  return files.map((file) => resolve(file)).sort();
}
