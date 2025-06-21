import type { FileIssues, Issue } from './types.js';

function formatIssue(issue: Issue): string {
  const { line, column, type, message, ruleId } = issue;
  const position = `${line}:${column}`.padEnd(6);
  const severity = type.padEnd(7);
  const rule = ruleId ? `  ${ruleId}` : '';
  
  return `  ${position} ${severity} ${message}${rule}`;
}

function formatFileIssues(fileIssues: FileIssues): string {
  const { filePath, issues } = fileIssues;
  
  if (issues.length === 0) {
    return '';
  }
  
  const header = filePath;
  const formattedIssues = issues.map(formatIssue).join('\n');
  
  return `${header}\n${formattedIssues}`;
}

function formatSummary(allFileIssues: Array<FileIssues>): string {
  const totalIssues = allFileIssues.reduce((sum, file) => sum + file.issues.length, 0);
  
  if (totalIssues === 0) {
    return '';
  }
  
  const errorCount = allFileIssues.reduce(
    (sum, file) => sum + file.issues.filter(issue => issue.type === 'error').length,
    0
  );
  
  const warningCount = allFileIssues.reduce(
    (sum, file) => sum + file.issues.filter(issue => issue.type === 'warning').length,
    0
  );
  
  const problemsText = totalIssues === 1 ? 'problem' : 'problems';
  let summary = `✖ ${totalIssues} ${problemsText}`;
  
  const parts: Array<string> = [];
  if (errorCount > 0) {
    parts.push(`${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`);
  }
  
  if (parts.length > 0) {
    summary += ` (${parts.join(', ')})`;
  }
  
  return summary;
}

export function formatEslintStyle(fileIssues: Array<FileIssues>): string {
  const formattedFiles = fileIssues
    .filter(file => file.issues.length > 0)
    .map(formatFileIssues)
    .filter(formatted => formatted !== '');
  
  if (formattedFiles.length === 0) {
    return '';
  }
  
  const summary = formatSummary(fileIssues);
  
  return `${formattedFiles.join('\n\n')}\n\n${summary}`;
}

export function hasErrors(fileIssues: Array<FileIssues>): boolean {
  return fileIssues.some(file => 
    file.issues.some(issue => issue.type === 'error')
  );
}

export function hasIssues(fileIssues: Array<FileIssues>): boolean {
  return fileIssues.some(file => file.issues.length > 0);
} 