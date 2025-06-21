export interface SnippetDirective {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface CodeBlock {
  language: string;
  content: string;
  snippet?: SnippetDirective;
  position: {
    start: number;
    end: number;
  };
  lineNumber?: number;
  columnNumber?: number;
}

export interface MarkdownFile {
  filePath: string;
  content: string;
  codeBlocks: Array<CodeBlock>;
}

export interface Config {
  snippetRoot: string;
  markdownGlob: string;
  includeExtensions: Array<string>;
}

export interface Issue {
  type: 'error' | 'warning';
  message: string;
  line: number;
  column: number;
  ruleId?: string;
}

export interface FileIssues {
  filePath: string;
  issues: Array<Issue>;
}

export interface SyncResult {
  updated: Array<string>;
  fileIssues: Array<FileIssues>;
  warnings: Array<string>;
  errors: Array<string>;
}

export interface CheckResult {
  inSync: boolean;
  outOfSync: Array<string>;
  fileIssues: Array<FileIssues>;
  warnings: Array<string>;
  errors: Array<string>;
}

export interface ExtractResult {
  extracted: Array<string>;
  snippetsCreated: number;
  warnings: Array<string>;
  errors: Array<string>;
}
