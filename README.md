# Sistem Manajemen Material Spare Part

## Project Overview
- **Name**: Sistem Manajemen Material Spare Part
- **Goal**: Aplikasi web lengkap untuk mengelola transaksi, stok, umur, dan mutasi material spare part dengan integrasi Google Sheets dan sistem Berita Acara (BA)
- **Features**: 
  - Form input transaksi material dengan multiple items
  - Searchable part number dengan autofill otomatis
  - Dashboard Stok Material dengan alert
  - Dashboard Umur Material
  - Dashboard Mutasi Material dengan BA tracking
  - Tanda tangan digital
  - Export data (CSV/PDF)

## URLs
- **Development (Sandbox)**: https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai
- **Production**: (belum di-deploy)
- **GitHub**: (belum di-setup)

## 🎯 Fitur Utama

### 1. ✅ Form Input Transaksi Material
**URL**: `/`

**Fitur:**
- Input tanggal dan jenis transaksi (Masuk/Keluar)
- Lokasi asal dan tujuan (dropdown dari Google Sheets)
- **Multiple Material Items** - tambah unlimited material dalam 1 transaksi
- Searchable part number dengan autofill:
  - Jenis Barang ✨ auto-fill
  - Material ✨ auto-fill
  - Mesin ✨ auto-fill
- Input manual: S/N Mesin dan Jumlah
- Signature pad untuk Pemeriksa dan Penerima
- **Auto-generate Nomor BA** (BA2025001, BA2025002, ...)

**Rules:**
- Jika 2+ material di input dalam 1 waktu → Nomor BA sama
- Nomor BA format: `BA[YEAR][NUMBER]` (contoh: BA2025001)
- Validasi: minimal 1 material, kedua tanda tangan harus ada

---

### 2. 📊 Dashboard Stok Material
**URL**: `/dashboard/stok`

**Fitur:**
- **Filter Jenis Barang:**
  - MATERIAL HANDAL
  - FILTER
  - MATERIAL BEKAS
  - SEMUA
- Filter Type Mesin (dropdown dinamis)
- Search Part Number
- Tabel stok dengan kolom:
  - Part Number
  - Jenis Barang
  - Material
  - Mesin
  - Stok Masuk (hijau)
  - Stok Keluar (merah)
  - Stok Akhir (dengan badge status)
  - Unit
- **Alert System:**
  - 🔴 **Habis**: Stok = 0
  - 🟡 **Hampir Habis**: Stok ≤ 10
  - 🟢 **Tersedia**: Stok > 10
- Export: PDF, Excel (CSV)

**Rules Stok:**
- Part Number yang sama → Stok = Masuk - Keluar
- Perhitungan otomatis dari semua transaksi
- Real-time update

---

### 3. 📅 Dashboard Umur Material (UPDATED v2.1)
**URL**: `/dashboard/umur`

**Fitur:**
- Filter Lokasi (unit pemasangan)
- Filter Material (search)
- Filter S/N Mesin
- **Tabel umur material lengkap:**
  - S/N Mesin
  - Part Number + Jenis Barang
  - Material + Mesin
  - Tanggal Pasang
  - **Umur (Hari)** - dari tanggal pasang sampai **HARI INI** ✨
  - **Target (Hari)** - editable dengan klik ✨
  - **Sisa (Hari)** - warna dinamis (hijau/kuning/merah) ✨
  - Lokasi
  - Status (badge warna)
  - **Button History** dengan counter penggantian ✨

**Fitur Baru:**
1. **Set Target Umur per Part Number** ✨
   - Klik angka target → modal input muncul
   - Set target umur (hari)
   - Default: 365 hari
   - Tersimpan permanent per part number

2. **Alert Warna Otomatis:** ✨
   - 🟢 **HIJAU (Terpasang)**: Umur < (Target - 20 hari)
   - 🟡 **KUNING (Mendekati Batas)**: Umur >= (Target - 20 hari)  
     → **ACTION**: Siapkan material pengganti!
   - 🔴 **MERAH (Perlu Diganti)**: Umur >= Target  
     → **URGENT**: Segera ganti material!

3. **History Modal Penggantian** ✨
   - Klik button "History (X)" → modal muncul
   - Tampil semua penggantian:
     - Penggantian ke-1, ke-2, ke-3, dst
     - Tanggal, Nomor BA (clickable)
     - Lokasi, Jumlah
     - Pemeriksa, Penerima
   - Link ke BA dokumen

**Rules Umur (UPDATED):**
- ✅ **Perhitungan**: Umur = **HARI INI** - Tanggal Pasang
  - Contoh: Pasang 15/10/2025, Hari ini 14/12/2025 → **60 hari**
- ✅ Track by S/N Mesin + Part Number
- ✅ Alert 20 hari sebelum target → warna KUNING
- ✅ Lewat target → warna MERAH
- ✅ History penggantian: 1st, 2nd, 3rd, dst

---

### 4. 🔄 Dashboard Mutasi Material
**URL**: `/dashboard/mutasi`

**Fitur:**
- Filter Tanggal
- Filter Nomor BA (search)
- Tabel mutasi:
  - **Nomor BA** (clickable → view detail)
  - Tanggal
  - Jenis Transaksi (badge Masuk/Keluar)
  - Part Number (multi-row jika multiple items)
  - Jumlah
  - Lokasi Keluar & Tujuan
  - Pemeriksa & Penerima
  - Status BA (Terkirim button)
- **View BA Modal** - tampil seperti dokumen PLN:
  - Header: Nomor BA, Tanggal
  - Info: Lokasi, Jenis, Dasar (LH 02)
  - Tabel material dengan Part Number, Material, Mesin, Jumlah, S/N
  - Tanda tangan Pemeriksa & Penerima (display image)
  - Action: Print, Download PDF
- Export All BA

**Rules BA:**
- 1 transaksi = 1 Nomor BA
- Multiple material dalam 1 transaksi = Nomor BA sama
- BA otomatis increment (001, 002, 003, ...)
- Format: `BA[YEAR][NUMBER]` (BA2025001)

---

## 📋 API Endpoints

### 1. Master Data
```bash
# Get all data from Google Sheets
GET /api/data

# Search part number
GET /api/search-part?q=1319257

# Get dropdown values (units, pemeriksa, penerima)
GET /api/dropdown-values
```

### 2. Transaction
```bash
# Save transaction (auto-generate BA number)
POST /api/save-transaction
Body: {
  tanggal, jenisTransaksi, lokasiAsal, lokasiTujuan,
  pemeriksa, penerima, ttdPemeriksa, ttdPenerima,
  materials: [{partNumber, jenisBarang, material, mesin, snMesin, jumlah}]
}

# Get all transactions
GET /api/transactions
```

### 3. Dashboard
```bash
# Get stock dashboard with filters
GET /api/dashboard/stock?jenis=FILTER&mesin=TCD+2013

# Get material age dashboard with filters
GET /api/dashboard/umur-material?lokasi=BABAI&material=FILTER

# Get BA by number
GET /api/ba/BA2025001
```

### 4. Material Age & Target (NEW v2.1)
```bash
# Get all target umur material
GET /api/target-umur

# Get target umur by part number
GET /api/target-umur/:partNumber

# Save or update target umur
POST /api/target-umur
Body: {
  partNumber: "1319257",
  targetUmurHari: 365,
  jenisBarang: "MATERIAL HANDAL",
  material: "FILTER INSERT",
  mesin: "F6L912"
}

# Get material history by S/N and Part Number
GET /api/material-history/:snMesin/:partNumber
Response: {
  snMesin: "11",
  partNumber: "NSX400A",
  totalPenggantian: 3,
  history: [
    {
      penggantianKe: 1,
      tanggal: "2025-01-15",
      nomorBA: "BA2025001",
      lokasi: "GUNUNG PUREI",
      jumlah: 1,
      pemeriksa: "MUCHLIS ADITYA ANHAR",
      penerima: "RIVALDO RENIER T"
    },
    ...
  ]
}
```

---

## 💾 Data Architecture

### Storage (Current: In-Memory)
```javascript
transactions = [
  {
    id: "timestamp",
    nomorBA: "BA2025001",
    tanggal: "2025-12-14",
    jenisTransaksi: "Keluar (Pengeluaran Gudang)",
    lokasiAsal: "GUDANG BUNTOK",
    lokasiTujuan: "BABAI",
    pemeriksa: "MUCHLIS ADITYA ANHAR",
    penerima: "RIVALDO RENIER T",
    ttdPemeriksa: "data:image/png;base64,...",
    ttdPenerima: "data:image/png;base64,...",
    materials: [
      {
        partNumber: "1319257",
        jenisBarang: "MATERIAL HANDAL",
        material: "FILTER INSERT",
        mesin: "F6L912",
        snMesin: "SN-001",
        jumlah: 5
      }
    ],
    createdAt: "2025-12-14T..."
  }
]
```

### Future: Firebase Firestore Structure
```
/transactions/{id}
  - nomorBA
  - tanggal
  - jenisTransaksi
  - lokasiAsal
  - lokasiTujuan
  - pemeriksa
  - penerima
  - ttdPemeriksa (base64)
  - ttdPenerima (base64)
  - materials (array)
  - createdAt

/stock/{partNumber}
  - partNumber
  - jenisBarang
  - material
  - mesin
  - stokMasuk
  - stokKeluar
  - stokAkhir
  - lastUpdated

/materialAge/{snMesin_partNumber}
  - snMesin
  - partNumber
  - material
  - mesin
  - lokasi
  - tanggalPasang
  - tanggalGanti
  - umurHari
  - status
```

---

## 🚀 User Guide

### A. Input Transaksi Baru

1. **Buka Form Input** (`/`)
2. **Isi Informasi Umum**:
   - Tanggal (default: today)
   - Jenis Transaksi: Keluar/Masuk
   - Lokasi Asal & Tujuan
3. **Tambah Material**:
   - Ketik Part Number → pilih dari autocomplete
   - Jenis Barang, Material, Mesin auto-fill ✨
   - Isi S/N Mesin manual
   - Isi Jumlah
   - Klik "Tambah Baris Material" untuk item lain
4. **Tanda Tangan**:
   - Pilih Pemeriksa → tanda tangan di canvas
   - Pilih Penerima → tanda tangan di canvas
5. **Submit**:
   - Klik "Simpan Transaksi"
   - Muncul modal sukses dengan **Nomor BA**
   - Klik "Lihat BA" → redirect ke Dashboard Mutasi

### B. Monitor Stok Material

1. **Buka Dashboard Stok** (`/dashboard/stok`)
2. **Filter Jenis Barang**: 
   - Klik button: MATERIAL HANDAL / FILTER / MATERIAL BEKAS
3. **Filter Mesin**:
   - Pilih dari dropdown
4. **Search**:
   - Ketik Part Number di search box
5. **Lihat Status**:
   - 🟢 Tersedia (stok > 10)
   - 🟡 Hampir Habis (stok ≤ 10)
   - 🔴 Habis (stok = 0)
6. **Export**:
   - Klik "Excel" → download CSV

### C. Monitor Umur Material

1. **Buka Dashboard Umur** (`/dashboard/umur`)
2. **Filter Lokasi**:
   - Pilih unit/lokasi pemasangan
3. **Filter Material**:
   - Ketik nama material
4. **Filter S/N Mesin**:
   - Ketik S/N untuk track specific mesin
5. **Lihat Status**:
   - 🟢 Terpasang (normal)
   - 🔴 Perlu Diganti (umur > 600 hari)

### D. Lihat & Export BA

1. **Buka Dashboard Mutasi** (`/dashboard/mutasi`)
2. **Filter** (optional):
   - Tanggal
   - Nomor BA
3. **View BA**:
   - Klik Nomor BA → modal muncul
   - Lihat detail lengkap seperti dokumen PLN
   - Tanda tangan ditampilkan
4. **Export BA**:
   - Klik "Print" → print halaman
   - Klik "Download PDF" → download (coming soon)
   - Klik "Export BA" di atas → export all

---

## 🎨 Tech Stack

- **Backend**: Hono v4.11.0 (Cloudflare Workers)
- **Frontend**: Vanilla JavaScript + HTML5
- **Styling**: Tailwind CSS v3 (CDN)
- **Icons**: FontAwesome v6.4.0
- **Data Source**: Google Sheets JSON API
- **Storage**: In-memory (current) → Firestore (future)
- **Platform**: Cloudflare Pages/Workers
- **Build**: Vite v6.3.5
- **Dev Server**: PM2

---

## 📂 Project Structure

```
webapp/
├── src/
│   ├── index.tsx              # Main backend with all routes
│   └── renderer.tsx           # JSX renderer
├── public/
│   └── static/
│       ├── app.js             # Form input logic
│       ├── dashboard-stok.js  # Stock dashboard
│       ├── dashboard-umur.js  # Material age dashboard
│       └── dashboard-mutasi.js # Mutation dashboard
├── dist/                      # Build output
├── .dev.vars                  # Environment variables (Firebase config)
├── ecosystem.config.cjs       # PM2 configuration
├── package.json
├── wrangler.jsonc
└── README.md
```

---

## 🔧 Development

### Local Development

```bash
# Clean port
fuser -k 3000/tcp 2>/dev/null || true

# Build project (REQUIRED first time)
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Check logs
pm2 logs webapp --nostream

# Test
curl http://localhost:3000
```

### Deployment to Cloudflare Pages

```bash
# Prerequisites
# 1. Call setup_cloudflare_api_key first
# 2. Verify: npx wrangler whoami

# Build and deploy
npm run build
npx wrangler pages deploy dist --project-name webapp

# Or use npm script
npm run deploy:prod
```

---

## 🆕 Fitur yang Baru Ditambahkan

### ✅ Completed - Version 2.1 (Latest)

**NEW in v2.1 - Dashboard Umur Material Improvements:**
1. ✅ **Fix Perhitungan Umur** - dari tanggal pasang sampai **HARI INI**
2. ✅ **Set Target Umur** per Part Number (editable dengan klik)
3. ✅ **Alert Warna Otomatis**:
   - 🟢 Hijau: Normal (umur < target - 20 hari)
   - 🟡 Kuning: Mendekati batas (20 hari sebelum target)
   - 🔴 Merah: Perlu diganti (lewat target)
4. ✅ **History Modal** - tampil semua penggantian (1st, 2nd, 3rd, dst)
5. ✅ **Kolom Baru**: Target (Hari), Sisa (Hari), Button History
6. ✅ **New APIs**: target-umur, material-history

**Completed in v2.0:**
1. **Navigasi Menu** - 4 menu utama di top navigation
2. **Dashboard Stok Material**:
   - Filter Jenis Barang (3 kategori + Semua)
   - Filter Mesin (dropdown dinamis)
   - Search Part Number
   - Alert system (Habis/Hampir Habis/Tersedia)
   - Export Excel (CSV)
3. **Dashboard Umur Material** (base version)
4. **Dashboard Mutasi Material**:
   - Tampilan tabel dengan multiple materials
   - Filter Tanggal & Nomor BA
   - View BA Modal (dokumen lengkap)
   - Display tanda tangan di BA
   - Button Export BA
5. **Auto BA Number Generation**:
   - Format: BA[YEAR][NUMBER]
   - Auto-increment: BA2025001, BA2025002, ...
   - Multiple materials = 1 BA number
6. **Success Modal** setelah submit
7. **Stock Calculation** (Masuk - Keluar)
8. **Material Age Calculation** by S/N Mesin

---

## ⏳ Fitur yang Belum Diimplementasikan

### High Priority
1. **Firebase Firestore Integration**:
   - Persistent storage
   - Real-time sync
   - Setup: Perlu Firebase Project ID & API Key
2. **PDF Export**:
   - BA export ke PDF dengan layout PLN
   - Include signature images
   - Library: jsPDF atau Puppeteer
3. **Print Optimization**:
   - CSS for print (@media print)
   - Page breaks untuk multiple materials

### Medium Priority
4. **User Authentication**:
   - Login system
   - Role: Admin, Operator
   - Permission management
5. **Advanced Filters**:
   - Date range picker
   - Multiple filter combinations
   - Save filter presets
6. **Notification System**:
   - Email notification untuk BA
   - Alert untuk stok hampir habis
   - Reminder untuk material perlu diganti

### Low Priority
7. **Mobile App** (PWA)
8. **Barcode Scanner** untuk Part Number
9. **Photo Upload** kondisi barang
10. **Integration** dengan ERP lain

---

## 📊 Business Rules Summary

### Stok Material
- **Rule**: Part Number sama → Stok = ∑Masuk - ∑Keluar
- **Alert**: 
  - Habis (0)
  - Hampir Habis (≤10)
  - Tersedia (>10)

### Umur Material
- **Rule**: Hitung umur hanya jika:
  - Material SAMA diganti pada
  - S/N Mesin SAMA
- **Formula**: Umur = Tanggal Ganti - Tanggal Pasang
- **Alert**: Perlu Diganti jika umur > 600 hari

### Nomor BA
- **Rule**:
  - 1 transaksi = 1 Nomor BA
  - Multiple materials dalam 1 input = BA sama
  - Auto-increment: 001, 002, 003, ...
- **Format**: `BA[YEAR][NUMBER]`
- **Example**: BA2025001, BA2025002

---

## 🔐 Configuration

### Firebase Setup (Future)

Edit `.dev.vars`:
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

Deploy ke production:
```bash
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put FIREBASE_API_KEY
```

---

## 📝 Notes

- **Cache Duration**: Google Sheets data di-cache 5 menit
- **In-Memory Storage**: Data hilang saat restart (belum persistent)
- **BA Counter**: Reset ke 1 saat restart
- **Signature Format**: Base64 PNG
- **Multi-material Support**: Unlimited items per transaksi

---

## 🎯 Status & Roadmap

- **Current Version**: v2.1 (Dashboard Umur Material Enhanced)
- **Status**: ✅ Active (Sandbox)
- **Latest Update**: 
  - ✅ Fix perhitungan umur (sampai hari ini)
  - ✅ Set target umur per part number
  - ✅ Alert warna otomatis (hijau/kuning/merah)
  - ✅ History penggantian modal
- **Next Priority**: Firebase Firestore Integration
- **Last Updated**: 2025-12-14

---

## 👥 Contact & Support

Untuk pertanyaan, bug report, atau feature request, silakan hubungi tim developer.

---

## 📸 Screenshots

### Form Input
- Multiple material items ✅
- Signature pad touchscreen ✅
- Auto BA number generation ✅

### Dashboard Stok
- Filter jenis barang ✅
- Alert system dengan badge colors ✅
- Export Excel ✅

### Dashboard Umur
- Filter lokasi & material ✅
- Perhitungan umur otomatis ✅

### Dashboard Mutasi
- View BA modal dengan dokumen PLN format ✅
- Tanda tangan display ✅
- Export BA ✅

---

**Happy Coding! 🚀**
