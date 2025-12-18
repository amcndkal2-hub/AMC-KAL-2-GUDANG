-- Sample Data for Production D1 Database
-- Execute this SQL in Cloudflare D1 Console

-- Insert sample transaction
INSERT OR IGNORE INTO transactions (nomor_ba, tanggal, jenis_transaksi, lokasi_asal, lokasi_tujuan, pemeriksa, penerima) 
VALUES ('BA-2025-001', '2025-01-15', 'Keluar', 'GUDANG KAL 2', 'BABAI', 'MUCHLIS ADITYA ANHAR', 'RIVALDO RENIER T');

-- Insert materials for the transaction
INSERT OR IGNORE INTO materials (transaction_id, part_number, jenis_barang, material, mesin, sn_mesin, jumlah) 
VALUES 
(1, '1319257', 'MATERIAL HANDAL', 'FILTER INSERT', 'F6L912', 'SN-F6L-001', 5), 
(1, '2105420', 'FILTER', 'FILTER INSERT', 'F10L413', 'SN-F10-002', 3);

-- Insert sample gangguan (disruption report)
INSERT OR IGNORE INTO gangguan (nomor_lh05, tanggal_laporan, jenis_gangguan, lokasi_gangguan, user_laporan, status) 
VALUES ('LH05-2025-001', '2025-01-15', 'Kerusakan Mesin', 'BABAI', 'Teknisi AMC', 'Open');

-- Insert materials needed for gangguan
INSERT OR IGNORE INTO material_gangguan (gangguan_id, part_number, material, mesin, jumlah, status, unit_uld, lokasi_tujuan) 
VALUES 
(1, '1319257', 'FILTER INSERT', 'F6L912', 2, 'Pengadaan', 'BABAI', 'BABAI'), 
(1, '2105420', 'FILTER INSERT', 'F10L413', 1, 'Pengadaan', 'BABAI', 'BABAI');
