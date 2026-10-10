import { resolve } from 'node:path';
import fg from 'fast-glob';

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
  const files = await fg(toGlobPattern(markdownGlob), {
    ignore: excludeGlob.map((pattern) => toGlobPattern(pattern)),
    cwd: workingDir,
    absolute: true,
  });
  return files.map((file) => resolve(file)).sort();
}
