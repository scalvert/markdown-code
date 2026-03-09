import { describe, it, expect } from 'vitest';
import { format, hasErrors, hasIssues } from '../src/formatter.js';
import type { FileIssues } from '../src/types.js';

function makeFileIssues(
  type: string,
  message = 'test message',
): Array<FileIssues> {
  return [
    {
      filePath: '/project/README.md',
      issues: [{ type: type as any, message, line: 1, column: 1 }],
    },
  ];
}

describe('hasErrors', () => {
  it('returns true for sync-needed', () => {
    expect(hasErrors(makeFileIssues('sync-needed'))).toBe(true);
  });

  it('returns true for invalid-path', () => {
    expect(hasErrors(makeFileIssues('invalid-path'))).toBe(true);
  });

  it('returns true for load-failed', () => {
    expect(hasErrors(makeFileIssues('load-failed'))).toBe(true);
  });

  it('returns true for remote-error', () => {
    expect(hasErrors(makeFileIssues('remote-error'))).toBe(true);
  });

  it('returns false for file-missing (intentionally non-fatal)', () => {
    expect(hasErrors(makeFileIssues('file-missing'))).toBe(false);
  });

  it('returns false for empty issues array', () => {
    expect(hasErrors([])).toBe(false);
  });

  it('returns false for file with no issues', () => {
    expect(hasErrors([{ filePath: '/project/README.md', issues: [] }])).toBe(
      false,
    );
  });
});

describe('hasIssues', () => {
  it('returns true when any issue exists', () => {
    expect(hasIssues(makeFileIssues('file-missing'))).toBe(true);
  });

  it('returns true for error-type issues', () => {
    expect(hasIssues(makeFileIssues('sync-needed'))).toBe(true);
  });

  it('returns false for empty issues array', () => {
    expect(hasIssues([])).toBe(false);
  });

  it('returns false for file with no issues', () => {
    expect(hasIssues([{ filePath: '/project/README.md', issues: [] }])).toBe(
      false,
    );
  });
});

describe('format', () => {
  it('returns empty string when there are no file issues', () => {
    expect(format([])).toBe('');
  });

  it('returns empty string for files with empty issues arrays', () => {
    expect(format([{ filePath: '/project/README.md', issues: [] }])).toBe('');
  });

  it('includes the file path in output', () => {
    const result = format(makeFileIssues('sync-needed'));
    expect(result).toContain('README.md');
  });

  it('includes the issue message', () => {
    const result = format(makeFileIssues('sync-needed', 'out of sync'));
    expect(result).toContain('out of sync');
  });

  it('includes a summary with issue count', () => {
    const result = format(makeFileIssues('sync-needed'));
    expect(result).toContain('1 problem');
  });

  it('uses plural "problems" for multiple issues', () => {
    const fileIssues: Array<FileIssues> = [
      {
        filePath: '/project/README.md',
        issues: [
          { type: 'sync-needed', message: 'a', line: 1, column: 1 },
          { type: 'file-missing', message: 'b', line: 2, column: 1 },
        ],
      },
    ];
    const result = format(fileIssues);
    expect(result).toContain('2 problems');
  });

  it('includes the ruleId when present', () => {
    const fileIssues: Array<FileIssues> = [
      {
        filePath: '/project/README.md',
        issues: [
          {
            type: 'sync-needed',
            message: 'out of sync',
            line: 5,
            column: 1,
            ruleId: 'content-mismatch',
          },
        ],
      },
    ];
    const result = format(fileIssues);
    expect(result).toContain('content-mismatch');
  });
});
