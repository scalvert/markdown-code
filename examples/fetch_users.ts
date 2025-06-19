interface User {
  id: number;
  name: string;
  email: string;
}

export async function fetchUsers(): Promise<Array<User>> {
  const response = await fetch('/api/users');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  return response.json() as Promise<Array<User>>;
}

export async function fetchUserById(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${id}: ${response.statusText}`);
  }

  return response.json() as Promise<User>;
} 