import type { Issue, IssueSeverity } from './types.js';

export type IssueKind = Issue['type'];

export type IssueColor = 'yellow' | 'cyan' | 'red' | 'magenta';

interface IssueKindDefinition {
  color: IssueColor;
  plural: string;
  allowsWarning: boolean;
}

const ISSUE_KINDS: Record<IssueKind, IssueKindDefinition> = {
  'sync-needed': {
    color: 'yellow',
    plural: 'sync-needed',
    allowsWarning: false,
  },
  'file-missing': {
    color: 'cyan',
    plural: 'file-missing',
    allowsWarning: true,
  },
  'invalid-path': {
    color: 'red',
    plural: 'invalid-paths',
    allowsWarning: false,
  },
  'load-failed': {
    color: 'red',
    plural: 'load-failed',
    allowsWarning: false,
  },
  'empty-range': {
    color: 'red',
    plural: 'empty-ranges',
    allowsWarning: false,
  },
  'remote-error': {
    color: 'magenta',
    plural: 'remote-errors',
    allowsWarning: false,
  },
};

const ISSUE_RULES = {
  'content-mismatch': 'sync-needed',
  'snippet-not-found': 'file-missing',
  'path-validation': 'load-failed',
  'snippet-load-error': 'load-failed',
  'path-traversal': 'invalid-path',
  'empty-line-range': 'empty-range',
  'remote-fetch-error': 'remote-error',
} as const satisfies Record<string, IssueKind>;

export type IssueRule = keyof typeof ISSUE_RULES;

export interface IssueLocation {
  line: number;
  column: number;
}

export interface IssueOptions {
  severity?: IssueSeverity | undefined;
}

function kindOf(type: string): IssueKindDefinition | undefined {
  return Object.hasOwn(ISSUE_KINDS, type)
    ? ISSUE_KINDS[type as IssueKind]
    : undefined;
}

function resolveSeverity(
  type: string,
  requested: IssueSeverity | undefined,
): IssueSeverity {
  return requested === 'warning' && kindOf(type)?.allowsWarning
    ? 'warning'
    : 'error';
}

export function createIssue(
  rule: IssueRule,
  { line, column }: IssueLocation,
  message: string,
  options: IssueOptions = {},
): Issue {
  const type = ISSUE_RULES[rule];
  return {
    type,
    severity: resolveSeverity(type, options.severity),
    message,
    line,
    column,
    ruleId: rule,
  };
}

export function severityOf(issue: Issue): IssueSeverity {
  return resolveSeverity(issue.type, issue.severity);
}

export function isError(issue: Issue): boolean {
  return severityOf(issue) === 'error';
}

export function issueColor(
  type: string,
  severity: IssueSeverity,
): IssueColor | 'white' {
  if (resolveSeverity(type, severity) === 'warning') {
    return 'yellow';
  }
  return kindOf(type)?.color ?? 'white';
}

export function issueLabel(issue: Issue): string {
  return severityOf(issue) === 'warning' ? 'warning' : issue.type;
}

export function kindCountLabel(type: string, count: number): string {
  if (count === 1) {
    return type;
  }
  return kindOf(type)?.plural ?? `${type}s`;
}
