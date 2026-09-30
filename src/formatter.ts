import { relative, resolve } from 'node:path';
import pc from 'picocolors';
import type {
  DiscoveryResult,
  FileIssues,
  Issue,
  IssueSeverity,
} from './types.js';
import {
  isError,
  issueColor,
  issueLabel,
  kindCountLabel,
  severityOf,
} from './issues.js';

function colorize(
  type: string,
  severity: IssueSeverity,
): (text: string) => string {
  return pc[issueColor(type, severity)];
}

function formatIssue(issue: Issue): string {
  const { line, column, type, message, ruleId } = issue;
  const position = pc.dim(`${line}:${column}`.padEnd(6));
  const colorFn = colorize(type, severityOf(issue));
  const severity = colorFn(issueLabel(issue).padEnd(12));
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
    const hasError = allFileIssues.some((file) =>
      file.issues.some((issue) => issue.type === type && isError(issue)),
    );
    const colorFn = colorize(type, hasError ? 'error' : 'warning');
    parts.push(colorFn(`${count} ${kindCountLabel(type, count)}`));
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

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function formatDiscovery(
  discovery: DiscoveryResult,
  workingDir: string,
): string {
  const blocks = pluralize(discovery.totalCodeBlocks, 'code block');
  const files = pluralize(discovery.fileDetails.length, 'file');
  const heading = `Found ${blocks} in ${files} not yet managed by markdown-code:`;
  const lines = discovery.fileDetails.map(
    ({ filePath, codeBlocks, languages }) => {
      const detail = `${pluralize(codeBlocks, 'code block')} (${languages.join(', ')})`;
      return `  ${relative(workingDir, filePath)}  ${pc.dim(detail)}`;
    },
  );

  return [heading, ...lines].join('\n');
}

export function hasErrors(fileIssues: Array<FileIssues>): boolean {
  return fileIssues.some((file) => file.issues.some(isError));
}

export function hasIssues(fileIssues: Array<FileIssues>): boolean {
  return fileIssues.some((file) => file.issues.length > 0);
}
