# PERBAIKAN: Data Gangguan Hilang Setelah Login Lagi

## Masalah
Data form gangguan yang sudah diinput **hilang setelah beberapa menit** atau setelah login kembali. Data tidak muncul di:
- Dashboard Gangguan
- Dashboard Kebutuhan Material

## Penyebab ROOT CAUSE
Data gangguan **HANYA disimpan di in-memory storage** (`gangguanTransactions`), tidak disimpan ke **D1 Database** yang persistent.

```typescript
// ❌ KODE LAMA (SALAH) - Data hilang saat restart
app.post('/api/save-gangguan', async (c) => {
  const body = await c.req.json()
  const nomorLH05 = generateNomorLH05() // Generate lokal, bukan dari DB
  
  const gangguan = { id: Date.now().toString(), nomorLH05, ...body }
  gangguanTransactions.push(gangguan) // ⚠️ HANYA simpan di memory!
  
  return c.json({ success: true, nomorLH05 })
})
```

**Konsekuensi:**
- ⚠️ Data hilang saat PM2 restart
- ⚠️ Data hilang saat server reboot
- ⚠️ Data tidak persistent
- ⚠️ Multi-user tidak sinkron

---

## Solusi yang Diterapkan

### 1. **Perbaikan: `/api/save-gangguan` - Simpan ke D1 Database**

```typescript
// ✅ KODE BARU (BENAR) - Data persistent di D1
app.post('/api/save-gangguan', async (c) => {
  const { env } = c
  const body = await c.req.json()
  
  // Generate Nomor LH05 dari D1 Database (auto-increment)
  const nomorLH05 = await DB.getNextLH05Number(env.DB)
  
  // Save ke D1 Database (PERSISTENT!)
  const result = await DB.saveGangguan(env.DB, {
    nomorLH05,
    ...body
  })
  
  console.log('✅ Gangguan saved to D1 Database successfully')
  
  // Fallback: juga simpan ke in-memory untuk backward compatibility
  const gangguan = {
    id: result.id.toString(),
    nomorLH05,
    ...body,
    createdAt: new Date().toISOString()
  }
  gangguanTransactions.push(gangguan)
  
  return c.json({ 
    success: true, 
    message: 'Form gangguan saved successfully (D1 Database)',
    nomorLH05,
    data: gangguan 
  })
})
```

**Keuntungan:**
- ✅ Data persistent di D1 Database
- ✅ Tidak hilang saat restart
- ✅ Multi-user synchronized
- ✅ Backup otomatis

---

### 2. **Perbaikan: `/api/gangguan-transactions` - Baca dari D1**

```typescript
// ✅ KODE BARU - Baca dari D1 Database
app.get('/api/gangguan-transactions', async (c) => {
  const { env } = c
  
  // Get from D1 Database (persistent storage)
  const dbGangguan = await DB.getAllGangguan(env.DB)
  console.log('📊 Total gangguan from D1:', dbGangguan.length)
  
  // Merge dengan in-memory untuk backward compatibility
  const allGangguan = [...dbGangguan, ...gangguanTransactions]
  
  return c.json({ gangguanTransactions: allGangguan })
})
```

---

### 3. **Perbaikan: `/api/dashboard/gangguan` - Baca dari D1**

```typescript
// ✅ KODE BARU - Dashboard membaca dari D1
app.get('/api/dashboard/gangguan', async (c) => {
  const { env } = c
  const kelompok = c.req.query('kelompok') || ''
  const tanggal = c.req.query('tanggal') || ''
  
  // Get from D1 Database
  let data = await DB.getAllGangguan(env.DB)
  
  if (kelompok) data = data.filter((g: any) => g.jenis_gangguan === kelompok)
  if (tanggal) data = data.filter((g: any) => g.tanggal_laporan?.includes(tanggal))
  
  return c.json({ data })
})
```

---

### 4. **Perbaikan: `/api/kebutuhan-material` - Baca dari D1**

```typescript
// ✅ KODE BARU - Kebutuhan Material dari D1
app.get('/api/kebutuhan-material', async (c) => {
  const { env } = c
  const status = c.req.query('status') || ''
  const nomorLH05 = c.req.query('nomor') || ''
  
  // Get from D1 Database
  let materials = await DB.getAllMaterialKebutuhan(env.DB)
  
  // Apply filters
  if (status) materials = materials.filter((m: any) => m.status === status)
  if (nomorLH05) materials = materials.filter((m: any) => m.nomor_lh05?.includes(nomorLH05))
  
  return c.json({ materials })
})
```

---

## Fungsi Database Helper (src/db.ts)

Fungsi-fungsi yang digunakan untuk persistent storage:

### `DB.saveGangguan(db, data)`
- Simpan data gangguan ke tabel `gangguan`
- Simpan material terkait ke tabel `material_gangguan`
- Return `{ success, id, nomorLH05 }`

### `DB.getAllGangguan(db)`
- Ambil semua data gangguan dari D1
- Join dengan materials
- Return array of gangguan objects

### `DB.getNextLH05Number(db)`
- Generate nomor LH05 sequential dari database
- Format: `0001/ND KAL 2/LH05/2025`
- Auto-increment berdasarkan last number

### `DB.getAllMaterialKebutuhan(db)`
- Ambil semua material kebutuhan dari gangguan
- Join dengan tabel gangguan
- Return flattened materials array

---

## Struktur Database D1

### Tabel: `gangguan`
```sql
CREATE TABLE gangguan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_lh05 TEXT UNIQUE NOT NULL,
  tanggal_laporan TEXT NOT NULL,
  jenis_gangguan TEXT NOT NULL,
  lokasi_gangguan TEXT NOT NULL,
  user_laporan TEXT NOT NULL,
  status TEXT DEFAULT 'Open',
  catatan_tindakan TEXT,
  rencana_perbaikan TEXT,
  ttd_teknisi TEXT,
  ttd_supervisor TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel: `material_gangguan`
```sql
CREATE TABLE material_gangguan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gangguan_id INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  material TEXT NOT NULL,
  mesin TEXT,
  jumlah INTEGER NOT NULL,
  status TEXT DEFAULT 'Pengadaan',
  unit_uld TEXT,
  lokasi_tujuan TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gangguan_id) REFERENCES gangguan(id)
);
```

---

## Testing Perbaikan

### 1. **Test Input Form Gangguan**
```bash
# Akses form gangguan
http://localhost:3000/form-gangguan

# Isi form dan submit
# Cek console log untuk konfirmasi "saved to D1 Database"
```

### 2. **Test Dashboard Gangguan**
```bash
# Akses dashboard
http://localhost:3000/dashboard/gangguan

# Verifikasi data muncul
# Restart PM2 dan cek lagi (data harus tetap ada)
pm2 restart webapp
```

### 3. **Test Kebutuhan Material**
```bash
# Akses dashboard kebutuhan
http://localhost:3000/dashboard/kebutuhan-material

# Verifikasi material dari gangguan muncul
```

### 4. **Test Persistence (CRITICAL!)**
```bash
# Restart aplikasi
pm2 restart webapp

# Login kembali dan cek dashboard
# Data harus TETAP ADA (tidak hilang)
```

---

## Verifikasi via API

```bash
# Test API gangguan
curl http://localhost:3000/api/gangguan-transactions

# Test API kebutuhan material
curl http://localhost:3000/api/kebutuhan-material

# Test API dashboard gangguan
curl http://localhost:3000/api/dashboard/gangguan
```

---

## Rollback (Jika Diperlukan)

Jika ada masalah, rollback dengan:

```bash
cd /home/user/AMC-KAL-2-GUDANG-fix
git checkout src/index.tsx
npm run build
pm2 restart webapp
```

---

## Kesimpulan

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| **Storage** | In-memory only | D1 Database (persistent) |
| **Durability** | ❌ Hilang saat restart | ✅ Permanent di database |
| **Multi-user** | ❌ Tidak sinkron | ✅ Synchronized |
| **Backup** | ❌ Tidak ada | ✅ Auto-backup via D1 |
| **Scalability** | ❌ Terbatas memory | ✅ Unlimited database |

---

## File yang Dimodifikasi

1. **src/index.tsx**:
   - `/api/save-gangguan` → Simpan ke D1
   - `/api/gangguan-transactions` → Baca dari D1
   - `/api/dashboard/gangguan` → Baca dari D1
   - `/api/kebutuhan-material` → Baca dari D1

2. **src/db.ts**:
   - Sudah ada fungsi helper untuk gangguan
   - Tidak perlu modifikasi (sudah lengkap)

---

**Status**: ✅ Perbaikan selesai dan sudah di-deploy  
**Tanggal**: 2026-01-21  
**Build**: Sukses (123.60 kB)  
**Testing**: Ready untuk UAT
