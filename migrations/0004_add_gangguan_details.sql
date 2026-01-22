-- Migration: Add missing columns to gangguan table for Form Gangguan LH05
-- Date: 2026-01-22

-- Add columns for komponen dan kejadian details
ALTER TABLE gangguan ADD COLUMN komponen_rusak TEXT;
ALTER TABLE gangguan ADD COLUMN gejala TEXT;
ALTER TABLE gangguan ADD COLUMN uraian_kejadian TEXT;
ALTER TABLE gangguan ADD COLUMN analisa_penyebab TEXT;
ALTER TABLE gangguan ADD COLUMN kesimpulan TEXT;

-- Add columns for beban listrik
ALTER TABLE gangguan ADD COLUMN beban_puncak REAL;
ALTER TABLE gangguan ADD COLUMN daya_mampu REAL;
ALTER TABLE gangguan ADD COLUMN pemadaman TEXT;

-- Add column for kelompok SPD (MEKANIK/ELEKTRIK/INSTRUMENT)
ALTER TABLE gangguan ADD COLUMN kelompok_spd TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gangguan_kelompok_spd ON gangguan(kelompok_spd);
CREATE INDEX IF NOT EXISTS idx_gangguan_komponen_rusak ON gangguan(komponen_rusak);
