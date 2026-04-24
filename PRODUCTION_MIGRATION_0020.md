# 🚨 URGENT: Production Database Migration Required

## Migration: Add `jumlah_rok` Column

**Date**: 2026-04-24  
**Feature**: Jumlah ROK - Editable quantity for Tanpa ROK calculation

---

## ⚠️ What Changed?

Added a new column `jumlah_rok` to table `rab_items` to support separate quantity calculation for "Harga Tanpa ROK".

### Example:
- **Jumlah** (original qty) = 12
- **Jumlah ROK** (editable) = 10
- **Harga Tanpa ROK** = Rp 50,000
- **Subtotal Tanpa ROK** = 50,000 × **10** = Rp 500,000 ✅

---

## 📋 Migration Steps

### 1. Open Cloudflare Dashboard
Go to: https://dash.cloudflare.com/

### 2. Navigate to D1 Database
- Click **Workers & Pages** (left sidebar)
- Click **D1** tab
- Select database: **amc-material-db**

### 3. Open Console Tab
Click the **Console** tab at the top

### 4. Run Migration SQL

Copy and paste the following SQL commands **ONE BY ONE**:

```sql
-- Add jumlah_rok column
ALTER TABLE rab_items ADD COLUMN jumlah_rok INTEGER DEFAULT NULL;
```

**Expected**: ✅ Query executed successfully

```sql
-- Set default values: jumlah_rok = jumlah for all existing records
UPDATE rab_items SET jumlah_rok = jumlah WHERE jumlah_rok IS NULL;
```

**Expected**: ✅ Query executed successfully (X rows affected)

### 5. Verify Migration

```sql
-- Check if column exists
PRAGMA table_info(rab_items);
```

**Expected**: You should see a row with `name = jumlah_rok`, `type = INTEGER`

```sql
-- Verify data
SELECT id, jumlah, jumlah_rok FROM rab_items LIMIT 5;
```

**Expected**: All rows should have `jumlah_rok` equal to `jumlah`

---

## ✅ After Migration

1. **Refresh** your browser on the application
2. **Open Detail RAB** (Daftar Realisasi Bayar)
3. **Check** new column "Qty ROK" is visible
4. **Test** editing Qty ROK (click cell → input new value → save)

---

## 🔄 Rollback (If Needed)

If something goes wrong:

```sql
-- Remove column (data will be lost!)
ALTER TABLE rab_items DROP COLUMN jumlah_rok;
```

**⚠️ Warning**: This will delete all jumlah_rok data!

---

## 📞 Support

If migration fails:
- Check error message
- Verify you're on the correct database (amc-material-db)
- Ensure you have write permissions
- Contact system administrator

---

## 🎯 Migration Status

- [ ] Migration SQL executed
- [ ] Verification queries passed
- [ ] Application tested
- [ ] Feature confirmed working

**Date Completed**: _____________  
**Completed By**: _____________
