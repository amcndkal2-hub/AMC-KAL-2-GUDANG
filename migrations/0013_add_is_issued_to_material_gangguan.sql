-- Migration: Add is_issued flag to material_gangguan table
-- Description: Track if material from LH05 has been issued/used in a transaction
-- This prevents the same LH05 material from being selected multiple times

ALTER TABLE material_gangguan ADD COLUMN is_issued INTEGER DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_material_gangguan_is_issued ON material_gangguan(is_issued);

-- 0 = Not issued yet (can be selected)
-- 1 = Already issued (cannot be selected again)
