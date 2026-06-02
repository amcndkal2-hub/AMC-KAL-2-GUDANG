-- Migration: Add nomor_kr column to rab table
-- Date: 2026-06-02
-- Purpose: Store permanent KR (Kontrak) number per KHS RAB, only editable by admin

ALTER TABLE rab ADD COLUMN nomor_kr TEXT DEFAULT NULL;
ALTER TABLE rab ADD COLUMN nomor_kr_set_by TEXT DEFAULT NULL;
ALTER TABLE rab ADD COLUMN nomor_kr_set_at DATETIME DEFAULT NULL;
