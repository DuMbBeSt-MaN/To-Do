import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables from .dotenv (rename to .env later if desired)
dotenv.config({ path: '.dotenv' });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection using a single Pool
const { Pool } = pg;
const useSsl = process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

async function initializeDatabase() {
  // Basic connectivity check and table auto-create
  await pool.query('SELECT 1');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL
    );
  `);
  console.log('Database initialized');
}

// Routes
app.get('/', (_req, res) => {
  res.json({ message: 'Todo Backend API is running!' });
});

// List items
app.get('/api/items', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT id, title FROM items ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Create item
app.post('/api/items', async (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const result = await pool.query(
      'INSERT INTO items (title) VALUES ($1) RETURNING id, title',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update item
app.put('/api/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const result = await pool.query(
      'UPDATE items SET title = $1 WHERE id = $2 RETURNING id, title',
      [title, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete item
app.delete('/api/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM items WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server after DB is ready
initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
  