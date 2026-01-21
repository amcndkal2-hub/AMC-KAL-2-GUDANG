# DASHBOARD UTAMA - Analitik Material

## Overview
Dashboard Utama adalah halaman analytics yang menampilkan **2 insight penting**:
1. **Top 10 Material Sering Keluar** - Ranking material berdasarkan frekuensi pengeluaran
2. **Material Stok Kritis** - Material dengan stok ≤ 5 buah yang perlu perhatian

**Access Control**: Dashboard ini **hanya bisa diakses setelah login** (protected route).

---

## Fitur Dashboard

### 1. Summary Cards (Top Section)
Tiga card metrics yang menampilkan:
- **Total Transaksi**: Jumlah seluruh transaksi material
- **Material Populer**: Jumlah material dalam top 10
- **Stok Kritis**: Jumlah material dengan stok ≤ 5 buah

### 2. Top 10 Material Sering Keluar
**Tampilan:**
- Tabel ranking dengan badge warna untuk posisi 1-3:
  - 🥇 Rank #1: Gold badge (kuning)
  - 🥈 Rank #2: Silver badge (abu-abu)
  - 🥉 Rank #3: Bronze badge (orange)
  - Rank lainnya: Blue badge

**Kolom Tabel:**
| Kolom | Deskripsi |
|-------|-----------|
| Rank | Posisi ranking dengan icon trophy/medal/award |
| Part Number | Kode part material |
| Nama Material | Nama lengkap material |
| Mesin | Tipe mesin yang menggunakan |
| Frekuensi Keluar | Berapa kali material keluar (badge merah) |
| Total Qty Keluar | Total jumlah yang keluar (badge orange) |
| Jenis Barang | Kategori material |

**Sorting**: Berdasarkan `frekuensi` keluar (tertinggi ke terendah)

### 3. Material Stok Kritis (≤ 5 buah)
**Tampilan:**
- Tabel dengan color-coding berdasarkan tingkat kritis:
  - 🔴 **HABIS** (stok = 0): Red badge
  - 🟠 **KRITIS** (stok ≤ 2): Orange badge
  - 🟡 **Perlu Perhatian** (stok 3-5): Yellow badge

**Kolom Tabel:**
| Kolom | Deskripsi |
|-------|-----------|
| Part Number | Kode part material |
| Nama Material | Nama lengkap material |
| Mesin | Tipe mesin yang menggunakan |
| Stok Akhir | Jumlah stok tersisa (dengan badge warna) |
| Status | Status kritis dengan icon (HABIS/KRITIS/Perlu Perhatian) |
| Jenis Barang | Kategori material |

**Sorting**: Berdasarkan `stokAkhir` (terendah ke tertinggi)

---

## API Endpoint

### GET `/api/dashboard/main`
**Authentication**: Required (Bearer token)

**Response:**
```json
{
  "topMaterials": [
    {
      "partNumber": "0490 1316",
      "material": "CYLINDER LINER",
      "mesin": "TCD 2013",
      "jenisBarang": "SPARE PART UTAMA",
      "totalKeluar": 25,
      "frekuensi": 8
    }
  ],
  "criticalStock": [
    {
      "partNumber": "51.12503-0059",
      "material": "FILTER BBM",
      "mesin": "MAN D 2842 LE 201",
      "jenisBarang": "FILTER",
      "stokMasuk": 10,
      "stokKeluar": 8,
      "stokAkhir": 2
    }
  ],
  "summary": {
    "totalTransactions": 150,
    "totalTopMaterials": 10,
    "totalCriticalStock": 5
  }
}
```

**Logic Perhitungan:**

#### Top Materials:
```typescript
// Filter transaksi keluar saja
dbTransactions.filter(tx => tx.jenis_transaksi.includes('Keluar'))

// Agregasi per part number
materialFrequency[partNumber] = {
  partNumber, material, mesin, jenisBarang,
  totalKeluar: sum(jumlah),     // Total quantity keluar
  frekuensi: count(transaksi)   // Berapa kali transaksi
}

// Sort by frekuensi descending, ambil top 10
.sort((a, b) => b.frekuensi - a.frekuensi).slice(0, 10)
```

#### Critical Stock:
```typescript
// Hitung stok akhir per part number
stockMap[partNumber] = {
  stokMasuk: sum(jumlah where jenis_transaksi = 'Masuk'),
  stokKeluar: sum(jumlah where jenis_transaksi = 'Keluar'),
  stokAkhir: stokMasuk - stokKeluar
}

// Filter stok ≤ 5 dan ≥ 0
.filter(s => s.stokAkhir <= 5 && s.stokAkhir >= 0)

// Sort by stokAkhir ascending
.sort((a, b) => a.stokAkhir - b.stokAkhir)
```

---

## Frontend Implementation

### Files
- **HTML**: `src/index.tsx` → `getDashboardMainHTML()`
- **JavaScript**: `public/static/dashboard-main.js`
- **Route**: `/dashboard/main`

### Auto-Refresh
Dashboard melakukan auto-refresh data setiap **5 menit** untuk memastikan data selalu up-to-date.

### Authentication Check
File `auth-check.js` memvalidasi session token sebelum mengakses dashboard. Jika tidak login, redirect ke `/login`.

---

## Navigation Menu

Dashboard Utama ditambahkan ke semua navigation bar:
```html
<a href="/dashboard/main" class="px-3 py-2 hover:bg-blue-700 rounded">
    <i class="fas fa-home mr-1"></i>Dashboard
</a>
```

**Menu Order:**
1. 🏠 Dashboard (baru)
2. ➕ Input Material
3. ⚠️ Form Gangguan
4. 📊 Stok
5. 📅 Umur
6. 🔄 Mutasi
7. 🔧 Gangguan
8. 📋 Kebutuhan

---

## Access Control

### Protected Route
Dashboard Utama **hanya bisa diakses setelah login**:
- ✅ User role: Bisa akses (read-only)
- ✅ Admin role: Bisa akses (read-only)
- ❌ Guest (tidak login): Redirect ke `/login`

### Login Credentials
```
User:
- Username: AMC@12345
- Password: 12345@AMC

Admin:
- Username: Andalcekatan
- Password: Password@123
```

---

## Testing

### 1. Test API Endpoint
```bash
# Test tanpa auth (harus gagal)
curl http://localhost:3000/api/dashboard/main

# Test dengan auth (harus sukses)
TOKEN="your-session-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dashboard/main
```

### 2. Test Dashboard Page
1. Akses: http://localhost:3000/dashboard/main
2. Jika belum login → Redirect ke `/login`
3. Login dengan credentials
4. Dashboard harus muncul dengan data

### 3. Test Data Flow
1. Input beberapa transaksi material keluar
2. Refresh Dashboard Utama
3. Verifikasi:
   - Top Materials menampilkan material yang sering keluar
   - Critical Stock menampilkan material dengan stok ≤ 5

---

## UI/UX Features

### Visual Enhancements
- **Gradient headers**: Red-orange gradient untuk eye-catching
- **Badge colors**: Status visual dengan warna semantik
- **Icons**: Font Awesome icons untuk visual context
- **Hover effects**: Interactive table rows
- **Loading states**: Spinner saat fetch data
- **Empty states**: Friendly message jika tidak ada data

### Responsive Design
- **Mobile-friendly**: Tailwind responsive classes
- **Scrollable tables**: Horizontal scroll untuk small screens
- **Flexible cards**: Grid layout auto-adjust

---

## Business Value

### 1. Top Materials Analysis
**Manfaat:**
- Identifikasi material dengan **demand tinggi**
- Planning procurement untuk material populer
- Prediksi kebutuhan material di masa depan
- Optimasi stok untuk material frequently used

**Use Case:**
> "Jika CYLINDER LINER sering keluar (frekuensi tinggi), pastikan stok selalu adequate untuk menghindari stockout saat maintenance urgent."

### 2. Critical Stock Alert
**Manfaat:**
- **Early warning system** untuk material hampir habis
- Mencegah **production downtime** akibat stockout
- Prioritas procurement untuk material kritis
- Risk mitigation untuk operasional continuity

**Use Case:**
> "Filter BBM tinggal 2 buah (KRITIS). Segera procurement sebelum habis agar tidak mengganggu operasional mesin."

---

## Changelog

### Version 1.0 (2026-01-21)
- ✅ Implement Dashboard Utama with 2 sections
- ✅ API endpoint `/api/dashboard/main`
- ✅ Frontend with analytics tables
- ✅ Auto-refresh every 5 minutes
- ✅ Protected route (login required)
- ✅ Responsive design with Tailwind CSS
- ✅ Visual enhancements with badges and colors

---

## Future Enhancements

### Potential Features
1. **Chart Visualization**:
   - Bar chart untuk top 10 materials
   - Pie chart untuk distribusi jenis barang
   - Line chart untuk trend stok bulanan

2. **Export Functionality**:
   - Export top materials ke Excel
   - Export critical stock ke PDF
   - Email alert untuk stok kritis

3. **Advanced Filters**:
   - Filter by jenis barang
   - Filter by mesin
   - Filter by date range

4. **Predictive Analytics**:
   - Machine learning untuk prediksi demand
   - Anomaly detection untuk unusual patterns
   - Forecast kebutuhan material

---

## Troubleshooting

### Issue 1: Data tidak muncul
**Solusi:**
- Cek apakah sudah ada transaksi di database
- Verifikasi session token valid
- Cek console browser untuk error API

### Issue 2: Redirect ke login terus
**Solusi:**
- Clear session storage
- Login ulang dengan credentials yang benar
- Cek `auth-check.js` loaded dengan benar

### Issue 3: Stok kritis tidak muncul
**Solusi:**
- Pastikan ada material dengan stok ≤ 5
- Verifikasi kalkulasi stok di API
- Test dengan data dummy

---

## Status

✅ **Implemented**: Dashboard Utama fully functional  
✅ **Tested**: API dan frontend working  
✅ **Deployed**: Running on port 3000  
✅ **Committed**: Git commit berhasil  

**Access URL**: http://localhost:3000/dashboard/main (after login)

---

**Created**: 2026-01-21  
**Author**: System  
**Version**: 1.0
