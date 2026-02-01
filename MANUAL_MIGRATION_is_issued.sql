-- MANUAL MIGRATION FOR is_issued COLUMN
-- Run this SQL command in wrangler d1 console

-- For LOCAL database:
-- wrangler d1 execute webapp-production --local --command="ALTER TABLE material_gangguan ADD COLUMN is_issued INTEGER DEFAULT 0"
-- wrangler d1 execute webapp-production --local --command="CREATE INDEX IF NOT EXISTS idx_material_gangguan_is_issued ON material_gangguan(is_issued)"

-- For PRODUCTION database:
-- wrangler d1 execute webapp-production --command="ALTER TABLE material_gangguan ADD COLUMN is_issued INTEGER DEFAULT 0"
-- wrangler d1 execute webapp-production --command="CREATE INDEX IF NOT EXISTS idx_material_gangguan_is_issued ON material_gangguan(is_issued)"

-- Or apply from migration file:
-- wrangler d1 migrations apply webapp-production --local
-- wrangler d1 migrations apply webapp-production
