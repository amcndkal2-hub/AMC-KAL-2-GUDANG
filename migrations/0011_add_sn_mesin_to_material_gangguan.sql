-- Migration: Add sn_mesin column to material_gangguan table
-- Purpose: Store serial number for each material in LH05 form

ALTER TABLE material_gangguan ADD COLUMN sn_mesin TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_material_gangguan_sn_mesin ON material_gangguan(sn_mesin);
