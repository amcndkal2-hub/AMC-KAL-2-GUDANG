# 🔧 URGENT: Database Migration Required

## ⚠️ Current Issue

**Error:** `D1_ERROR: no such column: rok_percentage: SQLITE_ERROR`

**Status:** ❌ Production database missing new columns

**Impact:** Cannot save ROK percentage or edit SPK/Realisasi prices

## ✅ Quick Fix (5 minutes)

### Step 1: Login to Cloudflare Dashboard
https://dash.cloudflare.com/

### Step 2: Navigate to D1 Database
1. Click on your account
2. Go to: **Workers & Pages** → **D1**
3. Select: **amc-material-db**
4. Click: **Console** tab

### Step 3: Copy & Run This SQL

```sql
-- Run these commands ONE BY ONE in the Console:

ALTER TABLE rab ADD COLUMN rok_percentage REAL DEFAULT 0;

ALTER TABLE rab_items ADD COLUMN harga_satuan_spk INTEGER DEFAULT NULL;

ALTER TABLE rab_items ADD COLUMN harga_satuan_tanpa_rok INTEGER DEFAULT NULL;

ALTER TABLE rab_items ADD COLUMN harga_satuan_realisasi INTEGER DEFAULT NULL;

ALTER TABLE rab_items ADD COLUMN subtotal_spk INTEGER DEFAULT NULL;

ALTER TABLE rab_items ADD COLUMN subtotal_tanpa_rok INTEGER DEFAULT NULL;

ALTER TABLE rab_items ADD COLUMN subtotal_realisasi INTEGER DEFAULT NULL;
```

**Note:** If you get "duplicate column name" error, it means the column already exists (safe to ignore).

### Step 4: Verify

```sql
-- Check rab table has rok_percentage:
PRAGMA table_info(rab);

-- Check rab_items has new columns:
PRAGMA table_info(rab_items);
```

### Step 5: Test in Application

1. Refresh your browser
2. Open Detail RAB
3. Input ROK percentage (e.g., 25)
4. Click "Save ROK"
5. Should work! ✅

## 📋 What These Columns Do

| Column | Table | Purpose | Example |
|--------|-------|---------|---------|
| rok_percentage | rab | ROK % for entire RAB | 25 (means 25%) |
| harga_satuan_spk | rab_items | Manual input SPK price | 100000 |
| harga_satuan_tanpa_rok | rab_items | Auto-calculated | 80000 (= 100000/1.25) |
| harga_satuan_realisasi | rab_items | Manual input realisasi price | 95000 |
| subtotal_spk | rab_items | Qty × SPK price | 200000 |
| subtotal_tanpa_rok | rab_items | Qty × Tanpa ROK price | 160000 |
| subtotal_realisasi | rab_items | Qty × Realisasi price | 190000 |

## 🎯 Formula

**ROK is MARKUP (kenaikan), not discount:**

```
Harga SPK = Rp 100
ROK = 25%
Formula: Harga Tanpa ROK = SPK / (1 + ROK%)
Result: Harga Tanpa ROK = 100 / 1.25 = Rp 80 ✅

Verification:
Tanpa ROK × (1 + ROK%) = 80 × 1.25 = 100 ✅
```

## 📞 Support

**Files to reference:**
- `MIGRATION_INSTRUCTIONS.md` - Detailed guide
- `migrations/MANUAL_APPLY_PRODUCTION.sql` - SQL script
- `migrations/0010_add_rok_and_price_columns.sql` - Original migration

**Still having issues?**
- Verify you're in the correct database: `amc-material-db`
- Check Cloudflare Dashboard → D1 → Tables
- Ensure you have write permissions

## 🚀 After Migration

**New features will work:**
1. ✅ Input ROK percentage
2. ✅ Edit Harga Satuan SPK (auto-calculates Tanpa ROK)
3. ✅ Edit Harga Satuan Realisasi
4. ✅ View all 4 price types side-by-side
5. ✅ Harga RAB read-only in Realisasi Bayar page

**Production URL:**
https://54155ccf.amc-kal-2-gudang.pages.dev/dashboard/list-tor

---

**Last Updated:** 2025-04-23
**Deployment:** https://54155ccf.amc-kal-2-gudang.pages.dev
**Git Commit:** 523333d
