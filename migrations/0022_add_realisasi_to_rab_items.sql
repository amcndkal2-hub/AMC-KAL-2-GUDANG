-- Migration: Add realisasi column to rab_items table
-- Date: 2026-01-24
-- Purpose: Store realisasi value for each RAB item in REALISASI page

-- Add realisasi column to rab_items
ALTER TABLE rab_items ADD COLUMN realisasi INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_rab_items_realisasi ON rab_items(realisasi);
