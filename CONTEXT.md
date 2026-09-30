# markdown-code

Keeps code examples in Markdown and MDX files in step with the source files they are copied from.

## Language

**Markdown document**:
The parsed content of one Markdown or MDX file, together with its code blocks.
_Avoid_: Markdown file (for the parsed form), page

**Code block**:
A fenced block with a language inside a Markdown document.
_Avoid_: Fence, code sample, snippet (for the block itself)

**Snippet directive**:
The `snippet=<path>[#L<start>[-L<end>]]` token in a code block's opening fence that names its snippet and optional line range.
_Avoid_: Annotation, snippet reference, snippet tag

**Snippet**:
The source file (local path or remote URL) that a snippet directive points at, and whose lines the code block mirrors.
_Avoid_: Source, snippet file (when a remote URL is meant)

**Issue**:
A problem found while syncing or checking a code block, reported at its line and column with a kind (`type`), a rule (`ruleId`), and a severity.
_Avoid_: Error (for issues that may be warnings), diagnostic, finding

**Rule**:
The specific cause of an issue (for example `snippet-not-found` or `path-traversal`), shown after each reported issue. Every rule belongs to one issue kind.
_Avoid_: Rule ID (for the concept), check

**Severity**:
Whether an issue fails the run (`error`) or is only reported (`warning`). Only missing snippets can be downgraded to a warning.
_Avoid_: Level, priority
