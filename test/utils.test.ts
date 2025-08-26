import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileExists, isInWorkingDir } from '../src/utils.js';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('utils', () => {
  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      const tempFile = join(tmpdir(), 'test-exists.txt');
      await writeFile(tempFile, 'test');

      const exists = await fileExists(tempFile);
      expect(exists).toBe(true);

      await unlink(tempFile);
    });

    it('should return false for non-existing files', async () => {
      const tempFile = join(tmpdir(), 'test-does-not-exist.txt');

      const exists = await fileExists(tempFile);
      expect(exists).toBe(false);
    });
  });

  describe('isPathWithinRoots', () => {
    it('should return true for paths within a single root', () => {
      const root = '/home/user/project';

      expect(isInWorkingDir('/home/user/project/file.txt', root)).toBe(true);
      expect(isInWorkingDir('/home/user/project/src/index.js', root)).toBe(
        true,
      );
      expect(isInWorkingDir('/home/user/project', root)).toBe(true);
    });

    it('should return false for paths outside the root', () => {
      const root = '/home/user/project';

      expect(isInWorkingDir('/home/user/other/file.txt', root)).toBe(false);
      expect(isInWorkingDir('/home/user/file.txt', root)).toBe(false);
      expect(isInWorkingDir('/etc/passwd', root)).toBe(false);
    });

    it('should handle multiple roots', () => {
      const roots = ['/home/user/project', '/var/lib/app'];

      expect(isInWorkingDir('/home/user/project/file.txt', roots)).toBe(true);
      expect(isInWorkingDir('/var/lib/app/config.json', roots)).toBe(true);
      expect(isInWorkingDir('/etc/passwd', roots)).toBe(false);
    });

    it('should prevent prefix-based attacks', () => {
      const root = '/home/user/project';

      // These paths start with the root as a prefix but are not within it
      expect(isInWorkingDir('/home/user/project-evil/file.txt', root)).toBe(
        false,
      );
      expect(isInWorkingDir('/home/user/projects/file.txt', root)).toBe(false);
    });

    it('should handle relative path traversal attempts', () => {
      const root = '/home/user/project';

      // Simulating resolved paths that would result from ../../../etc/passwd
      expect(isInWorkingDir('/etc/passwd', root)).toBe(false);
      expect(isInWorkingDir('/home/user', root)).toBe(false);
    });
  });
});
