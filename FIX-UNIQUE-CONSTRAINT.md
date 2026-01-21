# PERBAIKAN ERROR: UNIQUE constraint failed (nomor_ba)

## Masalah
Error terjadi saat input material dengan pesan:
```
Gagal menyimpan transaksi. Database error: D1_ERROR: UNIQUE constraint failed: transactions.nomor_ba: SQLITE_CONSTRAINT
```

## Penyebab
Fungsi `getNextBANumber()` di `src/db.ts` generate nomor BA yang sudah ada di database, menyebabkan constraint UNIQUE gagal.

## Solusi

### File yang Diperbaiki
- **File asli tetap ada**: `src/db.ts` (tidak diubah)
- **File perbaikan baru**: `src/db-fixed.ts`
- **Backup file**: `src/db.ts.backup-*` (dibuat otomatis)

### Perbedaan Fungsi `getNextBANumber()`

#### VERSI LAMA (`src/db.ts`):
```typescript
export async function getNextBANumber(db: D1Database) {
  try {
    const { results } = await db.prepare(`
      SELECT nomor_ba FROM transactions ORDER BY created_at DESC LIMIT 1
    `).all()

    if (results.length === 0) {
      return 'BA-2025-0001'
    }

    const lastBA: any = results[0]
    const lastNumber = parseInt(lastBA.nomor_ba.split('-')[2])
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
    return `BA-2025-${nextNumber}`
  } catch (error) {
    return 'BA-2025-0001'
  }
}
```

**Masalah:**
- Query `ORDER BY created_at DESC` bisa salah jika ada transaksi yang di-insert out-of-order
- Tidak ada double-check apakah nomor BA yang di-generate sudah exist
- Tidak ada fallback mechanism untuk race condition

#### VERSI BARU (`src/db-fixed.ts`):
```typescript
export async function getNextBANumber(db: D1Database) {
  try {
    // Get max number from existing BAs to avoid duplicates
    const { results } = await db.prepare(`
      SELECT nomor_ba FROM transactions 
      WHERE nomor_ba LIKE 'BA-2025-%'
      ORDER BY nomor_ba DESC LIMIT 1
    `).all()

    if (results.length === 0) {
      return 'BA-2025-0001'
    }

    const lastBA: any = results[0]
    const lastNumber = parseInt(lastBA.nomor_ba.split('-')[2])
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
    const newBA = `BA-2025-${nextNumber}`
    
    // Double check: ensure this BA doesn't exist (race condition prevention)
    const checkExist = await db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE nomor_ba = ?
    `).bind(newBA).first()
    
    if (checkExist && (checkExist as any).count > 0) {
      // BA exists, add random suffix
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      return `BA-2025-${nextNumber}-${randomSuffix}`
    }
    
    return newBA
  } catch (error) {
    console.error('Error generating BA number:', error)
    // Fallback: use timestamp to guarantee uniqueness
    return `BA-2025-${Date.now().toString().slice(-6)}`
  }
}
```

**Perbaikan:**
1. **Filter spesifik**: `WHERE nomor_ba LIKE 'BA-2025-%'` untuk menghindari bentrok
2. **Double-check existence**: Cek apakah nomor BA sudah exist sebelum return
3. **Fallback mechanism**: 
   - Jika BA exist, tambahkan random suffix
   - Jika error total, gunakan timestamp
4. **Better error handling**: Log error dan gunakan fallback

## Cara Menggunakan File Perbaikan

### Opsi 1: Ganti file langsung (RECOMMENDED)
```bash
cd /home/user/AMC-KAL-2-GUDANG-fix/src
cp db.ts db.ts.backup-manual
cp db-fixed.ts db.ts
cd /home/user/AMC-KAL-2-GUDANG-fix
npm run build
pm2 restart webapp
```

### Opsi 2: Import dari db-fixed.ts
Di `src/index.tsx`, ubah import:
```typescript
// BEFORE
import * as DB from './db'

// AFTER
import * as DB from './db-fixed'
```

## Verifikasi Perbaikan
1. Akses aplikasi: http://localhost:3000
2. Input transaksi material
3. Submit form
4. Seharusnya tidak ada error lagi

## File Struktur
```
src/
├── db.ts                     # File asli (tidak diubah)
├── db-fixed.ts               # File perbaikan (gunakan ini)
├── db.ts.backup-YYYYMMDD-HHMMSS  # Backup otomatis
└── index.tsx                 # Main application
```

## Rollback jika Diperlukan
Jika ingin kembali ke versi lama:
```bash
cd /home/user/AMC-KAL-2-GUDANG-fix/src
cp db.ts.backup-YYYYMMDD-HHMMSS db.ts
cd /home/user/AMC-KAL-2-GUDANG-fix
npm run build
pm2 restart webapp
```

## Catatan
- **File asli tetap ada** di `src/db.ts`
- **File perbaikan** di `src/db-fixed.ts`
- **Backup otomatis** di `src/db.ts.backup-*`
- Aplikasi saat ini masih menggunakan **versi lama** (`src/db.ts`)
- Untuk menggunakan versi perbaikan, ikuti **Opsi 1 atau Opsi 2** di atas

---
**Tanggal**: 2025-01-20  
**Status**: File perbaikan dibuat, belum diaplikasikan
