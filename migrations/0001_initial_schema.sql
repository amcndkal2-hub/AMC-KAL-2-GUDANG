-- Migration: Initial Schema for Material Management System
-- Date: 2025-12-18
-- Description: Create tables for transactions, materials, gangguan, and material_gangguan

-- =====================================================
-- TABLE: transactions
-- Purpose: Store material transaction records (BA)
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_ba TEXT UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  jenis_transaksi TEXT NOT NULL,
  lokasi_asal TEXT NOT NULL,
  lokasi_tujuan TEXT NOT NULL,
  pemeriksa TEXT NOT NULL,
  penerima TEXT NOT NULL,
  ttd_pemeriksa TEXT,
  ttd_penerima TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: materials
-- Purpose: Store material details for each transaction
-- =====================================================
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  jenis_barang TEXT,
  material TEXT,
  mesin TEXT,
  sn_mesin TEXT,
  jumlah INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLE: gangguan
-- Purpose: Store disruption reports (LH05)
-- =====================================================
CREATE TABLE IF NOT EXISTS gangguan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_lh05 TEXT UNIQUE NOT NULL,
  tanggal_laporan DATE NOT NULL,
  jenis_gangguan TEXT NOT NULL,
  lokasi_gangguan TEXT NOT NULL,
  user_laporan TEXT NOT NULL,
  status TEXT DEFAULT 'Open',
  catatan_tindakan TEXT,
  rencana_perbaikan TEXT,
  ttd_teknisi TEXT,
  ttd_supervisor TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: material_gangguan
-- Purpose: Store material requirements for each disruption
-- =====================================================
CREATE TABLE IF NOT EXISTS material_gangguan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gangguan_id INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  material TEXT,
  mesin TEXT,
  jumlah INTEGER NOT NULL,
  status TEXT DEFAULT 'Pengadaan',
  unit_uld TEXT,
  lokasi_tujuan TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gangguan_id) REFERENCES gangguan(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_nomor_ba ON transactions(nomor_ba);
CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON transactions(tanggal);
CREATE INDEX IF NOT EXISTS idx_transactions_jenis ON transactions(jenis_transaksi);
CREATE INDEX IF NOT EXISTS idx_transactions_lokasi_asal ON transactions(lokasi_asal);
CREATE INDEX IF NOT EXISTS idx_transactions_lokasi_tujuan ON transactions(lokasi_tujuan);

-- Indexes for materials table
CREATE INDEX IF NOT EXISTS idx_materials_transaction_id ON materials(transaction_id);
CREATE INDEX IF NOT EXISTS idx_materials_part_number ON materials(part_number);
CREATE INDEX IF NOT EXISTS idx_materials_mesin ON materials(mesin);

-- Indexes for gangguan table
CREATE INDEX IF NOT EXISTS idx_gangguan_nomor_lh05 ON gangguan(nomor_lh05);
CREATE INDEX IF NOT EXISTS idx_gangguan_tanggal ON gangguan(tanggal_laporan);
CREATE INDEX IF NOT EXISTS idx_gangguan_status ON gangguan(status);
CREATE INDEX IF NOT EXISTS idx_gangguan_lokasi ON gangguan(lokasi_gangguan);

-- Indexes for material_gangguan table
CREATE INDEX IF NOT EXISTS idx_material_gangguan_gangguan_id ON material_gangguan(gangguan_id);
CREATE INDEX IF NOT EXISTS idx_material_gangguan_part_number ON material_gangguan(part_number);
CREATE INDEX IF NOT EXISTS idx_material_gangguan_status ON material_gangguan(status);

-- =====================================================
-- TRIGGERS for automatic updated_at timestamp
-- =====================================================

-- Trigger for transactions table
CREATE TRIGGER IF NOT EXISTS transactions_updated_at 
AFTER UPDATE ON transactions
BEGIN
  UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for gangguan table
CREATE TRIGGER IF NOT EXISTS gangguan_updated_at 
AFTER UPDATE ON gangguan
BEGIN
  UPDATE gangguan SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for material_gangguan table
CREATE TRIGGER IF NOT EXISTS material_gangguan_updated_at 
AFTER UPDATE ON material_gangguan
BEGIN
  UPDATE material_gangguan SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
