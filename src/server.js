const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://veilstream:veilstream@localhost:5432/veilstream',
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

// Wait for database to be ready before serving requests
let dbReady = false;
async function waitForDb() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected');
      dbReady = true;
      return;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${i + 1}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('Could not connect to database after 30 attempts');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all users
app.get('/api/users', async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'Database not ready' });
  }
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING *',
      [name, email, role || 'viewer']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }
    console.error('Error creating user:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

waitForDb().then(() => {
  app.listen(port, () => {
    console.log(`VeilStream app listening on http://localhost:${port}`);
  });
});
