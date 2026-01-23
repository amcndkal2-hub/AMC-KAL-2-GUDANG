-- Migration: Add material_gangguan_id to rab_items
-- Date: 2026-01-23

-- Add material_gangguan_id to link RAB items with material_gangguan records
ALTER TABLE rab_items ADD COLUMN material_gangguan_id INTEGER;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_rab_items_material_gangguan_id ON rab_items(material_gangguan_id);
