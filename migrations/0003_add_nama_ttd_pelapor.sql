-- Add nama_pelapor and ttd_pelapor columns to gangguan table
ALTER TABLE gangguan ADD COLUMN nama_pelapor TEXT;
ALTER TABLE gangguan ADD COLUMN ttd_pelapor TEXT;
