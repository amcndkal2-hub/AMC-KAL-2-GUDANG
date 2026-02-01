-- Migration: Add jenis_pengeluaran column to transactions table
-- Date: 2026-02-01
-- Purpose: Store detailed basis for material issuance (e.g., "LH05 - 0022/ND KAL 2/LH05/2026")

-- Add jenis_pengeluaran column (allows NULL for backward compatibility)
ALTER TABLE transactions 
ADD COLUMN jenis_pengeluaran TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_jenis_pengeluaran 
ON transactions(jenis_pengeluaran);

-- Update existing LH05 transactions from from_lh05 column
UPDATE transactions 
SET jenis_pengeluaran = 'LH05 - ' || from_lh05 
WHERE from_lh05 IS NOT NULL 
  AND from_lh05 != '' 
  AND (jenis_pengeluaran IS NULL OR jenis_pengeluaran = '');

-- Log migration completion
SELECT 'Migration 0014 completed: jenis_pengeluaran column added' AS status;
