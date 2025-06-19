import meow from 'meow';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, validateConfig, type ConfigOverrides } from './config.js';
import { syncMarkdownFiles, checkMarkdownFiles } from './sync.js';

const cli = meow(
  `
  Usage
    $ markdown-code [options]

  Options
    --check, -c              Check if markdown files are in sync (exit non-zero on mismatch)
    --write, -w              Update markdown files with snippet content (default)
    --init, -i               Create a default configuration file
    --config                 Path to configuration file
    --snippet-root           Directory containing source files (default: ".")
    --markdown-glob          Glob pattern for markdown files (default: "**/*.md")
    --include-extensions     Comma-separated list of file extensions to include

  Examples
    $ markdown-code                 # updates all snippet blocks (default is --write)
    $ markdown-code --check         # verifies sync, fails if out of sync
    $ markdown-code --init          # creates .markdown-coderc.json with default settings
    $ markdown-code --config path/to/.markdown-coderc.json
    $ markdown-code --snippet-root ./src --markdown-glob "docs/**/*.md"
    $ markdown-code --include-extensions .ts,.js,.py
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
      init: {
        type: 'boolean',
        shortFlag: 'i',
        default: false,
      },
      config: {
        type: 'string',
      },
      snippetRoot: {
        type: 'string',
      },
      markdownGlob: {
        type: 'string',
      },
      includeExtensions: {
        type: 'string',
      },
    },
  }
);

function createDefaultConfig(): void {
  const configPath = resolve('.markdown-coderc.json');
  const snippetsDir = resolve('snippets');

  if (existsSync(configPath)) {
    console.log('Configuration file already exists at .markdown-coderc.json');
    return;
  }

  const defaultConfig = {
    snippetRoot: './snippets',
    markdownGlob: '**/*.md',
    includeExtensions: [
      '.ts',
      '.js',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.go',
      '.rs',
      '.php',
      '.rb',
      '.swift',
      '.kt',
    ],
  };

  try {
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('Created .markdown-coderc.json with default configuration');

    if (!existsSync(snippetsDir)) {
      mkdirSync(snippetsDir, { recursive: true });
      console.log('Created snippets/ directory for your source files');
    }

    console.log('\nNext steps:');
    console.log('1. Place your source files in the snippets/ directory');
    console.log(
      '2. Add snippet directives to your markdown files: ```js snippet=example.js'
    );
    console.log('3. Run `markdown-code` to sync your code examples');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create configuration: ${errorMessage}`);
  }
}

async function main(): Promise<void> {
  try {
    if (cli.flags.init) {
      createDefaultConfig();
      return;
    }

    const overrides: ConfigOverrides = {};
    if (cli.flags.snippetRoot) overrides.snippetRoot = cli.flags.snippetRoot;
    if (cli.flags.markdownGlob) overrides.markdownGlob = cli.flags.markdownGlob;
    if (cli.flags.includeExtensions)
      overrides.includeExtensions = cli.flags.includeExtensions;

    const config = loadConfig(cli.flags.config, overrides);
    validateConfig(config);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(errorMessage);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
