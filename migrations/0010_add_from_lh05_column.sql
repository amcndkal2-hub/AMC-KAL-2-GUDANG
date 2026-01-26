-- Migration: Add from_lh05 column to transactions table
-- Purpose: Track which transactions originate from LH05 (Gangguan) for automatic status update
-- Date: 2026-01-26

-- Add from_lh05 column to transactions table
ALTER TABLE transactions ADD COLUMN from_lh05 TEXT;

-- Create index for faster lookup of LH05-related transactions
CREATE INDEX IF NOT EXISTS idx_transactions_from_lh05 ON transactions(from_lh05);
