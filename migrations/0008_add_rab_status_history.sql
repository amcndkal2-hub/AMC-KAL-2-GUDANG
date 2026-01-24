-- Migration: Add status history timestamp fields to RAB table
-- Date: 2026-01-24
-- Purpose: Track RAB status changes (Draft → Pengadaan → Tersedia → Masuk Gudang)

-- Add timestamp columns for status transitions
ALTER TABLE rab ADD COLUMN tanggal_draft DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE rab ADD COLUMN tanggal_pengadaan DATETIME;
ALTER TABLE rab ADD COLUMN tanggal_tersedia DATETIME;
ALTER TABLE rab ADD COLUMN tanggal_masuk_gudang DATETIME;

-- Update existing records: set tanggal_draft = created_at
UPDATE rab SET tanggal_draft = created_at WHERE tanggal_draft IS NULL;

-- Create index for status history queries
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_draft ON rab(tanggal_draft);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_pengadaan ON rab(tanggal_pengadaan);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_tersedia ON rab(tanggal_tersedia);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_masuk_gudang ON rab(tanggal_masuk_gudang);
