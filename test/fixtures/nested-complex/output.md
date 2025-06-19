# Nested Directory Documentation

This demonstrates snippets from various nested directories.

## Components

### Button Component

Here's the interface definition:

```tsx snippet=src/components/Button.tsx#L3-L7
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}
```

And here's the main component function:

```tsx snippet=src/components/Button.tsx#L9-L15
export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium';
}
```

## API Utilities

The base URL configuration:

```ts snippet=src/utils/api.ts#L1
const BASE_URL = 'https://api.example.com';
```

Here's the complete fetchUser function:

```ts snippet=src/utils/api.ts#L3-L8
export async function fetchUser(id: string) {
  const response = await fetch(`${BASE_URL}/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  return response.json();
}
```

And just the error handling part:

```ts snippet=src/utils/api.ts#L5-L6
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
}
```
