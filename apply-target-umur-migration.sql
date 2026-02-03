-- =========================================
-- MIGRATION: Create target_umur_material table
-- Run this in Cloudflare D1 Console
-- =========================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS target_umur_material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number TEXT NOT NULL UNIQUE,
  jenis_barang TEXT NOT NULL,
  material TEXT NOT NULL,
  mesin TEXT NOT NULL,
  target_umur_hari INTEGER NOT NULL DEFAULT 365,
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_target_umur_part_number ON target_umur_material(part_number);

-- 3. Verify table created
SELECT name FROM sqlite_master WHERE type='table' AND name='target_umur_material';

-- Expected output: target_umur_material
