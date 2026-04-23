-- Migration: Add ROK percentage and additional price columns
-- Date: 2025-04-23

-- Add rok_percentage to rab table (in percentage, e.g., 25 for 25%)
ALTER TABLE rab ADD COLUMN rok_percentage REAL DEFAULT 0;

-- Add harga_satuan_spk to rab_items
ALTER TABLE rab_items ADD COLUMN harga_satuan_spk INTEGER DEFAULT NULL;

-- Add harga_satuan_tanpa_rok to rab_items (calculated field)
ALTER TABLE rab_items ADD COLUMN harga_satuan_tanpa_rok INTEGER DEFAULT NULL;

-- Add harga_satuan_realisasi to rab_items
ALTER TABLE rab_items ADD COLUMN harga_satuan_realisasi INTEGER DEFAULT NULL;

-- Add subtotal columns for each price type
ALTER TABLE rab_items ADD COLUMN subtotal_spk INTEGER DEFAULT NULL;
ALTER TABLE rab_items ADD COLUMN subtotal_tanpa_rok INTEGER DEFAULT NULL;
ALTER TABLE rab_items ADD COLUMN subtotal_realisasi INTEGER DEFAULT NULL;
