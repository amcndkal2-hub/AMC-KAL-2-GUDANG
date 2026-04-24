# Manual Database Migration Instructions

## Problem
Error: `D1_ERROR: no such column: rok_percentage: SQLITE_ERROR`

This error occurs because the production database is missing the new columns added in migration `0010_add_rok_and_price_columns.sql`.

## Solution

### Option 1: Cloudflare Dashboard (RECOMMENDED)

1. **Login to Cloudflare Dashboard**
   - Go to: https://dash.cloudflare.com/

2. **Navigate to D1 Database**
   - Click on your account
   - Go to: **Workers & Pages** → **D1**
   - Select database: **amc-material-db**

3. **Open Console**
   - Click on **Console** tab

4. **Run Migration SQL**
   - Copy the entire SQL script from `migrations/MANUAL_APPLY_PRODUCTION.sql`
   - Paste into the console
   - Click **Execute**
   - Run each ALTER TABLE statement one by one

5. **Verify**
   ```sql
   -- Check rab table
   PRAGMA table_info(rab);
   
   -- Check rab_items table
   PRAGMA table_info(rab_items);
   ```

### Option 2: Wrangler CLI (if you have proper API key)

```bash
# Apply migration to remote database
npx wrangler d1 migrations apply amc-material-db --remote
```

**Note:** This requires proper Cloudflare API token with D1 write permissions.

## Columns Added

### Table: `rab`
- `rok_percentage` REAL DEFAULT 0

### Table: `rab_items`
- `harga_satuan_spk` INTEGER DEFAULT NULL
- `harga_satuan_tanpa_rok` INTEGER DEFAULT NULL
- `harga_satuan_realisasi` INTEGER DEFAULT NULL
- `subtotal_spk` INTEGER DEFAULT NULL
- `subtotal_tanpa_rok` INTEGER DEFAULT NULL
- `subtotal_realisasi` INTEGER DEFAULT NULL

## Testing After Migration

1. **Test ROK Input**
   - Open Detail RAB
   - Input ROK percentage (e.g., 25)
   - Click "Save ROK"
   - Should succeed ✅

2. **Test SPK Price Edit**
   - Click on Harga Satuan SPK
   - Input new price (e.g., 100000)
   - Should auto-calculate Harga Tanpa ROK ✅

3. **Test Realisasi Price Edit**
   - Click on Harga Satuan Realisasi
   - Input new price
   - Should succeed ✅

## Troubleshooting

**Error: "duplicate column name"**
- This is normal if the column already exists
- Safe to ignore and continue with next statement

**Error: "table rab has no column named rok_percentage"**
- The ALTER TABLE didn't run successfully
- Try running the statement again
- Check that you're connected to the correct database

**Still getting errors after migration?**
- Verify columns exist: `PRAGMA table_info(rab);`
- Check Cloudflare Dashboard → D1 → amc-material-db → Tables
- Contact support if issue persists
