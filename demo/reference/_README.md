# Demo

## User Authentication

Here's our user interface:

```typescript snippet=src/auth.ts#L1-L5
export interface User {
  id: string;
  email: string;
  name: string;
}
```

And the login function:

```typescript snippet=src/auth.ts#L7-L19
export async function loginUser(
  email: string,
  password: string,
): Promise<User> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json();
}
```
