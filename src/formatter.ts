import { resolve } from 'node:path';
import pc from 'picocolors';
import type { FileIssues, Issue } from './types.js';

function getIssueColor(type: string): (text: string) => string {
  switch (type) {
  case 'sync-needed':
    return pc.yellow;
  case 'file-missing':
    return pc.cyan;
  case 'invalid-path':
  case 'load-failed':
    return pc.red;
  default:
    return pc.white;
  }
}

function getPluralForm(type: string): string {
  const pluralMap: Record<string, string> = {
    'sync-needed': 'sync-needed',
    'file-missing': 'file-missing',
    'invalid-path': 'invalid-paths',
    'load-failed': 'load-failed',
  };

  return pluralMap[type] ?? `${type}s`;
}

function formatIssue(issue: Issue): string {
  const { line, column, type, message, ruleId } = issue;
  const position = pc.dim(`${line}:${column}`.padEnd(6));
  const colorFn = getIssueColor(type);
  const severity = colorFn(type.padEnd(12));
  const rule = ruleId ? pc.dim(`  ${ruleId}`) : '';

  return `  ${position} ${severity} ${message}${rule}`;
}

function formatFileIssues(fileIssues: FileIssues): string {
  const { filePath, issues } = fileIssues;

  if (issues.length === 0) {
    return '';
  }

  const absolutePath = pc.dim(resolve(filePath));
  const formattedIssues = issues.map(formatIssue).join('\n');

  return `${absolutePath}\n${formattedIssues}`;
}

function formatSummary(allFileIssues: Array<FileIssues>): string {
  const totalIssues = allFileIssues.reduce(
    (sum, file) => sum + file.issues.length,
    0,
  );

  if (totalIssues === 0) {
    return '';
  }

  const issueCountsByType = allFileIssues.reduce(
    (counts, file) => {
      file.issues.forEach((issue) => {
        counts[issue.type] = (counts[issue.type] ?? 0) + 1;
      });
      return counts;
    },
    {} as Record<string, number>,
  );

  const problemsText = totalIssues === 1 ? 'problem' : 'problems';
  let summary = pc.bold(pc.red(`✖ ${totalIssues} ${problemsText}`));

  const parts: Array<string> = [];
  Object.entries(issueCountsByType).forEach(([type, count]) => {
    const label = count === 1 ? type : getPluralForm(type);
    const colorFn = getIssueColor(type);
    parts.push(colorFn(`${count} ${label}`));
  });

  if (parts.length > 0) {
    summary += pc.dim(` (${parts.join(', ')})`);
  }

  return summary;
}

export function format(fileIssues: Array<FileIssues>): string {
  const formattedFiles = fileIssues
    .filter((file) => file.issues.length > 0)
    .map(formatFileIssues)
    .filter((formatted) => formatted !== '');

  if (formattedFiles.length === 0) {
    return '';
  }

  const summary = formatSummary(fileIssues);

  return `${formattedFiles.join('\n\n')}\n\n${summary}`;
}

export function hasErrors(fileIssues: Array<FileIssues>): boolean {
  return fileIssues.some((file) =>
    file.issues.some(
      (issue) =>
        issue.type === 'sync-needed' ||
        issue.type === 'invalid-path' ||
        issue.type === 'load-failed',
    ),
  );
}

export function hasIssues(fileIssues: Array<FileIssues>): boolean {
  return fileIssues.some((file) => file.issues.length > 0);
}
