import fg from 'fast-glob';
import type { Issue, RuntimeConfig } from './types.js';
import { readMarkdownDocument } from './parser.js';
import {
  isManagedCodeBlock,
  resolveSnippet,
  type ManagedCodeBlock,
} from './snippet-resolution.js';

export type BlockPlan =
  | { status: 'in-sync'; codeBlock: ManagedCodeBlock }
  | { status: 'out-of-sync'; codeBlock: ManagedCodeBlock }
  | { status: 'failed'; codeBlock: ManagedCodeBlock; issue: Issue };

export type FilePlan =
  | {
      filePath: string;
      status: 'planned';
      content: string;
      updatedContent: string;
      blocks: Array<BlockPlan>;
    }
  | { filePath: string; status: 'unreadable'; error: string };

export type SyncPlan =
  | { status: 'listed'; files: AsyncIterable<FilePlan> }
  | { status: 'unlisted'; error: string };

async function planFile(
  filePath: string,
  config: RuntimeConfig,
): Promise<FilePlan> {
  try {
    const { content, document } = await readMarkdownDocument(filePath);
    const blocks: Array<BlockPlan> = [];

    for (const codeBlock of document.codeBlocks.filter(isManagedCodeBlock)) {
      const snippet = await resolveSnippet(codeBlock, {
        config,
        markdownFilePath: filePath,
      });

      if (snippet.status === 'failed') {
        blocks.push({ status: 'failed', codeBlock, issue: snippet.issue });
      } else if (snippet.content !== codeBlock.content) {
        document.setBody(codeBlock, snippet.content);
        blocks.push({ status: 'out-of-sync', codeBlock });
      } else {
        blocks.push({ status: 'in-sync', codeBlock });
      }
    }

    return {
      filePath,
      status: 'planned',
      content,
      updatedContent: document.toString(),
      blocks,
    };
  } catch (error) {
    return {
      filePath,
      status: 'unreadable',
      error: `Error processing ${filePath}: ${error}`,
    };
  }
}

async function* planFiles(
  markdownFiles: Array<string>,
  config: RuntimeConfig,
): AsyncGenerator<FilePlan> {
  for (const filePath of markdownFiles) {
    yield await planFile(filePath, config);
  }
}

export async function planSync(config: RuntimeConfig): Promise<SyncPlan> {
  let markdownFiles: Array<string>;
  try {
    markdownFiles = await fg(config.markdownGlob, {
      ignore: config.excludeGlob,
      cwd: config.workingDir,
      absolute: true,
    });
  } catch (error) {
    return {
      status: 'unlisted',
      error: `Error finding markdown files: ${error}`,
    };
  }

  return { status: 'listed', files: planFiles(markdownFiles, config) };
}

export function failedIssues(blocks: Array<BlockPlan>): Array<Issue> {
  return blocks.flatMap((block) =>
    block.status === 'failed' ? [block.issue] : [],
  );
}
