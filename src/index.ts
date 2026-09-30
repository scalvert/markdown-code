export {
  DEFAULT_CONFIG,
  configExists,
  loadConfig,
  validateConfig,
} from './config.js';
export { format, hasErrors, hasIssues } from './formatter.js';
export {
  MarkdownDocument,
  isMdxPath,
  type DocumentCodeBlock,
  type ParseOptions,
} from './markdown-document.js';
export {
  extractLines,
  loadSnippetContent,
  parseMarkdownFile,
  parseMarkdownForExtraction,
  replaceCodeBlock,
  resolveSnippetPath,
  trimBlankLines,
} from './parser.js';
export {
  formatSnippetDirective,
  parseSnippetDirective,
} from './snippet-directive.js';
export {
  fetchRemoteContent,
  isRemoteUrl,
  parseRemoteUrl,
  validateRemoteUrl,
} from './remote.js';
export {
  checkMarkdownFiles,
  discoverCodeBlocks,
  ensureTrailingNewline,
  extractSnippets,
  syncMarkdownFiles,
} from './sync.js';
export type * from './types.js';
export { VERSION } from './version.js';
