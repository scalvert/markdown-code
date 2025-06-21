# Demo: markdown-code - Keep your docs in sync! 
# This VHS tape demonstrates the key features of markdown-code

# Configure the terminal
Set FontSize 14
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"

Type "markdown-code Demo - Keeping documentation in sync!"
Enter
Sleep 1

Type ""
Enter

Type "Current README has plain code blocks:"
Enter
Type "head -15 README.md"
Enter
Sleep 3

Type ""
Enter

Type "Adding snippet directives to connect docs with source files..."
Enter
Sleep 1

# Add snippet directives
Type "sed -i '' 's/```ts/```ts snippet=src\/greet.ts/' README.md"
Enter
Type "sed -i '' 's/```json/```json snippet=config.json/' README.md"
Enter
Type "sed -i '' 's/```js/```js snippet=src\/utils.js#L5-L9/' README.md"
Enter
Sleep 1

Type ""
Enter

Type "Updated README with snippet directives:"
Enter
Type "head -15 README.md"
Enter
Sleep 3

Type ""
Enter

Type "Initialize markdown-code:"
Enter
Type "../dist/cli.js init"
Enter
Sleep 2

Type ""
Enter

Type "Check sync status:"
Enter
Type "../dist/cli.js check"
Enter
Sleep 3

Type ""
Enter

Type "Sync documentation:"
Enter
Type "../dist/cli.js sync"
Enter
Sleep 2

Type ""
Enter

Type "Check status again:"
Enter
Type "../dist/cli.js check"
Enter
Sleep 2

Type ""
Enter

Type "Modify source file:"
Enter
Type "echo 'export function greet(name: string): string {' > src/greet.ts"
Enter
Type "echo '  return \`Hi \${name}! Content CHANGED!\`;' >> src/greet.ts"
Enter
Type "echo '}' >> src/greet.ts"
Enter
Sleep 1

Type ""
Enter

Type "Check for drift:"
Enter
Type "../dist/cli.js check"
Enter
Sleep 3

Type ""
Enter

Type "Sync again:"
Enter
Type "../dist/cli.js sync"
Enter
Sleep 2

Type ""
Enter

Type "Final check:"
Enter
Type "../dist/cli.js check"
Enter
Sleep 2

Type ""
Enter

Type "markdown-code keeps docs and code in sync!"
Enter
Sleep 3

# Output settings
Output demo.gif 