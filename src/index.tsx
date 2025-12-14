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

// Helper: Calculate Material Age
function calculateMaterialAge() {
  const ageMap: any = {}
  
  transactions
    .filter(tx => tx.jenisTransaksi.includes('Keluar'))
    .forEach(tx => {
      tx.materials.forEach((mat: any) => {
        const key = `${mat.snMesin}_${mat.partNumber}`
        
        if (!ageMap[key]) {
          ageMap[key] = {
            snMesin: mat.snMesin,
            partNumber: mat.partNumber,
            material: mat.material,
            mesin: mat.mesin,
            lokasi: tx.lokasiTujuan,
            tanggalPasang: tx.tanggal,
            tanggalGanti: null,
            umurHari: 0,
            status: 'Terpasang'
          }
        } else {
          // Material diganti
          const tanggalPasang = new Date(ageMap[key].tanggalPasang)
          const tanggalGanti = new Date(tx.tanggal)
          const umurMs = tanggalGanti.getTime() - tanggalPasang.getTime()
          const umurHari = Math.floor(umurMs / (1000 * 60 * 60 * 24))
          
          ageMap[key].tanggalGanti = tx.tanggal
          ageMap[key].umurHari = umurHari
          ageMap[key].status = 'Perlu Diganti'
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
                <div class="flex space-x-4">
                    <a href="/" class="px-4 py-2 bg-blue-700 rounded hover:bg-blue-800">
                        <i class="fas fa-plus mr-2"></i>Input Material
                    </a>
                    <a href="/dashboard/stok" class="px-4 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-chart-bar mr-2"></i>Stok Material
                    </a>
                    <a href="/dashboard/umur" class="px-4 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-calendar-alt mr-2"></i>Umur Material
                    </a>
                    <a href="/dashboard/mutasi" class="px-4 py-2 hover:bg-blue-700 rounded">
                        <i class="fas fa-exchange-alt mr-2"></i>Mutasi Material
                    </a>
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
                            class="flex-1 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition text-lg font-semibold">
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
        <nav class="bg-green-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-chart-bar text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Stok Material</span>
                </div>
                <div class="flex space-x-4">
                    <a href="/" class="px-4 py-2 hover:bg-green-700 rounded">
                        <i class="fas fa-plus mr-2"></i>Input Material
                    </a>
                    <a href="/dashboard/stok" class="px-4 py-2 bg-green-700 rounded">
                        <i class="fas fa-chart-bar mr-2"></i>Stok Material
                    </a>
                    <a href="/dashboard/umur" class="px-4 py-2 hover:bg-green-700 rounded">
                        <i class="fas fa-calendar-alt mr-2"></i>Umur Material
                    </a>
                    <a href="/dashboard/mutasi" class="px-4 py-2 hover:bg-green-700 rounded">
                        <i class="fas fa-exchange-alt mr-2"></i>Mutasi Material
                    </a>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto p-6">
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 class="text-2xl font-bold mb-4">Filter Type Mesin</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <button onclick="filterJenis('MATERIAL HANDAL')" class="bg-blue-500 text-white px-4 py-3 rounded hover:bg-blue-600">
                        MATERIAL HANDAL
                    </button>
                    <button onclick="filterJenis('FILTER')" class="bg-green-500 text-white px-4 py-3 rounded hover:bg-green-600">
                        FILTER
                    </button>
                    <button onclick="filterJenis('MATERIAL BEKAS')" class="bg-yellow-500 text-white px-4 py-3 rounded hover:bg-yellow-600">
                        MATERIAL BEKAS
                    </button>
                    <button onclick="filterJenis('')" class="bg-gray-500 text-white px-4 py-3 rounded hover:bg-gray-600">
                        SEMUA
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Cari Part Number</label>
                        <input type="text" id="searchPart" placeholder="Cari Part Number..." 
                            class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter Mesin</label>
                        <select id="filterMesin" class="w-full px-4 py-2 border rounded-lg">
                            <option value="">Semua Mesin</option>
                        </select>
                    </div>
                </div>
                
                <div class="mt-4 flex justify-end space-x-2">
                    <button onclick="exportPDF()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        <i class="fas fa-file-pdf mr-2"></i>PDF
                    </button>
                    <button onclick="exportExcel()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-file-excel mr-2"></i>Excel
                    </button>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-800 text-white">
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
        <nav class="bg-pink-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-calendar-alt text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Umur Material</span>
                </div>
                <div class="flex space-x-4">
                    <a href="/" class="px-4 py-2 hover:bg-pink-700 rounded">
                        <i class="fas fa-plus mr-2"></i>Input Material
                    </a>
                    <a href="/dashboard/stok" class="px-4 py-2 hover:bg-pink-700 rounded">
                        <i class="fas fa-chart-bar mr-2"></i>Stok Material
                    </a>
                    <a href="/dashboard/umur" class="px-4 py-2 bg-pink-700 rounded">
                        <i class="fas fa-calendar-alt mr-2"></i>Umur Material
                    </a>
                    <a href="/dashboard/mutasi" class="px-4 py-2 hover:bg-pink-700 rounded">
                        <i class="fas fa-exchange-alt mr-2"></i>Mutasi Material
                    </a>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto p-6">
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 class="text-2xl font-bold mb-4">Filter Lokasi</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter Lokasi</label>
                        <select id="filterLokasi" class="w-full px-4 py-2 border rounded-lg">
                            <option value="">Semua Lokasi</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter Material</label>
                        <input type="text" id="filterMaterial" placeholder="Cari Material..." 
                            class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter S/N Mesin</label>
                        <input type="text" id="filterSN" placeholder="Cari S/N Mesin..." 
                            class="w-full px-4 py-2 border rounded-lg">
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-800 text-white">
                        <tr>
                            <th class="px-4 py-3 text-left">S/N Mesin</th>
                            <th class="px-4 py-3 text-left">Part Number</th>
                            <th class="px-4 py-3 text-left">Material</th>
                            <th class="px-4 py-3 text-left">Tanggal Pasang</th>
                            <th class="px-4 py-3 text-center">Umur (Hari)</th>
                            <th class="px-4 py-3 text-left">Lokasi</th>
                            <th class="px-4 py-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody id="ageTable">
                        <tr>
                            <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                                Belum ada data material terpasang
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

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
        <nav class="bg-cyan-600 text-white p-4 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-exchange-alt text-2xl"></i>
                    <span class="text-xl font-bold">Dashboard Mutasi Material</span>
                </div>
                <div class="flex space-x-4">
                    <a href="/" class="px-4 py-2 hover:bg-cyan-700 rounded">
                        <i class="fas fa-plus mr-2"></i>Input Material
                    </a>
                    <a href="/dashboard/stok" class="px-4 py-2 hover:bg-cyan-700 rounded">
                        <i class="fas fa-chart-bar mr-2"></i>Stok Material
                    </a>
                    <a href="/dashboard/umur" class="px-4 py-2 hover:bg-cyan-700 rounded">
                        <i class="fas fa-calendar-alt mr-2"></i>Umur Material
                    </a>
                    <a href="/dashboard/mutasi" class="px-4 py-2 bg-cyan-700 rounded">
                        <i class="fas fa-exchange-alt mr-2"></i>Mutasi Material
                    </a>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto p-6">
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 class="text-2xl font-bold mb-4">Filter Tanggal & Nomor BA</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter Tanggal</label>
                        <input type="date" id="filterTanggal" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter Nomor BA</label>
                        <input type="text" id="filterNomorBA" placeholder="Cari Nomor BA..." 
                            class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    
                    <div class="flex items-end">
                        <button onclick="exportAllBA()" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 w-full">
                            <i class="fas fa-file-export mr-2"></i>Export BA
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-800 text-white">
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
                                Belum ada data mutasi
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script src="/static/dashboard-mutasi.js"></script>
    </body>
    </html>
  `
}

export default app
