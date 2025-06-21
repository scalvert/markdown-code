# Demo: markdown-code - Reference existing source files
# This VHS tape demonstrates referencing source files with snippet directives

Set Theme "GitHub Dark"
Set FontFamily "Monaco"
Set TypingSpeed 50ms
Set FontSize 20
Set Width 1200
Set Height 800
Set Padding 20
Set Margin 60

Type "markdown-code can reference existing source files in your documentation"
Enter
Sleep 5

Ctrl+L

Type "We have existing source code in our project"
Enter
Enter
Type "cat src/auth.ts"
Enter
Sleep 5

Ctrl+L

Type "Our README references specific parts of the source file"
Enter
Enter
Type "cat README.md"
Enter
Sleep 5

Ctrl+L

Type "Let's check sync status"
Enter
Enter
Type "npx -y markdown-code check"
Enter
Sleep 3

Ctrl+L

Type "Now let's modify the source file"
Enter
Enter
Hide
Type "cp _auth_modified.ts src/auth.ts"
Enter
Show
Sleep 2

Ctrl+L

Type "Check for drift after source changes"
Enter
Enter
Type "npx markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "Sync documentation with source changes"
Enter
Enter
Type "npx markdown-code sync"
Enter
Sleep 4

Ctrl+L

Type "Verify everything is in sync"
Enter
Enter
Type "npx markdown-code check"
Enter
Sleep 3

Ctrl+L

Type "See the updated documentation"
Enter
Enter
Type "cat README.md"
Enter
Sleep 5

# Output settings
Output reference-demo.gif 