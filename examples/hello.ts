export function greetUser(name: string): string {
  return `Hello, ${name}! Welcome to markdown-code.`;
}

export function calculateSum(a: number, b: number): number {
  return a + b;
}

function processData(data: Array<string>): Array<string> {
  return data
    .filter((item) => item.length > 0)
    .map((item) => item.toUpperCase())
    .sort();
} 