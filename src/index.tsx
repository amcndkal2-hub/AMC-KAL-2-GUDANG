import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Google Sheets URL
const GOOGLE_SHEETS_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLibGBLpxhVKoCyNyEKKy3qLChkzbGk3u0B2OCnrRjQaVhgK7zrqCow5s2sWgqaCh97_c6L4jYn8GL1rz-GAlp_GuD3cWN8epmzIRv225YwSNEC6y3wp4ENvOpNITmxK2ic37e8c-UQSH2cbaBLT9mixv92O8sCA-ptW_LnjtZlzNrBzEjWXEKdNgCbOa_ZYVRIAnEzBLqeFCW7XQocgooPzv4xiOKaTXfR81vrwdC_xm4-pJVoMdgmyuldvxNMvM-vokUUcMdTkA-SG6wMRDg2UgAHC34GkfrC6ebYs&lib=MRb65GHGTxo8fAtO2JZr8dy1qv6vbq6ko'

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
initializeSampleGangguanData()

// Counter untuk LH05 (mulai dari 1 atau dari sample data count + 1)
let lh05Counter = gangguanTransactions.length + 1

// Storage untuk target umur material (in-memory)
// Key: partNumber, Value: { partNumber, targetUmurHari, jenisBarang, material, mesin }
let targetUmurMaterial: Map<string, any> = new Map()

// Storage untuk history penggantian material
// Key: `${snMesin}_${partNumber}`, Value: array of history
let materialHistory: Map<string, any[]> = new Map()

// Authentication storage
const VALID_CREDENTIALS = {
  username: 'AMC@12345',
  password: '12345@AMC'
}
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
function generateNomorBA() {
  const paddedNumber = String(baCounter).padStart(3, '0')
  baCounter++
  return `BA${new Date().getFullYear()}${paddedNumber}`
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

// API: Save transaction
app.post('/api/save-transaction', async (c) => {
  try {
    const body = await c.req.json()
    
    // Generate Nomor BA
    const nomorBA = generateNomorBA()
    
    // Add transaction
    const transaction = {
      id: Date.now().toString(),
      nomorBA,
      ...body,
      createdAt: new Date().toISOString()
    }
    
    transactions.push(transaction)
    
    return c.json({ 
      success: true, 
      message: 'Transaction saved successfully',
      nomorBA,
      data: transaction 
    })
  } catch (error) {
    return c.json({ error: 'Failed to save transaction' }, 500)
  }
})

// API: Get transactions
app.get('/api/transactions', (c) => {
  return c.json({ transactions })
})

// API: Get stock dashboard
app.get('/api/dashboard/stock', (c) => {
  const jenisBarang = c.req.query('jenis') || ''
  const mesin = c.req.query('mesin') || ''
  
  let stock = calculateStock()
  
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
})

// API: Get material age dashboard
app.get('/api/dashboard/umur-material', (c) => {
  const lokasi = c.req.query('lokasi') || ''
  const material = c.req.query('material') || ''
  
  let ageData = calculateMaterialAge()
  
  if (lokasi) {
    ageData = ageData.filter((a: any) => a.lokasi === lokasi)
  }
  
  if (material) {
    ageData = ageData.filter((a: any) => a.material.includes(material))
  }
  
  return c.json({ ageData })
})

// API: Get BA by Nomor
app.get('/api/ba/:nomor', (c) => {
  const nomor = c.req.param('nomor')
  const ba = transactions.find(tx => tx.nomorBA === nomor)
  
  if (!ba) {
    return c.json({ error: 'BA not found' }, 404)
  }
  
  return c.json({ ba })
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

// ==================== API AUTHENTICATION ====================

// API: Login
app.post('/api/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
      // Generate session token
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      activeSessions.set(sessionToken, {
        username,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
      })
      
      return c.json({
        success: true,
        message: 'Login successful',
        sessionToken
      })
    } else {
      return c.json({
        success: false,
        message: 'Username atau password salah'
      }, 401)
    }
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})

// API: Logout
app.post('/api/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    const sessionToken = authHeader?.replace('Bearer ', '')
    
    if (sessionToken) {
      activeSessions.delete(sessionToken)
    }
    
    return c.json({ success: true, message: 'Logout successful' })
  } catch (error) {
    return c.json({ error: 'Logout failed' }, 500)
  }
})

// API: Check session
app.get('/api/check-session', (c) => {
  const authHeader = c.req.header('Authorization')
  const sessionToken = authHeader?.replace('Bearer ', '')
  
  if (!sessionToken || !activeSessions.has(sessionToken)) {
    return c.json({ valid: false }, 401)
  }
  
  const session = activeSessions.get(sessionToken)
  const now = new Date()
  const expiresAt = new Date(session.expiresAt)
  
  if (now > expiresAt) {
    activeSessions.delete(sessionToken)
    return c.json({ valid: false, message: 'Session expired' }, 401)
  }
  
  return c.json({ 
    valid: true, 
    username: session.username,
    expiresAt: session.expiresAt
  })
})

// ==================== API FORM GANGGUAN LH05 ====================

// API: Save Form Gangguan LH05
app.post('/api/save-gangguan', async (c) => {
  try {
    const body = await c.req.json()
    
    console.log('💾 Saving gangguan form...')
    console.log('📋 Form data received:', JSON.stringify(body).substring(0, 200) + '...')
    
    // Generate Nomor LH05
    const nomorLH05 = generateNomorLH05()
    console.log('🏷️ Generated Nomor LH05:', nomorLH05)
    
    // Add transaction
    const gangguan = {
      id: Date.now().toString(),
      nomorLH05,
      ...body,
      createdAt: new Date().toISOString()
    }
    
    gangguanTransactions.push(gangguan)
    
    console.log('✅ Gangguan saved successfully')
    console.log('📊 Total gangguan now:', gangguanTransactions.length)
    console.log('🗂️ Last 3 items:', gangguanTransactions.slice(-3).map(g => g.nomorLH05))
    
    return c.json({ 
      success: true, 
      message: 'Form gangguan saved successfully',
      nomorLH05,
      data: gangguan 
    })
  } catch (error) {
    console.error('❌ Error saving gangguan:', error)
    return c.json({ error: 'Failed to save gangguan' }, 500)
  }
})

// API: Get all gangguan transactions
app.get('/api/gangguan-transactions', (c) => {
  console.log('🔍 GET /api/gangguan-transactions called')
  console.log('📊 Total gangguan:', gangguanTransactions.length)
  console.log('🗂️ Gangguan list:', gangguanTransactions.map(g => ({
    nomor: g.nomorLH05,
    unit: g.unitULD,
    kelompok: g.kelompokSPD,
    materials: g.materials?.length || 0
  })))
  
  return c.json({ gangguanTransactions })
})

// API: Get gangguan by Nomor LH05
app.get('/api/gangguan/:nomor', (c) => {
  const nomor = c.req.param('nomor')
  const gangguan = gangguanTransactions.find(tx => tx.nomorLH05 === nomor)
  
  if (!gangguan) {
    return c.json({ error: 'LH05 not found' }, 404)
  }
  
  return c.json({ gangguan })
})

// API: Get gangguan dashboard with filters
app.get('/api/dashboard/gangguan', (c) => {
  const kelompok = c.req.query('kelompok') || ''
  const tanggal = c.req.query('tanggal') || ''
  
  let data = gangguanTransactions
  
  if (kelompok) {
    data = data.filter((g: any) => g.kelompokSPD === kelompok)
  }
  
  if (tanggal) {
    data = data.filter((g: any) => g.hariTanggal?.includes(tanggal))
  }
  
  return c.json({ data })
})

// API: Get kebutuhan material (flattened dari gangguan transactions)
app.get('/api/kebutuhan-material', (c) => {
  const status = c.req.query('status') || ''
  const nomorLH05 = c.req.query('nomor') || ''
  
  let materials: any[] = []
  
  // Flatten materials from all gangguan transactions
  gangguanTransactions.forEach(gangguan => {
    if (gangguan.materials && Array.isArray(gangguan.materials)) {
      gangguan.materials.forEach((mat: any) => {
        materials.push({
          ...mat,
          nomorLH05: gangguan.nomorLH05,
          unitULD: gangguan.unitULD,
          lokasiTujuan: gangguan.unitULD, // Tambah kolom lokasi tujuan
          tanggalGangguan: gangguan.hariTanggal,
          kelompokSPD: gangguan.kelompokSPD,
          status: mat.status || 'Pengadaan' // Default status
        })
      })
    }
  })
  
  // Apply filters
  if (status) {
    materials = materials.filter(m => m.status === status)
  }
  
  if (nomorLH05) {
    materials = materials.filter(m => m.nomorLH05.includes(nomorLH05))
  }
  
  return c.json({ materials })
})

// API: Update status material
app.post('/api/update-material-status', async (c) => {
  try {
    const { nomorLH05, partNumber, status } = await c.req.json()
    
    // Find gangguan transaction
    const gangguan = gangguanTransactions.find(g => g.nomorLH05 === nomorLH05)
    
    if (!gangguan) {
      return c.json({ error: 'Gangguan not found' }, 404)
    }
    
    // Update material status
    const material = gangguan.materials?.find((m: any) => m.partNumber === partNumber)
    
    if (!material) {
      return c.json({ error: 'Material not found' }, 404)
    }
    
    material.status = status
    material.updatedAt = new Date().toISOString()
    
    return c.json({ 
      success: true, 
      message: 'Status updated',
      material 
    })
  } catch (error) {
    return c.json({ error: 'Failed to update status' }, 500)
  }
})

// Main page - Input Form
app.get('/', (c) => {
  return c.html(getInputFormHTML())
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

// HTML Templates
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
                </div>

                <!-- Form -->
                <form id="transactionForm" class="space-y-6">
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
                        
                        <div id="materialList" class="space-y-4"></div>
                        
                        <button type="button" id="addMaterial" 
                            class="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
                            <i class="fas fa-plus mr-2"></i>
                            Tambah Baris Material
                        </button>
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
                        <button type="submit" 
                            class="flex-1 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition text-lg font-semibold">
                            <i class="fas fa-save mr-2"></i>Simpan Transaksi
                        </button>
                        <button type="button" id="resetForm"
                            class="px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                            <i class="fas fa-undo mr-2"></i>Reset
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/auth-check.js"></script>
        <script src="/static/app.js"></script>
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

                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white">
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
                    <div class="mt-8 p-4 bg-gray-800 rounded-lg">
                        <h3 class="font-bold text-sm mb-3 text-gray-700">
                            <i class="fas fa-info-circle mr-2"></i>
                            Keterangan Status
                        </h3>
                        <div class="space-y-2 text-sm">
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
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-blue-500 text-white">
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

                    <!-- Export Button -->
                    <div class="mt-8">
                        <button onclick="exportAllBA()" class="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
                            <i class="fas fa-file-export mr-2"></i>
                            Export Semua BA
                        </button>
                    </div>

                    <!-- Info Box -->
                    <div class="mt-8 p-4 bg-gray-800 rounded-lg">
                        <h3 class="font-bold text-sm mb-3 text-gray-700">
                            <i class="fas fa-info-circle mr-2"></i>
                            Informasi
                        </h3>
                        <div class="space-y-2 text-sm text-gray-600">
                            <p>• Klik Nomor BA untuk melihat detail</p>
                            <p>• Status Terkirim untuk export BA</p>
                            <p>• Filter berdasarkan tanggal dan BA</p>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- Main Content Area -->
            <main class="flex-1 p-6">
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-blue-500 text-white">
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
                                </tr>
                            </thead>
                            <tbody id="mutasiTable">
                                <tr>
                                    <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                        <p>Memuat data...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
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
                        
                        <div id="materialListGangguan" class="space-y-4"></div>
                        
                        <button type="button" id="addMaterialGangguan" 
                            class="w-full mt-4 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
                            <i class="fas fa-plus mr-2"></i>
                            Tambah Material
                        </button>
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
                // Save session token
                localStorage.setItem('sessionToken', data.sessionToken)
                
                // Show success and redirect
                button.innerHTML = '<i class="fas fa-check mr-2"></i>Login Berhasil!'
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700')
                button.classList.add('bg-green-600')
                
                setTimeout(() => {
                  window.location.href = '/'
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
                    <a href="/dashboard/kebutuhan-material" class="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-clipboard-list mr-1"></i>Kebutuhan
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

                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white">
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

                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-blue-500 text-white">
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
                                    Belum ada data gangguan
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

export default app
