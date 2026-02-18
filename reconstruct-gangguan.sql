-- SCRIPT RECONSTRUCTION: Rebuild gangguan table from material_gangguan
-- This script reconstructs lost gangguan records from existing material_gangguan data

-- Step 1: Get all unique gangguan_id from material_gangguan with their metadata
INSERT OR REPLACE INTO gangguan (
  id,
  nomor_lh05,
  tanggal_laporan,
  jenis_gangguan,
  lokasi_gangguan,
  user_laporan,
  status,
  catatan_tindakan,
  rencana_perbaikan,
  ttd_teknisi,
  ttd_supervisor,
  created_at,
  updated_at,
  komponen_rusak,
  gejala,
  uraian_kejadian,
  analisa_penyebab,
  kesimpulan,
  beban_puncak,
  daya_mampu,
  pemadaman,
  kelompok_spd
)
SELECT DISTINCT
  mg.gangguan_id as id,
  PRINTF('%04d/ND KAL 2/LH05/2026', mg.gangguan_id) as nomor_lh05,
  DATE(mg.created_at) as tanggal_laporan,
  'RECONSTRUCTED' as jenis_gangguan,
  COALESCE(mg.unit_uld, mg.lokasi_tujuan, 'UNKNOWN') as lokasi_gangguan,
  'System Reconstruction' as user_laporan,
  'Open' as status,
  'Data reconstructed from material_gangguan table' as catatan_tindakan,
  'Pending restoration of original data' as rencana_perbaikan,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' as ttd_teknisi,
  '' as ttd_supervisor,
  mg.created_at,
  mg.updated_at,
  'Component to be identified' as komponen_rusak,
  'Symptoms to be identified' as gejala,
  'Incident details to be restored' as uraian_kejadian,
  'Root cause analysis pending' as analisa_penyebab,
  'Conclusion pending' as kesimpulan,
  0 as beban_puncak,
  0 as daya_mampu,
  'NORMAL' as pemadaman,
  'MEKANIK' as kelompok_spd
FROM material_gangguan mg
WHERE NOT EXISTS (
  SELECT 1 FROM gangguan g WHERE g.id = mg.gangguan_id
)
GROUP BY mg.gangguan_id
ORDER BY mg.gangguan_id ASC;

-- Verify reconstruction
SELECT 
  'Gangguan Reconstructed' as action,
  COUNT(*) as total_records,
  MIN(id) as min_id,
  MAX(id) as max_id,
  MIN(created_at) as earliest_date,
  MAX(created_at) as latest_date
FROM gangguan
WHERE jenis_gangguan = 'RECONSTRUCTED';
