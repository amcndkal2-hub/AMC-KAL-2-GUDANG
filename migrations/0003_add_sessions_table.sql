-- Migration untuk menambahkan tabel sessions
-- File: migrations/0003_add_sessions_table.sql

-- Create sessions table untuk persistent session storage
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- Index untuk query berdasarkan username
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);

-- Index untuk query berdasarkan expires_at (untuk cleanup expired sessions)
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
