-- Migration: Add from_lh05 and jenis_pengeluaran columns to transactions table
-- Date: 2026-02-01
-- Purpose: Track LH05 source and display proper basis for material issuance

-- Step 1: Add from_lh05 column (stores LH05 number like "0022/ND KAL 2/LH05/2026")
ALTER TABLE transactions 
ADD COLUMN from_lh05 TEXT;

-- Step 2: Add jenis_pengeluaran column (stores full text like "LH05 - 0022/ND KAL 2/LH05/2026")
ALTER TABLE transactions 
ADD COLUMN jenis_pengeluaran TEXT;

-- Step 3: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_from_lh05 
ON transactions(from_lh05);

CREATE INDEX IF NOT EXISTS idx_transactions_jenis_pengeluaran 
ON transactions(jenis_pengeluaran);

-- Step 4: Log migration completion
SELECT 'Migration 0015 completed: from_lh05 and jenis_pengeluaran columns added' AS status;
