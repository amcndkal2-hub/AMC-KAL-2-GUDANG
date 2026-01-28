-- Migration: Add jenis_rab column to rab table
-- Purpose: Store RAB type (KHS, SPK, Pembelian Langsung)
-- Date: 2026-01-28

-- Add jenis_rab column
ALTER TABLE rab ADD COLUMN jenis_rab TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_rab_jenis ON rab(jenis_rab);
