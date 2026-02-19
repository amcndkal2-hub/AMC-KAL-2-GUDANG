-- Add jenis_barang column to material_gangguan table
ALTER TABLE material_gangguan ADD COLUMN jenis_barang TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_material_gangguan_jenis_barang ON material_gangguan(jenis_barang);
