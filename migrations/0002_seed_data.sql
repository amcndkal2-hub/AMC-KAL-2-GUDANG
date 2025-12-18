-- Migration: Seed Data (Optional - for testing)
-- Date: 2025-12-18
-- Description: Insert sample data for testing purposes

-- Sample Transaction
INSERT OR IGNORE INTO transactions (nomor_ba, tanggal, jenis_transaksi, lokasi_asal, lokasi_tujuan, pemeriksa, penerima)
VALUES ('BA-2025-001', '2025-01-15', 'Keluar', 'GUDANG KAL 2', 'BABAI', 'MUCHLIS ADITYA ANHAR', 'RIVALDO RENIER T');

-- Sample Materials for transaction
INSERT OR IGNORE INTO materials (transaction_id, part_number, jenis_barang, material, mesin, sn_mesin, jumlah)
VALUES 
  (1, '1319257', 'MATERIAL HANDAL', 'FILTER INSERT', 'F6L912', 'SN-F6L-001', 5),
  (1, '2105420', 'FILTER', 'FILTER INSERT', 'F10L413', 'SN-F10-002', 3);

-- Sample Gangguan
INSERT OR IGNORE INTO gangguan (nomor_lh05, tanggal_laporan, jenis_gangguan, lokasi_gangguan, user_laporan, status)
VALUES ('LH05-2025-001', '2025-01-15', 'Kerusakan Mesin', 'BABAI', 'Teknisi AMC', 'Open');

-- Sample Material Gangguan
INSERT OR IGNORE INTO material_gangguan (gangguan_id, part_number, material, mesin, jumlah, status, unit_uld, lokasi_tujuan)
VALUES 
  (1, '1319257', 'FILTER INSERT', 'F6L912', 2, 'Pengadaan', 'BABAI', 'BABAI'),
  (1, '2105420', 'FILTER INSERT', 'F10L413', 1, 'Pengadaan', 'BABAI', 'BABAI');
