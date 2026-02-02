-- Fix S/N Mesin untuk SEMUA BA yang berasal dari LH05
-- Script ini akan update semua materials yang:
-- 1. Berasal dari transaction dengan from_lh05 tidak null
-- 2. S/N Mesin masih N/A
-- 3. Ada S/N Mesin di material_gangguan

-- Untuk BA-2026-0022 specifically (LH05: 0038/ND KAL 2/LH05/2026)
-- Manual fix karena kita tahu S/N Mesin-nya: 11895187

UPDATE materials 
SET status = '11895187'
WHERE transaction_id = (
  SELECT id FROM transactions WHERE nomor_ba = 'BA-2026-0022'
)
AND (status = 'N/A' OR status = '' OR status IS NULL)
AND part_number IN ('LV432641', 'LV429407');

-- Verify semua BA dari LH05 dengan S/N Mesin
SELECT 
  t.nomor_ba,
  t.from_lh05,
  m.part_number,
  m.material,
  m.mesin,
  m.status as sn_mesin,
  m.jumlah
FROM transactions t
JOIN materials m ON t.id = m.transaction_id
WHERE t.from_lh05 IS NOT NULL
  AND t.from_lh05 != ''
ORDER BY t.created_at DESC, m.part_number;
