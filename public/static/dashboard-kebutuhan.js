// =============================================
// Dashboard Kebutuhan Material
// =============================================

let allMaterials = []
let filteredMaterials = []

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Restore filter UI values first (before loading data)
  restoreFilterState()
  
  loadKebutuhanMaterial()
  populateFilters()
  
  // Auto refresh every 30 seconds
  setInterval(loadKebutuhanMaterial, 30000)
  
  // Filter change handlers
  document.getElementById('filterStatus').addEventListener('change', applyFilters)
  document.getElementById('filterMesin').addEventListener('change', applyFilters)
  document.getElementById('filterUnit').addEventListener('change', applyFilters)
  document.getElementById('filterJenisBarang').addEventListener('change', applyFilters)
  document.getElementById('searchNomor').addEventListener('input', applyFilters)
  document.getElementById('searchMaterial').addEventListener('input', applyFilters)
})

async function populateFilters() {
  try {
    const response = await fetch('/api/dropdown-values')
    const data = await response.json()
    
    // Populate Unit filter
    const unitSelect = document.getElementById('filterUnit')
    // Clear existing options except the first one
    unitSelect.innerHTML = '<option value="">Semua Unit</option>'
    data.units.forEach(unit => {
      const option = document.createElement('option')
      option.value = unit
      option.textContent = unit
      unitSelect.appendChild(option)
    })
  } catch (error) {
    console.error('Failed to load filters:', error)
  }
}

function populateMesinFilter() {
  // Extract unique mesin from all materials
  const uniqueMesins = [...new Set(allMaterials.map(m => m.mesin))].filter(m => m).sort()
  const mesinSelect = document.getElementById('filterMesin')
  
  // Clear existing options except the first one
  mesinSelect.innerHTML = '<option value="">Semua Mesin</option>'
  
  uniqueMesins.forEach(mesin => {
    const option = document.createElement('option')
    option.value = mesin
    option.textContent = mesin
    mesinSelect.appendChild(option)
  })
}

async function loadKebutuhanMaterial() {
  try {
    const response = await fetch('/api/kebutuhan-material')
    const data = await response.json()
    
    // Map snake_case API fields to camelCase for frontend compatibility
    allMaterials = (data.materials || []).map(item => ({
      ...item,
      nomorLH05: item.nomor_lh05,
      partNumber: item.part_number,
      lokasiTujuan: item.lokasi_tujuan || item.unit_uld,
      unitULD: item.unit_uld,
      stok: item.stok || 0, // Include stock info
      isTerkirim: item.isTerkirim || false, // Include shipment status
      jenisBarang: item.jenis_barang || 'Material Handal' // Include jenis barang
    }))
    filteredMaterials = [...allMaterials]
    
    // Sort by status priority: N/A, Pengadaan, Tersedia, Terkirim, Tunda, Reject
    const statusOrder = {
      'N/A': 1,
      'Pengadaan': 2,
      'Tersedia': 3,
      'Terkirim': 4,
      'Tunda': 5,
      'Reject': 6
    }
    
    allMaterials.sort((a, b) => {
      const statusA = a.status || 'N/A'
      const statusB = b.status || 'N/A'
      const orderA = statusOrder[statusA] || 999
      const orderB = statusOrder[statusB] || 999
      return orderA - orderB
    })
    
    filteredMaterials = [...allMaterials]
    
    // Populate mesin filter after data is loaded
    populateMesinFilter()
    
    updateStatistics()
    
    // Check if there are saved filters and apply them
    const savedState = sessionStorage.getItem('kebutuhanFilters')
    if (savedState) {
      console.log('🔄 Re-applying saved filters after data load...')
      // Don't call restoreFilterState() here, just apply existing filters
      applyFilters()
    } else {
      // No saved filters, just render all data
      renderTable()
    }
  } catch (error) {
    console.error('Load data error:', error)
  }
}

function updateStatistics() {
  const total = allMaterials.length
  const pengadaan = allMaterials.filter(m => m.status === 'Pengadaan').length
  const tunda = allMaterials.filter(m => m.status === 'Tunda').length
  const reject = allMaterials.filter(m => m.status === 'Reject').length
  const terkirim = allMaterials.filter(m => m.status === 'Terkirim').length
  const tersedia = allMaterials.filter(m => m.status === 'Tersedia').length
  
  document.getElementById('totalMaterial').textContent = total
  document.getElementById('totalPengadaan').textContent = pengadaan
  document.getElementById('totalTunda').textContent = tunda
  document.getElementById('totalReject').textContent = reject
  
  // Update statistik baru jika elemen ada
  const terkirimEl = document.getElementById('totalTerkirim')
  const tersediaEl = document.getElementById('totalTersedia')
  if (terkirimEl) terkirimEl.textContent = terkirim
  if (tersediaEl) tersediaEl.textContent = tersedia
}

function applyFilters() {
  const statusFilter = document.getElementById('filterStatus').value
  const mesinFilter = document.getElementById('filterMesin').value
  const unitFilter = document.getElementById('filterUnit').value
  const jenisBarangFilter = document.getElementById('filterJenisBarang').value
  const searchNomor = document.getElementById('searchNomor').value.toLowerCase()
  const searchMaterial = document.getElementById('searchMaterial').value.toLowerCase()
  
  // Save filter state to sessionStorage
  saveFilterState()
  
  filteredMaterials = allMaterials.filter(item => {
    let match = true
    
    // Filter by Status
    if (statusFilter && item.status !== statusFilter) {
      match = false
    }
    
    // Filter by Mesin
    if (mesinFilter && item.mesin !== mesinFilter) {
      match = false
    }
    
    // Filter by Unit (check both unitULD and lokasiTujuan)
    if (unitFilter) {
      const itemUnit = item.lokasiTujuan || item.unitULD || ''
      if (itemUnit !== unitFilter) {
        match = false
      }
    }
    
    // Filter by Jenis Barang (case-insensitive)
    if (jenisBarangFilter) {
      const itemJenis = (item.jenisBarang || '').toUpperCase()
      const filterJenis = jenisBarangFilter.toUpperCase()
      if (itemJenis !== filterJenis) {
        match = false
      }
    }
    
    // Filter by Nomor LH05
    if (searchNomor && !item.nomorLH05.toLowerCase().includes(searchNomor)) {
      match = false
    }
    
    // Filter by Material (searchable)
    if (searchMaterial && !item.material.toLowerCase().includes(searchMaterial)) {
      match = false
    }
    
    return match
  })
  
  // Sort by status priority: N/A, Pengadaan, Tersedia, Terkirim, Tunda, Reject
  const statusOrder = {
    'N/A': 1,
    'Pengadaan': 2,
    'Tersedia': 3,
    'Terkirim': 4,
    'Tunda': 5,
    'Reject': 6
  }
  
  filteredMaterials.sort((a, b) => {
    const statusA = a.status || 'N/A'
    const statusB = b.status || 'N/A'
    const orderA = statusOrder[statusA] || 999
    const orderB = statusOrder[statusB] || 999
    return orderA - orderB
  })
  
  renderTable()
}

function resetFilters() {
  document.getElementById('filterStatus').value = ''
  document.getElementById('filterMesin').value = ''
  document.getElementById('filterUnit').value = ''
  document.getElementById('filterJenisBarang').value = ''
  document.getElementById('searchNomor').value = ''
  document.getElementById('searchMaterial').value = ''
  
  // Clear sessionStorage
  sessionStorage.removeItem('kebutuhanFilters')
  
  filteredMaterials = [...allMaterials]
  renderTable()
}

function renderTable() {
  const tbody = document.getElementById('kebutuhanTable')
  
  if (filteredMaterials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="px-4 py-8 text-center text-gray-500">
          ${allMaterials.length === 0 ? 'Belum ada data kebutuhan material' : 'Tidak ada data yang sesuai filter'}
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = filteredMaterials.map((item, index) => {
    const lokasiTujuan = item.lokasiTujuan || item.unitULD || '-'
    const stok = item.stok || 0
    const status = item.status || 'N/A'
    const isTerkirim = item.isTerkirim || status === 'Terkirim'
    
    // Jenis Barang badge with color
    const jenisBarang = item.jenisBarang || 'Material Handal'
    let jenisBadge = ''
    if (jenisBarang === 'Material Handal' || jenisBarang === 'MATERIAL HANDAL') {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">Material Handal</span>`
    } else if (jenisBarang === 'Filter' || jenisBarang === 'FILTER') {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">Filter</span>`
    } else if (jenisBarang === 'Material Bekas' || jenisBarang === 'MATERIAL BEKAS') {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">Material Bekas</span>`
    } else {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">${jenisBarang}</span>`
    }
    
    // Determine status display and dropdown behavior
    let statusDisplay = ''
    let statusColor = ''
    let isDisabled = false
    
    // Case 3: Sudah terkirim (read-only, blue)
    if (isTerkirim) {
      statusDisplay = `
        <span class="inline-block px-3 py-2 rounded bg-blue-100 text-blue-800 font-semibold text-sm w-full">
          🚚 Terkirim
        </span>
      `
      isDisabled = true
    } 
    // Case 1: Stok > 0 → Status "Tersedia" (green, disabled, show stock)
    else if (stok > 0) {
      statusDisplay = `
        <span class="inline-block px-3 py-2 rounded bg-green-100 text-green-800 font-semibold text-sm w-full">
          ✅ Tersedia
          <span class="text-xs block mt-1">Stok: ${stok}</span>
        </span>
      `
      isDisabled = true
    } 
    // Case 2: Stok = 0 → Status "N/A" or "Pengadaan" (gray/yellow, editable, show stock 0)
    else if (stok === 0) {
      if (status === 'Pengadaan') {
        statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-300'
        statusDisplay = `
          <select 
            onchange="updateStatus('${item.nomorLH05}', '${item.partNumber}', this.value)"
            class="px-3 py-1 border rounded ${statusColor} font-semibold text-sm cursor-pointer w-full">
            <option value="N/A" ${status === 'N/A' ? 'selected' : ''}>N/A</option>
            <option value="Pengadaan" ${status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
            <option value="Tunda" ${status === 'Tunda' ? 'selected' : ''}>Tunda</option>
            <option value="Reject" ${status === 'Reject' ? 'selected' : ''}>Reject</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">📦 Stok: 0</p>
        `
      } else {
        statusColor = 'bg-gray-100 text-gray-800 border-gray-300'
        statusDisplay = `
          <select 
            onchange="updateStatus('${item.nomorLH05}', '${item.partNumber}', this.value)"
            class="px-3 py-1 border rounded ${statusColor} font-semibold text-sm cursor-pointer w-full">
            <option value="N/A" ${status === 'N/A' ? 'selected' : ''}>N/A</option>
            <option value="Pengadaan" ${status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
            <option value="Tunda" ${status === 'Tunda' ? 'selected' : ''}>Tunda</option>
            <option value="Reject" ${status === 'Reject' ? 'selected' : ''}>Reject</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">📦 Stok: 0</p>
        `
      }
      isDisabled = false
    }
    
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-3 text-center">${index + 1}</td>
        <td class="px-4 py-3">
          <a href="/dashboard/gangguan" class="text-blue-600 hover:underline font-semibold">
            ${item.nomorLH05}
          </a>
        </td>
        <td class="px-4 py-3 font-semibold">${item.partNumber}</td>
        <td class="px-4 py-3">${item.material}</td>
        <td class="px-4 py-3">${jenisBadge}</td>
        <td class="px-4 py-3">${item.mesin}</td>
        <td class="px-4 py-3">${item.sn_mesin || item.snMesin || '-'}</td>
        <td class="px-4 py-3 text-center font-semibold">${item.jumlah}</td>
        <td class="px-4 py-3">${lokasiTujuan}</td>
        <td class="px-4 py-3 text-center">
          ${statusDisplay}
        </td>
      </tr>
    `
  }).join('')
}

function getStatusColor(status) {
  const colors = {
    'N/A': 'bg-gray-100 text-gray-800 border-gray-300',
    'Pengadaan': 'bg-blue-100 text-blue-800 border-blue-300',
    'Tunda': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Reject': 'bg-red-100 text-red-800 border-red-300',
    'Terkirim': 'bg-green-100 text-green-800 border-green-300',
    'Tersedia': 'bg-purple-100 text-purple-800 border-purple-300'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

async function updateStatus(nomorLH05, partNumber, newStatus) {
  try {
    const response = await fetch('/api/update-material-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nomorLH05,
        partNumber,
        status: newStatus
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      // Update local data
      const material = allMaterials.find(m => 
        m.nomorLH05 === nomorLH05 && m.partNumber === partNumber
      )
      if (material) {
        material.status = newStatus
      }
      
      // Show success notification
      showNotification('Status berhasil diupdate!', 'success')
      
      // Refresh statistics
      updateStatistics()
    } else {
      showNotification('Gagal update status: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Update status error:', error)
    showNotification('Terjadi kesalahan sistem', 'error')
  }
}

function showNotification(message, type) {
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500'
  const notification = document.createElement('div')
  notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`
  notification.innerHTML = `
    <div class="flex items-center">
      <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle mr-2"></i>
      <span>${message}</span>
    </div>
  `
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.remove()
  }, 3000)
}

function exportExcel() {
  // Prepare CSV data
  let csv = 'No,Nomor LH05,Part Number,Material,Jenis Barang,Mesin,Jumlah,Unit/Lokasi Tujuan,Status\n'
  
  filteredMaterials.forEach((item, index) => {
    const lokasiTujuan = item.lokasiTujuan || item.unitULD || '-'
    const jenisBarang = item.jenisBarang || 'Material Handal'
    csv += `${index + 1},"${item.nomorLH05}","${item.partNumber}","${item.material}","${jenisBarang}","${item.mesin}",${item.jumlah},"${lokasiTujuan}","${item.status}"\n`
  })
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kebutuhan-material-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
  
  showNotification('Export berhasil!', 'success')
}

// =============================================
// SessionStorage - Persist Filter State
// =============================================

function saveFilterState() {
  const filterState = {
    status: document.getElementById('filterStatus').value,
    mesin: document.getElementById('filterMesin').value,
    unit: document.getElementById('filterUnit').value,
    jenisBarang: document.getElementById('filterJenisBarang').value,
    searchNomor: document.getElementById('searchNomor').value,
    searchMaterial: document.getElementById('searchMaterial').value
  }
  sessionStorage.setItem('kebutuhanFilters', JSON.stringify(filterState))
  console.log('✅ Filter state saved:', filterState)
}

function restoreFilterState() {
  try {
    const savedState = sessionStorage.getItem('kebutuhanFilters')
    if (!savedState) {
      console.log('ℹ️ No saved filter state found')
      return
    }
    
    const filterState = JSON.parse(savedState)
    console.log('🔄 Restoring filter UI values:', filterState)
    
    // Restore UI values only (applyFilters will be called by loadKebutuhanMaterial)
    if (filterState.status) document.getElementById('filterStatus').value = filterState.status
    if (filterState.mesin) document.getElementById('filterMesin').value = filterState.mesin
    if (filterState.unit) document.getElementById('filterUnit').value = filterState.unit
    if (filterState.jenisBarang) document.getElementById('filterJenisBarang').value = filterState.jenisBarang
    if (filterState.searchNomor) document.getElementById('searchNomor').value = filterState.searchNomor
    if (filterState.searchMaterial) document.getElementById('searchMaterial').value = filterState.searchMaterial
    
    console.log('✅ Filter UI values restored')
    
  } catch (error) {
    console.error('❌ Failed to restore filter state:', error)
  }
}
