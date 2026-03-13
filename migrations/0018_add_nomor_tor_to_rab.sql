-- Migration: Add nomor_tor column to rab table
-- Purpose: Allow storing TOR (Term of Reference) number
-- Date: 2026-03-13

-- Add nomor_tor column (nullable)
ALTER TABLE rab ADD COLUMN nomor_tor TEXT;

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_rab_nomor_tor ON rab(nomor_tor);
