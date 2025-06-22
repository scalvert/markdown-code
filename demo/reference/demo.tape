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
Sleep 3

Ctrl+u

Type "We have existing source code in our project"
Sleep 3
Ctrl+u
Type "head src/auth.ts"
Enter
Sleep 5

Ctrl+L

Type "Our README references specific parts of the source file"
Sleep 3

Ctrl+u

Type "head README.md"
Enter
Sleep 5

Ctrl+L

Type "Let's check sync status"
Sleep 3

Ctrl+u

Type "npx -y markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "Now let's modify the source file"

Ctrl+L

Type "Check for drift after source changes"
Sleep 3

Ctrl+u

Hide
Type "cp _auth_modified.ts src/auth.ts"
Enter
Show
Type "npx markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "Sync documentation with source changes"
Sleep 3

Ctrl+u

Type "npx markdown-code sync"
Enter
Sleep 5

Ctrl+L

Type "Verify everything is in sync"
Sleep 3

Ctrl+u

Type "npx markdown-code check"
Enter
Sleep 5

Ctrl+L

Type "See the updated documentation"
Sleep 3

Ctrl+u

Type "head README.md"
Enter
Sleep 5

# Output settings
Output reference-demo.gif 