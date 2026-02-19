-- Fix JENIS_BARANG for Part Number 1319257 (should be FILTER, not MATERIAL HANDAL)
UPDATE material_gangguan 
SET jenis_barang = 'FILTER'
WHERE part_number = '1319257' 
  AND jenis_barang = 'MATERIAL HANDAL';

-- Fix other common duplicates
UPDATE material_gangguan 
SET jenis_barang = 'FILTER'
WHERE part_number = '2020 PM' 
  AND jenis_barang = 'MATERIAL HANDAL';

-- Show affected rows
SELECT 'Updated records:' as message, COUNT(*) as count 
FROM material_gangguan 
WHERE part_number IN ('1319257', '2020 PM') 
  AND jenis_barang = 'FILTER';
