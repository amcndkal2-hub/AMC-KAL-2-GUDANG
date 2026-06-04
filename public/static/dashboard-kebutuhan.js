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
      // Normalize status: treat null, undefined, empty string, and "N/A" all as "N/A"
      status: (!item.status || item.status === '' || item.status === 'N/A') ? 'N/A' : item.status,
      stok: item.stok || 0, // Include stock info
      isTerkirim: item.isTerkirim || false, // Include shipment status
      jenisBarang: item.jenis_barang || 'Material Handal', // Include jenis barang
      isRabCreated: item.is_rab_created || false, // Include RAB flag
      sn_mesin: item.sn_mesin, // Include SN Mesin
      snMesin: item.sn_mesin // Alias for compatibility
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
  const statusFilter  = document.getElementById('filterStatus').value.trim()
  const mesinFilter   = document.getElementById('filterMesin').value.trim()
  const unitFilter    = document.getElementById('filterUnit').value.trim()
  const jenisFilter   = document.getElementById('filterJenisBarang').value.trim()
  const searchNomor   = document.getElementById('searchNomor').value.trim().toLowerCase()
  const searchMat     = document.getElementById('searchMaterial').value.trim().toLowerCase()

  saveFilterState()

  filteredMaterials = allMaterials.filter(item => {
    // ── 1. Status ──────────────────────────────────────────────
    // Normalize item status sama seperti saat load: null/''/N/A → 'N/A'
    const itemStatus = (!item.status || item.status === '' || item.status.trim() === 'N/A')
      ? 'N/A'
      : item.status.trim()

    if (statusFilter !== '' && itemStatus !== statusFilter) return false

    // ── 2. Mesin ───────────────────────────────────────────────
    if (mesinFilter !== '' && (item.mesin || '').trim() !== mesinFilter) return false

    // ── 3. Unit / Lokasi Tujuan ────────────────────────────────
    if (unitFilter !== '') {
      const itemUnit = (item.lokasiTujuan || item.unitULD || '').trim()
      if (itemUnit !== unitFilter) return false
    }

    // ── 4. Jenis Barang (case-insensitive) ─────────────────────
    if (jenisFilter !== '') {
      const itemJenis = (item.jenisBarang || '').trim().toUpperCase()
      if (itemJenis !== jenisFilter.toUpperCase()) return false
    }

    // ── 5. Search Nomor LH05 ───────────────────────────────────
    if (searchNomor && !(item.nomorLH05 || '').toLowerCase().includes(searchNomor)) return false

    // ── 6. Search Material ─────────────────────────────────────
    if (searchMat && !(item.material || '').toLowerCase().includes(searchMat)) return false

    return true
  })

  console.log(`🔍 Filter [status="${statusFilter}"] → ${filteredMaterials.length} / ${allMaterials.length} items`)

  // Sort by status priority
  const statusOrder = { 'N/A': 1, 'Pengadaan': 2, 'Tersedia': 3, 'Terkirim': 4, 'Tunda': 5, 'Reject': 6 }
  filteredMaterials.sort((a, b) => {
    const oA = statusOrder[a.status] || 999
    const oB = statusOrder[b.status] || 999
    return oA - oB
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
  
  // Debug: log status distribution of filteredMaterials before render
  const activeFilter = document.getElementById('filterStatus')?.value || ''
  const statusCount = filteredMaterials.reduce((acc, m) => {
    const s = m.status || 'N/A'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  console.log(`🎨 renderTable [filter="${activeFilter}"] ${filteredMaterials.length} items:`, statusCount)
  
  tbody.innerHTML = filteredMaterials.map((item, index) => {
    const lokasiTujuan = item.lokasiTujuan || item.unitULD || '-'
    const stok = item.stok || 0
    // Normalize status di renderTable juga untuk keamanan ganda
    const rawStatus = item.status
    const status = (!rawStatus || rawStatus === '' || rawStatus === 'N/A') ? 'N/A' : rawStatus
    const isTerkirim = item.isTerkirim || status === 'Terkirim'
    const isRabCreated = item.is_rab_created || item.isRabCreated || false
    
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
    
    // ========================================
    // STATUS LOGIC WITH DROPDOWN BEHAVIOR
    // ========================================
    
    // Case 1: Terkirim → Fixed, no dropdown (already shipped)
    if (isTerkirim || status === 'Terkirim') {
      statusColor = 'bg-green-100 text-green-800 border-green-300'
      statusDisplay = `
        <span class="inline-block px-2 py-1 rounded ${statusColor} text-xs font-semibold w-full text-center">
          ✅ Terkirim
        </span>
      `
      isDisabled = true
    }
    // Case 2: Pengadaan + RAB Created → Locked, no dropdown (in RAB process)
    else if (status === 'Pengadaan' && isRabCreated) {
      statusColor = 'bg-blue-100 text-blue-800 border-blue-300'
      statusDisplay = `
        <span class="inline-block px-2 py-1 rounded ${statusColor} text-xs font-semibold w-full text-center">
          🔒 Pengadaan
          <span class="text-xs block">📋 RAB</span>
        </span>
      `
      isDisabled = true
    }
    // Case 3: Reject → Fixed, no dropdown (rejected)
    else if (status === 'Reject') {
      statusColor = 'bg-red-100 text-red-800 border-red-300'
      statusDisplay = `
        <span class="inline-block px-2 py-1 rounded ${statusColor} text-xs font-semibold w-full text-center">
          ❌ Reject
        </span>
      `
      isDisabled = true
    }
    // Case 4a: Tersedia + RAB Created → Locked, no dropdown
    // HANYA jika status DB memang 'Tersedia' (bukan override dari stok)
    else if (status === 'Tersedia' && isRabCreated) {
      statusColor = 'bg-purple-100 text-purple-800 border-purple-300'
      statusDisplay = `
        <span class="inline-block px-2 py-1 rounded ${statusColor} text-xs font-semibold w-full text-center">
          🔒 Tersedia
          <span class="text-xs block">📦 ${stok} | 📋 RAB</span>
        </span>
      `
      isDisabled = true
    }
    // Case 4b: Tersedia + No RAB → Dropdown: Tersedia / Pengadaan / N/A
    // HANYA jika status DB memang 'Tersedia' (bukan stok override N/A)
    else if (status === 'Tersedia' && !isRabCreated) {
      statusColor = 'bg-purple-100 text-purple-800 border-purple-300'
      statusDisplay = `
        <select
          onchange="updateStatus(${item.id}, '${item.nomorLH05}', '${item.partNumber}', this.value, '${item.sn_mesin || item.snMesin || ''}')"
          class="px-2 py-1 border rounded ${statusColor} text-xs font-semibold cursor-pointer w-full">
          <option value="Tersedia" selected>Tersedia</option>
          <option value="Pengadaan">Pengadaan</option>
          <option value="N/A">N/A</option>
        </select>
        <p class="text-xs text-gray-500 text-center mt-0.5">📦 ${stok}</p>
      `
      isDisabled = false
    }
    // Case 5: Pengadaan (no RAB yet) → Dropdown: can change to N/A, Tunda, Reject
    else if (status === 'Pengadaan' && !isRabCreated) {
      statusColor = 'bg-blue-100 text-blue-800 border-blue-300'
      statusDisplay = `
        <select 
          onchange="updateStatus(${item.id}, '${item.nomorLH05}', '${item.partNumber}', this.value, '${item.sn_mesin || item.snMesin || ''}')"
          class="px-2 py-1 border rounded ${statusColor} text-xs font-semibold cursor-pointer w-full">
          <option value="Pengadaan" selected>Pengadaan</option>
          <option value="N/A">N/A</option>
          <option value="Tunda">Tunda</option>
          <option value="Reject">Reject</option>
        </select>
        <p class="text-xs text-gray-500 text-center mt-0.5">📦 ${stok}</p>
      `
      isDisabled = false
    }
    // Case 6: Tunda → Dropdown: can change to N/A, Pengadaan, Reject
    else if (status === 'Tunda') {
      statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-300'
      statusDisplay = `
        <select 
          onchange="updateStatus(${item.id}, '${item.nomorLH05}', '${item.partNumber}', this.value, '${item.sn_mesin || item.snMesin || ''}')"
          class="px-2 py-1 border rounded ${statusColor} text-xs font-semibold cursor-pointer w-full">
          <option value="Tunda" selected>Tunda</option>
          <option value="N/A">N/A</option>
          <option value="Pengadaan">Pengadaan</option>
          <option value="Reject">Reject</option>
        </select>
        <p class="text-xs text-gray-500 text-center mt-0.5">📦 ${stok}</p>
      `
      isDisabled = false
    }
    // Case 7: N/A or default → Dropdown: can change to Pengadaan, Tunda, Reject
    else {
      statusColor = 'bg-gray-100 text-gray-800 border-gray-300'
      statusDisplay = `
        <select 
          onchange="updateStatus(${item.id}, '${item.nomorLH05}', '${item.partNumber}', this.value, '${item.sn_mesin || item.snMesin || ''}')"
          class="px-2 py-1 border rounded ${statusColor} text-xs font-semibold cursor-pointer w-full">
          <option value="N/A" ${(!status || status === 'N/A') ? 'selected' : ''}>N/A</option>
          <option value="Pengadaan" ${status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
          <option value="Tunda" ${status === 'Tunda' ? 'selected' : ''}>Tunda</option>
          <option value="Reject" ${status === 'Reject' ? 'selected' : ''}>Reject</option>
        </select>
        <p class="text-xs text-gray-500 text-center mt-0.5">📦 ${stok}</p>
      `
      isDisabled = false
    }
    
    return `
      <tr class="border-b hover:bg-gray-50 align-middle transition-colors">
        <td class="px-3 py-2.5 text-center align-middle text-sm">${index + 1}</td>
        <td class="px-3 py-2.5 align-middle">
          <a href="/dashboard/gangguan" class="text-blue-600 hover:underline text-xs font-semibold">
            ${item.nomorLH05}
          </a>
        </td>
        <td class="px-3 py-2.5 align-middle text-xs font-semibold">${item.partNumber}</td>
        <td class="px-3 py-2.5 align-middle text-xs">${item.material}</td>
        <td class="px-3 py-2.5 align-middle text-center">${jenisBadge}</td>
        <td class="px-3 py-2.5 align-middle text-xs">${item.mesin}</td>
        <td class="px-3 py-2.5 align-middle text-xs text-center">${item.sn_mesin || item.snMesin || '-'}</td>
        <td class="px-3 py-2.5 text-center align-middle text-sm font-semibold">${item.jumlah}</td>
        <td class="px-3 py-2.5 align-middle text-xs">${lokasiTujuan}</td>
        <td class="px-2 py-2 text-center align-middle">
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

async function updateStatus(materialId, nomorLH05, partNumber, newStatus, snMesin) {
  try {
    const response = await fetch('/api/update-material-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        materialId,
        nomorLH05,
        partNumber,
        snMesin,
        status: newStatus
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      // Update item di allMaterials secara langsung
      const material = allMaterials.find(m => m.id === materialId)
      if (material) {
        material.status = newStatus
        console.log(`✅ Updated ID ${materialId}: ${material.partNumber} → ${newStatus}`)
      }

      // Re-apply filter yang aktif agar tabel konsisten dengan filter
      applyFilters()

      showNotification(`Status berhasil diupdate ke "${newStatus}"`, 'success')
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
