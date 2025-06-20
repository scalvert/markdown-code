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

export interface SyncResult {
  updated: Array<string>;
  warnings: Array<string>;
  errors: Array<string>;
}

export interface CheckResult {
  inSync: boolean;
  outOfSync: Array<string>;
  warnings: Array<string>;
  errors: Array<string>;
}

export interface ExtractResult {
  extracted: Array<string>;
  snippetsCreated: number;
  warnings: Array<string>;
  errors: Array<string>;
}
