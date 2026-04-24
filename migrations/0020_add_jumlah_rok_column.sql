-- Migration: Add jumlah_rok column to rab_items
-- Date: 2026-04-24
-- Description: Add jumlah_rok column for separate ROK quantity calculation

-- Add jumlah_rok column (defaults to NULL, will be set equal to jumlah in application)
ALTER TABLE rab_items ADD COLUMN jumlah_rok INTEGER DEFAULT NULL;

-- Update existing records: set jumlah_rok = jumlah for all existing items
UPDATE rab_items SET jumlah_rok = jumlah WHERE jumlah_rok IS NULL;
