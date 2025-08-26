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
  excludeGlob: Array<string>;
  includeExtensions: Array<string>;
}

export interface RuntimeConfig extends Config {
  workingDir: string;
}

export interface Issue {
  type:
    | 'sync-needed'
    | 'file-missing'
    | 'invalid-path'
    | 'load-failed'
    | 'out-of-sync';
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

export interface DiscoveryFileDetail {
  filePath: string;
  codeBlocks: number;
  languages: Array<string>;
}

export interface DiscoveryResult {
  markdownFiles: Array<string>;
  totalCodeBlocks: number;
  fileDetails: Array<DiscoveryFileDetail>;
}
