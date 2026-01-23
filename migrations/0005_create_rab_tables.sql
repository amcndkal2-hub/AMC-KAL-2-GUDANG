-- Migration: Create RAB (Rencana Anggaran Biaya) tables
-- Date: 2026-01-23

-- Table: rab (RAB header/master)
CREATE TABLE IF NOT EXISTS rab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_rab TEXT UNIQUE NOT NULL,
  tanggal_rab DATE NOT NULL,
  total_harga INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: rab_items (RAB detail/items)
CREATE TABLE IF NOT EXISTS rab_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_id INTEGER NOT NULL,
  nomor_lh05 TEXT NOT NULL,
  part_number TEXT NOT NULL,
  material TEXT NOT NULL,
  mesin TEXT,
  jumlah INTEGER NOT NULL,
  unit_uld TEXT,
  harga_satuan INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rab_id) REFERENCES rab(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rab_nomor ON rab(nomor_rab);
CREATE INDEX IF NOT EXISTS idx_rab_status ON rab(status);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal ON rab(tanggal_rab);
CREATE INDEX IF NOT EXISTS idx_rab_items_rab_id ON rab_items(rab_id);
CREATE INDEX IF NOT EXISTS idx_rab_items_part_number ON rab_items(part_number);
CREATE INDEX IF NOT EXISTS idx_rab_items_nomor_lh05 ON rab_items(nomor_lh05);
