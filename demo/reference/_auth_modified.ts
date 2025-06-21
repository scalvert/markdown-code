export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export async function loginUser(email: string, password: string): Promise<User> {
  // Added input validation
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

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