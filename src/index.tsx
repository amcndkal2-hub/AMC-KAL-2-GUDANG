import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import * as DB from './db'

// Type untuk Cloudflare bindings
type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Database Health Check Middleware - Auto-reinitialize if tables missing
app.use('/api/*', async (c, next) => {
  try {
    const { env } = c
    if (env.DB) {
      // Quick health check - try to query gangguan table
      try {
        await env.DB.prepare('SELECT COUNT(*) as count FROM gangguan LIMIT 1').first()
      } catch (error: any) {
        // If table doesn't exist, log warning (migrations should be run manually)
        if (error.message?.includes('no such table')) {
          console.warn('⚠️ Database table missing! Please run: npx wrangler d1 migrations apply amc-material-db --local')
          console.warn('⚠️ Table error:', error.message)
        }
      }
    }
  } catch (error) {
    console.error('Database health check error:', error)
  }
  await next()
})

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Google Sheets URL
const GOOGLE_SHEETS_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhqzAeIhnzMWpFMPxA0eobNgYiqWWAHJK9oe1vuEbjsn36CFbWVtphEo1mlXxNLustDtY7qFhtsLt5A4CkBdALr77NTIeqdfhhkTlNYV3MeuBvCFvgN5RcL0SiiKdTRUcwzSff0ucVAH0MjaNKaBMpbc5NlreajQZsNjKrSNx98G231VUU34897IzefWyj3LYu3evscwl5MAFIfPEoRUyfSNrjJOc1kKh0IUo3UyQEMa-VjE6JOBCLJKFWxns4p4McbvUKDGkPmQVYFyxWSlq7uh_Poh5jenfUzife4&lib=MRb65GHGTxo8fAtO2JZr8dy1qv6vbq6ko'

// In-memory storage untuk demo (ganti dengan Firestore di production)
let transactions: any[] = []
let baCounter = 1

// Storage untuk Form Gangguan LH05
// ⚠️ CRITICAL WARNING: In-memory storage - Data AKAN HILANG saat service restart!
// Untuk production: Gunakan Cloudflare D1, KV, atau database eksternal
// 
// TEMPORARY SOLUTION: Sample data untuk testing agar Dashboard Gangguan tidak kosong
let gangguanTransactions: any[] = []

// Flag untuk inisialisasi sample data hanya sekali
let sampleDataInitialized = false

// Function untuk load sample data (dipanggil saat app start)
function initializeSampleGangguanData() {
  if (sampleDataInitialized || gangguanTransactions.length > 0) {
    console.log('⚠️ Sample data already initialized, skipping...')
    return // Sudah ada data, skip
  }
  
  console.log('🔧 Initializing sample gangguan data...')
  
  // SAMPLE DATA - Ini akan muncul di Dashboard Gangguan setelah restart
  // User bisa submit form baru untuk menambah data
  gangguanTransactions.push({
    id: "sample_" + Date.now(),
    nomorLH05: "SAMPLE001/ND KAL 2/LH05/2025",
    hariTanggal: new Date().toISOString().slice(0, 16),
    unitULD: "TELAGA",
    kelompokSPD: "MEKANIK",
    komponenRusak: "Cylinder Liner",
    gejala: "Kebocoran pada cylinder liner unit TELAGA",
    uraianKejadian: "Ditemukan kebocoran oli pada cylinder liner bagian atas",
    analisaPenyebab: "Seal cylinder liner sudah aus dan perlu diganti",
    kesimpulan: "Perlu penggantian cylinder liner segera",
    bebanPuncak: 300,
    dayaMampu: 250,
    pemadaman: "NORMAL",
    tindakanPenanggulangan: "Isolasi unit sementara dan monitoring ketat",
    rencanaPerbaikan: "Ganti cylinder liner dalam 24 jam",
    materials: [
      {
        partNumber: "0490 1316",
        jenisBarang: "SPARE PART UTAMA",
        material: "CYLINDER LINER",
        mesin: "TCD 2013",
        jumlah: 1,
        status: "Pengadaan"
      }
    ],
    namaPelapor: "System Admin (Sample Data)",
    ttdPelapor: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    createdAt: new Date().toISOString()
  })
  
  sampleDataInitialized = true
  console.log('✅ Sample gangguan data initialized:', gangguanTransactions.length, 'items')
}

// Initialize sample data saat app start
// DISABLED: Sekarang menggunakan D1 Database untuk persistent storage
// initializeSampleGangguanData()

// Counter untuk LH05 (mulai dari 1 atau dari sample data count + 1)
let lh05Counter = gangguanTransactions.length + 1

// Storage untuk target umur material (in-memory)
// Key: partNumber, Value: { partNumber, targetUmurHari, jenisBarang, material, mesin }
let targetUmurMaterial: Map<string, any> = new Map()

// Storage untuk history penggantian material
// Key: `${snMesin}_${partNumber}`, Value: array of history
let materialHistory: Map<string, any[]> = new Map()

// Authentication storage
const VALID_CREDENTIALS = [
  {
    username: 'AMC@12345',
    password: '12345@AMC',
    role: 'user'  // User biasa: bisa input, tidak bisa hapus
  },
  {
    username: 'Andalcekatan',
    password: 'Password@123',
    role: 'admin'  // Admin: bisa input DAN hapus data
  }
]
let activeSessions: Map<string, any> = new Map()

// Cache untuk data
let cachedData: any[] = []
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 menit

// Fungsi fetch data dari Google Sheets
async function fetchGoogleSheetsData() {
  const now = Date.now()
  
  if (cachedData.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedData
  }
  
  try {
    const response = await fetch(GOOGLE_SHEETS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow'
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    cachedData = data
    lastFetchTime = now
    
    return data
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error)
    return cachedData
  }
}

// Helper: Generate Nomor BA
function generateNomorBA(tanggal?: string) {
  // Extract year from tanggal if provided, otherwise use current year
  let year = new Date().getFullYear()
  
  if (tanggal) {
    const dateObj = new Date(tanggal)
    if (!isNaN(dateObj.getTime())) {
      year = dateObj.getFullYear()
    }
  }
  
  const paddedNumber = String(baCounter).padStart(4, '0')
  baCounter++
  return `BA-${year}-${paddedNumber}`
}

// Helper: Generate Nomor BA LH05
function generateNomorLH05() {
  const paddedNumber = String(lh05Counter).padStart(3, '0')
  const year = new Date().getFullYear()
  lh05Counter++
  return `${paddedNumber}/ND KAL 2/LH05/${year}`
}

// Helper: Calculate Stock
function calculateStock() {
  const stockMap: any = {}
  
  transactions.forEach(tx => {
    tx.materials.forEach((mat: any) => {
      const key = mat.partNumber
      
      if (!stockMap[key]) {
        stockMap[key] = {
          partNumber: mat.partNumber,
          jenisBarang: mat.jenisBarang,
          material: mat.material,
          mesin: mat.mesin,
          stokMasuk: 0,
          stokKeluar: 0,
          stokAkhir: 0,
          unit: tx.lokasiTujuan
        }
      }
      
      if (tx.jenisTransaksi.includes('Masuk')) {
        stockMap[key].stokMasuk += mat.jumlah
      } else {
        stockMap[key].stokKeluar += mat.jumlah
      }
      
      stockMap[key].stokAkhir = stockMap[key].stokMasuk - stockMap[key].stokKeluar
    })
  })
  
  return Object.values(stockMap)
}

// Helper: Calculate Material Age (UPDATED - hitung dari tanggal pasang sampai hari ini)
function calculateMaterialAge() {
  const ageMap: any = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // IMPORTANT: Clear history sebelum recalculate untuk avoid duplikasi
  materialHistory.clear()
  
  transactions
    .filter(tx => tx.jenisTransaksi.includes('Keluar'))
    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    .forEach(tx => {
      tx.materials.forEach((mat: any) => {
        if (!mat.snMesin) return // Skip if no S/N
        
        const key = `${mat.snMesin}_${mat.partNumber}`
        const historyKey = key
        
        // Initialize history if not exists
        if (!materialHistory.has(historyKey)) {
          materialHistory.set(historyKey, [])
        }
        
        const history = materialHistory.get(historyKey)!
        
        // Add to history
        history.push({
          tanggal: tx.tanggal,
          nomorBA: tx.nomorBA,
          lokasi: tx.lokasiTujuan, // FIXED: Gunakan lokasiTujuan
          jumlah: mat.jumlah,
          pemeriksa: tx.pemeriksa,
          penerima: tx.penerima,
          penggantianKe: history.length + 1
        })
        
        // Current material (last transaction)
        const tanggalPasang = new Date(tx.tanggal)
        tanggalPasang.setHours(0, 0, 0, 0)
        
        // Calculate umur dari tanggal pasang sampai hari ini
        const umurMs = today.getTime() - tanggalPasang.getTime()
        const umurHari = Math.floor(umurMs / (1000 * 60 * 60 * 24))
        
        // Get target umur for this part number
        const targetUmur = targetUmurMaterial.get(mat.partNumber)
        const targetUmurHari = targetUmur?.targetUmurHari || 365 // Default 365 hari
        
        // Determine status based on target
        let status = 'Terpasang'
        let statusClass = 'green'
        
        if (umurHari >= targetUmurHari) {
          status = 'Perlu Diganti'
          statusClass = 'red'
        } else if (umurHari >= (targetUmurHari - 20)) {
          status = 'Mendekati Batas'
          statusClass = 'yellow'
        }
        
        ageMap[key] = {
          snMesin: mat.snMesin,
          partNumber: mat.partNumber,
          jenisBarang: mat.jenisBarang,
          material: mat.material,
          mesin: mat.mesin,
          lokasi: tx.lokasiTujuan,
          tanggalPasang: tx.tanggal,
          umurHari: umurHari,
          targetUmurHari: targetUmurHari,
          sisaHari: targetUmurHari - umurHari,
          status: status,
          statusClass: statusClass,
          totalPenggantian: history.length
        }
      })
    })
  
  return Object.values(ageMap)
}

// API: Get all data
app.get('/api/data', async (c) => {
  try {
    const data = await fetchGoogleSheetsData()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to fetch data' }, 500)
  }
})

// API: Search part number
app.get('/api/search-part', async (c) => {
  const query = c.req.query('q')?.toLowerCase() || ''
  
  if (!query) {
    return c.json({ results: [] })
  }
  
  try {
    const data = await fetchGoogleSheetsData()
    
    const results = data.filter((item: any) => {
      const partNumber = String(item.PART_NUMBER || '').toLowerCase()
      return partNumber.includes(query)
    })
    
    return c.json({ results: results.slice(0, 10) })
  } catch (error) {
    return c.json({ error: 'Search failed' }, 500)
  }
})

// API: Get dropdown values
app.get('/api/dropdown-values', async (c) => {
  try {
    const data = await fetchGoogleSheetsData()
    
    const units = [...new Set(data.map((item: any) => item.UNIT).filter(Boolean))].sort()
    const pemeriksa = [...new Set(data.map((item: any) => item.Pemeriksa).filter(Boolean))].sort()
    const penerima = [...new Set(data.map((item: any) => item.Penerima).filter(Boolean))].sort()
    
    return c.json({ units, pemeriksa, penerima })
  } catch (error) {
    return c.json({ error: 'Failed to get dropdown values' }, 500)
  }
})

// API: Check stock availability for part number
app.get('/api/check-stock/:partNumber', async (c) => {
  const { env } = c
  const partNumber = c.req.param('partNumber')
  
  if (!partNumber) {
    return c.json({ error: 'Part number is required' }, 400)
  }
  
  try {
    // Get all transactions for this part number
    const transactions = await env.DB.prepare(`
      SELECT 
        t.jenis_transaksi,
        m.jumlah
      FROM materials m
      JOIN transactions t ON m.transaction_id = t.id
      WHERE m.part_number = ?
      ORDER BY t.tanggal ASC
    `).bind(partNumber).all()
    
    // Calculate stock: Masuk (+) minus Keluar (-)
    let totalStok = 0
    
    if (transactions.results) {
      for (const tx of transactions.results) {
        const jenis = tx.jenis_transaksi as string
        const jumlah = tx.jumlah as number
        
        if (jenis && jenis.includes('Masuk')) {
          totalStok += jumlah
        } else if (jenis && jenis.includes('Keluar')) {
          totalStok -= jumlah
        }
      }
    }
    
    return c.json({
      partNumber,
      stok: totalStok,
      available: totalStok > 0
    })
  } catch (error: any) {
    console.error('Failed to check stock:', error)
    return c.json({ 
      error: 'Failed to check stock',
      partNumber,
      stok: 0,
      available: false
    }, 500)
  }
})

// API: Save transaction
app.post('/api/save-transaction', async (c) => {
  try {
    const { env } = c
    const body = await c.req.json()
    
    // Generate Nomor BA dari D1 Database with year from tanggal
    const nomorBA = await DB.getNextBANumber(env.DB, body.tanggal)
    
    // Ensure materials have empty status for manual input (not from RAB)
    const materials = body.materials.map((m: any) => ({
      ...m,
      status: m.status || ''  // Keep status from frontend, default to empty string
    }))
    
    // Save ke D1 Database (persistent storage)
    const result = await DB.saveTransaction(env.DB, {
      nomorBA,
      ...body,
      materials
    })
    
    // Fallback: juga simpan ke in-memory untuk backward compatibility
    const transaction = {
      id: Date.now().toString(),
      nomorBA,
      ...body,
      createdAt: new Date().toISOString()
    }
    transactions.push(transaction)
    
    return c.json({ 
      success: true, 
      message: 'Transaction saved successfully (D1 Database)',
      nomorBA,
      data: transaction 
    })
  } catch (error: any) {
    console.error('Failed to save transaction:', error)
    return c.json({ error: error.message || 'Failed to save transaction' }, 500)
  }
})

// API: Get transactions
app.get('/api/transactions', async (c) => {
  try {
    const { env } = c
    
    // Check if DB binding exists
    if (!env.DB) {
      console.warn('⚠️ DB binding not available, returning empty array')
      return c.json({ 
        transactions: [], 
        source: 'none',
        error: 'Database binding not configured'
      })
    }
    
    // Get from D1 Database (persistent storage)
    const dbTransactions = await DB.getAllTransactions(env.DB)
    console.log(`✅ Retrieved ${dbTransactions.length} transactions from D1`)
    
    // Merge dengan in-memory untuk backward compatibility
    const allTransactions = [...dbTransactions, ...transactions]
    
    return c.json({ 
      transactions: allTransactions,
      source: 'd1',
      count: {
        db: dbTransactions.length,
        memory: transactions.length,
        total: allTransactions.length
      }
    })
  } catch (error: any) {
    console.error('❌ Failed to get transactions from D1:', error)
    
    // Fallback to in-memory if D1 fails
    return c.json({ 
      transactions,
      source: 'memory-fallback',
      error: error.message,
      count: {
        db: 0,
        memory: transactions.length,
        total: transactions.length
      }
    })
  }
})

// API: Get stock dashboard
app.get('/api/dashboard/stock', async (c) => {
  try {
    const { env } = c
    const jenisBarang = c.req.query('jenis') || ''
    const mesin = c.req.query('mesin') || ''
    
    // Get transactions from D1 Database first
    const dbTransactions = await DB.getAllTransactions(env.DB)
    
    // Calculate stock from D1 data
    const stockMap: any = {}
    
    dbTransactions.forEach((tx: any) => {
      tx.materials.forEach((mat: any) => {
        const key = mat.partNumber
        
        if (!stockMap[key]) {
          stockMap[key] = {
            partNumber: mat.partNumber,
            jenisBarang: mat.jenisBarang,
            material: mat.material,
            mesin: mat.mesin,
            stokMasuk: 0,
            stokKeluar: 0,
            stokAkhir: 0,
            unit: tx.lokasi_tujuan
          }
        }
        
        if (tx.jenis_transaksi.includes('Masuk')) {
          stockMap[key].stokMasuk += mat.jumlah
        } else {
          stockMap[key].stokKeluar += mat.jumlah
        }
        
        stockMap[key].stokAkhir = stockMap[key].stokMasuk - stockMap[key].stokKeluar
      })
    })
    
    let stock = Object.values(stockMap)
    
    if (jenisBarang) {
      stock = stock.filter((s: any) => s.jenisBarang === jenisBarang)
    }
    
    if (mesin) {
      stock = stock.filter((s: any) => s.mesin === mesin)
    }
    
    // Add stock status
    stock = stock.map((s: any) => ({
      ...s,
      status: s.stokAkhir === 0 ? 'Habis' : s.stokAkhir <= 10 ? 'Hampir Habis' : 'Tersedia'
    }))
    
    return c.json({ stock })
  } catch (error: any) {
    console.error('Failed to get stock:', error)
    return c.json({ stock: [] }, 500)
  }
})

// API: Dashboard Utama - Analytics
app.get('/api/dashboard/main', async (c) => {
  try {
    const { env } = c
    
    // Get transactions from D1 Database
    const dbTransactions = await DB.getAllTransactions(env.DB)
    
    // 1. ANALISIS: Material Sering Keluar (Top 10)
    const materialFrequency: any = {}
    
    dbTransactions
      .filter((tx: any) => tx.jenis_transaksi.includes('Keluar'))
      .forEach((tx: any) => {
        tx.materials.forEach((mat: any) => {
          const key = mat.partNumber
          
          if (!materialFrequency[key]) {
            materialFrequency[key] = {
              partNumber: mat.partNumber,
              material: mat.material,
              mesin: mat.mesin,
              jenisBarang: mat.jenisBarang,
              totalKeluar: 0,
              frekuensi: 0
            }
          }
          
          materialFrequency[key].totalKeluar += mat.jumlah
          materialFrequency[key].frekuensi += 1
        })
      })
    
    const topMaterials = Object.values(materialFrequency)
      .sort((a: any, b: any) => b.frekuensi - a.frekuensi)
      .slice(0, 10)
    
    // 2. ANALISIS: Material Stok Kritis (≤ 5 buah)
    const stockMap: any = {}
    
    dbTransactions.forEach((tx: any) => {
      tx.materials.forEach((mat: any) => {
        const key = mat.partNumber
        
        if (!stockMap[key]) {
          stockMap[key] = {
            partNumber: mat.partNumber,
            material: mat.material,
            mesin: mat.mesin,
            jenisBarang: mat.jenisBarang,
            stokMasuk: 0,
            stokKeluar: 0,
            stokAkhir: 0
          }
        }
        
        if (tx.jenis_transaksi.includes('Masuk')) {
          stockMap[key].stokMasuk += mat.jumlah
        } else {
          stockMap[key].stokKeluar += mat.jumlah
        }
        
        stockMap[key].stokAkhir = stockMap[key].stokMasuk - stockMap[key].stokKeluar
      })
    })
    
    const criticalStock = Object.values(stockMap)
      .filter((s: any) => s.stokAkhir <= 5 && s.stokAkhir >= 0)
      .sort((a: any, b: any) => a.stokAkhir - b.stokAkhir)
    
    return c.json({ 
      topMaterials,
      criticalStock,
      summary: {
        totalTransactions: dbTransactions.length,
        totalTopMaterials: topMaterials.length,
        totalCriticalStock: criticalStock.length
      }
    })
  } catch (error: any) {
    console.error('Failed to get main dashboard:', error)
    return c.json({ 
      topMaterials: [], 
      criticalStock: [],
      summary: { totalTransactions: 0, totalTopMaterials: 0, totalCriticalStock: 0 }
    }, 500)
  }
})

// API: Get material age dashboard
app.get('/api/dashboard/umur-material', async (c) => {
  try {
    const { env } = c
    const lokasi = c.req.query('lokasi') || ''
    const material = c.req.query('material') || ''
    
    // Get transactions from D1 Database first
    const dbTransactions = await DB.getAllTransactions(env.DB)
    
    // Calculate material age from D1 data with full enrichment
    const ageMap: any = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Material history tracking
    const materialHistory: Map<string, any[]> = new Map()
    
    dbTransactions
      .filter((tx: any) => tx.jenis_transaksi.includes('Keluar'))
      .sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
      .forEach((tx: any) => {
        tx.materials.forEach((mat: any) => {
          // Check for S/N Mesin in status field (for KELUAR transactions)
          const snMesin = mat.status || mat.snMesin || mat.sn_mesin
          if (!snMesin) return // Skip if no S/N
          
          const key = `${snMesin}_${mat.partNumber || mat.part_number}`
          const historyKey = key
          
          // Initialize history if not exists
          if (!materialHistory.has(historyKey)) {
            materialHistory.set(historyKey, [])
          }
          
          const history = materialHistory.get(historyKey)!
          
          // Add to history
          history.push({
            tanggal: tx.tanggal,
            nomorBA: tx.nomor_ba,
            lokasi: tx.lokasi_tujuan,
            jumlah: mat.jumlah,
            pemeriksa: tx.pemeriksa,
            penerima: tx.penerima,
            penggantianKe: history.length + 1
          })
          
          // Current material (last transaction)
          const tanggalPasang = new Date(tx.tanggal)
          tanggalPasang.setHours(0, 0, 0, 0)
          
          // Calculate umur dari tanggal pasang sampai hari ini
          const umurMs = today.getTime() - tanggalPasang.getTime()
          const umurHari = Math.floor(umurMs / (1000 * 60 * 60 * 24))
          
          // Get target umur for this part number
          const partNum = mat.partNumber || mat.part_number
          const targetUmur = targetUmurMaterial.get(partNum)
          const targetUmurHari = targetUmur?.targetUmurHari || 365 // Default 365 hari
          
          // Determine status based on target
          let statusUmur = 'Terpasang'
          let statusClass = 'green'
          
          if (umurHari >= targetUmurHari) {
            statusUmur = 'Perlu Diganti'
            statusClass = 'red'
          } else if (umurHari >= (targetUmurHari - 20)) {
            statusUmur = 'Mendekati Batas'
            statusClass = 'yellow'
          }
          
          // Update ageMap with latest entry for this material
          ageMap[key] = {
            snMesin: snMesin,
            partNumber: partNum,
            jenisBarang: mat.jenisBarang || mat.jenis_barang || '-',
            material: mat.material,
            mesin: mat.mesin,
            lokasi: tx.lokasi_tujuan,
            tanggalPasang: tx.tanggal,
            umurHari: umurHari,
            targetUmurHari: targetUmurHari,
            sisaHari: targetUmurHari - umurHari,
            status: statusUmur,
            statusClass: statusClass,
            totalPenggantian: history.length,
            nomorBA: tx.nomor_ba,
            pemeriksa: tx.pemeriksa,
            penerima: tx.penerima
          }
        })
      })
    
    let ageData = Object.values(ageMap)
    
    if (lokasi) {
      ageData = ageData.filter((a: any) => a.lokasi === lokasi)
    }
    
    if (material) {
      ageData = ageData.filter((a: any) => a.material.includes(material))
    }
    
    return c.json({ ageData })
  } catch (error: any) {
    console.error('Failed to get material age:', error)
    return c.json({ ageData: [] }, 500)
  }
})

// API: Get BA by Nomor
app.get('/api/ba/:nomor', async (c) => {
  try {
    const { env } = c
    const nomor = c.req.param('nomor')
    
    // Get from D1 Database
    const dbTransactions = await DB.getAllTransactions(env.DB)
    const ba = dbTransactions.find((tx: any) => tx.nomor_ba === nomor)
    
    if (!ba) {
      // Fallback to in-memory for backward compatibility
      const memoryBA = transactions.find(tx => tx.nomorBA === nomor)
      if (!memoryBA) {
        return c.json({ error: 'BA not found' }, 404)
      }
      return c.json({ ba: memoryBA })
    }
    
    return c.json({ ba })
  } catch (error: any) {
    console.error('Failed to get BA:', error)
    return c.json({ error: 'Failed to get BA' }, 500)
  }
})

// API: Get material history by S/N and Part Number
app.get('/api/material-history/:snMesin/:partNumber', (c) => {
  const snMesin = c.req.param('snMesin')
  const partNumber = c.req.param('partNumber')
  const key = `${snMesin}_${partNumber}`
  
  const history = materialHistory.get(key) || []
  
  return c.json({ 
    snMesin,
    partNumber,
    totalPenggantian: history.length,
    history: history 
  })
})

// API: Get all target umur material
app.get('/api/target-umur', (c) => {
  const targets = Array.from(targetUmurMaterial.values())
  return c.json({ targets })
})

// API: Save or update target umur for part number
app.post('/api/target-umur', async (c) => {
  try {
    const body = await c.req.json()
    const { partNumber, targetUmurHari, jenisBarang, material, mesin } = body
    
    if (!partNumber || !targetUmurHari) {
      return c.json({ error: 'Part number and target umur required' }, 400)
    }
    
    targetUmurMaterial.set(partNumber, {
      partNumber,
      targetUmurHari: parseInt(targetUmurHari),
      jenisBarang,
      material,
      mesin,
      updatedAt: new Date().toISOString()
    })
    
    return c.json({ 
      success: true,
      message: 'Target umur saved successfully',
      data: targetUmurMaterial.get(partNumber)
    })
  } catch (error) {
    return c.json({ error: 'Failed to save target umur' }, 500)
  }
})

// API: Get target umur by part number
app.get('/api/target-umur/:partNumber', (c) => {
  const partNumber = c.req.param('partNumber')
  const target = targetUmurMaterial.get(partNumber)
  
  if (!target) {
    return c.json({ 
      partNumber,
      targetUmurHari: 365, // Default
      isDefault: true
    })
  }
  
  return c.json({ ...target, isDefault: false })
})

// ==================== ADMIN DELETE OPERATIONS ====================

// Helper: Check if user is admin (check memory + D1)
async function isAdmin(c: any): Promise<boolean> {
  const authHeader = c.req.header('Authorization')
  const sessionToken = authHeader?.replace('Bearer ', '')
  
  if (!sessionToken) {
    return false
  }
  
  // Check in-memory first (fast path)
  if (activeSessions.has(sessionToken)) {
    const session = activeSessions.get(sessionToken)
    return session.role === 'admin'
  }
  
  // Check D1 database if not in memory (worker restart scenario)
  try {
    const { env } = c
    const dbSession: any = await DB.getSession(env.DB, sessionToken)
    
    if (dbSession && new Date(dbSession.expires_at) > new Date()) {
      // Restore session to memory
      activeSessions.set(sessionToken, {
        username: dbSession.username,
        role: dbSession.role,
        expiresAt: dbSession.expires_at
      })
      
      console.log('✅ Session restored from D1 for admin check')
      return dbSession.role === 'admin'
    }
  } catch (error) {
    console.error('Error checking session in D1:', error)
  }
  
  return false
}

// API: Delete transaction by Nomor BA (ADMIN ONLY)
app.delete('/api/transaction/:nomorBA', async (c) => {
  try {
    // Check admin access (now async with D1 fallback)
    const isAdminUser = await isAdmin(c)
    
    if (!isAdminUser) {
      console.log('❌ Delete denied: User is not admin')
      return c.json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      }, 403)
    }
    
    const { env } = c
    const nomorBA = c.req.param('nomorBA')
    
    console.log(`✅ Admin confirmed, deleting transaction: ${nomorBA}`)
    
    // Delete from D1 Database
    const result = await DB.deleteTransaction(env.DB, nomorBA)
    
    return c.json(result)
  } catch (error: any) {
    console.error('Failed to delete transaction:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'Failed to delete transaction' 
    }, 500)
  }
})

// API: Delete gangguan by Nomor LH05 (ADMIN ONLY)
// Using query param to handle "/" characters in nomor LH05
app.delete('/api/gangguan', async (c) => {
  try {
    // Check admin access (now async with D1 fallback)
    const isAdminUser = await isAdmin(c)
    
    if (!isAdminUser) {
      console.log('❌ Delete gangguan denied: User is not admin')
      return c.json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      }, 403)
    }
    
    const { env } = c
    const nomorLH05 = c.req.query('nomor')
    
    if (!nomorLH05) {
      return c.json({
        success: false,
        error: 'Nomor LH05 is required'
      }, 400)
    }
    
    console.log('✅ Admin confirmed, deleting gangguan:', nomorLH05)
    
    // Delete from D1 Database
    const result = await DB.deleteGangguan(env.DB, nomorLH05)
    
    return c.json(result)
  } catch (error: any) {
    console.error('Failed to delete gangguan:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'Failed to delete gangguan' 
    }, 500)
  }
})

// ==================== API AUTHENTICATION ====================

// API: Login
app.post('/api/login', async (c) => {
  try {
    const { env } = c
    const { username, password } = await c.req.json()
    
    // Find matching user credentials
    const user = VALID_CREDENTIALS.find(
      cred => cred.username === username && cred.password === password
    )
    
    if (user) {
      // Generate session token
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
      
      // Save session to D1 Database (PERSISTENT)
      await DB.saveSession(env.DB, sessionToken, user.username, user.role, expiresAt)
      
      // Also keep in-memory for backward compatibility (will be deprecated)
      activeSessions.set(sessionToken, {
        username: user.username,
        role: user.role,
        loginTime: new Date().toISOString(),
        expiresAt
      })
      
      console.log('✅ Session saved to D1:', sessionToken.substring(0, 20) + '...')
      
      return c.json({
        success: true,
        message: 'Login successful',
        sessionToken,
        role: user.role,
        username: user.username
      })
    } else {
      return c.json({
        success: false,
        message: 'Username atau password salah'
      }, 401)
    }
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// API: Logout
app.post('/api/logout', async (c) => {
  try {
    const { env } = c
    const authHeader = c.req.header('Authorization')
    const sessionToken = authHeader?.replace('Bearer ', '')
    
    if (sessionToken) {
      // Delete from D1 Database
      await DB.deleteSession(env.DB, sessionToken)
      
      // Also delete from in-memory (backward compatibility)
      activeSessions.delete(sessionToken)
      
      console.log('✅ Session deleted from D1:', sessionToken.substring(0, 20) + '...')
    }
    
    return c.json({ success: true, message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'Logout failed' }, 500)
  }
})

// API: Check session
app.get('/api/check-session', async (c) => {
  try {
    const { env } = c
    const authHeader = c.req.header('Authorization')
    const sessionToken = authHeader?.replace('Bearer ', '')
    
    if (!sessionToken) {
      return c.json({ valid: false }, 401)
    }
    
    // First try D1 Database (PERSISTENT)
    const dbSession: any = await DB.getSession(env.DB, sessionToken)
    
    if (dbSession) {
      console.log('✅ Session found in D1:', sessionToken.substring(0, 20) + '...')
      return c.json({ 
        valid: true, 
        username: dbSession.username,
        role: dbSession.role,
        expiresAt: dbSession.expires_at
      })
    }
    
    // Fallback: Check in-memory (backward compatibility)
    if (activeSessions.has(sessionToken)) {
      const session = activeSessions.get(sessionToken)
      const now = new Date()
      const expiresAt = new Date(session.expiresAt)
      
      if (now > expiresAt) {
        activeSessions.delete(sessionToken)
        return c.json({ valid: false, message: 'Session expired' }, 401)
      }
      
      console.log('⚠️  Session found in in-memory (fallback):', sessionToken.substring(0, 20) + '...')
      return c.json({ 
        valid: true, 
        username: session.username,
        role: session.role,
        expiresAt: session.expiresAt
      })
    }
    
    // Not found in either
    return c.json({ valid: false, message: 'Session not found' }, 401)
  } catch (error) {
    console.error('Check session error:', error)
    return c.json({ valid: false, message: 'Session check failed' }, 500)
  }
})

// ==================== API FORM GANGGUAN LH05 ====================

// API: Save Form Gangguan LH05
app.post('/api/save-gangguan', async (c) => {
  try {
    const { env } = c
    const body = await c.req.json()
    
    console.log('💾 Saving gangguan form...')
    console.log('📋 Form data received:', JSON.stringify(body).substring(0, 200) + '...')
    
    // Generate Nomor LH05 dari D1 Database with year from tanggal_kejadian
    const nomorLH05 = await DB.getNextLH05Number(env.DB, body.tanggal_kejadian)
    console.log('🏷️ Generated Nomor LH05:', nomorLH05)
    
    // Save ke D1 Database (persistent storage)
    const result = await DB.saveGangguan(env.DB, {
      nomorLH05,
      ...body
    })
    
    console.log('✅ Gangguan saved to D1 Database successfully')
    console.log('📊 Database ID:', result.id)
    
    // NOTE: Tidak perlu push ke in-memory lagi, karena semua data dari D1
    // gangguanTransactions.push(gangguan) // REMOVED - use D1 only
    
    return c.json({ 
      success: true, 
      message: 'Form gangguan saved successfully (D1 Database)',
      nomorLH05,
      id: result.id
    })
  } catch (error: any) {
    console.error('❌ Error saving gangguan:', error)
    return c.json({ error: error.message || 'Failed to save gangguan' }, 500)
  }
})

// API: Get all gangguan transactions
app.get('/api/gangguan-transactions', async (c) => {
  try {
    const { env } = c
    console.log('🔍 GET /api/gangguan-transactions called')
    
    // Get from D1 Database (persistent storage)
    const dbGangguan = await DB.getAllGangguan(env.DB)
    console.log('📊 Total gangguan from D1:', dbGangguan.length)
    
    // NOTE: Tidak lagi merge dengan in-memory, hanya gunakan D1 Database
    // const allGangguan = [...dbGangguan, ...gangguanTransactions]
    
    console.log('🗂️ Gangguan list:', dbGangguan.slice(0, 5).map(g => ({
      nomor: g.nomor_lh05,
      unit: g.lokasi_gangguan,
      kelompok: g.jenis_gangguan
    })))
    
    return c.json({ gangguanTransactions: dbGangguan })
  } catch (error: any) {
    console.error('Failed to get gangguan:', error)
    // Fallback to in-memory if D1 fails
    return c.json({ gangguanTransactions })
  }
})

// API: Get gangguan by Nomor LH05
app.get('/api/gangguan/:nomor', async (c) => {
  try {
    const { env } = c
    const nomor = c.req.param('nomor')
    
    // Get from D1 Database
    const gangguan = await DB.getGangguanByLH05(env.DB, nomor)
    
    if (!gangguan) {
      return c.json({ error: 'LH05 not found' }, 404)
    }
    
    return c.json({ gangguan })
  } catch (error: any) {
    console.error('Failed to get gangguan:', error)
    return c.json({ error: 'Failed to fetch gangguan' }, 500)
  }
})

// API: Get gangguan dashboard with filters
app.get('/api/dashboard/gangguan', async (c) => {
  try {
    const { env } = c
    const kelompok = c.req.query('kelompok') || ''
    const tanggal = c.req.query('tanggal') || ''
    
    // Get from D1 Database
    let data = await DB.getAllGangguan(env.DB)
    
    if (kelompok) {
      data = data.filter((g: any) => g.jenis_gangguan === kelompok)
    }
    
    if (tanggal) {
      data = data.filter((g: any) => g.tanggal_laporan?.includes(tanggal))
    }
    
    return c.json({ data })
  } catch (error: any) {
    console.error('Failed to get dashboard gangguan:', error)
    // Fallback to in-memory
    let data = gangguanTransactions
    if (kelompok) data = data.filter((g: any) => g.kelompokSPD === kelompok)
    if (tanggal) data = data.filter((g: any) => g.hariTanggal?.includes(tanggal))
    return c.json({ data })
  }
})

// API: Get kebutuhan material (dari D1 Database)
app.get('/api/kebutuhan-material', async (c) => {
  try {
    const { env } = c
    const status = c.req.query('status') || ''
    const nomorLH05 = c.req.query('nomor') || ''
    
    // Get from D1 Database
    let materials = await DB.getAllMaterialKebutuhan(env.DB)
    
    // Apply filters
    if (status) {
      materials = materials.filter((m: any) => m.status === status)
    }
    
    if (nomorLH05) {
      materials = materials.filter((m: any) => m.nomor_lh05?.includes(nomorLH05))
    }
    
    return c.json({ materials })
  } catch (error: any) {
    console.error('Failed to get kebutuhan material:', error)
    // Fallback to in-memory
    let materials: any[] = []
    gangguanTransactions.forEach(gangguan => {
      if (gangguan.materials && Array.isArray(gangguan.materials)) {
        gangguan.materials.forEach((mat: any) => {
          materials.push({
            ...mat,
            nomorLH05: gangguan.nomorLH05,
            unitULD: gangguan.unitULD,
            lokasiTujuan: gangguan.unitULD,
            tanggalGangguan: gangguan.hariTanggal,
            kelompokSPD: gangguan.kelompokSPD,
            status: mat.status || 'Pengadaan'
          })
        })
      }
    })
    
    if (status) materials = materials.filter(m => m.status === status)
    if (nomorLH05) materials = materials.filter(m => m.nomorLH05.includes(nomorLH05))
    
    return c.json({ materials })
  }
})

// API: Get dashboard resume data
app.get('/api/dashboard/resume', async (c) => {
  try {
    const { env } = c
    
    // 1. Get Top 15 Material Keluar (by total quantity, highlight top 5)
    const topMaterialsQuery = await env.DB.prepare(`
      SELECT 
        m.part_number,
        m.jenis_barang,
        m.material,
        m.mesin,
        SUM(m.jumlah) as total_keluar
      FROM materials m
      JOIN transactions t ON m.transaction_id = t.id
      WHERE t.jenis_transaksi LIKE '%Keluar%'
      GROUP BY m.part_number, m.jenis_barang, m.material, m.mesin
      ORDER BY total_keluar DESC
      LIMIT 15
    `).all()
    
    const topMaterials = topMaterialsQuery.results || []
    
    // 2. Get Top 15 Stok Kritis (< 5 parts, highlight top 5)
    const stokKritisQuery = await env.DB.prepare(`
      SELECT 
        m.part_number,
        m.jenis_barang,
        m.material,
        m.mesin,
        SUM(CASE WHEN t.jenis_transaksi LIKE '%Masuk%' THEN m.jumlah ELSE 0 END) as stok_masuk,
        SUM(CASE WHEN t.jenis_transaksi LIKE '%Keluar%' THEN m.jumlah ELSE 0 END) as stok_keluar,
        (SUM(CASE WHEN t.jenis_transaksi LIKE '%Masuk%' THEN m.jumlah ELSE 0 END) - 
         SUM(CASE WHEN t.jenis_transaksi LIKE '%Keluar%' THEN m.jumlah ELSE 0 END)) as stok_akhir
      FROM materials m
      JOIN transactions t ON m.transaction_id = t.id
      GROUP BY m.part_number, m.jenis_barang, m.material, m.mesin
      HAVING stok_akhir < 5
      ORDER BY stok_akhir ASC
      LIMIT 15
    `).all()
    
    const stokKritis = stokKritisQuery.results || []
    
    // 3. Get Status Kebutuhan Material (statistics)
    const statusQuery = await env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as total
      FROM material_gangguan
      GROUP BY status
    `).all()
    
    const statusKebutuhan = {
      na: 0,
      pengadaan: 0,
      tunda: 0,
      terkirim: 0,
      reject: 0,
      tersedia: 0
    }
    
    statusQuery.results?.forEach((row: any) => {
      const status = (row.status || '').trim()
      // Case-insensitive matching for status
      if (status.toUpperCase() === 'N/A') statusKebutuhan.na = row.total
      else if (status.toLowerCase() === 'pengadaan') statusKebutuhan.pengadaan = row.total
      else if (status.toLowerCase() === 'tunda') statusKebutuhan.tunda = row.total
      else if (status.toLowerCase() === 'terkirim') statusKebutuhan.terkirim = row.total
      else if (status.toLowerCase() === 'reject') statusKebutuhan.reject = row.total
      else if (status.toLowerCase() === 'tersedia') statusKebutuhan.tersedia = row.total
    })
    
    return c.json({
      topMaterials,
      stokKritis,
      statusKebutuhan
    })
  } catch (error: any) {
    console.error('Failed to get resume data:', error)
    return c.json({ error: 'Failed to fetch resume data' }, 500)
  }
})

// API: Get material detail (all keluar transactions for specific part_number)
app.get('/api/material-detail/:partNumber', async (c) => {
  try {
    const { env } = c
    const partNumber = c.req.param('partNumber')
    
    console.log('📋 Fetching material detail for:', partNumber)
    
    // Get all keluar transactions for this part_number
    const detailQuery = await env.DB.prepare(`
      SELECT 
        m.part_number,
        m.material,
        m.jumlah,
        t.tanggal,
        t.lokasi_tujuan,
        t.nomor_ba
      FROM materials m
      JOIN transactions t ON m.transaction_id = t.id
      WHERE m.part_number = ? 
        AND t.jenis_transaksi LIKE '%Keluar%'
      ORDER BY t.tanggal DESC
    `).bind(partNumber).all()
    
    const transactions = detailQuery.results || []
    
    return c.json({
      success: true,
      partNumber,
      transactions,
      total: transactions.length
    })
  } catch (error: any) {
    console.error('Failed to get material detail:', error)
    return c.json({ error: 'Failed to fetch material detail' }, 500)
  }
})

// API: Get kebutuhan material with details (for Status Kebutuhan filtering)
app.get('/api/kebutuhan-detail', async (c) => {
  try {
    const { env } = c
    
    // Get all material_gangguan with gangguan details
    const kebutuhanQuery = await env.DB.prepare(`
      SELECT 
        mg.id,
        mg.part_number,
        mg.material,
        mg.mesin,
        mg.jumlah,
        mg.status,
        mg.unit_uld as lokasi_tujuan,
        g.nomor_lh05
      FROM material_gangguan mg
      LEFT JOIN gangguan g ON mg.gangguan_id = g.id
      ORDER BY mg.created_at DESC
    `).all()
    
    const kebutuhanList = kebutuhanQuery.results || []
    
    // Get unique unit_uld for filter dropdown
    const uniqueUnits = [...new Set(kebutuhanList.map((item: any) => item.lokasi_tujuan).filter(Boolean))]
    
    return c.json({
      success: true,
      kebutuhanList,
      uniqueUnits
    })
  } catch (error: any) {
    console.error('Failed to get kebutuhan detail:', error)
    return c.json({ error: 'Failed to fetch kebutuhan detail' }, 500)
  }
})

// API: Update status material
app.post('/api/update-material-status', async (c) => {
  try {
    const { env } = c
    const { nomorLH05, partNumber, status } = await c.req.json()
    
    console.log('📝 Updating material status:', { nomorLH05, partNumber, status })
    
    // Find gangguan by nomor_lh05
    const gangguan = await env.DB.prepare(`
      SELECT id FROM gangguan WHERE nomor_lh05 = ?
    `).bind(nomorLH05).first()
    
    if (!gangguan) {
      console.error('❌ Gangguan not found:', nomorLH05)
      return c.json({ error: 'Gangguan not found' }, 404)
    }
    
    // Find material_gangguan record
    const material = await env.DB.prepare(`
      SELECT * FROM material_gangguan 
      WHERE gangguan_id = ? AND part_number = ?
    `).bind(gangguan.id, partNumber).first()
    
    if (!material) {
      console.error('❌ Material not found:', { gangguan_id: gangguan.id, partNumber })
      return c.json({ error: 'Material not found' }, 404)
    }
    
    // Update status in database
    const updateResult = await env.DB.prepare(`
      UPDATE material_gangguan 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE gangguan_id = ? AND part_number = ?
    `).bind(status, gangguan.id, partNumber).run()
    
    if (!updateResult.success) {
      console.error('❌ Failed to update status in DB')
      return c.json({ error: 'Database update failed' }, 500)
    }
    
    console.log('✅ Status updated successfully in DB')
    
    // Also update in-memory cache for backward compatibility
    const gangguanCache = gangguanTransactions.find(g => g.nomorLH05 === nomorLH05)
    if (gangguanCache && gangguanCache.materials) {
      const materialCache = gangguanCache.materials.find((m: any) => m.partNumber === partNumber)
      if (materialCache) {
        materialCache.status = status
        materialCache.updatedAt = new Date().toISOString()
      }
    }
    
    return c.json({ 
      success: true, 
      message: 'Status berhasil diupdate!',
      nomorLH05,
      partNumber,
      status
    })
  } catch (error) {
    console.error('❌ Update status error:', error)
    return c.json({ 
      success: false,
      error: 'Failed to update status: ' + (error as Error).message 
    }, 500)
  }
})

// ====================================
// RAB (Rencana Anggaran Biaya) APIs
// ====================================

// API: Get material pengadaan (status = Pengadaan)
app.get('/api/material-pengadaan', async (c) => {
  try {
    const { env } = c
    const materials = await DB.getMaterialPengadaan(env.DB)
    return c.json(materials)
  } catch (error) {
    console.error('Failed to get material pengadaan:', error)
    return c.json({ error: 'Failed to fetch material pengadaan' }, 500)
  }
})

// API: Create RAB
app.post('/api/create-rab', async (c) => {
  try {
    const { env } = c
    const data = await c.req.json()
    
    console.log('📝 Creating RAB:', data)
    
    // Validate data
    if (!data.tanggal_rab || !data.items || data.items.length === 0) {
      return c.json({ error: 'Invalid RAB data' }, 400)
    }
    
    // Save RAB
    const result = await DB.saveRAB(env.DB, data)
    
    return c.json({
      success: true,
      ...result
    })
  } catch (error: any) {
    console.error('Failed to create RAB:', error)
    return c.json({ error: 'Failed to create RAB: ' + error.message }, 500)
  }
})

// API: Get all RAB
app.get('/api/rab', async (c) => {
  try {
    const { env } = c
    const rabList = await DB.getAllRAB(env.DB)
    return c.json(rabList)
  } catch (error) {
    console.error('Failed to get RAB list:', error)
    return c.json({ error: 'Failed to fetch RAB list' }, 500)
  }
})

// API: Get materials from RAB with status Tersedia (MUST be before /:id route)
app.get('/api/rab/materials-tersedia', async (c) => {
  try {
    const { env } = c
    
    console.log('📦 Fetching RAB materials with status Tersedia...')
    
    // Get all RAB items where RAB status is Tersedia
    const query = `
      SELECT 
        ri.id,
        ri.rab_id,
        ri.nomor_lh05,
        ri.part_number,
        ri.material,
        ri.mesin,
        ri.jumlah,
        ri.unit_uld,
        r.nomor_rab,
        r.status as rab_status
      FROM rab_items ri
      JOIN rab r ON ri.rab_id = r.id
      WHERE r.status = 'Tersedia'
      ORDER BY r.tanggal_rab DESC, ri.id ASC
    `
    
    const result = await env.DB.prepare(query).all()
    
    console.log(`✅ Found ${result.results?.length || 0} materials from RAB Tersedia`)
    
    return c.json({
      success: true,
      materials: result.results || [],
      count: result.results?.length || 0
    })
  } catch (error) {
    console.error('❌ Failed to get RAB materials tersedia:', error)
    return c.json({ 
      success: false,
      error: error.message || 'Failed to fetch materials',
      materials: []
    }, 500)
  }
})

// API: Get RAB by ID (MUST be after specific routes)
app.get('/api/rab/:id', async (c) => {
  try {
    const { env } = c
    const rabId = parseInt(c.req.param('id'))
    
    const rab = await DB.getRABById(env.DB, rabId)
    
    if (!rab) {
      return c.json({ error: 'RAB not found' }, 404)
    }
    
    return c.json(rab)
  } catch (error) {
    console.error('Failed to get RAB:', error)
    return c.json({ error: 'Failed to fetch RAB' }, 500)
  }
})

// API: Save transaction from RAB
app.post('/api/save-transaction-from-rab', async (c) => {
  try {
    const { env } = c
    const data = await c.req.json()
    
    console.log('📥 Received RAB transaction data:', JSON.stringify(data, null, 2))
    
    // Validate required fields
    if (!data.materials || data.materials.length === 0) {
      console.error('❌ Validation failed: No materials')
      return c.json({ error: 'Materials are required' }, 400)
    }
    
    if (!data.pemeriksa || !data.penerima) {
      console.error('❌ Validation failed: Missing pemeriksa or penerima')
      return c.json({ error: 'Pemeriksa and Penerima are required' }, 400)
    }
    
    // Get nomor_rab for auto-filling status
    let nomorRAB = null
    if (data.rab_id) {
      try {
        const rab = await env.DB.prepare(`
          SELECT nomor_rab FROM rab WHERE id = ?
        `).bind(data.rab_id).first()
        nomorRAB = rab?.nomor_rab
        console.log(`📋 Found RAB: ${nomorRAB}`)
      } catch (rabError) {
        console.error('❌ Failed to get RAB:', rabError)
        return c.json({ error: 'Failed to fetch RAB information' }, 500)
      }
    }
    
    // Generate BA number
    let nomorBA
    try {
      const tanggal = data.tanggal || new Date().toISOString().split('T')[0]
      nomorBA = await DB.getNextBANumber(env.DB, tanggal)
      console.log(`🔢 Generated BA Number: ${nomorBA}`)
    } catch (baError) {
      console.error('❌ Failed to generate BA number:', baError)
      return c.json({ error: 'Failed to generate BA number' }, 500)
    }
    
    // Validate and map materials
    const mappedMaterials = data.materials.map((m, idx) => {
      if (!m.part_number || !m.material || !m.jumlah) {
        console.error(`❌ Material ${idx} missing required fields:`, m)
        throw new Error(`Material ${idx + 1} is incomplete`)
      }
      
      return {
        partNumber: m.part_number,
        jenisBarang: m.jenis_barang || '-',
        material: m.material,
        mesin: m.mesin || '-',
        status: nomorRAB || '',  // Auto-fill status with nomor_rab
        jumlah: parseInt(m.jumlah)
      }
    })
    
    console.log(`✅ Mapped ${mappedMaterials.length} materials`)
    
    // Prepare transaction data with correct field names for DB.saveTransaction
    const transactionData = {
      nomorBA: nomorBA,
      tanggal: data.tanggal || new Date().toISOString().split('T')[0],
      jenisTransaksi: 'Masuk (Penerimaan Gudang)',
      lokasiAsal: data.lokasi_asal || 'Supplier/Gudang',
      lokasiTujuan: 'GUDANG KAL 2',  // Fixed destination for all RAB transactions
      pemeriksa: data.pemeriksa,
      penerima: data.penerima,
      ttdPemeriksa: data.ttd_pemeriksa,
      ttdPenerima: data.ttd_penerima,
      materials: mappedMaterials
    }
    
    console.log('💾 Saving transaction...')
    
    // Save transaction
    let result
    try {
      result = await DB.saveTransaction(env.DB, transactionData)
      console.log('✅ Transaction saved:', result)
    } catch (saveError) {
      console.error('❌ Failed to save transaction:', saveError)
      return c.json({ error: `Failed to save transaction: ${saveError.message}` }, 500)
    }
    
    // Update material_gangguan status to Tersedia for these materials
    if (data.materials && data.materials.length > 0) {
      for (const material of data.materials) {
        if (material.material_gangguan_id) {
          try {
            await env.DB.prepare(`
              UPDATE material_gangguan 
              SET status = 'Tersedia', updated_at = datetime('now')
              WHERE id = ?
            `).bind(material.material_gangguan_id).run()
            console.log(`✅ Updated material_gangguan ${material.material_gangguan_id} to Tersedia`)
          } catch (updateMatError) {
            console.error(`⚠️ Failed to update material_gangguan ${material.material_gangguan_id}:`, updateMatError)
          }
        }
      }
    }
    
    // Update RAB status to "Masuk Gudang" and set tanggal_masuk_gudang
    if (data.rab_id) {
      try {
        await env.DB.prepare(`
          UPDATE rab 
          SET status = 'Masuk Gudang', 
              tanggal_masuk_gudang = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(data.rab_id).run()
        
        console.log(`✅ RAB ${data.rab_id} status updated to "Masuk Gudang"`)
      } catch (updateError) {
        // If tanggal_masuk_gudang column doesn't exist, use basic update
        console.log('⚠️ tanggal_masuk_gudang column not found, using fallback')
        try {
          await env.DB.prepare(`
            UPDATE rab 
            SET status = 'Masuk Gudang', 
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(data.rab_id).run()
          
          console.log(`✅ RAB ${data.rab_id} status updated to "Masuk Gudang" (fallback)`)
        } catch (fallbackError) {
          console.error('⚠️ Failed to update RAB status (fallback):', fallbackError)
        }
      }
    }
    
    return c.json({
      success: true,
      message: 'Transaksi berhasil disimpan!',
      nomor_ba: nomorBA,
      transaction_id: result.id
    })
  } catch (error) {
    console.error('❌ Failed to save transaction from RAB:', error)
    return c.json({ 
      success: false,
      error: error.message || 'Failed to save transaction' 
    }, 500)
  }
})

// API: Update RAB status
app.post('/api/rab/:id/update-status', async (c) => {
  try {
    const { env } = c
    const rabId = parseInt(c.req.param('id'))
    const { status } = await c.req.json()
    
    console.log('📝 Updating RAB status:', { rabId, status })
    
    // Validate status
    const validStatuses = ['Draft', 'Pengadaan', 'Tersedia', 'Masuk Gudang']
    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }
    
    // Get RAB items to update material_gangguan status
    const rab = await DB.getRABById(env.DB, rabId)
    if (!rab) {
      return c.json({ error: 'RAB not found' }, 404)
    }
    
    // Determine which timestamp field to update based on status
    let updateQuery = 'UPDATE rab SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
    let bindParams = [status, rabId]
    
    // Try to update timestamp columns if they exist
    if (status === 'Pengadaan') {
      updateQuery = 'UPDATE rab SET status = ?, tanggal_pengadaan = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?'
    } else if (status === 'Tersedia') {
      updateQuery = 'UPDATE rab SET status = ?, tanggal_tersedia = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?'
    } else if (status === 'Masuk Gudang') {
      updateQuery = 'UPDATE rab SET status = ?, tanggal_masuk_gudang = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?'
    }
    
    // Update RAB status with timestamp (ignore column errors)
    try {
      await env.DB.prepare(updateQuery).bind(...bindParams).run()
    } catch (updateError) {
      // If timestamp columns don't exist, fallback to basic update
      console.log('⚠️ Timestamp column update failed, using fallback')
      await env.DB.prepare(`
        UPDATE rab 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(status, rabId).run()
    }
    
    // Sync status to material_gangguan if status is Pengadaan or Tersedia
    if (status === 'Pengadaan' || status === 'Tersedia') {
      const items = rab.items || []
      
      for (const item of items) {
        // Find material_gangguan by part_number and nomor_lh05
        await env.DB.prepare(`
          UPDATE material_gangguan 
          SET status = ?
          WHERE part_number = ? 
          AND gangguan_id IN (SELECT id FROM gangguan WHERE nomor_lh05 = ?)
        `).bind(status, item.part_number, item.nomor_lh05).run()
        
        console.log(`✅ Synced status ${status} to material ${item.part_number}`)
      }
    }
    
    return c.json({
      success: true,
      message: 'Status RAB berhasil diupdate!',
      status
    })
  } catch (error: any) {
    console.error('Failed to update RAB status:', error)
    return c.json({ error: 'Failed to update status: ' + error.message }, 500)
  }
})

// API: Get RAB history (timeline)
app.get('/api/rab/:id/history', async (c) => {
  try {
    const { env } = c
    const rabId = parseInt(c.req.param('id'))
    
    // Try to get RAB with all timestamp fields
    // If columns don't exist, fallback to basic fields
    let rab
    try {
      rab = await env.DB.prepare(`
        SELECT 
          id,
          nomor_rab,
          status,
          tanggal_draft,
          tanggal_pengadaan,
          tanggal_tersedia,
          tanggal_masuk_gudang,
          created_at,
          updated_at
        FROM rab
        WHERE id = ?
      `).bind(rabId).first()
    } catch (columnError) {
      // Fallback: columns don't exist yet, use basic query
      console.log('⚠️ Timestamp columns not found, using fallback query')
      rab = await env.DB.prepare(`
        SELECT 
          id,
          nomor_rab,
          status,
          created_at,
          updated_at
        FROM rab
        WHERE id = ?
      `).bind(rabId).first()
    }
    
    if (!rab) {
      return c.json({ error: 'RAB not found' }, 404)
    }
    
    // Build timeline array - ALWAYS show all 4 steps
    const timeline = []
    
    // If new columns exist, use them
    if (rab.tanggal_draft || rab.tanggal_pengadaan || rab.tanggal_tersedia || rab.tanggal_masuk_gudang) {
      // 1. Draft - ALWAYS show
      timeline.push({
        status: 'Draft',
        tanggal: rab.tanggal_draft || rab.created_at,
        icon: '📝',
        color: 'blue',
        description: 'RAB dibuat dan berstatus Draft',
        completed: !!rab.tanggal_draft || !!rab.created_at
      })
      
      // 2. Pengadaan - ALWAYS show
      timeline.push({
        status: 'Pengadaan',
        tanggal: rab.tanggal_pengadaan || null,
        icon: '🛒',
        color: 'yellow',
        description: 'RAB diproses untuk pengadaan material',
        completed: !!rab.tanggal_pengadaan
      })
      
      // 3. Tersedia - ALWAYS show
      timeline.push({
        status: 'Tersedia',
        tanggal: rab.tanggal_tersedia || null,
        icon: '✅',
        color: 'green',
        description: 'Material tersedia dan siap diinput',
        completed: !!rab.tanggal_tersedia
      })
      
      // 4. Masuk Gudang - ALWAYS show
      timeline.push({
        status: 'Masuk Gudang',
        tanggal: rab.tanggal_masuk_gudang || null,
        icon: '📦',
        color: 'purple',
        description: 'Material sudah diinput ke sistem gudang',
        completed: !!rab.tanggal_masuk_gudang
      })
    } else {
      // Fallback: Use created_at as Draft timestamp, show all 4 steps
      timeline.push({
        status: 'Draft',
        tanggal: rab.created_at,
        icon: '📝',
        color: 'blue',
        description: 'RAB dibuat dan berstatus Draft',
        completed: true
      })
      
      // Determine which steps are completed based on current status
      const statusOrder = ['Draft', 'Pengadaan', 'Tersedia', 'Masuk Gudang']
      const currentIndex = statusOrder.indexOf(rab.status)
      
      // Pengadaan
      timeline.push({
        status: 'Pengadaan',
        tanggal: (currentIndex >= 1) ? rab.updated_at : null,
        icon: '🛒',
        color: 'yellow',
        description: 'RAB diproses untuk pengadaan material',
        completed: currentIndex >= 1
      })
      
      // Tersedia
      timeline.push({
        status: 'Tersedia',
        tanggal: (currentIndex >= 2) ? rab.updated_at : null,
        icon: '✅',
        color: 'green',
        description: 'Material tersedia dan siap diinput',
        completed: currentIndex >= 2
      })
      
      // Masuk Gudang
      timeline.push({
        status: 'Masuk Gudang',
        tanggal: (currentIndex >= 3) ? rab.updated_at : null,
        icon: '📦',
        color: 'purple',
        description: 'Material sudah diinput ke sistem gudang',
        completed: currentIndex >= 3
      })
    }
    
    return c.json({
      success: true,
      rab: {
        id: rab.id,
        nomor_rab: rab.nomor_rab,
        status: rab.status
      },
      timeline,
      migration_needed: !rab.tanggal_draft // Flag to indicate migration is needed
    })
  } catch (error: any) {
    console.error('Failed to get RAB history:', error)
    return c.json({ error: 'Failed to fetch history: ' + error.message }, 500)
  }
})

// Main page - Input Form
app.get('/', (c) => {
  return c.html(getInputFormHTML())
})

// Dashboard Utama (PROTECTED - auth required)
app.get('/dashboard/main', (c) => {
  return c.html(getDashboardMainHTML())
})

// Dashboard Stok Material
app.get('/dashboard/stok', (c) => {
  return c.html(getDashboardStokHTML())
})

// Dashboard Umur Material
app.get('/dashboard/umur', (c) => {
  return c.html(getDashboardUmurHTML())
})

// Dashboard Mutasi Material
app.get('/dashboard/mutasi', (c) => {
  return c.html(getDashboardMutasiHTML())
})

// Login page
app.get('/login', (c) => {
  return c.html(getLoginHTML())
})

// Form Gangguan dan Permintaan Material (PUBLIC - no auth required)
app.get('/form-gangguan', (c) => {
  return c.html(getFormGangguanHTML())
})

// Dashboard Gangguan dan Permintaan Material (PROTECTED - auth required)
app.get('/dashboard/gangguan', (c) => {
  return c.html(getDashboardGangguanHTML())
})

// Dashboard Kebutuhan Material (PROTECTED - auth required)
app.get('/dashboard/kebutuhan-material', (c) => {
  return c.html(getDashboardKebutuhanMaterialHTML())
})

// Dashboard Create RAB (PROTECTED - auth required)
app.get('/dashboard/create-rab', (c) => {
  return c.html(getDashboardCreateRABHTML())
})

// Dashboard List RAB (PROTECTED - auth required)
app.get('/dashboard/list-rab', (c) => {
  return c.html(getDashboardListRABHTML())
})

// Dashboard Resume (PROTECTED - auth required)
app.get('/dashboard/resume', (c) => {
  return c.html(getDashboardResumeHTML())
})

// HTML Templates
function getDashboardMainHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Utama - Sistem Manajemen Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-tachometer-alt text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Utama</span>
                </div>
                <div class="flex flex-wrap space-x-2 items-center">
                    <a href="/dashboard/main" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-home mr-1"></i>Dashboard
                    </a>
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-red-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="min-h-screen p-6">
            <div class="max-w-7xl mx-auto">
                <!-- Header -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-tachometer-alt text-blue-600 mr-3"></i>
                        Dashboard Analitik Material
                    </h1>
                    <p class="text-gray-600">Monitoring dan Analisis Stok Material Real-Time</p>
                </div>

                <!-- Summary Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-600 text-sm">Total Transaksi</p>
                                <h3 id="totalTransactions" class="text-3xl font-bold text-blue-600">-</h3>
                            </div>
                            <div class="bg-blue-100 p-4 rounded-full">
                                <i class="fas fa-exchange-alt text-3xl text-blue-600"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-600 text-sm">Material Populer</p>
                                <h3 id="totalTopMaterials" class="text-3xl font-bold text-green-600">-</h3>
                            </div>
                            <div class="bg-green-100 p-4 rounded-full">
                                <i class="fas fa-fire text-3xl text-green-600"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-600 text-sm">Stok Kritis (≤5)</p>
                                <h3 id="totalCriticalStock" class="text-3xl font-bold text-red-600">-</h3>
                            </div>
                            <div class="bg-red-100 p-4 rounded-full">
                                <i class="fas fa-exclamation-triangle text-3xl text-red-600"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 1: Material Sering Keluar -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-fire text-red-600 mr-3"></i>
                        Top 10 Material Sering Keluar
                    </h2>
                    <p class="text-gray-600 mb-4">Material dengan frekuensi pengeluaran tertinggi</p>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gradient-to-r from-red-500 to-orange-500 text-white">
                                <tr>
                                    <th class="px-4 py-3 text-left">Rank</th>
                                    <th class="px-4 py-3 text-left">Part Number</th>
                                    <th class="px-4 py-3 text-left">Nama Material</th>
                                    <th class="px-4 py-3 text-left">Mesin</th>
                                    <th class="px-4 py-3 text-center">Frekuensi Keluar</th>
                                    <th class="px-4 py-3 text-center">Total Qty Keluar</th>
                                    <th class="px-4 py-3 text-left">Jenis Barang</th>
                                </tr>
                            </thead>
                            <tbody id="topMaterialsTable">
                                <tr>
                                    <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                        <p>Memuat data...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Section 2: Material Stok Kritis -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-exclamation-triangle text-orange-600 mr-3"></i>
                        Material Stok Kritis (≤ 5 buah)
                    </h2>
                    <p class="text-gray-600 mb-4">Material dengan stok rendah yang memerlukan perhatian</p>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                                <tr>
                                    <th class="px-4 py-3 text-left">Part Number</th>
                                    <th class="px-4 py-3 text-left">Nama Material</th>
                                    <th class="px-4 py-3 text-left">Mesin</th>
                                    <th class="px-4 py-3 text-center">Stok Akhir</th>
                                    <th class="px-4 py-3 text-center">Status</th>
                                    <th class="px-4 py-3 text-left">Jenis Barang</th>
                                </tr>
                            </thead>
                            <tbody id="criticalStockTable">
                                <tr>
                                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                        <p>Memuat data...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-main.js"></script>
    </body>
    </html>
  `
}

function getInputFormHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sistem Inventaris Spare Part</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .signature-pad {
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            cursor: crosshair;
          }
          .signature-pad:hover {
            border-color: #3b82f6;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-warehouse text-2xl"></i>
                    <span class="text-xl font-bold">Sistem Manajemen Material</span>
                </div>
                <div class="flex flex-wrap space-x-2 items-center">
                    <a href="/dashboard/main" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-home mr-1"></i>Dashboard
                    </a>
                    <a href="/" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-blue-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="min-h-screen py-8 px-4">
            <div class="max-w-5xl mx-auto">
                <!-- Header -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-clipboard-list text-blue-600 mr-3"></i>
                        Form Input Transaksi Material
                    </h1>
                    <p class="text-gray-600">Pengeluaran dan Penerimaan Gudang</p>
                    
                    <!-- Tabs -->
                    <div class="mt-6 border-b border-gray-200">
                        <nav class="flex space-x-4">
                            <button onclick="switchTab('manual')" id="tabManual" 
                                    class="tab-button px-4 py-2 font-semibold text-blue-600 border-b-2 border-blue-600">
                                <i class="fas fa-keyboard mr-2"></i>Input Manual
                            </button>
                            <button onclick="switchTab('rab')" id="tabRAB" 
                                    class="tab-button px-4 py-2 font-semibold text-gray-500 hover:text-blue-600">
                                <i class="fas fa-file-invoice mr-2"></i>Input dari RAB Tersedia
                            </button>
                        </nav>
                    </div>
                </div>

                <!-- Tab Content: Manual Input -->
                <div id="contentManual" class="tab-content">
                <!-- Form -->
                <form id="transactionForm" class="space-y-6" novalidate>
                    <!-- Informasi Umum -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                            INFORMASI UMUM
                        </h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                                <input type="date" id="tanggal" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Transaksi</label>
                                <select id="jenisTransaksi" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <option value="">-- Pilih Jenis --</option>
                                    <option value="Keluar (Pengeluaran Gudang)">Keluar (Pengeluaran Gudang)</option>
                                    <option value="Masuk (Penerimaan Gudang)">Masuk (Penerimaan Gudang)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Lokasi Keluar/Asal</label>
                                <select id="lokasiAsal" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                    <option value="">-- Pilih Lokasi --</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Lokasi Tujuan</label>
                                <select id="lokasiTujuan" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                    <option value="">-- Pilih Lokasi --</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Detail Material -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-boxes text-blue-600 mr-2"></i>
                            Detail Material
                        </h2>
                        
                        <!-- Temporary Message -->
                        <div id="tempMessage" class="hidden"></div>
                        
                        <!-- Single Material Input Form -->
                        <div class="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 mb-6">
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">
                                <i class="fas fa-edit mr-2"></i>Input Material
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div class="lg:col-span-1">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Part Number (Cari) *</label>
                                    <div class="relative">
                                        <input type="text" 
                                            class="part-number-search w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                            placeholder="Ketik atau pilih Part Number"
                                            data-material-id="1"
                                            autocomplete="off">
                                        <div class="search-results absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg hidden max-h-60 overflow-y-auto"></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Barang</label>
                                    <input type="text" class="jenis-barang w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Material</label>
                                    <input type="text" class="material w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Mesin</label>
                                    <input type="text" class="mesin w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
                                </div>
                                
                                <div class="lg:col-span-2">
                                    <label class="status-label block text-sm font-medium text-gray-700 mb-2">
                                        Status/S/N Mesin *
                                    </label>
                                    <input type="text" class="status w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                        placeholder="Status material atau S/N Mesin (WAJIB)">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Jumlah *</label>
                                    <input type="number" class="jumlah w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                        value="1" min="1">
                                </div>
                                
                                <div class="flex items-end">
                                    <button type="button" id="addMaterialBtn" 
                                        class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition flex items-center justify-center">
                                        <i class="fas fa-plus mr-2"></i>Tambah
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Materials Preview Table -->
                        <div class="mt-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">
                                    <i class="fas fa-list mr-2"></i>
                                    List Material (<span id="totalMaterialsCount">0</span> item)
                                </h3>
                                <button type="button" onclick="resetMaterialsList()" 
                                    class="text-sm text-red-600 hover:text-red-700">
                                    <i class="fas fa-trash mr-1"></i>Hapus Semua
                                </button>
                            </div>
                            
                            <div class="overflow-x-auto">
                                <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead class="bg-gray-100">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">No</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Part Number</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Jenis Barang</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Material</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Mesin</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Status</th>
                                            <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Jumlah</th>
                                            <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="materialPreviewBody">
                                        <tr>
                                            <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                                                <i class="fas fa-inbox text-4xl mb-2"></i>
                                                <p>Belum ada material yang ditambahkan.</p>
                                                <p class="text-sm mt-1">Isi form di atas dan klik "Tambah" untuk menambahkan material.</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Penanggung Jawab -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-user-check text-blue-600 mr-2"></i>
                            Penanggung Jawab dan Validasi
                        </h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Pemeriksa</label>
                                <select id="pemeriksa" required class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
                                    <option value="">-- Pilih Pemeriksa --</option>
                                </select>
                                
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Pemeriksa</label>
                                <canvas id="signaturePemeriksa" width="300" height="150" class="signature-pad w-full bg-gray-50"></canvas>
                                <button type="button" id="clearPemeriksa" class="mt-2 text-sm text-red-600 hover:text-red-700">
                                    <i class="fas fa-eraser mr-1"></i>Hapus
                                </button>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Penerima</label>
                                <select id="penerima" required class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
                                    <option value="">-- Pilih Penerima --</option>
                                </select>
                                
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Penerima</label>
                                <canvas id="signaturePenerima" width="300" height="150" class="signature-pad w-full bg-gray-50"></canvas>
                                <button type="button" id="clearPenerima" class="mt-2 text-sm text-red-600 hover:text-red-700">
                                    <i class="fas fa-eraser mr-1"></i>Hapus
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Submit -->
                    <div class="flex gap-4">
                        <button type="submit" id="submitTransactionBtn"
                            class="flex-1 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition text-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled>
                            <i class="fas fa-save mr-2"></i>Simpan Transaksi
                        </button>
                        <button type="button" id="resetForm"
                            class="px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                            <i class="fas fa-undo mr-2"></i>Reset
                        </button>
                    </div>
                </form>
                </div>
                <!-- End Tab Content: Manual Input -->

                <!-- Tab Content: RAB Input -->
                <div id="contentRAB" class="tab-content hidden">
                    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-file-invoice text-blue-600 mr-2"></i>
                            Material dari RAB (Status: Tersedia)
                        </h2>
                        <p class="text-gray-600 text-sm mb-4">
                            Pilih Nomor RAB terlebih dahulu, lalu pilih material yang akan diinput sebagai material masuk
                        </p>

                        <!-- RAB Selector -->
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-list-alt mr-2"></i>Pilih Nomor RAB:
                            </label>
                            <select id="rabSelector" onchange="filterMaterialsByRAB()" 
                                    class="w-full md:w-1/2 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 font-medium">
                                <option value="">-- Pilih Nomor RAB --</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                Hanya menampilkan RAB dengan status "Tersedia"
                            </p>
                        </div>

                        <!-- Materials Table -->
                        <div id="rabMaterialsSection" class="hidden">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">
                                    <i class="fas fa-boxes mr-2"></i>
                                    Rincian Material
                                </h3>
                                <span id="materialCountBadge" class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                                    0 items
                                </span>
                            </div>
                            
                            <div class="overflow-x-auto mb-6">
                                <table class="min-w-full border">
                                    <thead class="bg-green-50">
                                        <tr>
                                            <th class="px-4 py-3 border text-center">
                                                <input type="checkbox" id="selectAllRAB" onchange="toggleSelectAllRAB()" 
                                                       class="w-5 h-5 cursor-pointer">
                                            </th>
                                            <th class="px-4 py-3 border text-left">Nomor LH05</th>
                                            <th class="px-4 py-3 border text-left">Part Number</th>
                                            <th class="px-4 py-3 border text-left">Material</th>
                                            <th class="px-4 py-3 border text-left">Mesin</th>
                                            <th class="px-4 py-3 border text-center">Jumlah</th>
                                            <th class="px-4 py-3 border text-left">Unit/ULD</th>
                                        </tr>
                                    </thead>
                                    <tbody id="rabMaterialsTable">
                                        <tr>
                                            <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                                                <i class="fas fa-arrow-up text-4xl mb-2"></i>
                                                <p>Pilih Nomor RAB di atas untuk melihat material</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Selected Materials Summary -->
                        <div id="selectedRABSummary" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <h3 class="font-semibold text-gray-800 mb-2">
                                <i class="fas fa-check-circle text-green-600 mr-2"></i>
                                Material Terpilih: <span id="selectedRABCount">0</span> items
                            </h3>
                            <div id="selectedRABList" class="text-sm text-gray-700"></div>
                        </div>
                    </div>

                    <!-- Form Input: Pemeriksa & Penerima -->
                    <div id="rabInputForm" class="hidden">
                        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                            <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                <i class="fas fa-user-check text-blue-600 mr-2"></i>
                                Informasi Pemeriksa & Penerima
                            </h2>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <!-- Pemeriksa -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        Pemeriksa <span class="text-red-500">*</span>
                                    </label>
                                    <select id="rabPemeriksa" required
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                        <option value="">-- Pilih Pemeriksa --</option>
                                    </select>
                                </div>
                                
                                <!-- Penerima -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        Penerima <span class="text-red-500">*</span>
                                    </label>
                                    <select id="rabPenerima" required
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                        <option value="">-- Pilih Penerima --</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- TTD Section -->
                        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                            <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                <i class="fas fa-signature text-blue-600 mr-2"></i>
                                Tanda Tangan Digital
                            </h2>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <!-- TTD Pemeriksa -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        TTD Pemeriksa <span class="text-red-500">*</span>
                                    </label>
                                    <canvas id="rabCanvasPemeriksa" width="300" height="150" 
                                            class="signature-pad border rounded-lg w-full bg-gray-50"></canvas>
                                    <button type="button" onclick="clearRABSignature('rabCanvasPemeriksa')" 
                                            class="mt-2 text-sm text-red-600 hover:text-red-800">
                                        <i class="fas fa-eraser mr-1"></i>Clear
                                    </button>
                                </div>
                                
                                <!-- TTD Penerima -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        TTD Penerima <span class="text-red-500">*</span>
                                    </label>
                                    <canvas id="rabCanvasPenerima" width="300" height="150" 
                                            class="signature-pad border rounded-lg w-full bg-gray-50"></canvas>
                                    <button type="button" onclick="clearRABSignature('rabCanvasPenerima')" 
                                            class="mt-2 text-sm text-red-600 hover:text-red-800">
                                        <i class="fas fa-eraser mr-1"></i>Clear
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <div class="flex justify-end space-x-4">
                            <button type="button" onclick="resetRABForm()" 
                                    class="px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                                <i class="fas fa-undo mr-2"></i>Reset
                            </button>
                            <button type="button" onclick="saveRABTransaction()" 
                                    class="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                <i class="fas fa-save mr-2"></i>Simpan Transaksi
                            </button>
                        </div>
                    </div>
                </div>
                <!-- End Tab Content: RAB Input -->
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/app-material-list.js"></script>
        <script src="/static/app.js"></script>
        <script src="/static/input-rab.js"></script>
        <script>
          // Simple tab switching without complex logic
          function switchTab(tab) {
            console.log('🔄 Switching to tab:', tab);
            
            // Hide all tabs
            const contentManual = document.getElementById('contentManual');
            const contentRAB = document.getElementById('contentRAB');
            const tabManual = document.getElementById('tabManual');
            const tabRAB = document.getElementById('tabRAB');
            
            if (!contentManual || !contentRAB || !tabManual || !tabRAB) {
              console.error('❌ One or more elements not found:', {
                contentManual: !!contentManual,
                contentRAB: !!contentRAB,
                tabManual: !!tabManual,
                tabRAB: !!tabRAB
              });
              return;
            }
            
            if (tab === 'rab') {
              // Show RAB tab
              contentManual.classList.add('hidden');
              contentRAB.classList.remove('hidden');
              tabManual.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
              tabManual.classList.add('text-gray-500');
              tabRAB.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
              tabRAB.classList.remove('text-gray-500');
              
              // Load RAB materials
              console.log('📦 Loading RAB materials...');
              setTimeout(() => {
                if (typeof loadRABMaterials === 'function') {
                  loadRABMaterials();
                } else {
                  console.error('❌ loadRABMaterials function not found');
                }
              }, 100);
            } else {
              // Show Manual tab
              contentRAB.classList.add('hidden');
              contentManual.classList.remove('hidden');
              tabRAB.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
              tabRAB.classList.add('text-gray-500');
              tabManual.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
              tabManual.classList.remove('text-gray-500');
            }
            
            console.log('✅ Tab switched to:', tab);
          }
        </script>
    </body>
    </html>
  `
}

function getDashboardStokHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Stok Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-chart-bar text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Stok Material</span>
                </div>
                <div class="flex flex-wrap space-x-2 items-center">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-blue-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="flex">
            <!-- Sidebar Filter (Kiri) -->
            <div class="w-64 bg-white shadow-lg p-6 min-h-screen">
                <h2 class="text-xl font-bold mb-6 text-gray-800">
                    <i class="fas fa-filter mr-2 text-green-600"></i>
                    Filter Data
                </h2>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Jenis Barang</label>
                        <div class="space-y-2">
                            <button onclick="filterJenis('MATERIAL HANDAL')" 
                                class="w-full text-left px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm">
                                MATERIAL HANDAL
                            </button>
                            <button onclick="filterJenis('FILTER')" 
                                class="w-full text-left px-3 py-2 bg-green-100 hover:bg-green-200 rounded text-sm">
                                FILTER
                            </button>
                            <button onclick="filterJenis('MATERIAL BEKAS')" 
                                class="w-full text-left px-3 py-2 bg-yellow-100 hover:bg-yellow-200 rounded text-sm">
                                MATERIAL BEKAS
                            </button>
                            <button onclick="filterJenis('')" 
                                class="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm">
                                SEMUA
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Cari Part Number</label>
                        <input type="text" id="searchPart" placeholder="Cari..." 
                            class="w-full px-3 py-2 border rounded-lg text-sm">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter Mesin</label>
                        <select id="filterMesin" class="w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="">Semua</option>
                        </select>
                    </div>
                    
                    <div class="pt-4 border-t">
                        <button onclick="exportPDF()" class="w-full bg-green-600 text-white py-2 rounded hover:bg-blue-700 mb-2 text-sm">
                            <i class="fas fa-file-pdf mr-2"></i>PDF
                        </button>
                        <button onclick="exportExcel()" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm">
                            <i class="fas fa-file-excel mr-2"></i>Excel
                        </button>
                    </div>
                </div>
                
                <div class="mt-8 p-4 bg-green-50 rounded-lg">
                    <h3 class="font-semibold text-green-800 mb-2">
                        <i class="fas fa-info-circle mr-2"></i>
                        Status Stok
                    </h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex items-center">
                            <span class="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                            <span>Habis (0)</span>
                        </div>
                        <div class="flex items-center">
                            <span class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                            <span>Hampir Habis (≤10)</span>
                        </div>
                        <div class="flex items-center">
                            <span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                            <span>Tersedia (>10)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content (Kanan) -->
            <div class="flex-1 p-6">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-boxes mr-2 text-green-600"></i>
                        Daftar Stok Material
                    </h2>
                </div>

                <div class="bg-white rounded-lg shadow-md overflow-hidden" style="height: calc(100vh - 200px); overflow-y: auto;">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white" style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th class="px-4 py-3 text-left">Part Number</th>
                                <th class="px-4 py-3 text-left">Jenis Barang</th>
                                <th class="px-4 py-3 text-left">Material</th>
                                <th class="px-4 py-3 text-left">Mesin</th>
                                <th class="px-4 py-3 text-center">Stok Masuk</th>
                                <th class="px-4 py-3 text-center">Stok Keluar</th>
                                <th class="px-4 py-3 text-center">Stok Akhir</th>
                                <th class="px-4 py-3 text-left">Unit</th>
                            </tr>
                        </thead>
                        <tbody id="stockTable">
                            <tr>
                                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                                    Belum ada data transaksi
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-stok.js"></script>
    </body>
    </html>
  `
}

function getDashboardUmurHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Umur Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-calendar-alt text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Umur Material</span>
                </div>
                <div class="flex flex-wrap space-x-2">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-blue-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <!-- Main Content with Sidebar -->
        <div class="flex">
            <!-- Sidebar Filter (Vertical) -->
            <aside class="w-80 bg-gray-900 shadow-lg min-h-screen p-6">
                <h2 class="text-2xl font-bold text-blue-400 mb-6 flex items-center">
                    <i class="fas fa-filter mr-2"></i>
                    Filter Material
                </h2>
                
                <div class="space-y-6">
                    <!-- Filter Lokasi -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-map-marker-alt mr-2 text-pink-600"></i>
                            Lokasi
                        </label>
                        <select id="filterLokasi" class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500">
                            <option value="">Semua Lokasi</option>
                        </select>
                    </div>
                    
                    <!-- Filter Material -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-box mr-2 text-pink-600"></i>
                            Material
                        </label>
                        <input type="text" id="filterMaterial" placeholder="Cari Material..." 
                            class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500">
                    </div>
                    
                    <!-- Filter S/N Mesin -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-barcode mr-2 text-pink-600"></i>
                            S/N Mesin
                        </label>
                        <input type="text" id="filterSN" placeholder="Cari S/N Mesin..." 
                            class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500">
                    </div>

                    <!-- Status Legend -->
                    <div class="mt-8 p-4 bg-white rounded-lg shadow-md">
                        <h3 class="font-semibold text-pink-800 mb-3">
                            <i class="fas fa-info-circle mr-2"></i>
                            Keterangan Status
                        </h3>
                        <div class="space-y-2 text-sm text-gray-700">
                            <div class="flex items-center">
                                <span class="inline-block w-4 h-4 bg-red-100 border-2 border-red-500 rounded mr-2"></span>
                                <span>Perlu Diganti (Lewat Target)</span>
                            </div>
                            <div class="flex items-center">
                                <span class="inline-block w-4 h-4 bg-yellow-100 border-2 border-yellow-500 rounded mr-2"></span>
                                <span>Mendekati Batas (≤20 hari)</span>
                            </div>
                            <div class="flex items-center">
                                <span class="inline-block w-4 h-4 bg-green-100 border-2 border-green-500 rounded mr-2"></span>
                                <span>Terpasang (Normal)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- Main Content Area -->
            <main class="flex-1 p-6">
                <div class="bg-white rounded-lg shadow-md overflow-hidden" style="height: calc(100vh - 200px); overflow-y: auto;">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white" style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th class="px-4 py-3 text-left">S/N Mesin</th>
                                <th class="px-4 py-3 text-left">Part Number</th>
                                <th class="px-4 py-3 text-left">Material</th>
                                <th class="px-4 py-3 text-left">Tanggal Pasang</th>
                                <th class="px-4 py-3 text-center">Umur (Hari)</th>
                                <th class="px-4 py-3 text-center">Target (Hari)</th>
                                <th class="px-4 py-3 text-center">Sisa (Hari)</th>
                                <th class="px-4 py-3 text-left">Lokasi</th>
                                <th class="px-4 py-3 text-center">Status</th>
                                <th class="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="ageTable">
                            <tr>
                                <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                    <p>Memuat data...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </main>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-umur.js"></script>
    </body>
    </html>
  `
}

function getDashboardMutasiHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Mutasi Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-exchange-alt text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Mutasi Material</span>
                </div>
                <div class="flex flex-wrap space-x-2">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-blue-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <!-- Main Content with Sidebar -->
        <div class="flex">
            <!-- Sidebar Filter (Vertical) -->
            <aside class="w-80 bg-gray-900 shadow-lg min-h-screen p-6">
                <h2 class="text-2xl font-bold text-blue-400 mb-6 flex items-center">
                    <i class="fas fa-filter mr-2"></i>
                    Filter Mutasi
                </h2>
                
                <div class="space-y-6">
                    <!-- Filter Tanggal -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-calendar mr-2 text-cyan-600"></i>
                            Tanggal
                        </label>
                        <input type="date" id="filterTanggal" 
                            class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                    </div>
                    
                    <!-- Filter Nomor BA -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-file-alt mr-2 text-cyan-600"></i>
                            Nomor BA
                        </label>
                        <input type="text" id="filterNomorBA" placeholder="Cari Nomor BA..." 
                            class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                    </div>
                    
                    <!-- Filter Part Number -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-barcode mr-2 text-cyan-600"></i>
                            Part Number
                        </label>
                        <input type="text" id="filterPartNumber" placeholder="Cari Part Number..." 
                            class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                    </div>
                    
                    <!-- Filter Unit Tujuan -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-300 mb-3">
                            <i class="fas fa-map-marker-alt mr-2 text-cyan-600"></i>
                            Unit Tujuan
                        </label>
                        <select id="filterUnitTujuan" 
                            class="w-full px-4 py-2 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">Semua Unit</option>
                        </select>
                    </div>

                    <!-- Export Button -->
                    <div class="mt-8">
                        <button onclick="exportAllBA()" class="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
                            <i class="fas fa-file-export mr-2"></i>
                            Export Semua BA
                        </button>
                    </div>

                    <!-- Info Box -->
                    <div class="mt-8 p-4 bg-white rounded-lg shadow-md">
                        <h3 class="font-semibold text-cyan-800 mb-3">
                            <i class="fas fa-info-circle mr-2"></i>
                            Informasi
                        </h3>
                        <div class="space-y-2 text-sm text-gray-700">
                            <p>• Klik Nomor BA untuk melihat detail</p>
                            <p>• Status Terkirim untuk export BA</p>
                            <p>• Filter: Tanggal, BA, Part Number, Unit</p>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- Main Content Area -->
            <main class="flex-1 p-6">
                <div class="bg-white rounded-lg shadow-md overflow-hidden" style="height: calc(100vh - 200px); overflow-y: auto;">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white" style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th class="px-4 py-3 text-left">Nomor BA</th>
                                <th class="px-4 py-3 text-left">Tanggal</th>
                                <th class="px-4 py-3 text-left">Jenis Transaksi</th>
                                <th class="px-4 py-3 text-left">Part Number</th>
                                <th class="px-4 py-3 text-center">Jumlah</th>
                                <th class="px-4 py-3 text-left">Lokasi Keluar</th>
                                <th class="px-4 py-3 text-left">Lokasi Tujuan</th>
                                <th class="px-4 py-3 text-left">Pemeriksa</th>
                                <th class="px-4 py-3 text-left">Penerima</th>
                                <th class="px-4 py-3 text-center">Status BA</th>
                                <th class="px-4 py-3 text-center admin-only">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="mutasiTable">
                            <tr>
                                <td colspan="11" class="px-4 py-8 text-center text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                    <p>Memuat data...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </main>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-mutasi.js"></script>
    </body>
    </html>
  `
}

function getFormGangguanHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Form Gangguan dan Permintaan Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .signature-pad {
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            cursor: crosshair;
          }
          .signature-pad:hover {
            border-color: #3b82f6;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-exclamation-triangle text-2xl"></i>
                    <span class="text-xl font-bold">Form Gangguan dan Permintaan Material</span>
                </div>
                <div class="flex flex-wrap space-x-2">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                </div>
            </div>
        </nav>

        <div class="min-h-screen py-8 px-4">
            <div class="max-w-6xl mx-auto">
                <!-- Header -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-file-alt text-red-600 mr-3"></i>
                        Form Gangguan dan Permintaan Material
                    </h1>
                    <p class="text-gray-600">Berita Acara LH05</p>
                </div>

                <!-- Form -->
                <form id="gangguanForm" class="space-y-6">
                    <!-- BA LH05 Number (Auto) -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-hashtag text-red-600 mr-2"></i>
                            Nomor BA LH05 (Auto)
                        </h2>
                        <div class="bg-gray-100 p-4 rounded-lg">
                            <p class="text-sm text-gray-600 mb-2">Nomor akan di-generate otomatis:</p>
                            <p class="text-2xl font-bold text-red-600">Format: XXX/ND KAL 2/LH05/TAHUN</p>
                            <p class="text-sm text-gray-500 mt-2">Contoh: 001/ND KAL 2/LH05/2025</p>
                        </div>
                    </div>

                    <!-- 1. Hari/Tanggal/Jam Kejadian -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            1. Hari/Tanggal/Jam Kejadian
                        </h2>
                        <input type="datetime-local" id="hariTanggal" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                    </div>

                    <!-- Unit/ULD -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-building text-red-600 mr-2"></i>
                            Unit / ULD
                        </h2>
                        <select id="unitULD" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                            <option value="">-- Pilih Unit/ULD --</option>
                        </select>
                    </div>

                    <!-- 2. Kelompok SPD yang rusak -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            2. Kelompok SPD yang rusak
                        </h2>
                        <select id="kelompokSPD" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                            <option value="">-- Pilih Kelompok SPD --</option>
                            <option value="MEKANIK">MEKANIK</option>
                            <option value="ELEKTRIK">ELEKTRIK</option>
                        </select>
                    </div>

                    <!-- 3-6. Isian Manual -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            Analisa Gangguan
                        </h2>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    3. Komponen yang rusak
                                </label>
                                <input type="text" id="komponenRusak" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    4. Gejala yang timbul
                                </label>
                                <textarea id="gejala" required rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    5. Uraian kejadian
                                </label>
                                <textarea id="uraianKejadian" required rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    6. Analisa penyebab
                                </label>
                                <textarea id="analisaPenyebab" required rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    7. Kesimpulan kerusakan
                                </label>
                                <textarea id="kesimpulan" required rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- 8. Akibat terhadap sistem pembangkit -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            8. Akibat terhadap sistem pembangkit
                        </h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    Beban Puncak (MW)
                                </label>
                                <input type="number" id="bebanPuncak" step="0.01" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    Daya Mampu (MW)
                                </label>
                                <input type="number" id="dayaMampu" step="0.01" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    Status Pemadaman
                                </label>
                                <select id="pemadaman" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                    <option value="">-- Pilih Status --</option>
                                    <option value="NORMAL">NORMAL</option>
                                    <option value="SIAGA">SIAGA</option>
                                    <option value="DEFISIT">DEFISIT</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- 9-10. Tindakan -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            Tindakan dan Rencana
                        </h2>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    9. Tindakan penanggulangan
                                </label>
                                <textarea id="tindakanPenanggulangan" required rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">
                                    10. Rencana perbaikan
                                </label>
                                <textarea id="rencanaPerbaikan" required rows="3"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- 11. Kebutuhan Material -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-boxes text-red-600 mr-2"></i>
                            11. Kebutuhan Material
                        </h2>
                        
                        <!-- Temporary Message -->
                        <div id="tempMessageGangguan" class="hidden"></div>
                        
                        <!-- Single Material Input Form -->
                        <div class="border-2 border-red-500 rounded-lg p-4 bg-red-50 mb-6">
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">
                                <i class="fas fa-edit mr-2"></i>Input Material
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div class="lg:col-span-1">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Part Number (Cari) *</label>
                                    <div class="relative">
                                        <input type="text" 
                                            class="part-number-search-gangguan w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" 
                                            placeholder="Ketik atau pilih Part Number"
                                            data-material-id="1"
                                            autocomplete="off">
                                        <div class="search-results-gangguan absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg hidden max-h-60 overflow-y-auto"></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Barang</label>
                                    <input type="text" class="jenis-barang-gangguan w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Material</label>
                                    <input type="text" class="material-gangguan w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Mesin</label>
                                    <input type="text" class="mesin-gangguan w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
                                </div>
                                
                                <div class="lg:col-span-2">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">S/N Mesin *</label>
                                    <input type="text" class="sn-mesin-gangguan w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                        placeholder="Serial Number Mesin (WAJIB)">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Jumlah *</label>
                                    <input type="number" class="jumlah-gangguan w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                        value="1" min="1">
                                </div>
                                
                                <div class="flex items-end">
                                    <button type="button" id="addMaterialBtnGangguan" 
                                        class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition flex items-center justify-center">
                                        <i class="fas fa-plus mr-2"></i>Tambah
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Stock Info Display -->
                            <div id="stockInfoGangguan" class="mt-4 hidden"></div>
                        </div>
                        
                        <!-- Materials Preview Table -->
                        <div class="mt-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">
                                    <i class="fas fa-list mr-2"></i>
                                    List Material (<span id="totalMaterialsCountGangguan">0</span> item)
                                </h3>
                                <button type="button" onclick="resetMaterialsListGangguan()" 
                                    class="text-sm text-red-600 hover:text-red-700">
                                    <i class="fas fa-trash mr-1"></i>Hapus Semua
                                </button>
                            </div>
                            
                            <div class="overflow-x-auto">
                                <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead class="bg-gray-100">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">No</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Part Number</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Jenis Barang</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Material</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Mesin</th>
                                            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">S/N Mesin</th>
                                            <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Jumlah</th>
                                            <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="materialPreviewBodyGangguan">
                                        <tr>
                                            <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                                                <i class="fas fa-inbox text-4xl mb-2"></i>
                                                <p>Belum ada material yang ditambahkan.</p>
                                                <p class="text-sm mt-1">Isi form di atas dan klik "Tambah" untuk menambahkan material.</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- 12. TTD Digital -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-signature text-red-600 mr-2"></i>
                            12. Tanda Tangan Digital Pelapor
                        </h2>
                        
                        <div class="max-w-md mx-auto">
                            <label class="block text-sm font-medium text-gray-300 mb-2">Nama Pelapor</label>
                            <input type="text" id="namaPelapor" required placeholder="Nama Pelapor"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
                            
                            <label class="block text-sm font-medium text-gray-300 mb-2">Tanda Tangan Pelapor</label>
                            <canvas id="signaturePelapor" width="400" height="200" class="signature-pad w-full bg-gray-50"></canvas>
                            <button type="button" id="clearPelapor" class="mt-2 text-sm text-red-600 hover:text-red-700">
                                <i class="fas fa-eraser mr-1"></i>Hapus Tanda Tangan
                            </button>
                        </div>
                    </div>

                    <!-- Submit -->
                    <div class="flex gap-4">
                        <button type="submit" 
                            class="flex-1 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition text-lg font-semibold">
                            <i class="fas fa-save mr-2"></i>Simpan Form Gangguan
                        </button>
                        <button type="button" id="resetFormGangguan"
                            class="px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                            <i class="fas fa-undo mr-2"></i>Reset
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/form-gangguan-material-list.js"></script>
        <script src="/static/form-gangguan.js"></script>
    </body>
    </html>
  `
}

function getLoginHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - Sistem Manajemen Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-500 to-blue-700 min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full mx-4">
            <!-- Login Card -->
            <div class="bg-white rounded-2xl shadow-2xl p-8">
                <!-- Header -->
                <div class="text-center mb-8">
                    <div class="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-warehouse text-4xl text-white"></i>
                    </div>
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">Sistem Manajemen Material</h1>
                    <p class="text-gray-600">Silakan login untuk melanjutkan</p>
                </div>

                <!-- Error Message -->
                <div id="errorMessage" class="hidden bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span id="errorText">Username atau password salah</span>
                    </div>
                </div>

                <!-- Login Form -->
                <form id="loginForm" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">
                            <i class="fas fa-user mr-2 text-blue-600"></i>Username
                        </label>
                        <input type="text" id="username" required
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Masukkan username">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">
                            <i class="fas fa-lock mr-2 text-blue-600"></i>Password
                        </label>
                        <div class="relative">
                            <input type="password" id="password" required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Masukkan password">
                            <button type="button" id="togglePassword" 
                                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>

                    <button type="submit" id="loginButton"
                        class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold text-lg flex items-center justify-center">
                        <i class="fas fa-sign-in-alt mr-2"></i>
                        <span>Login</span>
                    </button>
                </form>

                <!-- Public Access Link -->
                <div class="mt-8 pt-6 border-t border-gray-200 text-center">
                    <p class="text-gray-600 mb-3">Akses Publik:</p>
                    <a href="/form-gangguan" 
                        class="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Form Gangguan dan Permintaan Material
                        <i class="fas fa-arrow-right ml-2"></i>
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div class="text-center mt-6 text-white">
                <p class="text-sm opacity-80">PT PLN (Persero) Unit Induk Wilayah Kalimantan Selatan & Tengah</p>
            </div>
        </div>

        <script>
          // Toggle password visibility
          document.getElementById('togglePassword').addEventListener('click', function() {
            const passwordInput = document.getElementById('password')
            const icon = this.querySelector('i')
            
            if (passwordInput.type === 'password') {
              passwordInput.type = 'text'
              icon.classList.remove('fa-eye')
              icon.classList.add('fa-eye-slash')
            } else {
              passwordInput.type = 'password'
              icon.classList.remove('fa-eye-slash')
              icon.classList.add('fa-eye')
            }
          })

          // Login form submit
          document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault()
            
            const username = document.getElementById('username').value
            const password = document.getElementById('password').value
            const button = document.getElementById('loginButton')
            const errorDiv = document.getElementById('errorMessage')
            
            // Disable button
            button.disabled = true
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...'
            
            try {
              const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
              })
              
              const data = await response.json()
              
              if (data.success) {
                // Save session token, role, and username
                localStorage.setItem('sessionToken', data.sessionToken)
                localStorage.setItem('userRole', data.role)
                localStorage.setItem('username', data.username)
                
                // Show success and redirect
                button.innerHTML = '<i class="fas fa-check mr-2"></i>Login Berhasil!'
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700')
                button.classList.add('bg-green-600')
                
                setTimeout(() => {
                  // Force reload to clear cache and load fresh data
                  window.location.href = '/'
                  window.location.reload(true)
                }, 500)
              } else {
                // Show error
                errorDiv.classList.remove('hidden')
                document.getElementById('errorText').textContent = data.message || 'Login gagal'
                
                // Reset button
                button.disabled = false
                button.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login'
              }
            } catch (error) {
              console.error('Login error:', error)
              errorDiv.classList.remove('hidden')
              document.getElementById('errorText').textContent = 'Terjadi kesalahan sistem'
              
              // Reset button
              button.disabled = false
              button.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login'
            }
          })
        </script>
    </body>
    </html>
  `
}

function getDashboardKebutuhanMaterialHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Kebutuhan Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-clipboard-list text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Kebutuhan Material</span>
                </div>
                <div class="flex flex-wrap space-x-2 items-center">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <!-- Dropdown Kebutuhan -->
                    <div class="relative inline-block text-left">
                        <button onclick="toggleKebutuhanDropdown()" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800 flex items-center">
                            <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                            <i class="fas fa-caret-down ml-1"></i>
                        </button>
                        <div id="kebutuhanDropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                            <a href="/dashboard/kebutuhan-material" class="block px-4 py-2 text-gray-800 hover:bg-blue-100">
                                <i class="fas fa-list mr-2"></i>Kebutuhan Material
                            </a>
                            <a href="/dashboard/create-rab" class="block px-4 py-2 text-gray-800 hover:bg-blue-100">
                                <i class="fas fa-plus-circle mr-2"></i>Create RAB
                            </a>
                            <a href="/dashboard/list-rab" class="block px-4 py-2 text-gray-800 hover:bg-blue-100">
                                <i class="fas fa-list-alt mr-2"></i>List RAB
                            </a>
                        </div>
                    </div>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-blue-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="flex">
            <!-- Sidebar Filter (Kiri) -->
            <div class="w-64 bg-gray-900 shadow-lg p-6 min-h-screen">
                <h2 class="text-xl font-bold mb-6 text-white">
                    <i class="fas fa-filter mr-2 text-blue-400"></i>
                    Filter Data
                </h2>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Filter Status</label>
                        <select id="filterStatus" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                            <option value="">Semua Status</option>
                            <option value="N/A">N/A</option>
                            <option value="Pengadaan">Pengadaan</option>
                            <option value="Tunda">Tunda</option>
                            <option value="Reject">Reject</option>
                            <option value="Terkirim">Terkirim</option>
                            <option value="Tersedia">Tersedia</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Filter Mesin</label>
                        <select id="filterMesin" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                            <option value="">Semua Mesin</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Filter Unit</label>
                        <select id="filterUnit" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                            <option value="">Semua Unit</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Cari Nomor LH05</label>
                        <input type="text" id="searchNomor" placeholder="Cari nomor..." 
                            class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                    </div>
                    
                    <button onclick="applyFilters()" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-search mr-2"></i>Terapkan Filter
                    </button>
                    
                    <button onclick="resetFilters()" class="w-full bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                        <i class="fas fa-undo mr-2"></i>Reset Filter
                    </button>
                </div>
                
                <div class="mt-8 p-4 bg-purple-50 rounded-lg">
                    <h3 class="font-semibold text-purple-800 mb-2">
                        <i class="fas fa-info-circle mr-2"></i>
                        Statistik
                    </h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span>Total Material:</span>
                            <span id="totalMaterial" class="font-bold">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Pengadaan:</span>
                            <span id="totalPengadaan" class="font-bold text-blue-600">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Tunda:</span>
                            <span id="totalTunda" class="font-bold text-yellow-600">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Reject:</span>
                            <span id="totalReject" class="font-bold text-red-600">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Terkirim:</span>
                            <span id="totalTerkirim" class="font-bold text-green-600">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Tersedia:</span>
                            <span id="totalTersedia" class="font-bold text-purple-600">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content (Kanan) -->
            <div class="flex-1 p-6">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-boxes mr-2 text-purple-600"></i>
                            Kebutuhan Material
                        </h2>
                        <button onclick="exportExcel()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            <i class="fas fa-file-excel mr-2"></i>Export Excel
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-md overflow-hidden" style="height: calc(100vh - 200px); overflow-y: auto;">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white" style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th class="px-4 py-3 text-center">No</th>
                                <th class="px-4 py-3 text-left">Nomor LH05</th>
                                <th class="px-4 py-3 text-left">Part Number</th>
                                <th class="px-4 py-3 text-left">Material</th>
                                <th class="px-4 py-3 text-left">Mesin</th>
                                <th class="px-4 py-3 text-center">Jumlah</th>
                                <th class="px-4 py-3 text-left">Unit/Lokasi Tujuan</th>
                                <th class="px-4 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody id="kebutuhanTable">
                            <tr>
                                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                                    Belum ada data kebutuhan material
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-kebutuhan.js"></script>
        <script>
          // Toggle dropdown kebutuhan
          function toggleKebutuhanDropdown() {
            const dropdown = document.getElementById('kebutuhanDropdown')
            dropdown.classList.toggle('hidden')
          }
          
          // Close dropdown when clicking outside
          document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('kebutuhanDropdown')
            const button = event.target.closest('button')
            if (button && button.textContent.includes('Kebutuhan')) return
            if (!dropdown.contains(event.target)) {
              dropdown.classList.add('hidden')
            }
          })
        </script>
    </body>
    </html>
  `
}

function getDashboardGangguanHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Gangguan dan Permintaan Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-tools text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Gangguan dan Permintaan Material</span>
                </div>
                <div class="flex flex-wrap space-x-2">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/stok" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-1"></i>Stok
                    </a>
                    <a href="/dashboard/umur" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-1"></i>Umur
                    </a>
                    <a href="/dashboard/mutasi" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-1"></i>Mutasi
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-blue-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="flex">
            <!-- Sidebar Filter (Kiri) -->
            <div class="w-64 bg-gray-900 shadow-lg p-6 min-h-screen">
                <h2 class="text-xl font-bold mb-6 text-white">
                    <i class="fas fa-filter mr-2 text-blue-400"></i>
                    Filter Data
                </h2>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Kelompok SPD</label>
                        <select id="filterKelompok" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                            <option value="">Semua</option>
                            <option value="MEKANIK">MEKANIK</option>
                            <option value="ELEKTRIK">ELEKTRIK</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Tanggal</label>
                        <input type="date" id="filterTanggal" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Status Pemadaman</label>
                        <select id="filterPemadaman" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                            <option value="">Semua</option>
                            <option value="NORMAL">NORMAL</option>
                            <option value="SIAGA">SIAGA</option>
                            <option value="DEFISIT">DEFISIT</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Filter Unit</label>
                        <select id="filterUnit" class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                            <option value="">Semua Unit</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Cari Nomor LH05</label>
                        <input type="text" id="searchNomor" placeholder="001/ND KAL 2/LH05/2025" 
                            class="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm">
                    </div>
                    
                    <button onclick="applyFilters()" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-search mr-2"></i>Terapkan Filter
                    </button>
                    
                    <button onclick="resetFilters()" class="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600">
                        <i class="fas fa-undo mr-2"></i>Reset Filter
                    </button>
                </div>
                
                <div class="mt-8 p-4 bg-gray-800 rounded-lg">
                    <h3 class="font-semibold text-blue-400 mb-2">
                        <i class="fas fa-info-circle mr-2"></i>
                        Statistik
                    </h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-300">Total Gangguan:</span>
                            <span class="text-gray-300" id="totalGangguan" class="font-bold">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Mekanik:</span>
                            <span class="text-gray-300" id="totalMekanik" class="font-bold">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Elektrik:</span>
                            <span class="text-gray-300" id="totalElektrik" class="font-bold">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content (Kanan) -->
            <div class="flex-1 p-6">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-list-ul mr-2 text-blue-600"></i>
                            Daftar Gangguan dan Permintaan Material
                        </h2>
                        <button onclick="exportAllLH05()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                            <i class="fas fa-file-export mr-2"></i>Export All
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-md overflow-hidden" style="height: calc(100vh - 200px); overflow-y: auto;">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white" style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th class="px-4 py-3 text-left">Nomor LH05</th>
                                <th class="px-4 py-3 text-left">Tanggal Kejadian</th>
                                <th class="px-4 py-3 text-left">Kelompok SPD</th>
                                <th class="px-4 py-3 text-left">Komponen Rusak</th>
                                <th class="px-4 py-3 text-center">Beban (MW)</th>
                                <th class="px-4 py-3 text-center">Status</th>
                                <th class="px-4 py-3 text-center">Material</th>
                                <th class="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="gangguanTable">
                            <tr>
                                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                                    <div class="mb-4">
                                        <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-3"></i>
                                        <p class="text-lg font-semibold">Memuat data gangguan...</p>
                                        <p class="text-sm text-gray-400 mt-2">Jika data tidak muncul dalam 5 detik, refresh halaman (F5)</p>
                                    </div>
                                    <div id="debugInfo" class="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-left text-sm">
                                        <p class="font-semibold mb-2"><i class="fas fa-info-circle mr-2"></i>Debug Info:</p>
                                        <p>⏳ Loading... mohon tunggu</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-gangguan.js"></script>
        <script>
          // Force load data after auth check completes
          window.addEventListener('load', function() {
            console.log('🔥 FORCE LOADING dashboard gangguan data...')
            setTimeout(function() {
              if (typeof loadDashboardData === 'function') {
                console.log('✅ Calling loadDashboardData() manually')
                loadDashboardData()
              } else {
                console.error('❌ loadDashboardData function not found!')
              }
            }, 1000)
          })
        </script>
    </body>
    </html>
  `
}

function getDashboardResumeHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Resume - Sistem Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-chart-line text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Resume Material</span>
                </div>
                <div class="flex flex-wrap space-x-2 items-center">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-plus mr-1"></i>Input Material
                    </a>
                    <a href="/form-gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Form Gangguan
                    </a>
                    <a href="/dashboard/gangguan" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tools mr-1"></i>Gangguan
                    </a>
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
                    </a>
                    <a href="/dashboard/resume" class="px-3 py-2 bg-blue-800 rounded">
                        <i class="fas fa-chart-line mr-1"></i>Resume
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-red-700 rounded ml-4">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="flex min-h-screen bg-gray-50">
            <!-- Sidebar Filter (Style Dashboard Stok) -->
            <div class="w-64 bg-white shadow-md p-6">
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-filter text-blue-600 mr-2"></i>
                        Filter Data
                    </h3>
                    
                    <!-- Dropdown Pilih Tampilan -->
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Pilih Tampilan</label>
                        <select id="filterTampilan" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="status-kebutuhan">Status Kebutuhan Material</option>
                            <option value="top-material">Top 15 Material Sering Keluar</option>
                            <option value="stok-kritis">Top 15 Stok Kritis</option>
                        </select>
                    </div>
                    
                    <!-- Tombol Filter -->
                    <button onclick="applyFilter()" class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg mb-2 transition-colors">
                        <i class="fas fa-search mr-2"></i>Filter
                    </button>
                    
                    <!-- Tombol Reset -->
                    <button onclick="resetFilter()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg mb-4 transition-colors">
                        <i class="fas fa-redo mr-2"></i>Reset
                    </button>
                    
                    <!-- Filter MESIN (untuk Top Material & Stok Kritis) -->
                    <div id="filterMesinSection" class="mb-4" style="display:none;">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-cog text-gray-600 mr-1"></i>
                            Filter Mesin
                        </label>
                        <select id="filterMesin" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Semua Mesin</option>
                        </select>
                    </div>
                    
                    <!-- Filter Part Number & Unit/ULD (untuk Status Kebutuhan Material) -->
                    <div id="filterStatusKebutuhanSection" class="space-y-4" style="display:none;">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-barcode text-gray-600 mr-1"></i>
                                Cari Part Number
                            </label>
                            <input 
                                type="text" 
                                id="filterPartNumber" 
                                placeholder="Ketik Part Number..."
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-map-marker-alt text-gray-600 mr-1"></i>
                                Filter Unit/ULD
                            </label>
                            <select id="filterUnitULD" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="">Semua Unit/ULD</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 p-6">
                <!-- Page Header -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 class="text-2xl font-bold text-gray-800 flex items-center">
                        <i class="fas fa-chart-line text-blue-600 mr-3"></i>
                        Dashboard Resume Material
                    </h1>
                    <p class="text-gray-600 mt-2">Ringkasan data material, stok kritis, dan status kebutuhan</p>
                </div>

            <!-- Section: Status Kebutuhan Material -->
            <div id="status-kebutuhan" class="section-content">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-tasks text-blue-600 mr-2"></i>
                        Status Kebutuhan Material
                    </h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
                        <!-- Total -->
                        <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow p-4">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-clipboard-list text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusTotal">0</span>
                            </div>
                            <p class="text-sm opacity-90">Total Kebutuhan</p>
                        </div>
                        
                        <!-- N/A -->
                        <div class="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-lg shadow p-4 cursor-pointer hover:scale-105 transition-transform" onclick="showStatusDetail('N/A')">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-question-circle text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusNA">0</span>
                            </div>
                            <p class="text-sm opacity-90">N/A 👆</p>
                        </div>
                        
                        <!-- Pengadaan -->
                        <div class="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow p-4 cursor-pointer hover:scale-105 transition-transform" onclick="showStatusDetail('Pengadaan')">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-shopping-cart text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusPengadaan">0</span>
                            </div>
                            <p class="text-sm opacity-90">Pengadaan 👆</p>
                        </div>
                        
                        <!-- Tunda -->
                        <div class="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg shadow p-4 cursor-pointer hover:scale-105 transition-transform" onclick="showStatusDetail('Tunda')">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-clock text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusTunda">0</span>
                            </div>
                            <p class="text-sm opacity-90">Tunda 👆</p>
                        </div>
                        
                        <!-- Terkirim -->
                        <div class="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow p-4 cursor-pointer hover:scale-105 transition-transform" onclick="showStatusDetail('Terkirim')">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-check-circle text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusTerkirim">0</span>
                            </div>
                            <p class="text-sm opacity-90">Terkirim 👆</p>
                        </div>
                        
                        <!-- Reject -->
                        <div class="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow p-4 cursor-pointer hover:scale-105 transition-transform" onclick="showStatusDetail('Reject')">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-times-circle text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusReject">0</span>
                            </div>
                            <p class="text-sm opacity-90">Reject 👆</p>
                        </div>
                        
                        <!-- Tersedia -->
                        <div class="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg shadow p-4 cursor-pointer hover:scale-105 transition-transform" onclick="showStatusDetail('Tersedia')">
                            <div class="flex items-center justify-between mb-2">
                                <i class="fas fa-box text-2xl opacity-80"></i>
                                <span class="text-3xl font-bold" id="statusTersedia">0</span>
                            </div>
                            <p class="text-sm opacity-90">Tersedia 👆</p>
                        </div>
                    </div>
                    
                    <!-- Tabel Detail Material (seperti Dashboard Stok) -->
                    <div class="mt-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">Detail Material Kebutuhan</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="bg-blue-600 text-white">
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">No</th>
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">Nomor LH05</th>
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">Part Number</th>
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">Material</th>
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">Mesin</th>
                                        <th class="px-4 py-3 text-center text-sm font-semibold border">Jumlah</th>
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">Unit/ULD</th>
                                        <th class="px-4 py-3 text-left text-sm font-semibold border">Tujuan</th>
                                        <th class="px-4 py-3 text-center text-sm font-semibold border">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="detailMaterialTable" class="text-sm">
                                    <tr>
                                        <td colspan="9" class="px-4 py-8 text-center text-gray-400 border">
                                            <i class="fas fa-info-circle text-2xl"></i>
                                            <p class="mt-2">Klik salah satu status card di atas untuk melihat detail material</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <!-- Export Button -->
                        <div class="mt-4 flex justify-end">
                            <button onclick="exportStatusToExcel()" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                                <i class="fas fa-file-excel mr-2"></i>Export to Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section: Top 15 Material Sering Keluar -->
            <div id="top-material" class="section-content" style="display: none;">
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-trophy text-yellow-500 mr-2"></i>
                        Top 15 Material Sering Keluar
                        <span class="ml-3 text-sm font-normal text-gray-500">(🔴 Merah = Top 5 Prioritas)</span>
                    </h2>
                    
                    <div class="overflow-x-auto max-h-[600px]">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10">
                                <tr class="bg-blue-600 text-white">
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Peringkat</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Part Number</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Jenis Barang</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Material</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Mesin</th>
                                    <th class="px-4 py-3 text-center text-sm font-semibold border">Total Keluar</th>
                                    <th class="px-4 py-3 text-center text-sm font-semibold border">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="topMaterialsTable" class="text-sm">
                                <tr>
                                    <td colspan="7" class="px-4 py-8 text-center text-gray-400 border">
                                        <i class="fas fa-spinner fa-spin text-2xl"></i>
                                        <p class="mt-2">Memuat data...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Export Button -->
                    <div class="mt-4 flex justify-end">
                        <button onclick="exportTopMaterialToExcel()" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                            <i class="fas fa-file-excel mr-2"></i>Export to Excel
                        </button>
                    </div>
                </div>
            </div>

            <!-- Section: Top 15 Stok Kritis -->
            <div id="stok-kritis" class="section-content" style="display: none;">
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                        Top 15 Stok Kritis (< 5 Parts)
                        <span class="ml-3 text-sm font-normal text-gray-500">(🔴 Merah = Top 5 Prioritas)</span>
                    </h2>
                    
                    <div class="overflow-x-auto max-h-[600px]">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10">
                                <tr class="bg-blue-600 text-white">
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">No</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Part Number</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Jenis Barang</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Material</th>
                                    <th class="px-4 py-3 text-left text-sm font-semibold border">Mesin</th>
                                    <th class="px-4 py-3 text-center text-sm font-semibold border">Stok Akhir</th>
                                </tr>
                            </thead>
                            <tbody id="stokKritisTable" class="text-sm">
                                <tr>
                                    <td colspan="6" class="px-4 py-8 text-center text-gray-400 border">
                                        <i class="fas fa-spinner fa-spin text-2xl"></i>
                                        <p class="mt-2">Memuat data...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Export Button -->
                    <div class="mt-4 flex justify-end">
                        <button onclick="exportStokKritisToExcel()" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                            <i class="fas fa-file-excel mr-2"></i>Export to Excel
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>

        <!-- Modal: Detail Material Keluar -->
        <div id="modalMaterialDetail" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div class="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold flex items-center">
                        <i class="fas fa-info-circle mr-2"></i>
                        Detail Transaksi Material Keluar
                    </h3>
                    <button onclick="closeMaterialDetailModal()" class="text-white hover:text-gray-200 text-2xl font-bold">
                        &times;
                    </button>
                </div>
                
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div id="materialDetailContent">
                        <div class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                            <p class="mt-4 text-gray-600">Memuat detail material...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            function logout() {
                if (confirm('Apakah Anda yakin ingin logout?')) {
                    fetch('/logout', { method: 'POST' })
                        .then(() => window.location.href = '/login')
                        .catch(() => window.location.href = '/login')
                }
            }
            
            function closeMaterialDetailModal() {
                document.getElementById('modalMaterialDetail').classList.add('hidden')
                document.getElementById('modalMaterialDetail').classList.remove('flex')
            }
        </script>
        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-resume.js"></script>
    </body>
    </html>
  `
}

function getDashboardCreateRABHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Create RAB - Rencana Anggaran Biaya</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <!-- Navbar -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="container mx-auto px-4 py-3 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-calculator text-2xl"></i>
                    <span class="text-xl font-bold">Create RAB</span>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="/form-gangguan" class="hover:text-blue-200"><i class="fas fa-wrench mr-2"></i>Form Gangguan</a>
                    <a href="/dashboard/kebutuhan-material" class="hover:text-blue-200"><i class="fas fa-clipboard-list mr-2"></i>Kebutuhan</a>
                    <a href="/dashboard/stok" class="hover:text-blue-200"><i class="fas fa-boxes mr-2"></i>Stok
                    <a href="/dashboard/mutasi" class="hover:text-blue-200"><i class="fas fa-exchange-alt mr-2"></i>Mutasi</a>
                    <a href="/dashboard/umur" class="hover:text-blue-200"><i class="fas fa-calendar-alt mr-2"></i>Umur</a>
                    <a href="/dashboard/gangguan" class="hover:text-blue-200"><i class="fas fa-exclamation-triangle mr-2"></i>Gangguan</a>
                    <a href="/dashboard/resume" class="hover:text-blue-200"><i class="fas fa-chart-line mr-2"></i>Resume</a>
                    <button onclick="logout()" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-6">
            <!-- Header -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h1 class="text-2xl font-bold text-gray-800 flex items-center">
                    <i class="fas fa-calculator text-blue-600 mr-3"></i>
                    Create RAB (Rencana Anggaran Biaya)
                </h1>
                <p class="text-gray-600 mt-2">Buat RAB dari material dengan status Pengadaan</p>
            </div>

            <!-- Form RAB -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <!-- Tanggal RAB -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-calendar mr-2"></i>Tanggal RAB
                        </label>
                        <input type="date" id="tanggalRAB" 
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                               required>
                    </div>
                    
                    <!-- Nomor RAB (auto-generated) -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-hashtag mr-2"></i>Nomor RAB
                        </label>
                        <input type="text" id="nomorRAB" 
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                               placeholder="Auto-generated"
                               readonly>
                    </div>
                </div>

                <!-- Material Pengadaan List -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-list mr-2"></i>Pilih Material dari Kebutuhan (Status: Pengadaan)
                    </h3>
                    
                    <div class="overflow-x-auto">
                        <table class="min-w-full border">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 border text-left">Pilih</th>
                                    <th class="px-4 py-2 border text-left">Nomor LH05</th>
                                    <th class="px-4 py-2 border text-left">Part Number</th>
                                    <th class="px-4 py-2 border text-left">Material</th>
                                    <th class="px-4 py-2 border text-left">Mesin</th>
                                    <th class="px-4 py-2 border text-center">Jumlah</th>
                                    <th class="px-4 py-2 border text-left">Unit/ULD</th>
                                    <th class="px-4 py-2 border text-right">Harga Satuan (Rp)</th>
                                </tr>
                            </thead>
                            <tbody id="materialPengadaanTable">
                                <tr>
                                    <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                                        <p>Memuat data material...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Selected Materials for RAB -->
                <div id="selectedMaterialsSection" class="hidden">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-check-circle mr-2 text-green-600"></i>Material Terpilih untuk RAB
                    </h3>
                    
                    <div class="overflow-x-auto mb-4">
                        <table class="min-w-full border">
                            <thead class="bg-blue-50">
                                <tr>
                                    <th class="px-4 py-2 border text-center">No</th>
                                    <th class="px-4 py-2 border text-left">Nomor LH05</th>
                                    <th class="px-4 py-2 border text-left">Part Number</th>
                                    <th class="px-4 py-2 border text-left">Material</th>
                                    <th class="px-4 py-2 border text-left">Mesin</th>
                                    <th class="px-4 py-2 border text-center">Jumlah</th>
                                    <th class="px-4 py-2 border text-left">Unit/ULD</th>
                                    <th class="px-4 py-2 border text-right">Harga Satuan</th>
                                    <th class="px-4 py-2 border text-right">Subtotal</th>
                                    <th class="px-4 py-2 border text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="selectedMaterialsTable">
                            </tbody>
                            <tfoot class="bg-gray-100 font-bold">
                                <tr>
                                    <td colspan="8" class="px-4 py-3 border text-right">TOTAL HARGA:</td>
                                    <td class="px-4 py-3 border text-right text-lg text-blue-600" id="totalHarga">Rp 0</td>
                                    <td class="px-4 py-3 border"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex justify-end space-x-4">
                        <button onclick="resetRAB()" class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg">
                            <i class="fas fa-redo mr-2"></i>Reset
                        </button>
                        <button onclick="createRAB()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                            <i class="fas fa-save mr-2"></i>Create RAB
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-rab.js"></script>
    </body>
    </html>
  `
}

export default app

function getDashboardListRABHTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daftar RAB - Rencana Anggaran Biaya</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Navbar -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="container mx-auto px-4 py-3 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-list-alt text-2xl"></i>
                    <span class="text-xl font-bold">Daftar RAB</span>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="/dashboard/create-rab" class="hover:text-blue-200"><i class="fas fa-plus-circle mr-2"></i>Create RAB</a>
                    <a href="/dashboard/kebutuhan-material" class="hover:text-blue-200"><i class="fas fa-clipboard-list mr-2"></i>Kebutuhan</a>
                    <a href="/dashboard/resume" class="hover:text-blue-200"><i class="fas fa-chart-line mr-2"></i>Resume</a>
                    <button onclick="logout()" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-6">
            <!-- Header -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h1 class="text-2xl font-bold text-gray-800 flex items-center justify-between">
                    <span>
                        <i class="fas fa-list-alt text-blue-600 mr-3"></i>
                        Daftar RAB (Rencana Anggaran Biaya)
                    </span>
                </h1>
                <p class="text-gray-600 mt-2">Daftar semua RAB yang telah dibuat</p>
            </div>

            <!-- RAB List -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="overflow-x-auto">
                    <table class="min-w-full border">
                        <thead class="bg-blue-50">
                            <tr>
                                <th class="px-4 py-3 border text-center">No</th>
                                <th class="px-4 py-3 border text-left">Nomor RAB</th>
                                <th class="px-4 py-3 border text-center">Tanggal</th>
                                <th class="px-4 py-3 border text-center">Jumlah Item</th>
                                <th class="px-4 py-3 border text-right">Total Harga</th>
                                <th class="px-4 py-3 border text-center">Status</th>
                                <th class="px-4 py-3 border text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="rabListTable">
                            <tr>
                                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                                    <p>Memuat data RAB...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- View RAB Modal -->
        <div id="viewRABModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4">
                <div class="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-file-invoice text-blue-600 mr-2"></i>
                        Detail RAB
                    </h2>
                    <button onclick="closeViewRABModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <div id="rabDetailContent" class="p-6">
                    <!-- Content will be loaded here -->
                </div>
                <div class="p-6 border-t bg-gray-50 flex justify-end space-x-4 sticky bottom-0">
                    <button onclick="exportRABToExcel()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-file-excel mr-2"></i>Export Excel
                    </button>
                    <button onclick="exportRABToPDF()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-file-pdf mr-2"></i>Export PDF
                    </button>
                    <button onclick="closeViewRABModal()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-times mr-2"></i>Tutup
                    </button>
                </div>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/dashboard-list-rab.js"></script>
    </body>
    </html>
  `
}

// ============================================
// INPUT MATERIAL V2 - NEW SYSTEM
// ============================================
function getInputFormV2HTML() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Input Material V2 - Sistem Manajemen Material</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .signature-pad { border: 2px solid #e5e7eb; border-radius: 0.5rem; cursor: crosshair; }
        </style>
    </head>
    <body class="bg-gray-100">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-clipboard-list text-2xl"></i>
                    <span class="text-xl font-bold">Input Material V2 (Beta)</span>
                    <span class="bg-yellow-500 text-xs px-2 py-1 rounded">NEW</span>
                </div>
                <div class="flex space-x-2">
                    <a href="/" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-arrow-left mr-1"></i>Kembali ke V1
                    </a>
                    <a href="/dashboard/main" class="px-3 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-tachometer-alt mr-1"></i>Dashboard
                    </a>
                    <button onclick="logout()" class="px-3 py-2 bg-red-600 hover:bg-red-700 rounded">
                        <i class="fas fa-sign-out-alt mr-1"></i>Logout
                    </button>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto p-6">
            <!-- Info Banner -->
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
                <div class="flex items-start">
                    <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
                    <div>
                        <h3 class="font-semibold text-blue-800">Sistem Input Material Baru</h3>
                        <p class="text-sm text-blue-700 mt-1">
                            Isi data material satu per satu, lalu klik "Tambah ke List". Material akan muncul di tabel preview di bawah.
                        </p>
                    </div>
                </div>
            </div>

            <form id="inputForm" class="space-y-6">
                <!-- Header Info -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">
                        <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                        Informasi Transaksi
                    </h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                            <input type="date" id="tanggal" required 
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Transaksi</label>
                            <select id="jenisTransaksi" required 
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Pilih Jenis --</option>
                                <option value="Masuk (Penerimaan Gudang)">Masuk (Penerimaan Gudang)</option>
                                <option value="Keluar (Pengeluaran Gudang)">Keluar (Pengeluaran Gudang)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Lokasi Tujuan</label>
                            <select id="lokasiTujuan" required 
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Pilih Lokasi --</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Material Input Form -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">
                        <i class="fas fa-plus-circle text-green-600 mr-2"></i>
                        Input Material
                    </h2>

                    <!-- Temp Message -->
                    <div id="tempMessage" class="hidden bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded mb-4"></div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <!-- Part Number Search -->
                        <div class="lg:col-span-1">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Part Number <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                                <input type="text" id="inputPartNumber" 
                                    placeholder="Ketik untuk mencari..."
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <div id="searchResults" class="hidden absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"></div>
                            </div>
                        </div>

                        <!-- Jenis Barang -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Barang</label>
                            <input type="text" id="inputJenisBarang" readonly
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        </div>

                        <!-- Material -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Material</label>
                            <input type="text" id="inputMaterial" readonly
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        </div>

                        <!-- Mesin -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Mesin</label>
                            <input type="text" id="inputMesin" readonly
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        </div>

                        <!-- Status / S/N -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <span class="status-label">Status</span>
                            </label>
                            <input type="text" id="inputStatus"
                                placeholder="Status material (opsional)"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>

                        <!-- Jumlah -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Jumlah <span class="text-red-500">*</span>
                            </label>
                            <input type="number" id="inputJumlah" min="1"
                                placeholder="Kuantitas"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>

                    <!-- Add Button -->
                    <button type="button" id="btnTambahMaterial"
                        class="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition flex items-center justify-center font-semibold">
                        <i class="fas fa-plus-circle mr-2"></i>
                        Tambah ke List Material
                    </button>
                </div>

                <!-- Materials Preview Table -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">
                        <i class="fas fa-list text-blue-600 mr-2"></i>
                        Preview List Material
                    </h2>

                    <!-- Empty State -->
                    <div id="materialsEmptyState" class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-2"></i>
                        <p>Belum ada material. Silakan tambahkan material di atas.</p>
                    </div>

                    <!-- Table -->
                    <div id="materialsTableContainer" class="hidden overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jenis Barang</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesin</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        <span class="status-label">Status</span>
                                    </th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="materialsTableBody" class="bg-white divide-y divide-gray-200">
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Penanggung Jawab -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">
                        <i class="fas fa-user-check text-blue-600 mr-2"></i>
                        Penanggung Jawab
                    </h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Pemeriksa</label>
                            <select id="pemeriksa" required class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
                                <option value="">-- Pilih Pemeriksa --</option>
                            </select>
                            
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Pemeriksa</label>
                            <canvas id="signaturePemeriksa" width="300" height="150" class="signature-pad w-full"></canvas>
                            <button type="button" id="clearPemeriksa" class="mt-2 text-sm text-red-600 hover:text-red-700">
                                <i class="fas fa-eraser mr-1"></i>Hapus
                            </button>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Penerima</label>
                            <select id="penerima" required class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
                                <option value="">-- Pilih Penerima --</option>
                            </select>
                            
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Penerima</label>
                            <canvas id="signaturePenerima" width="300" height="150" class="signature-pad w-full"></canvas>
                            <button type="button" id="clearPenerima" class="mt-2 text-sm text-red-600 hover:text-red-700">
                                <i class="fas fa-eraser mr-1"></i>Hapus
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Submit -->
                <div class="flex gap-4">
                    <button type="submit" 
                        class="flex-1 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition text-lg font-semibold">
                        <i class="fas fa-save mr-2"></i>Simpan Transaksi
                    </button>
                    <button type="button" onclick="resetForm()" 
                        class="bg-gray-500 text-white py-4 px-6 rounded-lg hover:bg-gray-600 transition text-lg font-semibold">
                        <i class="fas fa-undo mr-1"></i>Reset
                    </button>
                </div>
            </form>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/app-material-input.js"></script>
        <script src="/static/app-v2.js"></script>
    </body>
    </html>
  `
}
