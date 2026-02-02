-- Fix S/N Mesin untuk BA-2026-0022 (dari LH05 0038/ND KAL 2/LH05/2026)
-- S/N Mesin yang benar: 11895187

-- Update materials untuk BA-2026-0022
UPDATE materials 
SET status = '11895187'
WHERE transaction_id = (
  SELECT id FROM transactions WHERE nomor_ba = 'BA-2026-0022'
)
AND part_number IN ('LV432641', 'LV429407');

-- Verify update
SELECT 
  t.nomor_ba,
  m.part_number,
  m.material,
  m.mesin,
  m.status as sn_mesin
FROM materials m
JOIN transactions t ON m.transaction_id = t.id
WHERE t.nomor_ba = 'BA-2026-0022';
