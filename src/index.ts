export {
  DEFAULT_CONFIG,
  configExists,
  loadConfig,
  validateConfig,
} from './config.js';
export { format, hasErrors, hasIssues } from './formatter.js';
export {
  extractLines,
  loadSnippetContent,
  parseMarkdownFile,
  parseMarkdownForExtraction,
  parseSnippetDirective,
  replaceCodeBlock,
  resolveSnippetPath,
  trimBlankLines,
} from './parser.js';
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
