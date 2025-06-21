import express from 'express';
import { greet } from './greet.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface User {
  id: number;
  name: string;
  email: string;
}

// Main API endpoint - this will be featured in the demo
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      user,
      greeting: greet(user.name)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function getUserById(id: number): Promise<User | null> {
  return { id, name: 'Demo User', email: 'demo@example.com' };
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 