-- Create test data for LH05 0453
INSERT INTO gangguan (id, nomor_lh05, tanggal_laporan, jenis_gangguan, lokasi_gangguan, user_laporan, status)
VALUES (453, '0453/ND KAL 2/LH05/2026 - TUMPUNG LAUNG (1 material)', '2026-05-19', 'TROUBLE', 'TUMPUNG LAUNG', 'test_user', 'Open');

-- Add material to this gangguan (NOT YET ISSUED - is_issued = 0)
INSERT INTO material_gangguan (gangguan_id, part_number, material, mesin, sn_mesin, jumlah, is_issued, created_at)
VALUES (453, 'DULAI47P1229', 'NOZZLE ELEMENT / NOZZLE INJECTOR', 'BF8M 1013 EC', '11914868', 6, 0, datetime('now'));
