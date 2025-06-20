import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .scriptName('markdown-code')
  .usage('Keep code examples in Markdown synchronized with actual source files')
  .commandDir('./commands')
  .option('config', {
    type: 'string',
    describe: 'Path to configuration file',
    global: true,
  })
  .option('snippet-root', {
    type: 'string',
    describe: 'Directory containing source files (default: ".")',
    global: true,
  })
  .option('markdown-glob', {
    type: 'string',
    describe: 'Glob pattern for markdown files (default: "**/*.md")',
    global: true,
  })
  .option('include-extensions', {
    type: 'string',
    describe: 'Comma-separated list of file extensions to include',
    global: true,
  })
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .demandCommand(1, 'You need at least one command before moving on')
  .parse();
