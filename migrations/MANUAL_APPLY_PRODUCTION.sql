-- =========================================
-- MANUAL MIGRATION FOR PRODUCTION DATABASE
-- =========================================
-- Run this SQL in Cloudflare Dashboard:
-- Dashboard → D1 → amc-material-db → Console
-- Copy and paste this entire script
-- =========================================

-- Check if columns exist before adding (SQLite doesn't have IF NOT EXISTS for columns)
-- You need to run this one by one and ignore errors if column already exists

-- 1. Add rok_percentage to rab table
ALTER TABLE rab ADD COLUMN rok_percentage REAL DEFAULT 0;

-- 2. Add harga_satuan_spk to rab_items
ALTER TABLE rab_items ADD COLUMN harga_satuan_spk INTEGER DEFAULT NULL;

-- 3. Add harga_satuan_tanpa_rok to rab_items (calculated field)
ALTER TABLE rab_items ADD COLUMN harga_satuan_tanpa_rok INTEGER DEFAULT NULL;

-- 4. Add harga_satuan_realisasi to rab_items
ALTER TABLE rab_items ADD COLUMN harga_satuan_realisasi INTEGER DEFAULT NULL;

-- 5. Add subtotal columns for each price type
ALTER TABLE rab_items ADD COLUMN subtotal_spk INTEGER DEFAULT NULL;
ALTER TABLE rab_items ADD COLUMN subtotal_tanpa_rok INTEGER DEFAULT NULL;
ALTER TABLE rab_items ADD COLUMN subtotal_realisasi INTEGER DEFAULT NULL;

-- =========================================
-- VERIFICATION QUERIES
-- =========================================
-- Run these to verify the columns were added:

-- Check rab table structure
PRAGMA table_info(rab);

-- Check rab_items table structure
PRAGMA table_info(rab_items);

-- =========================================
-- NOTES:
-- =========================================
-- If you get "duplicate column name" error, it means the column already exists (safe to ignore)
-- All columns are nullable and have default values, so existing data won't be affected
