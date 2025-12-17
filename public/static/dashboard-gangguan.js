// =============================================
// Dashboard Gangguan dan Permintaan Material
// =============================================

let allGangguanData = []
let filteredData = []

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Dashboard Gangguan Initialized')
  console.log('📍 Current URL:', window.location.href)
  
  // Check if coming from form submission (has timestamp parameter)
  const urlParams = new URLSearchParams(window.location.search)
  const fromForm = urlParams.get('t')
  
  if (fromForm) {
    // Coming from form submission - force immediate load
    console.log('✨ Loading fresh data from form submission...')
    // Remove timestamp from URL to clean it up
    window.history.replaceState({}, document.title, window.location.pathname)
  }
  
  console.log('⏳ Starting data load...')
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
    const response = await fetch('/api/gangguan-transactions')
    const data = await response.json()
    
    console.log('✅ API Response:', data)
    console.log('📊 Total gangguan:', data.gangguanTransactions ? data.gangguanTransactions.length : 0)
    
    allGangguanData = data.gangguanTransactions || []
    filteredData = [...allGangguanData]
    
    console.log('📋 allGangguanData:', allGangguanData.length, 'items')
    console.log('🔍 filteredData:', filteredData.length, 'items')
    
    updateStatistics()
    renderTable()
    
    console.log('✅ Dashboard data loaded successfully')
  } catch (error) {
    console.error('❌ Load data error:', error)
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
  const searchNomor = document.getElementById('searchNomor').value.toLowerCase()
  
  filteredData = allGangguanData.filter(item => {
    let match = true
    
    if (kelompok && item.kelompokSPD !== kelompok) {
      match = false
    }
    
    if (tanggal && !item.hariTanggal.includes(tanggal)) {
      match = false
    }
    
    if (pemadaman && item.pemadaman !== pemadaman) {
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
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-8 text-center text-gray-500">
          ${message}
          ${allGangguanData.length === 0 ? '<br><small class="text-red-500">DEBUG: API returned empty data</small>' : ''}
        </td>
      </tr>
    `
    return
  }
  
  console.log('✅ Rendering', filteredData.length, 'rows')
  
  tbody.innerHTML = filteredData.map(item => {
    const tanggal = new Date(item.hariTanggal).toLocaleString('id-ID', {
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
            class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">
            <i class="fas fa-eye mr-1"></i>Detail
          </button>
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
    const response = await fetch(`/api/gangguan/${encodeURIComponent(nomorLH05)}`)
    const data = await response.json()
    
    if (data.gangguan) {
      showLH05Modal(data.gangguan)
    } else {
      alert('Data tidak ditemukan')
    }
  } catch (error) {
    console.error('View LH05 error:', error)
    alert('Error loading data')
  }
}

function showLH05Modal(gangguan) {
  const tanggal = new Date(gangguan.hariTanggal).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  const materialsHtml = gangguan.materials.map((mat, index) => `
    <tr class="border-b">
      <td class="px-4 py-2 text-center">${index + 1}</td>
      <td class="px-4 py-2">${mat.partNumber}</td>
      <td class="px-4 py-2">${mat.material}</td>
      <td class="px-4 py-2">${mat.mesin}</td>
      <td class="px-4 py-2 text-center">${mat.jumlah}</td>
    </tr>
  `).join('')
  
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
            <p class="font-semibold text-gray-800">${gangguan.komponenRusak}</p>
          </div>
          
          <div class="border-l-4 border-yellow-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Gejala yang Timbul</p>
            <p class="text-gray-800">${gangguan.gejala}</p>
          </div>
          
          <div class="border-l-4 border-blue-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Uraian Kejadian</p>
            <p class="text-gray-800">${gangguan.uraianKejadian}</p>
          </div>
          
          <div class="border-l-4 border-purple-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Analisa Penyebab</p>
            <p class="text-gray-800">${gangguan.analisaPenyebab}</p>
          </div>
          
          <div class="border-l-4 border-green-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Kesimpulan Kerusakan</p>
            <p class="text-gray-800">${gangguan.kesimpulan}</p>
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
              <p class="font-semibold text-gray-800">${gangguan.bebanPuncak} MW</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 mb-1">Daya Mampu</p>
              <p class="font-semibold text-gray-800">${gangguan.dayaMampu} MW</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 mb-1">Status</p>
              <p class="font-semibold text-gray-800">${getStatusBadge(gangguan.pemadaman)}</p>
            </div>
          </div>
        </div>
        
        <!-- Tindakan -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="border-l-4 border-orange-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Tindakan Penanggulangan</p>
            <p class="text-gray-800">${gangguan.tindakanPenanggulangan}</p>
          </div>
          <div class="border-l-4 border-cyan-500 pl-4">
            <p class="text-sm text-gray-600 mb-1">Rencana Perbaikan</p>
            <p class="text-gray-800">${gangguan.rencanaPerbaikan}</p>
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
                  <th class="px-4 py-2 text-left">Mesin</th>
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
            <img src="${gangguan.ttdPelapor}" alt="TTD Pelapor" class="mx-auto border rounded-lg shadow" style="max-width: 300px; height: 150px;">
            <p class="font-semibold text-gray-800 mt-3 text-lg">${gangguan.namaPelapor}</p>
            <p class="text-sm text-gray-500">Pelapor</p>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="bg-gray-100 p-4 rounded-b-lg flex justify-end space-x-2">
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

function exportAllLH05() {
  alert('Export All LH05\n\nFungsi export semua BA akan diimplementasikan dengan format Excel atau CSV')
  // TODO: Implement export all functionality
}
 dengan format Excel atau CSV')
  // TODO: Implement export all functionality
}
