-- Migration: Create pengadaan_rab_links table
-- Purpose: Store RAB to Pengadaan linking
-- Date: 2026-03-09

-- Table: pengadaan_rab_links
CREATE TABLE IF NOT EXISTS pengadaan_rab_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_ijin_prinsip TEXT UNIQUE NOT NULL,
  nomor_rab TEXT NOT NULL,
  linked_by TEXT,
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pengadaan_rab_links_ijin ON pengadaan_rab_links(nomor_ijin_prinsip);
CREATE INDEX IF NOT EXISTS idx_pengadaan_rab_links_rab ON pengadaan_rab_links(nomor_rab);
