# Manual Migration Guide for RAB History Feature

## Problem
Migration 0008 tidak bisa di-apply otomatis ke production D1 database karena authorization issue dengan Cloudflare API.

## Current Status
✅ **Fitur History sudah berfungsi dengan fallback logic**
- API akan fallback ke `created_at` dan `updated_at` jika kolom timestamp belum ada
- Timeline menampilkan minimal 2 steps: Draft (saat dibuat) + Status saat ini

## Optional: Manual Migration Steps

Jika ingin timeline yang lebih lengkap dengan timestamp yang akurat untuk setiap perubahan status, ikuti langkah berikut:

### Step 1: Access Cloudflare Dashboard

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Pilih account: **Amc.ndkal2@gmail.com's Account**
3. Klik **Workers & Pages** di sidebar
4. Pilih **D1** tab
5. Klik database **amc-material-db**

### Step 2: Run Migration SQL

Klik tab **Console** dan jalankan SQL berikut satu per satu:

```sql
-- 1. Add timestamp columns
ALTER TABLE rab ADD COLUMN tanggal_draft DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE rab ADD COLUMN tanggal_pengadaan DATETIME;
ALTER TABLE rab ADD COLUMN tanggal_tersedia DATETIME;
ALTER TABLE rab ADD COLUMN tanggal_masuk_gudang DATETIME;

-- 2. Update existing records
UPDATE rab SET tanggal_draft = created_at WHERE tanggal_draft IS NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_draft ON rab(tanggal_draft);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_pengadaan ON rab(tanggal_pengadaan);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_tersedia ON rab(tanggal_tersedia);
CREATE INDEX IF NOT EXISTS idx_rab_tanggal_masuk_gudang ON rab(tanggal_masuk_gudang);
```

### Step 3: Verify Migration

Run this query to check if columns exist:

```sql
SELECT 
  id,
  nomor_rab,
  status,
  tanggal_draft,
  tanggal_pengadaan,
  tanggal_tersedia,
  tanggal_masuk_gudang,
  created_at,
  updated_at
FROM rab
LIMIT 5;
```

**Expected Result:** Query should return all columns without error.

### Step 4: Test in Application

1. Buka aplikasi: https://c299ddeb.amc-kal-2-gudang.pages.dev
2. Login → Dashboard → List RAB
3. Klik button **History** pada RAB
4. Check response `migration_needed: false` (berarti migration sukses)

## After Migration

Setelah migration applied, sistem akan:
- ✅ Track setiap perubahan status dengan timestamp yang akurat
- ✅ Timeline menampilkan 4 steps: Draft → Pengadaan → Tersedia → Masuk Gudang
- ✅ Setiap step menampilkan tanggal & waktu yang tepat
- ✅ Audit trail lengkap untuk keperluan tracking

## Without Migration (Current State)

Tanpa migration, sistem tetap berfungsi dengan baik:
- ✅ History menampilkan 2 steps: Draft (created_at) + Current status (updated_at)
- ✅ Status tracking tetap berfungsi
- ✅ Auto-update ke "Masuk Gudang" tetap berfungsi
- ⚠️ Timestamp tidak se-akurat dengan migration (hanya ada 2 timestamp)

## Notes

- Migration **OPTIONAL** - sistem tetap berfungsi tanpa migration
- Untuk audit trail yang lebih lengkap, disarankan untuk apply migration
- Jika ada error saat apply migration, hubungi developer atau Cloudflare support

## Alternative: Use Local Database

Untuk development/testing dengan full features:

```bash
# Apply migration to local D1
cd /home/user/AMC-KAL-2-GUDANG-fix
npx wrangler d1 migrations apply amc-material-db --local

# Start local dev server
npm run build
pm2 start ecosystem.config.cjs
```

Local database akan memiliki semua kolom timestamp dan full timeline feature.
