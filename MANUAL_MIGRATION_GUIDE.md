# 🔧 URGENT FIX: Jenis RAB Tidak Tersimpan

## 🔍 **Root Cause**

Migration `0012_add_jenis_rab_column.sql` **belum dijalankan** di production database.

Production DB masih **TIDAK PUNYA** kolom `jenis_rab`, sehingga:
- ✅ Frontend mengirim `jenis_rab`
- ✅ Backend menerima `jenis_rab`
- ❌ Database INSERT gagal → fallback INSERT tanpa `jenis_rab`
- ❌ Data `jenis_rab` tidak tersimpan

---

## ✅ **Solusi: Run Manual Migration**

### **Step 1: Login ke Cloudflare Dashboard**
1. Buka: https://dash.cloudflare.com
2. Login dengan akun Anda

### **Step 2: Buka D1 Database Console**
1. Sidebar kiri → Click **"Workers & Pages"**
2. Top tabs → Click **"D1 SQL Database"**
3. Database list → Click **"amc-material-db"**
4. Top tabs → Click **"Console"** (ikon terminal)

### **Step 3: Execute Migration SQL**

Copy SQL berikut dan paste di console, lalu click **"Execute"**:

```sql
-- Add jenis_rab column
ALTER TABLE rab ADD COLUMN jenis_rab TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_rab_jenis ON rab(jenis_rab);

-- Verify column added
PRAGMA table_info(rab);
```

### **Step 4: Verify Output**

Setelah execute, Anda harus melihat output table_info yang include:

```
cid | name         | type    | notnull | dflt_value | pk
----|--------------|---------|---------|------------|----
0   | id           | INTEGER | 0       |            | 1
1   | nomor_rab    | TEXT    | 1       |            | 0
2   | tanggal_rab  | DATE    | 1       |            | 0
3   | jenis_rab    | TEXT    | 0       |            | 0  <-- NEW!
4   | total_harga  | INTEGER | 1       |            | 0
5   | status       | TEXT    | 0       | Draft      | 0
6   | created_by   | TEXT    | 0       |            | 0
7   | created_at   | DATETIME| 0       | ...        | 0
8   | updated_at   | DATETIME| 0       | ...        | 0
```

**✅ Jika `jenis_rab` muncul → Migration SUCCESS!**

---

## 🧪 **Testing Setelah Migration**

### **Test 1: Create RAB Baru**
1. Buka: https://b9073eaa.amc-kal-2-gudang.pages.dev/dashboard/create-rab
2. Isi form:
   - Tanggal RAB
   - **Jenis RAB: KHS** (Kontrak Harga Satuan)
   - Pilih material
   - Isi harga
3. Click "Create RAB"
4. View Detail RAB
5. **Expected**: Jenis RAB: KHS (Kontrak Harga Satuan) ✅

### **Test 2: Verify Database**

Di D1 Console, run:
```sql
SELECT nomor_rab, jenis_rab, tanggal_rab FROM rab ORDER BY created_at DESC LIMIT 5;
```

**Expected Output:**
```
nomor_rab      | jenis_rab | tanggal_rab
---------------|-----------|-------------
RAB-2026-0003  | KHS       | 2026-01-28   <-- NEW RAB
RAB-2026-0002  | NULL      | 2026-01-28   <-- OLD RAB
RAB-2026-0001  | NULL      | 2026-01-28   <-- OLD RAB
```

---

## ❓ **Troubleshooting**

### **Problem 1: "No such column: jenis_rab"**
**Solution:** Migration belum dijalankan. Ulangi Step 3.

### **Problem 2: "Table already has column jenis_rab"**
**Solution:** Migration sudah pernah dijalankan. Skip ke Testing.

### **Problem 3: Jenis RAB Masih NULL Setelah Migration**
**Possible Causes:**
1. Cache browser → Clear cache & reload
2. Old RAB → Buat RAB baru untuk test

---

## 📞 **Need Help?**

Jika migration gagal atau ada error, screenshot error message dan share untuk troubleshooting.

---

## ✅ **Success Criteria**

Migration berhasil jika:
- ✅ SQL execute tanpa error
- ✅ `PRAGMA table_info(rab)` menampilkan `jenis_rab`
- ✅ Create RAB baru → Jenis RAB tersimpan
- ✅ View Detail RAB → Jenis RAB muncul

---

**Good luck! 🚀**
