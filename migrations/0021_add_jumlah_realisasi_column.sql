-- Migration: Add jumlah_realisasi column to rab_items
-- Date: 2026-04-24
-- Description: Add jumlah_realisasi column for separate Realisasi quantity calculation

-- Add jumlah_realisasi column (defaults to NULL, will be set equal to jumlah in application)
ALTER TABLE rab_items ADD COLUMN jumlah_realisasi INTEGER DEFAULT NULL;

-- Update existing records: set jumlah_realisasi = jumlah for all existing items
UPDATE rab_items SET jumlah_realisasi = jumlah WHERE jumlah_realisasi IS NULL;
