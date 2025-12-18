# 🗄️ D1 DATABASE IMPLEMENTATION GUIDE
## Material Management System - AMC ND KAL 2

**Last Updated:** 2025-12-18  
**Status:** READY TO IMPLEMENT  
**Estimated Time:** 2-3 hours

---

## 📋 OVERVIEW

Guide ini akan membantu Anda mengimplementasikan **Cloudflare D1 Database** ke aplikasi Material Management System untuk **persistent data storage** (data tidak hilang saat restart).

**Keuntungan D1:**
- ✅ FREE 10GB storage (cukup untuk 5-10 tahun)
- ✅ Performance sangat cepat (edge computing)
- ✅ Native integration dengan Cloudflare Pages
- ✅ Backup otomatis
- ✅ Easy maintenance

---

## 🚀 STEP-BY-STEP IMPLEMENTATION

### **PHASE 1: CREATE D1 DATABASE (5 menit)**

#### **1.1 Login ke Terminal/CMD**

Buka terminal atau command prompt Anda.

#### **1.2 Navigate ke Project**

```bash
cd /home/user/webapp
# Atau path project Anda
```

#### **1.3 Set Cloudflare API Token**

```bash
export CLOUDFLARE_API_TOKEN="i4BT6fi0SFAW7V0XIUQso4Rwk2Xb3Qq3mc8BGGTk"
```

**PENTING:** Jika command di atas gagal dengan error "Authentication error [code: 10000]", maka token Anda tidak punya permission D1.

**SOLUSI:** Buat API Token baru dengan permission:
1. Login ke: https://dash.cloudflare.com/profile/api-tokens
2. Klik "Create Token" → "Custom Token"
3. Tambahkan permission:
   - Account > D1 > Edit
   - Account > Cloudflare Pages > Edit
   - Account > Account Settings > Read
4. Copy token baru dan gunakan di command atas

#### **1.4 Create D1 Database**

```bash
npx wrangler d1 create amc-material-db
```

**OUTPUT EXPECTED:**
```
✅ Successfully created DB 'amc-material-db'

[[d1_databases]]
binding = "DB"
database_name = "amc-material-db"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

**⚠️ PENTING: COPY `database_id` dari output!**

---

### **PHASE 2: UPDATE CONFIGURATION (2 menit)**

#### **2.1 Update `wrangler.jsonc`**

Buka file `/home/user/webapp/wrangler.jsonc` dan ganti:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "webapp",
  "compatibility_date": "2025-12-14",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "amc-material-db",
      "database_id": "PASTE_DATABASE_ID_DI_SINI"  // <-- Ganti dengan database_id dari step 1.4
    }
  ]
}
```

**CONTOH:**
```jsonc
"database_id": "12345678-1234-5678-1234-567812345678"
```

---

### **PHASE 3: RUN MIGRATIONS (3 menit)**

#### **3.1 Check Migration Files**

Pastikan file berikut ada:
- `/home/user/webapp/migrations/0001_initial_schema.sql` ✅ (sudah dibuat)
- `/home/user/webapp/migrations/0002_seed_data.sql` ✅ (sudah dibuat)

#### **3.2 Run Migration - LOCAL (Development)**

```bash
cd /home/user/webapp
npx wrangler d1 migrations apply amc-material-db --local
```

**OUTPUT EXPECTED:**
```
✅ Applied 2 migration(s)
```

#### **3.3 Run Migration - PRODUCTION**

```bash
npx wrangler d1 migrations apply amc-material-db
```

**OUTPUT EXPECTED:**
```
✅ Applied 2 migration(s) to production database
```

---

### **PHASE 4: UPDATE BACKEND CODE (20-30 menit)**

#### **4.1 Add Type Bindings**

Di file `/home/user/webapp/src/index.tsx`, tambahkan di bagian paling atas (setelah import):

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import * as DB from './db'  // <-- TAMBAHKAN INI

// Type untuk Cloudflare bindings
type Bindings = {
  DB: D1Database;
}

// Update Hono app dengan bindings
const app = new Hono<{ Bindings: Bindings }>()  // <-- UPDATE INI
```

#### **4.2 Update API `/api/save-transaction`**

**SEBELUM (in-memory):**
```typescript
app.post('/api/save-transaction', async (c) => {
  try {
    const body = await c.req.json()
    const nomorBA = generateNomorBA()
    
    const transaction = {
      id: Date.now().toString(),
      nomorBA,
      ...body,
      createdAt: new Date().toISOString()
    }
    
    transactions.push(transaction)  // <-- IN-MEMORY
    
    return c.json({ success: true, nomorBA })
  } catch (error) {
    return c.json({ error: 'Failed to save' }, 500)
  }
})
```

**SESUDAH (D1 Database):**
```typescript
app.post('/api/save-transaction', async (c) => {
  try {
    const { env } = c  // <-- Ambil env (berisi DB binding)
    const body = await c.req.json()
    
    // Generate Nomor BA dari D1
    const nomorBA = await DB.getNextBANumber(env.DB)
    
    // Save ke D1 Database
    const result = await DB.saveTransaction(env.DB, {
      nomorBA,
      ...body
    })
    
    return c.json({ success: true, ...result })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})
```

#### **4.3 Update API `/api/transactions`**

**SEBELUM:**
```typescript
app.get('/api/transactions', (c) => {
  return c.json({ transactions })  // <-- IN-MEMORY
})
```

**SESUDAH:**
```typescript
app.get('/api/transactions', async (c) => {
  try {
    const { env } = c
    const transactions = await DB.getAllTransactions(env.DB)
    return c.json({ transactions })
  } catch (error) {
    return c.json({ error: 'Failed to get transactions' }, 500)
  }
})
```

#### **4.4 Update API `/api/save-gangguan`** (Form Gangguan LH05)

**SEBELUM:**
```typescript
app.post('/api/save-gangguan', async (c) => {
  // ... code ...
  gangguanTransactions.push(transaction)  // <-- IN-MEMORY
  // ...
})
```

**SESUDAH:**
```typescript
app.post('/api/save-gangguan', async (c) => {
  try {
    const { env } = c
    const body = await c.req.json()
    
    // Generate Nomor LH05 dari D1
    const nomorLH05 = await DB.getNextLH05Number(env.DB)
    
    // Save ke D1 Database
    const result = await DB.saveGangguan(env.DB, {
      nomorLH05,
      ...body
    })
    
    return c.json({ success: true, ...result })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})
```

#### **4.5 Update API `/api/gangguan-transactions`**

**SEBELUM:**
```typescript
app.get('/api/gangguan-transactions', (c) => {
  return c.json({ transactions: gangguanTransactions })  // <-- IN-MEMORY
})
```

**SESUDAH:**
```typescript
app.get('/api/gangguan-transactions', async (c) => {
  try {
    const { env } = c
    const transactions = await DB.getAllGangguan(env.DB)
    return c.json({ transactions })
  } catch (error) {
    return c.json({ error: 'Failed to get gangguan' }, 500)
  }
})
```

#### **4.6 Update API `/api/material-kebutuhan`**

**SEBELUM:**
```typescript
app.get('/api/material-kebutuhan', (c) => {
  // Ambil dari gangguanTransactions (in-memory)
  const materials = gangguanTransactions.flatMap(...)
  return c.json({ materials })
})
```

**SESUDAH:**
```typescript
app.get('/api/material-kebutuhan', async (c) => {
  try {
    const { env } = c
    const materials = await DB.getAllMaterialKebutuhan(env.DB)
    return c.json({ materials })
  } catch (error) {
    return c.json({ error: 'Failed to get materials' }, 500)
  }
})
```

---

### **PHASE 5: TEST LOCAL (10 menit)**

#### **5.1 Update package.json scripts**

Tambahkan script untuk dev dengan D1:

```json
{
  "scripts": {
    "dev:d1": "wrangler pages dev dist --d1=amc-material-db --local --ip 0.0.0.0 --port 3000",
    // ... scripts lain
  }
}
```

#### **5.2 Build & Start**

```bash
cd /home/user/webapp

# Build
npm run build

# Clean port
fuser -k 3000/tcp 2>/dev/null || true

# Start dengan D1 local
npm run dev:d1
```

#### **5.3 Test di Browser**

1. Buka: http://localhost:3000
2. Login: `AMC@12345` / `12345@AMC`
3. Input transaksi material baru
4. Refresh page → Data masih ada ✅
5. Stop server (Ctrl+C) → Start lagi
6. Data masih ada ✅ (PERSISTENT!)

---

### **PHASE 6: DEPLOY TO PRODUCTION (10 menit)**

#### **6.1 Build Production**

```bash
cd /home/user/webapp
npm run build
```

#### **6.2 Deploy dengan D1**

```bash
export CLOUDFLARE_API_TOKEN="i4BT6fi0SFAW7V0XIUQso4Rwk2Xb3Qq3mc8BGGTk"
npx wrangler pages deploy dist --project-name amc-material-system
```

#### **6.3 Verify Production**

```bash
# Test API
curl https://amc-material-system.pages.dev/api/transactions

# Test Gangguan
curl https://amc-material-system.pages.dev/api/gangguan-transactions
```

#### **6.4 Test di Browser**

1. Buka: https://amc-material-system.pages.dev
2. Login dan input data
3. Data sekarang PERSISTENT! 🎉

---

## 🔍 TROUBLESHOOTING

### **Problem 1: Migration Failed**

```
Error: Database not found
```

**Solution:**
- Pastikan `database_id` di `wrangler.jsonc` sudah benar
- Coba create database lagi: `npx wrangler d1 create amc-material-db`

---

### **Problem 2: API Error 500**

```
Database error: ...
```

**Solution:**
- Check console logs: `pm2 logs --nostream`
- Pastikan migration sudah dijalankan
- Cek binding name di wrangler.jsonc (`binding: "DB"` harus sama dengan code)

---

### **Problem 3: Data Tidak Muncul**

**Solution:**
- Pastikan semua API sudah di-update dari in-memory ke D1
- Cek database isi data: `npx wrangler d1 execute amc-material-db --local --command="SELECT * FROM transactions"`

---

## 📊 VERIFIKASI D1 BERHASIL

Cek apakah D1 sudah berjalan dengan baik:

```bash
# 1. Cek table structure
npx wrangler d1 execute amc-material-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# Expected output:
# - transactions
# - materials
# - gangguan
# - material_gangguan

# 2. Cek sample data
npx wrangler d1 execute amc-material-db --local --command="SELECT COUNT(*) as total FROM transactions"

# 3. Cek gangguan data
npx wrangler d1 execute amc-material-db --local --command="SELECT COUNT(*) as total FROM gangguan"
```

---

## 📚 NEXT STEPS (OPTIONAL)

### **1. Backup Database**

```bash
# Export data
npx wrangler d1 backup create amc-material-db
```

### **2. Analytics Dashboard**

Cloudflare Dashboard → D1 → amc-material-db → Analytics

### **3. Query Console**

Cloudflare Dashboard → D1 → amc-material-db → Console

---

## ✅ CHECKLIST IMPLEMENTASI

- [ ] Create D1 Database (Phase 1)
- [ ] Update wrangler.jsonc (Phase 2)
- [ ] Run migrations local & production (Phase 3)
- [ ] Update backend code (Phase 4)
- [ ] Test local (Phase 5)
- [ ] Deploy to production (Phase 6)
- [ ] Verify data persistent (Test restart)
- [ ] Update README.md dengan info D1

---

## 💡 TIPS

1. **Always backup before major changes**
2. **Test local first before production**
3. **Monitor D1 usage** di Cloudflare Dashboard
4. **Free tier: 10GB storage** - cukup untuk jutaan record
5. **Upgrade jika perlu**: $5/month untuk 50GB

---

## 📞 SUPPORT

Jika ada masalah:
1. Check logs: `pm2 logs --nostream`
2. Check Cloudflare Dashboard
3. Re-run migrations jika perlu
4. Contact: amc.ndkal2@gmail.com

---

**🎉 SELAMAT! Aplikasi Anda sekarang menggunakan D1 Database dengan data persistent!**
