# Sistem Inventaris Spare Part

## Project Overview
- **Name**: Sistem Inventaris Spare Part
- **Goal**: Aplikasi web untuk mengelola transaksi inventaris spare part dengan integrasi Google Sheets
- **Features**: 
  - Form input transaksi material
  - Searchable part number dengan autofill
  - Dropdown dinamis untuk lokasi, pemeriksa, dan penerima
  - Tanda tangan digital menggunakan signature pad
  - Validasi form dan data submission

## URLs
- **Development (Sandbox)**: https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai
- **Production**: (belum di-deploy)
- **GitHub**: (belum di-setup)

## Fitur yang Sudah Selesai
1. ✅ Backend API dengan Hono framework
2. ✅ Integrasi dengan Google Sheets JSON API
3. ✅ Searchable part number dengan autofill otomatis (Jenis Barang, Material, Mesin)
4. ✅ Dropdown dinamis untuk:
   - Lokasi Keluar/Asal
   - Lokasi Tujuan
   - Nama Pemeriksa
   - Nama Penerima
5. ✅ Input manual untuk S/N Mesin dan Jumlah
6. ✅ Signature pad untuk tanda tangan digital (touchscreen support)
7. ✅ Form validation dan data submission

## Fitur yang Belum Diimplementasikan
1. ⏳ Penyimpanan data transaksi ke database atau Google Sheets
2. ⏳ Export data ke PDF/Excel
3. ⏳ History transaksi
4. ⏳ Dashboard dan reporting
5. ⏳ User authentication
6. ⏳ Multiple material items dalam satu transaksi

## Data Architecture
- **Data Source**: Google Sheets JSON API
- **Storage Services**: 
  - Cache in-memory (5 menit)
  - Future: Cloudflare D1/KV untuk persistent storage
- **Data Models**:
  ```typescript
  interface SparePartData {
    JENIS_BARANG: string
    PART_NUMBER: number | string
    MATERIAL: string
    MESIN: string
    UNIT: string
    Pemeriksa: string
    Penerima: string
  }
  
  interface Transaction {
    tanggal: string
    jenisTransaksi: string
    lokasiAsal: string
    lokasiTujuan: string
    pemeriksa: string
    penerima: string
    ttdPemeriksa: string (base64)
    ttdPenerima: string (base64)
    materials: Material[]
  }
  ```

## API Endpoints

### 1. GET /api/data
Mengambil semua data spare part dari Google Sheets
```bash
curl https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai/api/data
```

### 2. GET /api/search-part?q=<query>
Mencari part number berdasarkan query
```bash
curl https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai/api/search-part?q=1319257
```

### 3. GET /api/dropdown-values
Mengambil nilai unik untuk dropdown (units, pemeriksa, penerima)
```bash
curl https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai/api/dropdown-values
```

### 4. POST /api/save-transaction
Menyimpan data transaksi (currently logs to console)
```bash
curl -X POST https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai/api/save-transaction \
  -H "Content-Type: application/json" \
  -d '{"tanggal":"2025-12-14","jenisTransaksi":"Keluar",...}'
```

## User Guide

### Cara Menggunakan Aplikasi

1. **Buka aplikasi** di browser:
   - Development: https://3000-itxfls7jninzh0h0emwqh-b32ec7bb.sandbox.novita.ai

2. **Isi Informasi Umum**:
   - Pilih tanggal transaksi
   - Pilih jenis transaksi (Keluar/Masuk)
   - Pilih lokasi asal dan tujuan dari dropdown

3. **Isi Detail Material**:
   - **Cara 1 - Search Part Number**: Ketik part number di kolom "Part Number (Cari)"
     - Sistem akan menampilkan hasil pencarian
     - Klik hasil yang sesuai
     - Data Jenis Barang, Material, dan Mesin akan terisi otomatis
   
   - **Cara 2 - Pilih dari Dropdown**: Ketik sebagian part number untuk melihat pilihan
   
   - Isi S/N Mesin secara manual (contoh: SN-EXC-001)
   - Isi jumlah/kuantitas

4. **Tambah Material** (opsional):
   - Klik tombol "Tambah Baris Material" untuk menambah item lain
   - Klik tombol "Hapus" untuk menghapus baris yang tidak diperlukan

5. **Isi Penanggung Jawab**:
   - Pilih nama Pemeriksa dari dropdown
   - Tanda tangan di area signature pad (support mouse dan touchscreen)
   - Pilih nama Penerima dari dropdown
   - Tanda tangan di area signature pad kedua

6. **Submit**:
   - Klik tombol "Simpan Transaksi"
   - Sistem akan validasi:
     - Semua field wajib terisi
     - Minimal 1 material
     - Kedua tanda tangan harus ada
   - Jika berhasil, akan muncul notifikasi sukses

7. **Reset Form**:
   - Klik tombol "Reset" untuk mengosongkan form
   - Konfirmasi akan muncul sebelum form di-reset

## Development

### Local Development
```bash
# Install dependencies
npm install

# Build project
npm run build

# Start development server (sandbox)
pm2 start ecosystem.config.cjs

# Or using wrangler directly
npm run dev:sandbox

# Test service
curl http://localhost:3000
```

### Deployment to Cloudflare Pages
```bash
# Build and deploy
npm run deploy:prod

# Or manual steps:
npm run build
wrangler pages deploy dist --project-name webapp
```

## Tech Stack
- **Backend**: Hono v4.11.0 (lightweight web framework)
- **Frontend**: HTML5 + Vanilla JavaScript
- **Styling**: Tailwind CSS v3 (via CDN)
- **Icons**: FontAwesome v6.4.0
- **Platform**: Cloudflare Pages/Workers
- **Build Tool**: Vite v6.3.5
- **Process Manager**: PM2 (for sandbox development)

## Project Structure
```
webapp/
├── src/
│   ├── index.tsx          # Main Hono application
│   └── renderer.tsx       # JSX renderer
├── public/
│   └── static/
│       └── app.js         # Frontend JavaScript
├── dist/                  # Build output
├── ecosystem.config.cjs   # PM2 configuration
├── package.json          # Dependencies
├── wrangler.jsonc        # Cloudflare configuration
└── README.md            # Documentation
```

## Rekomendasi Pengembangan Selanjutnya

### High Priority
1. **Implement Database Storage**: 
   - Setup Cloudflare D1 untuk persistent storage
   - Create migrations dan schema
   - Implement save transaction ke database

2. **Export/Print Feature**:
   - Generate PDF untuk bukti transaksi
   - Include signature images dalam PDF
   - Add print button

3. **Transaction History**:
   - Halaman untuk melihat history transaksi
   - Filter by date, location, part number
   - Search functionality

### Medium Priority
4. **User Authentication**:
   - Login system dengan role (admin, operator)
   - Hanya admin yang bisa hapus/edit transaksi
   - Audit trail untuk setiap perubahan

5. **Dashboard & Analytics**:
   - Statistik penggunaan spare part
   - Chart untuk trend konsumsi
   - Low stock alert

6. **Mobile Optimization**:
   - Responsive design improvements
   - Touch-friendly interface
   - Offline mode dengan service worker

### Low Priority
7. **Advanced Features**:
   - Barcode scanning untuk part number
   - Photo upload untuk kondisi barang
   - Email notification untuk transaksi penting
   - Integration dengan sistem ERP

## Status
- **Platform**: Cloudflare Pages (Development)
- **Status**: ✅ Active (Sandbox)
- **Last Updated**: 2025-12-14

## Notes
- Cache duration untuk data Google Sheets: 5 menit
- Signature images disimpan dalam format base64 PNG
- Form validation dilakukan di client-side dan server-side
- Support untuk multiple material items dalam satu transaksi (unlimited)

## Contact & Support
Untuk pertanyaan atau issue, silakan hubungi tim developer.
