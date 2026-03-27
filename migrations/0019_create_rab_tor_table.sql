-- Migration: Create rab_tor table as fallback for nomor_tor
-- Purpose: Store TOR numbers in separate table when column doesn't exist
-- Date: 2026-03-27

CREATE TABLE IF NOT EXISTS rab_tor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_id INTEGER NOT NULL UNIQUE,
  nomor_tor TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rab_id) REFERENCES rab(id) ON DELETE CASCADE
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_rab_tor_rab_id ON rab_tor(rab_id);
CREATE INDEX IF NOT EXISTS idx_rab_tor_nomor_tor ON rab_tor(nomor_tor);
