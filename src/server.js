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

// Wait for database and initialize schema
let dbReady = false;
async function waitForDb() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected');
      break;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${i + 1}/30)`);
      if (i === 29) {
        console.error('Could not connect to database after 30 attempts');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Auto-create schema and seed data if table doesn't exist
  const tableCheck = await pool.query(
    "SELECT to_regclass('public.users') AS exists"
  );
  if (!tableCheck.rows[0].exists) {
    console.log('Creating users table and seeding data...');
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO users (name, email, role, created_at) VALUES
        ('Alice Chen',        'alice.chen@example.com',       'admin',    '2025-01-15 09:30:00Z'),
        ('Bob Martinez',      'bob.martinez@example.com',     'editor',   '2025-01-22 14:15:00Z'),
        ('Carol White',       'carol.white@example.com',      'viewer',   '2025-02-03 11:00:00Z'),
        ('David Kim',         'david.kim@example.com',        'editor',   '2025-02-10 16:45:00Z'),
        ('Eva Johansson',     'eva.johansson@example.com',    'admin',    '2025-02-14 08:20:00Z'),
        ('Frank Nguyen',      'frank.nguyen@example.com',     'viewer',   '2025-03-01 13:30:00Z'),
        ('Grace Okafor',      'grace.okafor@example.com',     'editor',   '2025-03-08 10:10:00Z'),
        ('Henry Patel',       'henry.patel@example.com',      'viewer',   '2025-03-15 15:55:00Z'),
        ('Iris Tanaka',       'iris.tanaka@example.com',      'editor',   '2025-03-22 09:00:00Z'),
        ('Jack Thompson',     'jack.thompson@example.com',    'viewer',   '2025-04-01 12:30:00Z'),
        ('Karen Liu',         'karen.liu@example.com',        'admin',    '2025-04-05 17:20:00Z'),
        ('Leo Rossi',         'leo.rossi@example.com',        'viewer',   '2025-04-12 08:45:00Z'),
        ('Maria Santos',      'maria.santos@example.com',     'editor',   '2025-04-18 14:00:00Z'),
        ('Nathan Brooks',     'nathan.brooks@example.com',    'viewer',   '2025-04-25 11:30:00Z'),
        ('Olivia Schmidt',    'olivia.schmidt@example.com',   'viewer',   '2025-05-02 16:10:00Z'),
        ('Paul Dubois',       'paul.dubois@example.com',      'editor',   '2025-05-10 09:25:00Z'),
        ('Quinn Murphy',      'quinn.murphy@example.com',     'viewer',   '2025-05-17 13:40:00Z'),
        ('Rachel Cohen',      'rachel.cohen@example.com',     'admin',    '2025-05-24 10:50:00Z'),
        ('Sam Wilson',        'sam.wilson@example.com',       'viewer',   '2025-06-01 15:15:00Z'),
        ('Tina Andersson',    'tina.andersson@example.com',   'editor',   '2025-06-08 08:30:00Z'),
        ('Uma Krishnan',      'uma.krishnan@example.com',     'viewer',   '2025-06-15 12:00:00Z'),
        ('Victor Popov',      'victor.popov@example.com',     'viewer',   '2025-06-22 17:35:00Z'),
        ('Wendy Chang',       'wendy.chang@example.com',      'editor',   '2025-07-01 09:15:00Z'),
        ('Xavier Moreau',     'xavier.moreau@example.com',    'viewer',   '2025-07-08 14:50:00Z'),
        ('Yuki Watanabe',     'yuki.watanabe@example.com',    'admin',    '2025-07-15 11:05:00Z')
    `);
    console.log('Seeded 25 users');
  }

  dbReady = true;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all users (with optional search)
app.get('/api/users', async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'Database not ready' });
  }
  try {
    const search = req.query.search;
    let result;
    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      result = await pool.query(
        'SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1 ORDER BY id',
        [pattern]
      );
    } else {
      result = await pool.query('SELECT * FROM users ORDER BY id');
    }
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
