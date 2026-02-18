// =============================================
// Dashboard Gangguan dan Permintaan Material
// =============================================

let allGangguanData = []
let filteredData = []

// Visual debug helper
function updateDebugInfo(message, type = 'info') {
  const debugEl = document.getElementById('debugInfo')
  if (debugEl) {
    const colors = {
      info: 'text-blue-600',
      success: 'text-green-600',
      error: 'text-red-600',
      warning: 'text-yellow-600'
    }
    const icons = {
      info: 'fa-info-circle',
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle'
    }
    debugEl.innerHTML = `<p class="${colors[type]}"><i class="fas ${icons[type]} mr-2"></i>${message}</p>`
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Dashboard Gangguan Initialized')
  console.log('📍 Current URL:', window.location.href)
  
  updateDebugInfo('🚀 Inisialisasi dashboard...', 'info')
  
  // Check if coming from form submission (has timestamp parameter)
  const urlParams = new URLSearchParams(window.location.search)
  const fromForm = urlParams.get('t')
  
  if (fromForm) {
    // Coming from form submission - force immediate load
    console.log('✨ Loading fresh data from form submission...')
    updateDebugInfo('✨ Memuat data baru dari form...', 'info')
    // Remove timestamp from URL to clean it up
    window.history.replaceState({}, document.title, window.location.pathname)
  }
  
  console.log('⏳ Starting data load...')
  updateDebugInfo('⏳ Memuat data dari server...', 'info')
  
  // Restore filter UI values first
  restoreFilterState()
  
  loadDashboardData()
  populateUnitFilter()
  
  // Auto refresh every 30 seconds
  setInterval(() => {
    console.log('🔄 Auto-refresh triggered')
    loadDashboardData()
  }, 30000)
  
  console.log('✅ Dashboard initialization complete')
})

async function populateUnitFilter() {
  try {
    const response = await fetch('/api/dropdown-values')
    const data = await response.json()
    
    const unitSelect = document.getElementById('filterUnit')
    data.units.forEach(unit => {
      const option = document.createElement('option')
      option.value = unit
      option.textContent = unit
      unitSelect.appendChild(option)
    })
  } catch (error) {
    console.error('Failed to load units:', error)
  }
}

async function loadDashboardData() {
  try {
    console.log('🔄 Loading gangguan data from API...')
    console.log('🎯 API URL: /api/gangguan-transactions')
    
    const response = await fetch('/api/gangguan-transactions')
    console.log('📡 Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log('✅ API Response:', data)
    console.log('📊 Total gangguan:', data.gangguanTransactions ? data.gangguanTransactions.length : 0)
    
    if (!data.gangguanTransactions) {
      console.error('❌ gangguanTransactions is undefined!')
      allGangguanData = []
    } else if (!Array.isArray(data.gangguanTransactions)) {
      console.error('❌ gangguanTransactions is not an array!', typeof data.gangguanTransactions)
      allGangguanData = []
    } else {
      // Map snake_case API fields to camelCase for frontend compatibility
      allGangguanData = data.gangguanTransactions.map(item => ({
        ...item,
        nomorLH05: item.nomor_lh05,
        tanggalLaporan: item.tanggal_laporan,
        jenisGangguan: item.jenis_gangguan,
        lokasiGangguan: item.lokasi_gangguan,
        userLaporan: item.user_laporan,
        catatanTindakan: item.catatan_tindakan,
        rencanaPerbaikan: item.rencana_perbaikan,
        ttdTeknisi: item.ttd_teknisi,
        ttdSupervisor: item.ttd_supervisor,
        createdAt: item.created_at,
        // NEW: Map form fields
        komponenRusak: item.komponen_rusak,
        gejala: item.gejala,
        uraianKejadian: item.uraian_kejadian,
        analisaPenyebab: item.analisa_penyebab,
        kesimpulan: item.kesimpulan,
        bebanPuncak: item.beban_puncak,
        dayaMampu: item.daya_mampu,
        pemadaman: item.pemadaman,
        kelompokSPD: item.kelompok_spd || item.jenis_gangguan,
        // For backward compatibility with old field names
        unitULD: item.lokasi_gangguan
      }))
      console.log('✅ gangguanTransactions is valid array with field mapping')
    }
    
    filteredData = [...allGangguanData]
    
    console.log('📋 allGangguanData:', allGangguanData.length, 'items')
    console.log('🔍 filteredData:', filteredData.length, 'items')
    
    if (allGangguanData.length > 0) {
      console.log('🗂️ First item:', JSON.stringify(allGangguanData[0]).substring(0, 200))
    }
    
    updateStatistics()
    
    // Check if there are saved filters and apply them
    const savedState = sessionStorage.getItem('gangguanFilters')
    if (savedState) {
      console.log('🔄 Re-applying saved filters after data load...')
      applyFilters()
    } else {
      renderTable()
    }
    
    console.log('✅ Dashboard data loaded successfully')
    updateDebugInfo(`✅ Data loaded: ${allGangguanData.length} gangguan`, 'success')
  } catch (error) {
    console.error('❌ Load data error:', error)
    console.error('❌ Error stack:', error.stack)
    
    updateDebugInfo(`❌ Error: ${error.message}`, 'error')
    
    // Show error in UI
    const tbody = document.getElementById('gangguanTable')
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-8 text-center">
            <div class="mb-4">
              <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-3"></i>
              <p class="text-lg font-semibold text-red-600">Error Memuat Data</p>
              <p class="text-gray-600 mt-2">${error.message}</p>
            </div>
            <div class="mt-4 p-4 bg-red-50 border-l-4 border-red-400 text-left max-w-2xl mx-auto">
              <p class="font-semibold mb-2 text-red-800"><i class="fas fa-bug mr-2"></i>Detail Error:</p>
              <pre class="text-xs bg-white p-2 rounded overflow-x-auto">${error.stack || error.message}</pre>
              <div class="mt-3">
                <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  <i class="fas fa-sync mr-2"></i>Coba Lagi (Refresh)
                </button>
              </div>
            </div>
          </td>
        </tr>
      `
    }
  }
}

function updateStatistics() {
  const total = allGangguanData.length
  const mekanik = allGangguanData.filter(g => g.kelompokSPD === 'MEKANIK').length
  const elektrik = allGangguanData.filter(g => g.kelompokSPD === 'ELEKTRIK').length
  
  document.getElementById('totalGangguan').textContent = total
  document.getElementById('totalMekanik').textContent = mekanik
  document.getElementById('totalElektrik').textContent = elektrik
}

function applyFilters() {
  const kelompok = document.getElementById('filterKelompok').value
  const tanggal = document.getElementById('filterTanggal').value
  const pemadaman = document.getElementById('filterPemadaman').value
  const unitFilter = document.getElementById('filterUnit').value
  const searchNomor = document.getElementById('searchNomor').value.toLowerCase()
  
  // Save filter state
  saveFilterState()
  
  filteredData = allGangguanData.filter(item => {
    let match = true
    
    if (kelompok && item.kelompokSPD !== kelompok) {
      match = false
    }
    
    if (tanggal && !item.tanggalLaporan.includes(tanggal)) {
      match = false
    }
    
    if (pemadaman && item.pemadaman !== pemadaman) {
      match = false
    }
    
    // Filter by Unit/Lokasi
    if (unitFilter && item.lokasiGangguan !== unitFilter) {
      match = false
    }
    
    if (searchNomor && !item.nomorLH05.toLowerCase().includes(searchNomor)) {
      match = false
    }
    
    return match
  })
  
  renderTable()
}

function resetFilters() {
  document.getElementById('filterKelompok').value = ''
  document.getElementById('filterTanggal').value = ''
  document.getElementById('filterPemadaman').value = ''
  document.getElementById('filterUnit').value = ''
  document.getElementById('searchNomor').value = ''
  
  // Clear sessionStorage
  sessionStorage.removeItem('gangguanFilters')
  
  filteredData = [...allGangguanData]
  renderTable()
}

function renderTable() {
  console.log('🎨 renderTable() called')
  console.log('📊 allGangguanData.length:', allGangguanData.length)
  console.log('🔍 filteredData.length:', filteredData.length)
  
  const tbody = document.getElementById('gangguanTable')
  
  if (!tbody) {
    console.error('❌ Element gangguanTable not found!')
    return
  }
  
  if (filteredData.length === 0) {
    const message = allGangguanData.length === 0 ? 'Belum ada data gangguan' : 'Tidak ada data yang sesuai filter'
    console.warn('⚠️ No data to display:', message)
    
    updateDebugInfo(
      allGangguanData.length === 0 
        ? '⚠️ API mengembalikan data kosong. Coba refresh (F5) atau submit form gangguan baru.' 
        : '⚠️ Data ada tapi tersaring oleh filter. Reset filter untuk melihat semua data.',
      'warning'
    )
    
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-gray-500">
          <div class="mb-4">
            <i class="fas fa-inbox text-6xl text-gray-300 mb-3"></i>
            <p class="text-lg font-semibold">${message}</p>
          </div>
          <div class="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-left max-w-2xl mx-auto">
            <p class="font-semibold mb-2"><i class="fas fa-lightbulb mr-2 text-yellow-600"></i>Kemungkinan Penyebab:</p>
            <ul class="list-disc list-inside text-sm space-y-1">
              <li>Data gangguan belum ada (silakan submit form gangguan)</li>
              <li>Service baru restart (data in-memory hilang)</li>
              <li>Filter terlalu ketat (coba reset filter)</li>
              <li>JavaScript error (tekan F12 untuk debug)</li>
            </ul>
            <div class="mt-3 flex gap-2">
              <button onclick="location.href='/form-gangguan'" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                <i class="fas fa-plus mr-2"></i>Submit Form Gangguan
              </button>
              <button onclick="location.reload()" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                <i class="fas fa-sync mr-2"></i>Refresh Halaman
              </button>
            </div>
          </div>
        </td>
      </tr>
    `
    return
  }
  
  updateDebugInfo(`✅ Berhasil memuat ${filteredData.length} data gangguan`, 'success')
  
  console.log('✅ Rendering', filteredData.length, 'rows')
  
  // Check if user can edit/delete (admin, amc, or andalcekatan)
  // Use canEditDelete() function from auth-check.js
  const hasEditDeletePermission = typeof canEditDelete === 'function' ? canEditDelete() : false
  
  tbody.innerHTML = filteredData.map(item => {
    const tanggal = new Date(item.tanggalLaporan).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    const statusBadge = getStatusBadge(item.pemadaman)
    const kelompokBadge = getKelompokBadge(item.kelompokSPD)
    const totalMaterial = item.materials?.length || 0
    
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-3">
          <button onclick="viewLH05('${item.nomorLH05}')" 
            class="text-blue-600 hover:text-blue-800 font-semibold hover:underline">
            ${item.nomorLH05}
          </button>
        </td>
        <td class="px-4 py-3">${tanggal}</td>
        <td class="px-4 py-3">
          ${kelompokBadge}
        </td>
        <td class="px-4 py-3">
          <span class="font-semibold text-gray-700">${item.lokasiGangguan || '-'}</span>
        </td>
        <td class="px-4 py-3">${item.komponenRusak}</td>
        <td class="px-4 py-3 text-center">${item.bebanPuncak}</td>
        <td class="px-4 py-3 text-center">
          ${statusBadge}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-semibold">
            ${totalMaterial} item
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="viewLH05('${item.nomorLH05}')" 
            class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm mr-2">
            <i class="fas fa-eye mr-1"></i>Detail
          </button>
          ${hasEditDeletePermission ? `
            <button onclick="deleteGangguan('${item.nomorLH05}')" 
              class="edit-delete-only bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm">
              <i class="fas fa-trash mr-1"></i>Hapus
            </button>
          ` : ''}
        </td>
      </tr>
    `
  }).join('')
}

function getStatusBadge(status) {
  const badges = {
    'NORMAL': '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">NORMAL</span>',
    'SIAGA': '<span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">SIAGA</span>',
    'DEFISIT': '<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold">DEFISIT</span>'
  }
  return badges[status] || status
}

function getKelompokBadge(kelompok) {
  const badges = {
    'MEKANIK': '<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-semibold">MEKANIK</span>',
    'ELEKTRIK': '<span class="bg-purple-100 text-purple-800 px-3 py-1 rounded text-sm font-semibold">ELEKTRIK</span>'
  }
  return badges[kelompok] || kelompok
}

async function viewLH05(nomorLH05) {
  try {
    console.log('📋 Fetching gangguan detail for:', nomorLH05)
    const response = await fetch(`/api/gangguan/${encodeURIComponent(nomorLH05)}`)
    
    console.log('📡 Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('✅ Gangguan data:', data)
    
    if (data.gangguan) {
      // Map snake_case API fields to camelCase for modal
      const mappedGangguan = {
        ...data.gangguan,
        nomorLH05: data.gangguan.nomor_lh05,
        tanggalLaporan: data.gangguan.tanggal_laporan,
        jenisGangguan: data.gangguan.jenis_gangguan,
        lokasiGangguan: data.gangguan.lokasi_gangguan,
        userLaporan: data.gangguan.user_laporan,
        namaPelapor: data.gangguan.user_laporan, // Nama pelapor dari user_laporan
        komponenRusak: data.gangguan.komponen_rusak,
        gejala: data.gangguan.gejala,
        uraianKejadian: data.gangguan.uraian_kejadian,
        analisaPenyebab: data.gangguan.analisa_penyebab,
        kesimpulan: data.gangguan.kesimpulan,
        bebanPuncak: data.gangguan.beban_puncak,
        dayaMampu: data.gangguan.daya_mampu,
        pemadaman: data.gangguan.pemadaman,
        kelompokSPD: data.gangguan.kelompok_spd,
        catatanTindakan: data.gangguan.catatan_tindakan,
        tindakanPenanggulangan: data.gangguan.catatan_tindakan, // Use catatan_tindakan as fallback
        rencanaPerbaikan: data.gangguan.rencana_perbaikan,
        ttdTeknisi: data.gangguan.ttd_teknisi,
        ttdPelapor: data.gangguan.ttd_teknisi, // TTD pelapor dari ttd_teknisi
        ttdSupervisor: data.gangguan.ttd_supervisor,
        unitULD: data.gangguan.lokasi_gangguan,
        materials: data.gangguan.materials || []
      }
      showLH05Modal(mappedGangguan)
    } else {
      console.error('❌ Gangguan data not found in response')
      alert('❌ Data tidak ditemukan untuk LH05: ' + nomorLH05)
    }
  } catch (error) {
    console.error('❌ View LH05 error:', error)
    console.error('❌ Error stack:', error.stack)
    alert('❌ Error loading data: ' + error.message + '\n\nSilakan cek console untuk detail lebih lanjut.')
  }
}

function showLH05Modal(gangguan) {
  // Check if user can edit/delete (admin, amc, or andalcekatan)
  const hasEditDeletePermission = typeof canEditDelete === 'function' ? canEditDelete() : false
  
  const tanggal = new Date(gangguan.tanggalLaporan).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  const materialsHtml = (gangguan.materials && Array.isArray(gangguan.materials)) 
    ? gangguan.materials.map((mat, index) => `
    <tr class="border-b">
      <td class="px-4 py-2 text-center">${index + 1}</td>
      <td class="px-4 py-2">${mat.partNumber ?? '-'}</td>
      <td class="px-4 py-2">${mat.material ?? '-'}</td>
      <td class="px-4 py-2"><span class="inline-block px-2 py-1 text-xs font-semibold rounded ${mat.jenisBarang === 'FILTER' ? 'bg-yellow-100 text-yellow-800' : mat.jenisBarang === 'MATERIAL BEKAS' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}">${mat.jenisBarang ?? 'Material Handal'}</span></td>
      <td class="px-4 py-2">${mat.mesin ?? '-'}</td>
      <td class="px-4 py-2">${mat.snMesin ?? mat.status ?? '-'}</td>
      <td class="px-4 py-2 text-center">${mat.jumlah ?? 0}</td>
    </tr>
  `).join('')
    : '<tr><td colspan="7" class="px-4 py-2 text-center text-gray-500">Tidak ada data material</td></tr>'
  
  const modal = document.createElement('div')
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto'
  modal.innerHTML = `
    <div class="bg-white rounded-lg max-w-4xl w-full my-8 shadow-2xl">
      <!-- Header -->
      <div class="bg-orange-600 text-white p-6 rounded-t-lg">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold">BERITA ACARA GANGGUAN</h2>
            <p class="text-orange-100">PT PLN (Persero) Unit Induk Wilayah Kalimantan Selatan & Tengah</p>
          </div>
          <button onclick="this.closest('.fixed').remove()" 
            class="text-white hover:text-orange-200 text-3xl">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Nomor LH05 -->
        <div class="border-2 border-orange-600 rounded-lg p-4 bg-orange-50">
          <div class="text-center">
            <p class="text-sm text-gray-600 mb-1">NOMOR BA LH05</p>
            <p class="text-3xl font-bold text-orange-600">${gangguan.nomorLH05}</p>
          </div>
        </div>
        
        <!-- Info Kejadian -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600 mb-1">Tanggal & Waktu Kejadian</p>
            <p class="font-semibold text-gray-800">${tanggal}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600 mb-1">Unit / ULD</p>
            <p class="font-semibold text-gray-800">${gangguan.unitULD || '-'}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600 mb-1">Kelompok SPD</p>
            <p class="font-semibold text-gray-800">${gangguan.kelompokSPD}</p>
          </div>
        </div>
        
        <!-- Detail Gangguan -->
        <div class="space-y-4">
          <div class="border-l-4 border-red-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Komponen yang Rusak</p>
            <p class="font-semibold text-gray-800">${gangguan.komponenRusak || '-'}</p>
          </div>
          
          <div class="border-l-4 border-yellow-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Gejala yang Timbul</p>
            <p class="text-gray-800">${gangguan.gejala || '-'}</p>
          </div>
          
          <div class="border-l-4 border-blue-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Uraian Kejadian</p>
            <p class="text-gray-800">${gangguan.uraianKejadian || '-'}</p>
          </div>
          
          <div class="border-l-4 border-purple-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Analisa Penyebab</p>
            <p class="text-gray-800">${gangguan.analisaPenyebab || '-'}</p>
          </div>
          
          <div class="border-l-4 border-green-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Kesimpulan Kerusakan</p>
            <p class="text-gray-800">${gangguan.kesimpulan || '-'}</p>
          </div>
        </div>
        
        <!-- Akibat Sistem Pembangkit -->
        <div class="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 class="font-semibold text-gray-800 mb-3">
            <i class="fas fa-bolt text-red-600 mr-2"></i>
            Akibat terhadap Sistem Pembangkit
          </h3>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <p class="text-sm text-gray-600 mb-1">Beban Puncak</p>
              <p class="font-semibold text-gray-800">${gangguan.bebanPuncak || '-'} MW</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 mb-1">Daya Mampu</p>
              <p class="font-semibold text-gray-800">${gangguan.dayaMampu || '-'} MW</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 mb-1">Status</p>
              <p class="font-semibold text-gray-800">${getStatusBadge(gangguan.pemadaman || 'NORMAL')}</p>
            </div>
          </div>
        </div>
        
        <!-- Tindakan -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="border-l-4 border-orange-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Tindakan Penanggulangan</p>
            <p class="text-gray-800">${gangguan.tindakanPenanggulangan || '-'}</p>
          </div>
          <div class="border-l-4 border-cyan-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Rencana Perbaikan</p>
            <p class="text-gray-800">${gangguan.rencanaPerbaikan || '-'}</p>
          </div>
        </div>
        
        <!-- Material Table -->
        <div>
          <h3 class="font-semibold text-gray-800 mb-3">
            <i class="fas fa-boxes text-orange-600 mr-2"></i>
            Kebutuhan Material
          </h3>
          <div class="border rounded-lg overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-800 text-white">
                <tr>
                  <th class="px-4 py-2 text-center">No</th>
                  <th class="px-4 py-2 text-left">Part Number</th>
                  <th class="px-4 py-2 text-left">Material</th>
                  <th class="px-4 py-2 text-left">Jenis Barang</th>
                  <th class="px-4 py-2 text-left">Mesin</th>
                  <th class="px-4 py-2 text-left">S/N Mesin</th>
                  <th class="px-4 py-2 text-center">Jumlah</th>
                </tr>
              </thead>
              <tbody class="bg-white">
                ${materialsHtml}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Signature -->
        <div class="pt-6 border-t">
          <div class="text-center max-w-md mx-auto">
            <p class="text-sm text-gray-600 mb-2">Tanda Tangan Pelapor</p>
            <img src="${gangguan.ttdPelapor || ''}" alt="TTD Pelapor" class="mx-auto border rounded-lg shadow" style="max-width: 300px; height: 150px;">
            <p class="font-semibold text-gray-800 mt-3 text-lg">${gangguan.namaPelapor || gangguan.userLaporan || '-'}</p>
            <p class="text-sm text-gray-500">Pelapor</p>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="bg-gray-100 p-4 rounded-b-lg flex justify-end space-x-2">
        ${hasEditDeletePermission ? `
        <button onclick="editLH05('${gangguan.nomorLH05}')" 
          class="edit-delete-only bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
          <i class="fas fa-edit mr-2"></i>Edit
        </button>
        ` : ''}
        <button onclick="printLH05('${gangguan.nomorLH05}')" 
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          <i class="fas fa-print mr-2"></i>Print
        </button>
        <button onclick="exportLH05PDF('${gangguan.nomorLH05}')" 
          class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          <i class="fas fa-file-pdf mr-2"></i>Export PDF
        </button>
        <button onclick="this.closest('.fixed').remove()" 
          class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
          Tutup
        </button>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
}

function printLH05(nomorLH05) {
  alert('Print LH05: ' + nomorLH05 + '\n\nFungsi print akan diimplementasikan dengan window.print()')
  // TODO: Implement actual print functionality
  // window.print()
}

function exportLH05PDF(nomorLH05) {
  alert('Export PDF: ' + nomorLH05 + '\n\nFungsi export PDF akan memerlukan library seperti jsPDF atau html2pdf')
  // TODO: Implement PDF export
}

function editLH05(nomorLH05) {
  // Navigate to Form Gangguan page with edit mode
  window.location.href = `/form-gangguan?edit=${encodeURIComponent(nomorLH05)}`
}

function exportAllLH05() {
  alert('Export All LH05\n\nFungsi export semua BA akan diimplementasikan dengan format Excel atau CSV')
  // TODO: Implement export all functionality
}

async function deleteGangguan(nomorLH05) {
    if (!confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus form gangguan:\n${nomorLH05}\n\nData yang terhapus TIDAK BISA dikembalikan!\n\nLanjutkan hapus?`)) {
        return;
    }
    
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        // Use query param to handle "/" in nomor LH05
        const response = await fetch(`/api/gangguan?nomor=${encodeURIComponent(nomorLH05)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Form gangguan ${nomorLH05} berhasil dihapus!`);
            // Reload data
            await loadDashboardData();
        } else {
            alert(`❌ Gagal menghapus form gangguan:\n${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('❌ Terjadi kesalahan saat menghapus form gangguan');
    }
}

// =============================================
// SessionStorage - Persist Filter State
// =============================================

function saveFilterState() {
  const filterState = {
    kelompok: document.getElementById('filterKelompok').value,
    tanggal: document.getElementById('filterTanggal').value,
    pemadaman: document.getElementById('filterPemadaman').value,
    unit: document.getElementById('filterUnit').value,
    searchNomor: document.getElementById('searchNomor').value
  }
  sessionStorage.setItem('gangguanFilters', JSON.stringify(filterState))
  console.log('✅ Gangguan filter state saved:', filterState)
}

function restoreFilterState() {
  try {
    const savedState = sessionStorage.getItem('gangguanFilters')
    if (!savedState) {
      console.log('ℹ️ No saved Gangguan filter state found')
      return
    }
    
    const filterState = JSON.parse(savedState)
    console.log('🔄 Restoring Gangguan filter UI values:', filterState)
    
    // Restore filter UI values only (applyFilters will be called by loadDashboardData)
    if (filterState.kelompok) document.getElementById('filterKelompok').value = filterState.kelompok
    if (filterState.tanggal) document.getElementById('filterTanggal').value = filterState.tanggal
    if (filterState.pemadaman) document.getElementById('filterPemadaman').value = filterState.pemadaman
    if (filterState.unit) document.getElementById('filterUnit').value = filterState.unit
    if (filterState.searchNomor) document.getElementById('searchNomor').value = filterState.searchNomor
    
    console.log('✅ Gangguan filter UI values restored')
    
  } catch (error) {
    console.error('❌ Failed to restore Gangguan filter state:', error)
  }
}
