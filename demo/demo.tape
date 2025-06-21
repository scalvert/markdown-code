# Demo: markdown-code - Keep your docs in sync! 
# This VHS tape demonstrates the key features of markdown-code

# Configure the terminal
Set FontSize 14
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"

Type "markdown-code Demo"
Enter
Sleep 1

Type ""
Enter

Type "cat DEMO.md"
Enter
Sleep 4

Type "../dist/cli.js check"
Enter
Sleep 4

Type "../dist/cli.js init --extract"
Enter
Sleep 3

Type "tree snippets/"
Enter
Sleep 2

Type "../dist/cli.js check"
Enter
Sleep 2

Type "echo 'export function greet(name: string): string {' > snippets/demo/snippet1.ts"
Enter
Type "echo '  return \`Hi there, \${name}! Welcome!\`;' >> snippets/demo/snippet1.ts"
Enter
Type "echo '}' >> snippets/demo/snippet1.ts"
Enter

Type "../dist/cli.js check"
Enter
Sleep 4

Type "../dist/cli.js sync"
Enter
Sleep 3

Type "../dist/cli.js check"
Enter
Sleep 2

# Output settings
Output demo.gif 