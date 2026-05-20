-- Create another gangguan (LH05 0999) that uses SAME material
INSERT INTO gangguan (id, nomor_lh05, tanggal_laporan, jenis_gangguan, lokasi_gangguan, user_laporan, status)
VALUES (999, '0999/ND KAL 2/LH05/2026 - OTHER UNIT', '2026-05-18', 'TROUBLE', 'OTHER UNIT', 'test_user', 'Closed');

-- Add SAME material to this other gangguan and mark as ISSUED (is_issued = 1)
INSERT INTO material_gangguan (gangguan_id, part_number, material, mesin, sn_mesin, jumlah, is_issued, created_at)
VALUES (999, 'DULAI47P1229', 'NOZZLE ELEMENT / NOZZLE INJECTOR', 'BF8M 1013 EC', '11914868', 6, 1, datetime('now'));

-- Add transaction showing this material was sent from LH05 0999
INSERT INTO transactions (
  jenis_transaksi, lokasi_tujuan, tanggal_transaksi, 
  catatan, materials, from_lh05
) VALUES (
  'Barang Keluar', 'OTHER UNIT', '2026-05-18',
  'Sent from LH05 0999',
  json('[{"partNumber":"DULAI47P1229","material":"NOZZLE ELEMENT","mesin":"BF8M 1013 EC","jumlah":6}]'),
  '0999/ND KAL 2/LH05/2026 - OTHER UNIT'
);
