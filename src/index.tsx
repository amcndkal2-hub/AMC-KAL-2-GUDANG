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

// Cache untuk data
let cachedData: any[] = []
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 menit

// Fungsi fetch data dari Google Sheets
async function fetchGoogleSheetsData() {
  const now = Date.now()
  
  // Return cached data jika masih fresh
  if (cachedData.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedData
  }
  
  try {
    const response = await fetch(GOOGLE_SHEETS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
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
    // Return cached data jika ada error
    return cachedData
  }
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
    
    // Search by part number (exact match atau partial)
    const results = data.filter((item: any) => {
      const partNumber = String(item.PART_NUMBER || '').toLowerCase()
      return partNumber.includes(query)
    })
    
    return c.json({ results: results.slice(0, 10) }) // Limit 10 results
  } catch (error) {
    return c.json({ error: 'Search failed' }, 500)
  }
})

// API: Get unique values untuk dropdown
app.get('/api/dropdown-values', async (c) => {
  try {
    const data = await fetchGoogleSheetsData()
    
    // Extract unique values
    const units = [...new Set(data.map((item: any) => item.UNIT).filter(Boolean))].sort()
    const pemeriksa = [...new Set(data.map((item: any) => item.Pemeriksa).filter(Boolean))].sort()
    const penerima = [...new Set(data.map((item: any) => item.Penerima).filter(Boolean))].sort()
    
    return c.json({
      units,
      pemeriksa,
      penerima
    })
  } catch (error) {
    return c.json({ error: 'Failed to get dropdown values' }, 500)
  }
})

// API: Save transaction (untuk demo, hanya log ke console)
app.post('/api/save-transaction', async (c) => {
  try {
    const body = await c.req.json()
    
    // Di sini bisa implement logic untuk save ke database atau Google Sheets
    console.log('Transaction saved:', body)
    
    return c.json({ 
      success: true, 
      message: 'Transaction saved successfully',
      data: body 
    })
  } catch (error) {
    return c.json({ error: 'Failed to save transaction' }, 500)
  }
})

// Main page
app.get('/', (c) => {
  return c.html(`
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
        <div class="min-h-screen py-8 px-4">
            <div class="max-w-5xl mx-auto">
                <!-- Header -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-clipboard-list text-blue-600 mr-3"></i>
                        Sistem Inventaris Spare Part
                    </h1>
                    <p class="text-gray-600">Form Input Transaksi Material</p>
                </div>

                <!-- Form -->
                <form id="transactionForm" class="space-y-6">
                    <!-- Informasi Umum -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                            INFORMASI UMUM
                            <button type="button" class="ml-auto text-gray-400 hover:text-gray-600">
                                <i class="fas fa-chevron-up"></i>
                            </button>
                        </h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                                <input type="date" id="tanggal" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Transaksi</label>
                                <select id="jenisTransaksi" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option value="">-- Pilih Jenis Transaksi --</option>
                                    <option value="Keluar (Pengeluaran Gudang)">Keluar (Pengeluaran Gudang)</option>
                                    <option value="Masuk (Penerimaan Gudang)">Masuk (Penerimaan Gudang)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Lokasi Keluar/Asal</label>
                                <select id="lokasiAsal" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option value="">-- Pilih Lokasi --</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Lokasi Tujuan</label>
                                <select id="lokasiTujuan" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
                        
                        <div id="materialList" class="space-y-4">
                            <!-- Material items akan ditambahkan di sini -->
                        </div>
                        
                        <button type="button" id="addMaterial" 
                            class="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
                            <i class="fas fa-plus mr-2"></i>
                            Tambah Baris Material
                        </button>
                    </div>

                    <!-- Penanggung Jawab dan Validasi -->
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold text-gray-800 mb-4">
                            <i class="fas fa-user-check text-blue-600 mr-2"></i>
                            Penanggung Jawab dan Validasi
                        </h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Pemeriksa</label>
                                <select id="pemeriksa" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
                                    <option value="">-- Pilih Pemeriksa --</option>
                                </select>
                                
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Pemeriksa</label>
                                <canvas id="signaturePemeriksa" width="300" height="150" 
                                    class="signature-pad w-full bg-gray-50"></canvas>
                                <button type="button" id="clearPemeriksa" 
                                    class="mt-2 text-sm text-red-600 hover:text-red-700">
                                    <i class="fas fa-eraser mr-1"></i>Hapus Tanda Tangan
                                </button>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Penerima</label>
                                <select id="penerima" required
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
                                    <option value="">-- Pilih Penerima --</option>
                                </select>
                                
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Penerima</label>
                                <canvas id="signaturePenerima" width="300" height="150" 
                                    class="signature-pad w-full bg-gray-50"></canvas>
                                <button type="button" id="clearPenerima" 
                                    class="mt-2 text-sm text-red-600 hover:text-red-700">
                                    <i class="fas fa-eraser mr-1"></i>Hapus Tanda Tangan
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex gap-4">
                        <button type="submit" 
                            class="flex-1 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition text-lg font-semibold">
                            <i class="fas fa-save mr-2"></i>
                            Simpan Transaksi
                        </button>
                        <button type="button" id="resetForm"
                            class="px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                            <i class="fas fa-undo mr-2"></i>
                            Reset
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
