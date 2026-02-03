-- Create target_umur_material table
CREATE TABLE IF NOT EXISTS target_umur_material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number TEXT NOT NULL UNIQUE,
  jenis_barang TEXT NOT NULL,
  material TEXT NOT NULL,
  mesin TEXT NOT NULL,
  target_umur_hari INTEGER NOT NULL DEFAULT 365,
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_target_umur_part_number ON target_umur_material(part_number);
