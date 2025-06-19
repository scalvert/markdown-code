import meow from 'meow';
import { loadConfig, validateConfig } from './config.js';
import { syncMarkdownFiles, checkMarkdownFiles } from './sync.js';

const cli = meow(
  `
  Usage
    $ markdown-code [options]

  Options
    --check, -c       Check if markdown files are in sync (exit non-zero on mismatch)
    --write, -w       Update markdown files with snippet content (default)
    --config          Path to configuration file

  Examples
    $ markdown-code                 # updates all snippet blocks (default is --write)
    $ markdown-code --check         # verifies sync, fails if out of sync
    $ markdown-code --config path/to/.markdown-coderc.json
`,
  {
    importMeta: import.meta,
    flags: {
      check: {
        type: 'boolean',
        shortFlag: 'c',
        default: false,
      },
      write: {
        type: 'boolean',
        shortFlag: 'w',
        default: false,
      },
      config: {
        type: 'string',
      },
    },
  }
);

async function main(): Promise<void> {
  try {
    const config = loadConfig(cli.flags.config);
    validateConfig(config);

    const isCheckMode = cli.flags.check;
    const shouldWrite =
      cli.flags.write || (!cli.flags.check && !cli.flags.write);

    if (shouldWrite) {
      console.log('Syncing markdown files...');
      const result = await syncMarkdownFiles(config);

      if (result.warnings.length > 0) {
        console.log('Warnings:');
        for (const warning of result.warnings) {
          console.log(`  ${warning}`);
        }
      }

      if (result.errors.length > 0) {
        console.error('Errors:');
        for (const error of result.errors) {
          console.error(`  ${error}`);
        }
        process.exit(1);
      }

      if (result.updated.length > 0) {
        console.log('Updated files:');
        for (const file of result.updated) {
          console.log(`  ${file}`);
        }
      } else {
        console.log('All files are already in sync.');
      }
    } else {
      console.log('Checking markdown files...');
      const result = await checkMarkdownFiles(config);

      if (result.warnings.length > 0) {
        console.log('Warnings:');
        for (const warning of result.warnings) {
          console.log(`  ${warning}`);
        }
      }

      if (result.errors.length > 0) {
        console.error('Errors:');
        for (const error of result.errors) {
          console.error(`  ${error}`);
        }
        process.exit(1);
      }

      if (result.inSync) {
        console.log('All markdown files are in sync.');
      } else {
        console.error('The following files are out of sync:');
        for (const file of result.outOfSync) {
          console.error(`  ${file}`);
        }
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
