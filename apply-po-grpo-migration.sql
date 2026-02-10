-- ========================================
-- Manual Migration: Add No PO and GRPO columns
-- Date: 2026-02-10
-- Execute this in Cloudflare D1 Console:
-- https://dash.cloudflare.com → D1 → amc-material-db → Console
-- ========================================

-- Step 1: Check if columns exist (optional - for verification)
PRAGMA table_info(material_gangguan);

-- Step 2: Add no_po column (if not exists)
ALTER TABLE material_gangguan ADD COLUMN no_po TEXT;

-- Step 3: Add no_grpo column (if not exists)
ALTER TABLE material_gangguan ADD COLUMN no_grpo TEXT;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_material_gangguan_no_po ON material_gangguan(no_po);
CREATE INDEX IF NOT EXISTS idx_material_gangguan_no_grpo ON material_gangguan(no_grpo);

-- Step 5: Verify columns added (optional)
PRAGMA table_info(material_gangguan);

-- Expected output should include:
-- ...
-- | no_po | TEXT | 0 | null | 0 |
-- | no_grpo | TEXT | 0 | null | 0 |
-- ...

SELECT 'Migration complete: no_po and no_grpo columns added to material_gangguan table' AS status;
