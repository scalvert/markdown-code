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
Enter
Sleep 5

Ctrl+L

Type "We have this README.md in our project"
Enter
Enter
Type "cat README.md"
Enter
Sleep 5

Ctrl+L

Type "We can first check what code blocks will benefit from markdown-code"
Enter
Enter
Type "npx -y markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "We can run the init and extraction in a single command. This adds a default .markdown-coderc.json file to your project, and extracts all snippets"
Enter
Enter
Type "npx markdown-code init --extract"
Enter
Sleep 4

Ctrl+L

Type "Let's see what was extracted"
Enter

Ctrl+L

Type "tree snippets/"
Enter
Sleep 5

Type "We now have our project setup to use markdown-code to manage code blocks in documentation"
Enter
Type "Let's see what the check command does now"
Enter
Enter
Type "npx markdown-code check"
Enter
Sleep 3

Ctrl+L

Type "Now let's modify a snippet file to show drift detection"
Enter
Enter
Hide
Type "cp _snippets_modified/_snippet1_modified.ts snippets/demo/snippet1.ts"
Enter
Show
Sleep 2

Ctrl+L

Type "npx markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "npx markdown-code sync"
Enter
Sleep 4

Ctrl+L

Type "npx markdown-code check"
Enter
Sleep 3

# Output settings
Output extraction-demo.gif 