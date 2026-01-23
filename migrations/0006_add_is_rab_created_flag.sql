-- Migration: Add is_rab_created flag to material_gangguan
-- Date: 2026-01-23

-- Add column to track if material already included in RAB
ALTER TABLE material_gangguan ADD COLUMN is_rab_created INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_material_gangguan_is_rab ON material_gangguan(is_rab_created);
