-- Migration: Rename sn_mesin to status in materials table
-- Date: 2026-01-24
-- Purpose: Change column name from sn_mesin to status for better clarity
-- Context: 
--   - Input Manual: status = user input (manual text)
--   - Input dari RAB: status = nomor_rab (auto-filled)

-- SQLite doesn't support ALTER COLUMN RENAME directly
-- We need to create new table, copy data, drop old, rename new

-- Step 1: Create new table with 'status' column
CREATE TABLE IF NOT EXISTS materials_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  jenis_barang TEXT,
  material TEXT,
  mesin TEXT,
  status TEXT,  -- Changed from sn_mesin to status
  jumlah INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
INSERT INTO materials_new (id, transaction_id, part_number, jenis_barang, material, mesin, status, jumlah, created_at)
SELECT id, transaction_id, part_number, jenis_barang, material, mesin, sn_mesin, jumlah, created_at
FROM materials;

-- Step 3: Drop old table
DROP TABLE materials;

-- Step 4: Rename new table to materials
ALTER TABLE materials_new RENAME TO materials;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_materials_transaction_id ON materials(transaction_id);
CREATE INDEX IF NOT EXISTS idx_materials_part_number ON materials(part_number);
CREATE INDEX IF NOT EXISTS idx_materials_mesin ON materials(mesin);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
