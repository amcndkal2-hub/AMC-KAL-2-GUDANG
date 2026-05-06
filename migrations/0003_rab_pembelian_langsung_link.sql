-- Create table for linking RAB SPK with RAB Pembelian Langsung
CREATE TABLE IF NOT EXISTS rab_pembelian_langsung_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_spk_id INTEGER NOT NULL,
  rab_pembelian_langsung_id INTEGER NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rab_spk_id) REFERENCES rab(id) ON DELETE CASCADE,
  FOREIGN KEY (rab_pembelian_langsung_id) REFERENCES rab(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rab_spk_id ON rab_pembelian_langsung_link(rab_spk_id);
CREATE INDEX IF NOT EXISTS idx_rab_pembelian_langsung_id ON rab_pembelian_langsung_link(rab_pembelian_langsung_id);
