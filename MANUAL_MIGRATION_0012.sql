-- ========================================
-- MANUAL MIGRATION: Add jenis_rab Column
-- ========================================
-- File: 0012_add_jenis_rab_column.sql
-- Purpose: Store RAB type (KHS, SPK, Pembelian Langsung)
-- Date: 2026-01-28
--
-- INSTRUCTIONS:
-- 1. Login to Cloudflare Dashboard
-- 2. Go to: Workers & Pages > D1 Databases
-- 3. Select: amc-material-db
-- 4. Click: "Console" tab
-- 5. Copy paste SQL below and click "Execute"
-- ========================================

-- Add jenis_rab column
ALTER TABLE rab ADD COLUMN jenis_rab TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_rab_jenis ON rab(jenis_rab);

-- Verify column added
PRAGMA table_info(rab);

-- ========================================
-- Expected Output:
-- ========================================
-- Column list should include:
-- - id
-- - nomor_rab
-- - tanggal_rab
-- - jenis_rab  <-- NEW COLUMN
-- - total_harga
-- - status
-- - created_by
-- - created_at
-- - updated_at
-- ========================================
