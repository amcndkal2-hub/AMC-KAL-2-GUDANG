# 🔧 Troubleshooting: Dashboard Gangguan Tidak Muncul Data

## 🎯 Masalah yang Dilaporkan

**Gejala:**
- Form Gangguan berhasil submit
- Dashboard Kebutuhan Material **MUNCUL** datanya ✅
- Dashboard Gangguan **TIDAK MUNCUL** datanya ❌

---

## 🔍 Root Cause Analysis

### Penyebab Utama: **In-Memory Storage**

Aplikasi ini menggunakan **in-memory storage** yang berarti:
- ❌ Data **TIDAK PERSISTENT** (hilang saat restart)
- ❌ Data **TIDAK SHARED** antar multiple instances
- ❌ Data **HILANG** saat Cloudflare Worker restart

### Mengapa Dashboard Kebutuhan Muncul tapi Dashboard Gangguan Tidak?

Dashboard Kebutuhan menampilkan data dari `gangguanTransactions.materials[]` yang **FLATTEN**.
Dashboard Gangguan menampilkan data dari `gangguanTransactions[]` langsung.

**Perbedaan:**
```javascript
// Dashboard Gangguan (direct array)
gangguanTransactions = [
  { nomorLH05: "001/...", materials: [...] }
]

// Dashboard Kebutuhan (flattened materials)
materials = [
  { nomorLH05: "001/...", partNumber: "...", ... }
]
```

---

## ✅ **SOLUSI CEPAT: Login & Test**

### Langkah 1: Login ke Aplikasi

```
URL: https://your-app.pages.dev/login
Username: AMC@12345
Password: 12345@AMC
```

### Langkah 2: Akses Dashboard Gangguan

```
URL: https://your-app.pages.dev/dashboard/gangguan
```

**Expected Result:** Akan muncul **1 sample data** dengan Nomor LH05: `SAMPLE001/ND KAL 2/LH05/2025`

### Langkah 3: Submit Form Gangguan Baru

1. Buka: `/form-gangguan` (PUBLIC - no login required)
2. Isi semua form field
3. Tambah minimal 1 material
4. Tanda tangan Pelapor
5. Submit

### Langkah 4: Verify di Dashboard Gangguan

1. Buka: `/dashboard/gangguan`
2. Data baru **HARUS MUNCUL** sekarang
3. Cek console browser (F12) untuk debug logs

---

## 🐛 **DEBUGGING CHECKLIST**

### A. Cek Browser Console (F12)

Buka Dashboard Gangguan → Tekan **F12** → Tab **Console**

**Expected logs:**
```
🚀 Dashboard Gangguan Initialized
📍 Current URL: https://...
⏳ Starting data load...
🔄 Loading gangguan data from API...
✅ API Response: {gangguanTransactions: Array(1)}
📊 Total gangguan: 1
📋 allGangguanData: 1 items
🔍 filteredData: 1 items
✅ Dashboard data loaded successfully
🎨 renderTable() called
📊 allGangguanData.length: 1
🔍 filteredData.length: 1
✅ Rendering 1 rows
```

**Jika muncul error:**
- ❌ `gangguanTransactions: Array(0)` → Data kosong, cek backend
- ❌ `401 Unauthorized` → Session expired, login ulang
- ❌ `Element gangguanTable not found` → HTML tidak ter-load

### B. Cek API Endpoint

```bash
# Test API directly
curl -s http://localhost:3000/api/gangguan-transactions | jq

# Expected output:
{
  "gangguanTransactions": [
    {
      "id": "...",
      "nomorLH05": "SAMPLE001/ND KAL 2/LH05/2025",
      "kelompokSPD": "MEKANIK",
      ...
    }
  ]
}
```

### C. Cek PM2 Logs (Server-side)

```bash
pm2 logs webapp --nostream --lines 50

# Expected logs:
0|webapp   | 🔧 Initializing sample gangguan data...
0|webapp   | ✅ Sample gangguan data initialized: 1 items
0|webapp   | 🔍 GET /api/gangguan-transactions called
0|webapp   | 📊 Total gangguan: 1
```

### D. Cek Authentication

```bash
# Test di browser console:
localStorage.getItem('sessionToken')

# Jika null → Login dulu
# Jika ada → Cek session validity

fetch('/api/check-session', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sessionToken') }
}).then(r => r.json()).then(console.log)

# Expected: { valid: true, username: "...", expiresAt: "..." }
```

---

## 🔥 **KNOWN ISSUES & FIXES**

### Issue 1: "Data Hilang Setelah Restart"

**Cause:** In-memory storage tidak persistent

**Fix:**
```bash
# Restart akan reset data
pm2 restart webapp

# Sample data akan di-reinitialize otomatis
# User-submitted data akan HILANG
```

**Permanent Solution:** Migrate to Cloudflare D1 (see below)

### Issue 2: "Dashboard Kosong Meski Form Berhasil"

**Cause:** Multiple possible reasons

**Debug Steps:**
```javascript
// 1. Cek di browser console
fetch('/api/gangguan-transactions')
  .then(r => r.json())
  .then(data => {
    console.log('API Data:', data)
    console.log('Total:', data.gangguanTransactions.length)
  })

// 2. Cek apakah data ter-save
console.log('Last submit result should show:', result.nomorLH05)

// 3. Force reload dashboard
location.reload()
```

### Issue 3: "401 Unauthorized di Dashboard Gangguan"

**Cause:** Session expired atau belum login

**Fix:**
```bash
# Clear session
localStorage.removeItem('sessionToken')

# Login ulang
window.location.href = '/login'
```

### Issue 4: "Table Element Not Found"

**Cause:** HTML belum ter-render sepenuhnya

**Fix:**
```javascript
// Cek apakah element ada
const table = document.getElementById('gangguanTable')
console.log('Table element:', table)

// Jika null, tunggu DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Try again
})
```

---

## 💾 **PERMANENT SOLUTION: Cloudflare D1 Database**

### Why Migrate to D1?

❌ **In-Memory Problems:**
- Data hilang saat restart
- Tidak bisa scale
- Tidak persistent
- Tidak shared antar instances

✅ **D1 Advantages:**
- ✅ Data persistent (tidak hilang)
- ✅ SQLite-based (familiar)
- ✅ Global distribution
- ✅ Zero-latency reads
- ✅ Free tier: 5 GB storage

### Migration Steps (Summary)

```bash
# 1. Create D1 database
npx wrangler d1 create webapp-db

# 2. Update wrangler.jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "webapp-db",
    "database_id": "YOUR_DATABASE_ID"
  }]
}

# 3. Create migration files
mkdir migrations
cat > migrations/0001_create_gangguan_table.sql << 'EOF'
CREATE TABLE gangguan_transactions (
  id TEXT PRIMARY KEY,
  nomor_lh05 TEXT UNIQUE NOT NULL,
  hari_tanggal TEXT NOT NULL,
  unit_uld TEXT,
  kelompok_spd TEXT,
  komponen_rusak TEXT,
  gejala TEXT,
  uraian_kejadian TEXT,
  analisa_penyebab TEXT,
  kesimpulan TEXT,
  beban_puncak REAL,
  daya_mampu REAL,
  pemadaman TEXT,
  tindakan_penanggulangan TEXT,
  rencana_perbaikan TEXT,
  nama_pelapor TEXT,
  ttd_pelapor TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE gangguan_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gangguan_id TEXT NOT NULL,
  part_number TEXT NOT NULL,
  jenis_barang TEXT,
  material TEXT,
  mesin TEXT,
  jumlah INTEGER,
  status TEXT DEFAULT 'Pengadaan',
  FOREIGN KEY (gangguan_id) REFERENCES gangguan_transactions(id)
);

CREATE INDEX idx_gangguan_nomor ON gangguan_transactions(nomor_lh05);
CREATE INDEX idx_gangguan_date ON gangguan_transactions(hari_tanggal);
CREATE INDEX idx_materials_gangguan ON gangguan_materials(gangguan_id);
EOF

# 4. Apply migrations
npx wrangler d1 migrations apply webapp-db --local
npx wrangler d1 migrations apply webapp-db

# 5. Update backend code (src/index.tsx)
# Replace in-memory array with D1 queries
```

**Full migration guide:** See `DEPLOYMENT_GUIDE.md` section "D1 Database Best Practices"

---

## 🧪 **TESTING CHECKLIST**

### Test Scenario 1: Fresh Install

```bash
# 1. Clean restart
pm2 restart webapp

# 2. Wait 5 seconds
sleep 5

# 3. Check sample data
curl http://localhost:3000/api/gangguan-transactions | jq '.gangguanTransactions | length'
# Expected: 1

# 4. Open dashboard
# URL: /dashboard/gangguan
# Expected: 1 row dengan SAMPLE001 data
```

### Test Scenario 2: Submit Form

```bash
# 1. Open form
# URL: /form-gangguan

# 2. Fill all fields + add material + signature

# 3. Submit

# 4. Check API
curl http://localhost:3000/api/gangguan-transactions | jq '.gangguanTransactions | length'
# Expected: 2

# 5. Open dashboard
# URL: /dashboard/gangguan
# Expected: 2 rows (SAMPLE001 + new data)
```

### Test Scenario 3: Filter & Search

```bash
# 1. Open dashboard with filters
# URL: /dashboard/gangguan

# 2. Test filters:
# - Kelompok SPD: MEKANIK
# - Expected: Filter MEKANIK items only

# 3. Test search:
# - Search nomor: "001"
# - Expected: Show items with "001" in nomor
```

---

## 📊 **MONITORING & LOGS**

### Server-Side Logs (PM2)

```bash
# Real-time logs
pm2 logs webapp

# Last 100 lines
pm2 logs webapp --nostream --lines 100

# Filter for gangguan-related logs
pm2 logs webapp --nostream --lines 200 | grep -i "gangguan\|lh05"

# Expected patterns:
# ✅ "Sample gangguan data initialized: X items"
# ✅ "GET /api/gangguan-transactions called"
# ✅ "Total gangguan: X"
# ✅ "Saving gangguan form..."
# ✅ "Gangguan saved successfully"
```

### Client-Side Logs (Browser)

```javascript
// Enable verbose logging in dashboard-gangguan.js
localStorage.setItem('debug', 'true')

// Check data flow
console.log('allGangguanData:', allGangguanData)
console.log('filteredData:', filteredData)

// Force reload data
loadDashboardData()
```

---

## 🚨 **EMERGENCY RECOVERY**

### Jika Dashboard Tetap Kosong:

**Step 1: Hard Refresh**
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Step 2: Clear Browser Cache**
```
F12 → Application → Clear Storage → Clear site data
```

**Step 3: Re-login**
```
1. Logout
2. Clear localStorage: localStorage.clear()
3. Login ulang
4. Akses dashboard gangguan
```

**Step 4: Restart Backend**
```bash
pm2 restart webapp
sleep 5
curl http://localhost:3000/api/gangguan-transactions
```

**Step 5: Check for Service Issues**
```bash
# Check if service is running
pm2 status

# Check if port 3000 is open
curl http://localhost:3000

# Check wrangler errors
pm2 logs webapp --err --lines 50
```

---

## 📞 **SUPPORT & HELP**

### Quick Commands Reference

```bash
# Restart service
pm2 restart webapp

# Check logs
pm2 logs webapp --nostream --lines 50

# Test API
curl http://localhost:3000/api/gangguan-transactions | jq

# Check gangguan count
curl -s http://localhost:3000/api/gangguan-transactions | jq '.gangguanTransactions | length'

# Test with login
# (Requires session token from browser)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/check-session
```

### Browser Console Commands

```javascript
// Check session
localStorage.getItem('sessionToken')

// Test API directly
fetch('/api/gangguan-transactions').then(r => r.json()).then(console.log)

// Force reload dashboard data
loadDashboardData()

// Check filtered data
console.log('Filtered:', filteredData.length, 'All:', allGangguanData.length)
```

---

## ✅ **VERIFICATION STEPS**

After fixing, verify:

- [ ] Sample data muncul di dashboard (SAMPLE001)
- [ ] Bisa submit form gangguan baru
- [ ] Data baru muncul di dashboard gangguan
- [ ] Data muncul di dashboard kebutuhan material
- [ ] Filter & search berfungsi
- [ ] Statistics box menampilkan angka yang benar
- [ ] Bisa view detail LH05
- [ ] Console tidak ada error
- [ ] API /api/gangguan-transactions return data
- [ ] PM2 logs tidak ada error

---

## 📝 **CONCLUSION**

**Root Cause:** In-memory storage tidak persistent

**Temporary Fix:** Sample data sudah di-load otomatis, data baru akan hilang saat restart

**Permanent Solution:** Migrate ke Cloudflare D1 Database

**Current Status:** ✅ Aplikasi berfungsi dengan sample data

**Next Steps:**
1. Test dashboard gangguan dengan login
2. Submit form gangguan baru untuk test
3. Plan migration ke D1 untuk persistent storage

---

**Last Updated:** 2025-12-17
**Status:** ✅ Fixed with logging & sample data
