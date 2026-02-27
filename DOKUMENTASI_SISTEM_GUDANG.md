# 📦 DOKUMENTASI SISTEM MANAJEMEN GUDANG AMC KAL 2

**Versi:** 2.0  
**Tanggal:** 2026-02-25  
**Platform:** Cloudflare Pages + D1 Database  
**URL Production:** https://amc-kal-2-gudang.pages.dev

---

## 📑 DAFTAR ISI

1. [Login & Autentikasi](#1-login--autentikasi)
2. [Dashboard Utama](#2-dashboard-utama)
3. [Form Gangguan & Permintaan Material (LH05)](#3-form-gangguan--permintaan-material-lh05)
4. [Input Material](#4-input-material)
5. [Dashboard Analytics](#5-dashboard-analytics)
6. [Menu Stok](#6-menu-stok)
7. [Menu Umur Material](#7-menu-umur-material)
8. [Menu Mutasi](#8-menu-mutasi)
9. [Menu Gangguan](#9-menu-gangguan)
10. [Menu Kebutuhan Material](#10-menu-kebutuhan-material)
11. [Menu Pengadaan](#11-menu-pengadaan)
12. [Menu Resume](#12-menu-resume)
13. [Alur Material Flow](#13-alur-material-flow)
14. [Role & Permission](#14-role--permission)

---

## 1. LOGIN & AUTENTIKASI

### 1.1 Halaman Login
**URL:** `https://amc-kal-2-gudang.pages.dev/login`

**Fitur:**
- Username & Password authentication
- Session token disimpan di localStorage
- Auto-redirect ke dashboard setelah login sukses

**User Credentials:**

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| **Admin** | admin | admin123 | Full access (semua fitur + admin tools) |
| **Operator** | operator | op123 | Limited access (input & view only) |
| **Viewer** | viewer | view123 | Read-only access |

### 1.2 Session Management
- **Session Token**: Tersimpan di localStorage dengan key `sessionToken`
- **User Info**: Username & role tersimpan di localStorage
- **Auto Logout**: Session akan hilang jika localStorage dihapus
- **Protected Routes**: Semua halaman dashboard require authentication

---

## 2. DASHBOARD UTAMA

### 2.1 Navigasi Menu
**URL:** `/dashboard/main` atau `/`

**Menu Utama:**
1. 📥 **Input Material** - Form input transaksi material
2. ⚠️ **Form Gangguan** - Laporan gangguan & permintaan material (Public - tanpa login)
3. 📊 **Analytics** - Dashboard statistik & grafik
4. 📦 **Stok** - Monitoring stok material
5. 📅 **Umur** - Umur pakai material & history penggantian
6. 🔄 **Mutasi** - History transaksi material masuk/keluar
7. 🔧 **Gangguan** - Management laporan gangguan (Protected)
8. 📋 **Kebutuhan** - Material yang dibutuhkan dari LH05
9. 🛒 **Pengadaan** - Material dalam proses pengadaan
10. 📈 **Resume** - Ringkasan & laporan lengkap

### 2.2 Dashboard Analytics

**Tampilan:**
- **Total Material**: Jumlah total part number di gudang
- **Material Tersedia**: Material ready untuk dikirim (stok > 0, belum terkirim)
- **Material Terkirim**: Material yang sudah dikirim ke lokasi
- **Grafik Transaksi**: Bar chart transaksi masuk vs keluar per bulan

---

## 3. FORM GANGGUAN & PERMINTAAN MATERIAL (LH05)

### 3.1 Akses
**URL:** `/form-gangguan`  
**Status:** **PUBLIC** - Tidak perlu login  
**Tujuan:** Operator lokasi dapat melaporkan gangguan dan request material

### 3.2 Form Fields

#### A. Informasi Gangguan
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| **Nomor LH05** | Text | ✅ | Format: 0001/ND KAL 2/LH05/2026 |
| **Tanggal Laporan** | Date | ✅ | Tanggal kejadian gangguan |
| **Jenis Gangguan** | Dropdown | ✅ | Pilihan: Breakdown, Preventive Maintenance, Service Rutin, Emergency |
| **Lokasi Gangguan** | Dropdown | ✅ | Lokasi unit (KUDANGAN, TELAGA PULANG, TUMPUNG LAUNG, dll) |
| **User Pelapor** | Text | ✅ | Nama teknisi/operator yang melaporkan |
| **Catatan Tindakan** | Textarea | ❌ | Deskripsi tindakan yang dilakukan |
| **Rencana Perbaikan** | Textarea | ❌ | Rencana perbaikan selanjutnya |

#### B. Material yang Dibutuhkan (Multiple Entry)

**Per Material:**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| **Part Number** | Text | ✅ | Kode part material |
| **Jenis Barang** | Dropdown | ✅ | MATERIAL HANDAL, FILTER, MATERIAL BEKAS |
| **Nama Material** | Text | ✅ | Deskripsi material |
| **Mesin** | Text | ✅ | Tipe mesin (BF6M 1013EC, TCD 2013, dll) |
| **S/N Mesin** | Text | ✅ | Serial number mesin yang bermasalah |
| **Jumlah** | Number | ✅ | Qty material yang dibutuhkan |

**Aksi:**
- ➕ **Tambah Material**: Menambah entry material baru
- 🗑️ **Hapus**: Menghapus material dari list

#### C. Tanda Tangan Digital
- **Tanda Tangan Teknisi**: Canvas untuk tanda tangan pelapor
- **Tanda Tangan Supervisor**: Canvas untuk approval supervisor

### 3.3 Submit & Validasi
- **Validasi**: Semua field required harus diisi
- **Submit**: Data disimpan ke tabel `gangguan` dan `material_gangguan`
- **Status Default**: "Open"
- **Redirect**: Setelah submit, kembali ke form kosong dengan pesan sukses

### 3.4 Setelah Submit
Material yang disubmit akan muncul di:
1. **Menu Gangguan** (untuk admin/operator)
2. **Menu Kebutuhan Material** (dengan status N/A - menunggu keputusan)

---

## 4. INPUT MATERIAL

### 4.1 Jenis Transaksi

#### A. Material Masuk (Penerimaan Gudang)
**URL:** `/dashboard/main` → Tab "Material Masuk"

**Fungsi:** Input material yang masuk ke gudang (dari supplier, RAB, atau transfer)

**Form Fields:**
| Field | Keterangan |
|-------|------------|
| **Nomor BA** | Auto-generate (BA-YYYY-XXXX) |
| **Tanggal** | Tanggal penerimaan |
| **Lokasi Asal** | Supplier/Gudang/Lokasi asal |
| **Lokasi Tujuan** | GUDANG KAL 2 (default) |
| **Pemeriksa** | Nama pemeriksa (dropdown) |
| **Penerima** | Nama penerima (dropdown) |
| **Materials** | List material yang diterima |

**Material Input:**
- Part Number
- Jenis Barang
- Nama Material
- Mesin
- S/N Material (bisa pakai nomor RAB jika dari RAB)
- Jumlah

**Efek:**
- ✅ Material ditambahkan ke tabel `transactions` (jenis: Masuk)
- ✅ Stok material **bertambah** di tabel `stok`
- ✅ Material muncul di menu Mutasi

#### B. Material Keluar (Pengeluaran Gudang)
**URL:** `/dashboard/main` → Tab "Material Keluar"

**Sub-Menu:**
1. **Tambah Material dari LH05** - Pilih dari daftar kebutuhan material (LH05)
2. **Tambah Material Manual** - Input manual tanpa LH05

**Fitur Material Keluar dari LH05:**

**Step 1: Pilih Nomor LH05**
- Dropdown berisi semua nomor LH05 yang ada
- Otomatis load material dari LH05 tersebut

**Step 2: Pilih Material**
- Checkbox untuk setiap material
- **Status Badge:**
  - 🟢 **Tersedia** (stok >= jumlah diminta) - bisa dipilih
  - 🔴 **Stok Tidak Cukup** (stok < jumlah diminta) - **checkbox disabled** ✅
  - 🟡 **Stok Habis** (stok = 0) - checkbox disabled
  - 🔵 **Sudah Terkirim** - checkbox disabled
  - ⚫ **Sudah Ditambahkan** - checkbox disabled

**Validasi Stok (CRITICAL):**
```
IF stok < jumlah diminta:
  → Checkbox DISABLED
  → Tampil warning: "Stok Tidak Cukup! Tersedia: X, Diminta: Y"
  → Tidak bisa ditambahkan ke transaksi
```

**Step 3: Preview & Submit**
- Preview material yang dipilih
- Input Pemeriksa & Penerima
- Tanda tangan digital (Pemeriksa & Penerima)
- Submit untuk create BA

**Efek:**
- ✅ BA baru dibuat di tabel `transactions` (jenis: Keluar)
- ✅ Stok material **berkurang** di tabel `stok`
- ✅ Status material di `material_gangguan` → **Terkirim**
- ✅ Material muncul di menu Mutasi & Umur Material

---

## 5. DASHBOARD ANALYTICS

### 5.1 Statistik Cards
**URL:** `/dashboard/analytics`

**Metrics Ditampilkan:**
1. **Total Material**: Jumlah unique part number
2. **Material Tersedia**: Material dengan stok > 0 dan belum terkirim
3. **Material Terkirim**: Material yang sudah dikirim (isTerkirim = true)
4. **Total Transaksi**: Jumlah seluruh transaksi

### 5.2 Grafik

#### A. Transaksi per Bulan (Bar Chart)
- **Sumbu X**: Bulan (Jan, Feb, Mar, ...)
- **Sumbu Y**: Jumlah transaksi
- **Data**:
  - Bar hijau: Transaksi Masuk
  - Bar merah: Transaksi Keluar

#### B. Top 10 Material (Pie Chart)
- Material yang paling sering keluar
- Warna berbeda per material

---

## 6. MENU STOK

### 6.1 Tampilan
**URL:** `/dashboard/stok`

**Tabel Stok Material:**
| Kolom | Keterangan |
|-------|------------|
| **No** | Nomor urut |
| **Part Number** | Kode part material |
| **Jenis Barang** | MATERIAL HANDAL / FILTER / MATERIAL BEKAS |
| **Material** | Nama material |
| **Stok** | Jumlah stok tersedia |

### 6.2 Filter
- **Jenis Barang**: Filter by MATERIAL HANDAL / FILTER / MATERIAL BEKAS
- **Search**: Cari by part number atau nama material

### 6.3 Color Coding
- 🟢 **Stok > 0**: Hijau (Tersedia)
- 🔴 **Stok = 0**: Merah (Habis)

### 6.4 Export
- **Export to Excel**: Download tabel stok ke file .xlsx

---

## 7. MENU UMUR MATERIAL

### 7.1 Fungsi
**URL:** `/dashboard/umur`

**Tujuan:** Monitor umur pakai material & jadwal penggantian

### 7.2 Tabel Umur Material
| Kolom | Keterangan |
|-------|------------|
| **Part Number** | Kode part material |
| **Material** | Nama material |
| **Mesin** | Tipe mesin |
| **S/N Mesin** | Serial number mesin |
| **Lokasi** | Lokasi unit |
| **Tanggal Pasang** | Tanggal material dipasang |
| **Umur Hari** | Jumlah hari sejak dipasang |
| **Target Umur** | Target umur (hari) sebelum ganti |
| **Sisa Hari** | Hari tersisa sebelum overdue |
| **Status** | Warna badge (hijau, kuning, merah) |

### 7.3 Status Umur Material

| Status | Kondisi | Warna | Keterangan |
|--------|---------|-------|------------|
| **Aman** | Sisa ≥ 30 hari | 🟢 Hijau | Material masih aman |
| **Perhatian** | 0 < Sisa < 30 hari | 🟡 Kuning | Segera rencanakan penggantian |
| **Overdue** | Sisa < 0 | 🔴 Merah | Sudah melewati target umur |

### 7.4 History Penggantian Material
**Klik Part Number** → Modal "History Penggantian Material"

**Tampilan:**
- **S/N Mesin**: Serial number mesin
- **Part Number**: Kode part
- **Total Penggantian**: Berapa kali sudah diganti

**Tabel History:**
| Kolom | Keterangan |
|-------|------------|
| **Penggantian Ke-** | Urutan penggantian (1, 2, 3, ...) |
| **Tanggal** | Tanggal penggantian |
| **Nomor BA** | BA Mutasi Keluar (link clickable) |
| **Dasar Pengeluaran** | Nomor LH05 yang request |
| **Unit Tujuan** | Lokasi tujuan |
| **Jumlah** | Qty material |
| **Pemeriksa** | Nama pemeriksa |
| **Penerima** | Nama penerima |

**CRITICAL FIX (2026-02-25):**
- ✅ **1 LH05 + 1 Part Number = 1 BA + 1 History Entry**
- ✅ Tidak ada lagi duplikat BA untuk material yang sama
- ✅ Example: TO616TBD (LH05 0017) sekarang hanya 1 entry (BA 0092/BA/01/2026)

### 7.5 Filter & Export
- **Filter Lokasi**: Filter by lokasi unit
- **Filter Part Number**: Search by part number
- **Export Excel**: Download tabel umur material

---

## 8. MENU MUTASI

### 8.1 Fungsi
**URL:** `/dashboard/mutasi`

**Tujuan:** Monitor semua transaksi material (masuk & keluar)

### 8.2 Tabel Mutasi
| Kolom | Keterangan |
|-------|------------|
| **Nomor BA** | Nomor BA (link clickable → detail BA) |
| **Tanggal** | Tanggal transaksi |
| **Jenis Transaksi** | Masuk (hijau) / Keluar (merah) |
| **Part Number** | Kode part material |
| **Jumlah** | Qty material |
| **Lokasi Keluar** | Lokasi asal |
| **Lokasi Tujuan** | Lokasi tujuan |
| **Pemeriksa** | Nama pemeriksa |
| **Penerima** | Nama penerima |
| **Status BA** | Status BA (Terkirim, dll) |
| **Aksi** | Admin tools (admin only) |

### 8.3 Filter (Sidebar)

**Filter Options:**
1. **Tanggal**: Filter by tanggal transaksi
2. **Nomor BA**: Search by nomor BA
3. **Part Number**: Search by part number
4. **Unit Tujuan**: Dropdown lokasi tujuan (auto-populated)

### 8.4 Detail BA (Modal)
**Klik Nomor BA** → Modal "Detail Berita Acara"

**Tampilan:**
- **Informasi BA:**
  - Nomor BA
  - Tanggal
  - Jenis Transaksi
  - Lokasi Asal → Lokasi Tujuan
  - Pemeriksa & Penerima
  - Dasar Pengeluaran (LH05)

- **Daftar Material:**
  | Part Number | Material | Mesin | S/N Mesin | Qty |
  |-------------|----------|-------|-----------|-----|

- **Aksi:**
  - 📄 **Export PDF**: Download BA dalam format PDF
  - 📊 **Export Excel**: Download BA dalam format Excel

### 8.5 Export Semua BA
**Button:** "Export Semua BA" (di sidebar)

**Fungsi:** Download semua BA dalam 1 file Excel/PDF

### 8.6 Admin Tools (Admin Only)
- **Perbaiki Data LH05 Lama**: Bulk fix untuk BA tanpa LH05
- **Perbaiki 1 BA Manual**: Fix individual BA

### 8.7 CLEANUP DUPLIKAT (2026-02-25)
**CRITICAL FIX:**
- ✅ Deleted **153 duplicate BA transactions**
- ✅ Now: **1 LH05 + 1 Part Number = 1 BA only**
- ✅ Total transactions: 295 → 145
- ✅ Keluar: 260 → 108
- ✅ Masuk: 35 → 37

---

## 9. MENU GANGGUAN

### 9.1 Fungsi
**URL:** `/dashboard/gangguan`  
**Status:** PROTECTED (login required)

**Tujuan:** Management laporan gangguan & permintaan material (LH05)

### 9.2 Tabel Gangguan
| Kolom | Keterangan |
|-------|------------|
| **Nomor LH05** | Nomor laporan (link clickable → detail) |
| **Tanggal** | Tanggal laporan |
| **Jenis Gangguan** | Breakdown, PM, Service, Emergency |
| **Lokasi** | Lokasi unit |
| **User Pelapor** | Nama pelapor |
| **Status** | Open / In Progress / Closed |
| **Aksi** | Edit, Update Status, Delete (admin only) |

### 9.3 Detail Gangguan (Modal)
**Klik Nomor LH05** → Modal "Detail Laporan Gangguan"

**Tampilan:**
- **Informasi Gangguan:**
  - Nomor LH05
  - Tanggal Laporan
  - Jenis Gangguan
  - Lokasi
  - User Pelapor
  - Status
  - Catatan Tindakan
  - Rencana Perbaikan

- **Material yang Diminta:**
  | Part Number | Material | Mesin | S/N Mesin | Qty | Status |
  |-------------|----------|-------|-----------|-----|--------|

- **Tanda Tangan:**
  - Teknisi
  - Supervisor

### 9.4 Update Status
**Flow:**
1. Open → In Progress (saat material diproses)
2. In Progress → Closed (saat semua material terkirim atau selesai)

---

## 10. MENU KEBUTUHAN MATERIAL

### 10.1 Fungsi
**URL:** `/dashboard/kebutuhan-material`

**Tujuan:** Management material yang dibutuhkan dari LH05

### 10.2 Tabel Kebutuhan
| Kolom | Keterangan |
|-------|------------|
| **No** | Nomor urut |
| **Nomor LH05** | Nomor laporan (link clickable) |
| **Part Number** | Kode part material |
| **Jenis Barang** | MATERIAL HANDAL / FILTER / MATERIAL BEKAS |
| **Material** | Nama material |
| **Mesin** | Tipe mesin |
| **S/N Mesin** | Serial number mesin |
| **Jumlah** | Qty diminta |
| **Unit Tujuan** | Lokasi unit |
| **Status** | Dropdown status (editable) |
| **Stok** | Stok tersedia di gudang |

### 10.3 Status Material & Dropdown Logic

**CRITICAL: Status Dropdown Logic (Updated 2026-02-21)**

#### Status Options & Behavior:

| Status | Kondisi | Dropdown | Keterangan |
|--------|---------|----------|------------|
| **N/A** | Stok = 0, baru masuk dari LH05 | ✏️ N/A, Pengadaan, Tunda, Reject | Belum ada keputusan |
| **Tersedia (no RAB)** | Stok > 0, belum masuk RAB | ✏️ Tersedia, Pengadaan (re-order) | Bisa dikeluarkan atau re-order |
| **Tersedia (RAB)** | Stok > 0, sudah masuk RAB | 🔒 Locked | Tidak bisa re-order (proses RAB) |
| **Pengadaan (no RAB)** | Belum buat RAB | ✏️ Pengadaan, N/A, Tunda, Reject | Bisa diubah |
| **Pengadaan (RAB)** | Sudah buat RAB | 🔒 Locked | Tidak bisa diubah (proses RAB) |
| **Tunda** | - | ✏️ Tunda, N/A, Pengadaan, Reject | Pending keputusan |
| **Reject** | - | 🔒 Locked | Tidak bisa diubah |
| **Terkirim** | BA sudah dibuat | 🔒 Locked | Material sudah dikirim |

#### Color Coding:
- 🟢 **Tersedia**: Badge hijau (stok > 0, ready to ship)
- 🟡 **Pengadaan**: Badge kuning (dalam proses pengadaan)
- 🔴 **N/A**: Badge abu-abu (tidak ada stok, belum diproses)
- ⏸️ **Tunda**: Badge abu-abu (pending)
- ❌ **Reject**: Badge merah (ditolak)
- 🚚 **Terkirim**: Badge biru (sudah dikirim)

### 10.4 Filter
- **Status**: Filter by status (N/A, Pengadaan, Tersedia, dll)
- **Mesin**: Filter by tipe mesin
- **Unit**: Filter by unit tujuan
- **Jenis Barang**: Filter by jenis barang
- **Search**: Search by nomor LH05, part number, atau nama material

### 10.5 Export
- **Export Excel**: Download tabel kebutuhan material

---

## 11. MENU PENGADAAN

### 11.1 Fungsi
**URL:** `/dashboard/pengadaan`

**Tujuan:** Management material dalam proses pengadaan

### 11.2 Sub-Menu

#### A. Pengadaan Material (List Material Status Pengadaan)
**URL:** `/dashboard/pengadaan-material`

**Tampilan:**
- Tabel material dengan status = "Pengadaan"
- Filter & search
- Aksi: Create RAB untuk material yang dipilih

#### B. Create RAB (Rencana Anggaran Biaya)
**URL:** `/dashboard/create-rab`

**Form Fields:**
| Field | Keterangan |
|-------|------------|
| **Nomor RAB** | Auto-generate (RAB-YYYY-XXXX) |
| **Tanggal** | Tanggal RAB dibuat |
| **Materials** | List material yang akan dibeli |

**Material Selection:**
- Checkbox untuk pilih multiple material
- Dari list material dengan status "Pengadaan"

**Efek setelah Create RAB:**
- ✅ Status material → **Pengadaan (RAB created)** 🔒 LOCKED
- ✅ Dropdown status disabled
- ✅ Flag `is_rab_created` = true
- ✅ RAB tersimpan di tabel `rab`

#### C. List RAB
**URL:** `/dashboard/list-rab`

**Tampilan:**
- Tabel semua RAB yang sudah dibuat
- Filter by tanggal, nomor RAB
- Aksi: 
  - 📄 View Detail
  - ✏️ Edit (jika status belum "Tersedia")
  - 🗑️ Delete (admin only)
  - ✅ Mark as Tersedia (material sudah datang)

**Detail RAB (Modal):**
- Nomor RAB
- Tanggal
- List material:
  | Part Number | Material | Qty | Status |
  |-------------|----------|-----|--------|

**Mark as Tersedia:**
- Update status material di RAB → "Tersedia"
- Material ready untuk ditarik ke "Material Masuk"

---

## 12. MENU RESUME

### 12.1 Fungsi
**URL:** `/dashboard/resume`

**Tujuan:** Ringkasan & laporan lengkap sistem gudang

### 12.2 Sections

#### A. Summary Cards
- Total Material
- Material Tersedia
- Material Terkirim
- Total Transaksi
- Material Pengadaan
- Material N/A

#### B. Grafik
- Transaksi per Bulan (Line Chart)
- Material per Jenis Barang (Pie Chart)
- Top 10 Material Most Used (Bar Chart)

#### C. Tabel Resume
- **Kebutuhan Material** (latest 20 entries)
- **Transaksi Material** (latest 20 entries)
- **Stok Material** (all)

#### D. Export
- **Export Full Report**: Download laporan lengkap (Excel)
- **Export Dashboard PDF**: Screenshot dashboard as PDF

---

## 13. ALUR MATERIAL FLOW

### 13.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATERIAL FLOW SYSTEM                         │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐
│  FORM GANGGUAN │ (Public - No Login)
│     (LH05)     │
└────────┬───────┘
         │ Submit
         ▼
┌────────────────────────────────────────────────────────────────┐
│  MENU KEBUTUHAN MATERIAL                                        │
│  Status: N/A (Stok = 0)                                         │
│  Dropdown: N/A, Pengadaan, Tunda, Reject                        │
└────────┬──────────────┬──────────────┬──────────────┬──────────┘
         │              │              │              │
         │ Pengadaan    │ Tunda        │ Reject       │ Stok > 0
         ▼              ▼              ▼              │
┌────────────────┐ ┌──────────┐ ┌──────────┐         │
│  CREATE RAB    │ │  PENDING │ │  CLOSED  │         │
│                │ │          │ │          │         │
└────────┬───────┘ └──────────┘ └──────────┘         │
         │                                            │
         │ Lock Status                                │
         │ (Pengadaan + RAB)                          │
         ▼                                            │
┌────────────────────┐                                │
│  PENGADAAN (RAB)   │                                │
│  Status: LOCKED    │                                │
│  Dropdown: DISABLED│                                │
└────────┬───────────┘                                │
         │                                            │
         │ Material Datang                            │
         ▼                                            │
┌────────────────────────────────────────────────────┴──────────┐
│  MENU INPUT MATERIAL (Material Masuk)                          │
│  - Input BA Masuk                                              │
│  - Stok bertambah                                              │
│  - S/N Material tercatat                                       │
└────────┬───────────────────────────────────────────────────────┘
         │
         │ Stok > 0
         ▼
┌────────────────────────────────────────────────────────────────┐
│  MENU KEBUTUHAN MATERIAL                                        │
│  Status: Tersedia (Stok > 0, Belum Terkirim)                   │
│  Dropdown: Tersedia, Pengadaan (Re-order)                      │
└────────┬───────────────────────────────────────────────────────┘
         │
         │ Create BA Keluar
         ▼
┌────────────────────────────────────────────────────────────────┐
│  MENU INPUT MATERIAL (Material Keluar)                         │
│  - Pilih material dari LH05                                    │
│  - VALIDASI STOK: IF stok < jumlah → DISABLED ✅              │
│  - Create BA Keluar                                            │
│  - Stok berkurang                                              │
└────────┬───────────────────────────────────────────────────────┘
         │
         │ Material Terkirim
         ▼
┌────────────────────────────────────────────────────────────────┐
│  STATUS FINAL                                                   │
│  - Status: Terkirim (LOCKED)                                   │
│  - Dropdown: DISABLED                                          │
│  - Material muncul di MENU MUTASI                              │
│  - Material muncul di MENU UMUR MATERIAL                       │
│  - History Penggantian tercatat                                │
└────────────────────────────────────────────────────────────────┘
```

### 13.2 Material Status Lifecycle

```
1. LH05 Created → Check Stock
                  ↓
   ┌──────────────┴───────────────┐
   │                              │
   Stok = 0                    Stok > 0
   Status: N/A                 Status: Tersedia
   ↓                              ↓
   User Decision:              Can Re-order:
   - Pengadaan                 - Change to Pengadaan
   - Tunda                     - OR Create BA Keluar
   - Reject                    
   ↓                              ↓
2. Pengadaan → Create RAB → LOCKED
                              ↓
3. Material Arrives → Status: Tersedia
                              ↓
4. Create BA Keluar → VALIDASI STOK ✅
                              ↓
                      IF stok >= jumlah:
                        → Allow
                      ELSE:
                        → DISABLED ❌
                              ↓
5. Status: Terkirim (LOCKED)
```

---

## 14. ROLE & PERMISSION

### 14.1 Role Matrix

| Fitur | Admin | Operator | Viewer |
|-------|-------|----------|--------|
| **Login** | ✅ | ✅ | ✅ |
| **Form Gangguan (Public)** | ✅ | ✅ | ✅ (No login) |
| **Input Material** | ✅ | ✅ | ❌ |
| **View Dashboard** | ✅ | ✅ | ✅ |
| **View Stok** | ✅ | ✅ | ✅ |
| **View Umur** | ✅ | ✅ | ✅ |
| **View Mutasi** | ✅ | ✅ | ✅ |
| **View Gangguan** | ✅ | ✅ | ✅ |
| **View Kebutuhan** | ✅ | ✅ | ✅ |
| **Update Status Material** | ✅ | ✅ | ❌ |
| **Create RAB** | ✅ | ❌ | ❌ |
| **Edit RAB** | ✅ | ❌ | ❌ |
| **Delete BA** | ✅ | ❌ | ❌ |
| **Admin Tools** | ✅ | ❌ | ❌ |
| **Export Data** | ✅ | ✅ | ✅ |

### 14.2 Admin-Only Features

**Admin Tools (Hidden for non-admin):**
- Delete BA (di Menu Mutasi)
- Fix Data LH05 (bulk fix)
- Fix BA Manual (individual fix)
- Delete RAB
- Reset Material Status
- Cleanup Duplicate BA (API endpoint)

**Class:** `.admin-only` (auto-hide jika bukan admin)

---

## 15. CRITICAL FIXES & UPDATES

### 15.1 Stock Validation (2026-02-21)
**Problem:** Material dengan stok < jumlah diminta masih bisa dipilih

**Solution:**
```javascript
const isAvailable = mat.stok >= mat.jumlah;
const isDisabled = mat.stok === 0 || !isAvailable || isAlreadySent || isAlreadyAdded;
```

**Result:**
- ✅ Checkbox disabled jika `stok < jumlah`
- ✅ Badge merah: "🔴 Stok Tidak Cukup! Tersedia: X, Diminta: Y"

### 15.2 Status Dropdown Logic (2026-02-21)
**Problem:** Dropdown tidak sesuai dengan kondisi RAB

**Solution:**
- ✅ Tersedia + No RAB → Editable (can re-order)
- ✅ Tersedia + RAB Created → LOCKED (cannot re-order)
- ✅ Pengadaan + No RAB → Editable
- ✅ Pengadaan + RAB Created → LOCKED
- ✅ Reject, Terkirim → LOCKED

### 15.3 Menu Mutasi Fix (2026-02-25)
**Problem:** Data transaksi tidak muncul (error: "udentry is not defined")

**Solution:**
- ✅ Remove cache buster dari script tags
- ✅ Script now loads correctly

**Result:**
- ✅ 145 transaksi ditampilkan dengan benar

### 15.4 Cleanup Duplicate BA (2026-02-25)
**Problem:** 1 LH05 + 1 Part Number → Multiple BA (duplikat)

**Example:**
- LH05 0017 + Part TO616TBD → 4 BA (0092, 0059, 0034, 0009)

**Solution:**
- ✅ Created API endpoint: `POST /api/cleanup-duplicate-ba`
- ✅ Strategy: Keep latest BA, delete older ones
- ✅ Delete materials first, then transactions

**Result:**
- ✅ Deleted **153 duplicate BA**
- ✅ Processed **117 duplicate groups**
- ✅ Total transactions: 295 → 145
- ✅ Now: **1 LH05 + 1 Part = 1 BA + 1 History** ✅

### 15.5 S/N Synchronization (2026-02-20)
**Problem:** S/N di BA/Mutasi tidak match dengan S/N di LH05

**Solution:**
- ✅ Created API endpoints:
  - `POST /api/sync-sn-to-materials`
  - `POST /api/fix-tersedia-sn`
- ✅ Sync S/N from `material_gangguan` to `materials` table

**Result:**
- ✅ Updated **508 materials**
- ✅ All S/N now match: LH05 ↔ BA ↔ Umur
- ✅ Example: BA-2026-0046 → SN 12022517 ✅

---

## 16. DATABASE SCHEMA

### 16.1 Main Tables

#### A. `gangguan` (LH05 Laporan)
```sql
- id (PK, AUTOINCREMENT)
- nomor_lh05 (UNIQUE)
- tanggal_laporan (DATE)
- jenis_gangguan (TEXT)
- lokasi_gangguan (TEXT)
- user_laporan (TEXT)
- status (TEXT, default: 'Open')
- catatan_tindakan (TEXT)
- rencana_perbaikan (TEXT)
- ttd_teknisi (TEXT)
- ttd_supervisor (TEXT)
- created_at (DATETIME)
- updated_at (DATETIME)
```

#### B. `material_gangguan` (Material dari LH05)
```sql
- id (PK, AUTOINCREMENT)
- gangguan_id (FK → gangguan.id)
- part_number (TEXT)
- jenis_barang (TEXT)
- material (TEXT)
- mesin (TEXT)
- sn_mesin (TEXT)
- jumlah (INTEGER)
- status (TEXT, default: 'N/A')
- lokasi_tujuan (TEXT)
- stok (INTEGER, default: 0)
- isTerkirim (BOOLEAN, default: false)
- is_rab_created (BOOLEAN, default: false)
- created_at (DATETIME)
- updated_at (DATETIME)
```

#### C. `transactions` (BA Masuk/Keluar)
```sql
- id (PK, AUTOINCREMENT)
- nomor_ba (UNIQUE)
- tanggal (DATE)
- jenis_transaksi (TEXT)
- lokasi_asal (TEXT)
- lokasi_tujuan (TEXT)
- pemeriksa (TEXT)
- penerima (TEXT)
- ttd_pemeriksa (TEXT)
- ttd_penerima (TEXT)
- from_lh05 (TEXT, nullable)
- created_at (DATETIME)
```

#### D. `materials` (Detail Material di BA)
```sql
- id (PK, AUTOINCREMENT)
- transaction_id (FK → transactions.id)
- part_number (TEXT)
- jenis_barang (TEXT)
- material (TEXT)
- mesin (TEXT)
- sn_mesin (TEXT)
- jumlah (INTEGER)
- created_at (DATETIME)
```

#### E. `stok` (Stok Material)
```sql
- id (PK, AUTOINCREMENT)
- part_number (TEXT, UNIQUE)
- jenis_barang (TEXT)
- material (TEXT)
- stok (INTEGER, default: 0)
- updated_at (DATETIME)
```

#### F. `rab` (Rencana Anggaran Biaya)
```sql
- id (PK, AUTOINCREMENT)
- nomor_rab (UNIQUE)
- tanggal (DATE)
- materials (TEXT, JSON)
- status (TEXT, default: 'Pending')
- created_at (DATETIME)
```

#### G. `users` (User Authentication)
```sql
- id (PK, AUTOINCREMENT)
- username (UNIQUE)
- password (TEXT, hashed)
- role (TEXT)
- created_at (DATETIME)
```

---

## 17. API ENDPOINTS

### 17.1 Authentication
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user

### 17.2 Gangguan & LH05
- `POST /api/form-gangguan` - Submit form gangguan (public)
- `GET /api/gangguan` - Get all gangguan
- `GET /api/gangguan/:id` - Get gangguan by ID
- `PUT /api/gangguan/:id` - Update gangguan
- `DELETE /api/gangguan/:id` - Delete gangguan (admin)

### 17.3 Material Kebutuhan
- `GET /api/kebutuhan-material` - Get all kebutuhan material
- `POST /api/update-material-status` - Update status material
- `POST /api/reset-material-status` - Reset material status (admin)

### 17.4 Transactions (BA)
- `GET /api/transactions` - Get all transactions
- `POST /api/save-transaction` - Create new BA
- `GET /api/transactions/:ba` - Get BA by nomor_ba
- `DELETE /api/transactions/:id` - Delete BA (admin)

### 17.5 Stok
- `GET /api/stok` - Get all stok material
- `POST /api/update-stok` - Update stok (internal)

### 17.6 RAB & Pengadaan
- `POST /api/create-rab` - Create RAB
- `GET /api/list-rab` - Get all RAB
- `GET /api/rab/:id` - Get RAB by ID
- `PUT /api/rab/:id` - Update RAB
- `DELETE /api/rab/:id` - Delete RAB (admin)
- `POST /api/mark-rab-tersedia` - Mark RAB material as Tersedia

### 17.7 Analytics & Resume
- `GET /api/dashboard-stats` - Get dashboard statistics
- `GET /api/analytics` - Get analytics data

### 17.8 Admin Tools
- `POST /api/sync-sn-to-materials` - Sync S/N from LH05 to BA/Mutasi
- `POST /api/fix-tersedia-sn` - Fix "Tersedia" S/N
- `POST /api/cleanup-duplicate-ba` - Cleanup duplicate BA (CRITICAL)
- `POST /api/fix-lh05-jenis` - Fix LH05 jenis_transaksi (bulk)
- `POST /api/fix-single-ba` - Fix single BA manual

### 17.9 Dropdown Values
- `GET /api/dropdown-values` - Get all dropdown values (lokasi, pemeriksa, penerima)

---

## 18. TEKNOLOGI & DEPLOYMENT

### 18.1 Tech Stack
- **Frontend**: HTML, TailwindCSS, JavaScript (Vanilla)
- **Backend**: Hono Framework (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Hosting**: Cloudflare Pages
- **CDN Libraries**:
  - TailwindCSS
  - Font Awesome
  - Chart.js
  - xlsx (Excel export)
  - jsPDF (PDF export)

### 18.2 Deployment
- **Production URL**: https://amc-kal-2-gudang.pages.dev
- **Build Command**: `npm run build`
- **Deploy Command**: `npx wrangler pages deploy dist --project-name amc-kal-2-gudang`

### 18.3 Local Development
```bash
# Build
npm run build

# Start dev server
npm run dev:sandbox
# or
pm2 start ecosystem.config.cjs

# Test
curl http://localhost:3000
```

---

## 19. BACKUP & RECOVERY

### 19.1 Latest Backup
**File:** https://www.genspark.ai/api/files/s/EUaEWSyJ  
**Size:** 12.3 MB  
**Date:** 2026-02-25  
**Description:** Duplicate BA cleanup complete - All systems working

### 19.2 Database Backup
**D1 Database Export:**
```bash
npx wrangler d1 export webapp-production --local > backup.sql
```

**D1 Database Import:**
```bash
npx wrangler d1 execute webapp-production --local --file=backup.sql
```

---

## 20. TROUBLESHOOTING

### 20.1 Common Issues

#### A. Login Gagal
**Problem:** Cannot login with correct credentials

**Solution:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Try login again

#### B. Data Tidak Muncul
**Problem:** Tabel kosong atau loading terus

**Solution:**
1. Check API response di Network tab (F12)
2. Clear cache browser (Ctrl+Shift+Delete)
3. Reload page (Ctrl+F5)

#### C. Stok Tidak Update
**Problem:** Stok material tidak berubah setelah transaksi

**Solution:**
1. Check API `/api/update-stok`
2. Manual recalculate: Sum(Masuk) - Sum(Keluar)
3. Call admin tool: `POST /api/fix-stock-after-cleanup`

#### D. Duplikat BA Muncul Lagi
**Problem:** Setelah cleanup, duplikat BA muncul lagi

**Solution:**
1. Pastikan tidak input BA manual untuk LH05 yang sama
2. Call cleanup lagi: `POST /api/cleanup-duplicate-ba`
3. Verify: Check menu Mutasi & Umur Material

---

## 21. CHANGELOG

### Version 2.0 (2026-02-25)
- ✅ **CRITICAL**: Cleanup duplicate BA (153 BA deleted)
- ✅ **CRITICAL**: 1 LH05 + 1 Part = 1 BA only
- ✅ Fix Menu Mutasi not loading data
- ✅ Total transactions: 295 → 145

### Version 1.9 (2026-02-21)
- ✅ Stock validation for Material Keluar
- ✅ Status dropdown logic complete
- ✅ Tersedia + RAB lock/unlock
- ✅ Pengadaan + RAB lock

### Version 1.8 (2026-02-20)
- ✅ S/N synchronization (508 materials)
- ✅ FILTER/RACOR reset complete
- ✅ Non-FILTER sync (148 materials)
- ✅ BA modal fixed in Mutasi menu

### Version 1.7 (2026-02-19)
- ✅ Status auto-update logic restored
- ✅ Material status based on stock + isTerkirim

---

## 22. KONTAK & SUPPORT

**Project Owner:** AMC KAL 2  
**Deployment Date:** 2026-02-25  
**Documentation Version:** 2.0  
**Last Updated:** 2026-02-25 10:00 WIB

---

## 23. APPENDIX

### 23.1 Dropdown Values

#### A. Lokasi Unit
- KUDANGAN
- TELAGA PULANG
- TUMPUNG LAUNG
- KERASIAN
- SUNGAI BALI
- MENDAWAI
- PEGATAN
- TUMBANG MANJUL
- KENAMBUI

#### B. Jenis Gangguan
- Breakdown
- Preventive Maintenance
- Service Rutin
- Emergency

#### C. Jenis Barang
- MATERIAL HANDAL
- FILTER
- MATERIAL BEKAS

#### D. Status Material
- N/A
- Pengadaan
- Tersedia
- Tunda
- Reject
- Terkirim

### 23.2 File Structure
```
AMC-KAL-2-GUDANG-fix/
├── src/
│   └── index.tsx              # Main backend file (Hono)
├── public/
│   └── static/
│       ├── auth-check.js      # Auth middleware
│       ├── dashboard-kebutuhan.js
│       ├── dashboard-mutasi-63f7bc43.js
│       ├── form-lh05-input.js
│       └── ...
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_seed_data.sql
│   └── ...
├── wrangler.jsonc            # Cloudflare config
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── ecosystem.config.cjs      # PM2 config (sandbox only)
└── README.md                 # Project README
```

---

**END OF DOCUMENTATION**

---

**Catatan:**
Dokumentasi ini mencakup semua fitur sistem gudang AMC KAL 2 per tanggal 2026-02-25. Untuk update terbaru, silakan cek commit history di GitHub repository.

**GitHub Repository:** https://github.com/amcndkal2-hub/AMC-KAL-2-GUDANG

