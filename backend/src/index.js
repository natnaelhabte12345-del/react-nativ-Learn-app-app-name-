require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db, init } = require('./db');

const app = express();
const port = process.env.PORT || 3333;
app.use(cors());
app.use(bodyParser.json());

init();

app.get('/health', (req, res) => res.json({ ok: true }));

// Users
app.get('/users', (req, res) => {
  const stmt = db.prepare('SELECT id, clerk_id as clerkId, email, created_at as createdAt FROM users');
  const rows = stmt.all();
  res.json(rows);
});

app.post('/users', (req, res) => {
  const { clerkId, email } = req.body;
  if (!clerkId) return res.status(400).json({ error: 'clerkId required' });
  const insert = db.prepare('INSERT OR IGNORE INTO users (clerk_id, email) VALUES (?, ?)');
  const info = insert.run(clerkId, email || null);
  const user = db.prepare('SELECT id, clerk_id as clerkId, email, created_at as createdAt FROM users WHERE clerk_id = ?').get(clerkId);
  res.json(user);
});

// Progress
app.get('/progress', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const stmt = db.prepare('SELECT id, lesson_id as lessonId, completed, xp, last_modified as lastModified FROM progress WHERE user_id = ?');
  const rows = stmt.all(userId);
  res.json(rows);
});

app.post('/progress', (req, res) => {
  const { userId, lessonId, completed = false, xp = 0 } = req.body;
  if (!userId || !lessonId) return res.status(400).json({ error: 'userId and lessonId required' });

  const upsert = db.prepare(`
    INSERT INTO progress (user_id, lesson_id, completed, xp, last_modified)
    VALUES (?, ?, ?, ?, (strftime('%s','now')))
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET
      completed = excluded.completed,
      xp = excluded.xp,
      last_modified = excluded.last_modified
  `);

  // better-sqlite3 doesn't support excluded.* in older versions; fallback to manual upsert
  try {
    upsert.run(userId, lessonId, completed ? 1 : 0, xp);
  } catch (e) {
    const exists = db.prepare('SELECT id FROM progress WHERE user_id = ? AND lesson_id = ?').get(userId, lessonId);
    if (exists) {
      db.prepare('UPDATE progress SET completed = ?, xp = ?, last_modified = (strftime("%s","now")) WHERE id = ?').run(completed ? 1 : 0, xp, exists.id);
    } else {
      db.prepare('INSERT INTO progress (user_id, lesson_id, completed, xp, last_modified) VALUES (?, ?, ?, ?, (strftime("%s","now")))').run(userId, lessonId, completed ? 1 : 0, xp);
    }
  }

  const row = db.prepare('SELECT id, lesson_id as lessonId, completed, xp, last_modified as lastModified FROM progress WHERE user_id = ? AND lesson_id = ?').get(userId, lessonId);
  res.json(row);
});

app.listen(port, () => {
  console.log(`Backend sketch running on http://localhost:${port}`);
});
