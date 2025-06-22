# Demo: markdown-code - Keep your docs in sync! 
# This VHS tape demonstrates the key features of markdown-code

Set Theme "GitHub Dark"
Set FontFamily "Monaco"
Set TypingSpeed 50ms
Set FontSize 20
Set Width 1200
Set Height 800
Set Padding 20
Set Margin 60

Type "markdown-code helps keep your documentation in sync with code changes"
Sleep 3

Ctrl+u

Type "We have this README.md in our project"
Sleep 3

Ctrl+u

Type "head README.md"
Enter
Sleep 5

Ctrl+L

Type "We can first check what code blocks will benefit from markdown-code"
Sleep 3

Ctrl+u

Type "npx -y markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "We can run the init and extraction in a single command."
Sleep 3
Ctrl+u

Type "This adds a default .markdown-coderc.json file to your project, and extracts all snippets"
Sleep 3
Ctrl+u

Type "npx markdown-code init --extract"
Enter
Sleep 5

Ctrl+L

Type "Let's see what was extracted"
Sleep 3
Ctrl+u

Type "git-tree"
Enter
Sleep 5

Ctrl+L

Type "We now have our project setup to use markdown-code to manage code blocks in documentation"
Sleep 3

Ctrl+u

Type "Let's see what the check command does now"
Sleep 3

Ctrl+u

Type "npx markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "Now let's modify a snippet file to show drift detection"
Sleep 3
Ctrl+u

Hide
Type "cp _snippets_modified/_snippet1_modified.ts snippets/demo/snippet1.ts"
Enter
Show
Type "npx markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "npx markdown-code sync"
Enter
Sleep 5

Ctrl+L

Type "npx markdown-code check"
Enter
Sleep 5

# Output settings
Output extraction-demo.gif 