import { describe, it, expect } from 'vitest';
import {
  createIssue,
  isError,
  issueColor,
  issueLabel,
  kindCountLabel,
  severityOf,
  type IssueRule,
} from '../src/issues.js';

const at = { line: 3, column: 5 };

describe('issue catalogue', () => {
  it.each<[IssueRule, string]>([
    ['content-mismatch', 'sync-needed'],
    ['snippet-not-found', 'file-missing'],
    ['path-validation', 'load-failed'],
    ['snippet-load-error', 'load-failed'],
    ['path-traversal', 'invalid-path'],
    ['remote-fetch-error', 'remote-error'],
    ['empty-line-range', 'empty-range'],
  ])('creates %s as a %s error', (rule, type) => {
    expect(createIssue(rule, at, 'message')).toEqual({
      type,
      severity: 'error',
      message: 'message',
      line: 3,
      column: 5,
      ruleId: rule,
    });
  });

  it('lets a missing snippet be downgraded to a warning', () => {
    const issue = createIssue('snippet-not-found', at, 'missing', {
      severity: 'warning',
    });

    expect(issue.severity).toBe('warning');
    expect(isError(issue)).toBe(false);
    expect(issueLabel(issue)).toBe('warning');
    expect(issueColor(issue.type, severityOf(issue))).toBe('yellow');
  });

  it('keeps every other rule fatal even when a warning is requested', () => {
    const issue = createIssue('path-traversal', at, 'escape', {
      severity: 'warning',
    });

    expect(issue.severity).toBe('error');
    expect(isError(issue)).toBe(true);
    expect(issueLabel(issue)).toBe('invalid-path');
  });

  it('resolves severity for issues built outside the catalogue', () => {
    expect(
      severityOf({ type: 'file-missing', message: '', line: 1, column: 1 }),
    ).toBe('error');
    expect(
      severityOf({
        type: 'sync-needed',
        severity: 'warning',
        message: '',
        line: 1,
        column: 1,
      }),
    ).toBe('error');
  });

  it('labels counts with each kind plural', () => {
    expect(kindCountLabel('invalid-path', 1)).toBe('invalid-path');
    expect(kindCountLabel('invalid-path', 2)).toBe('invalid-paths');
    expect(kindCountLabel('sync-needed', 2)).toBe('sync-needed');
    expect(kindCountLabel('unknown-kind', 2)).toBe('unknown-kinds');
  });

  it('falls back to white for unknown kinds', () => {
    expect(issueColor('unknown-kind', 'error')).toBe('white');
    expect(issueColor('remote-error', 'error')).toBe('magenta');
  });
});
