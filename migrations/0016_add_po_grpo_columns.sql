-- Migration: Add No PO and GRPO columns to material_gangguan
-- Date: 2026-02-03

-- Add no_po column
ALTER TABLE material_gangguan ADD COLUMN no_po TEXT;

-- Add no_grpo column
ALTER TABLE material_gangguan ADD COLUMN no_grpo TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_material_gangguan_no_po ON material_gangguan(no_po);
CREATE INDEX IF NOT EXISTS idx_material_gangguan_no_grpo ON material_gangguan(no_grpo);
