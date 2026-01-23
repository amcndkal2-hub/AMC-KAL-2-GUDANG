// =============================================
// Dashboard Kebutuhan Material
// =============================================

let allMaterials = []
let filteredMaterials = []

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  loadKebutuhanMaterial()
  populateFilters()
  
  // Auto refresh every 30 seconds
  setInterval(loadKebutuhanMaterial, 30000)
  
  // Filter change handlers
  document.getElementById('filterStatus').addEventListener('change', applyFilters)
  document.getElementById('filterMesin').addEventListener('change', applyFilters)
  document.getElementById('filterUnit').addEventListener('change', applyFilters)
  document.getElementById('searchNomor').addEventListener('input', applyFilters)
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
      unitULD: item.unit_uld
    }))
    filteredMaterials = [...allMaterials]
    
    // Populate mesin filter after data is loaded
    populateMesinFilter()
    
    updateStatistics()
    renderTable()
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
  const searchNomor = document.getElementById('searchNomor').value.toLowerCase()
  
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
    
    // Filter by Nomor LH05
    if (searchNomor && !item.nomorLH05.toLowerCase().includes(searchNomor)) {
      match = false
    }
    
    return match
  })
  
  renderTable()
}

function resetFilters() {
  document.getElementById('filterStatus').value = ''
  document.getElementById('filterMesin').value = ''
  document.getElementById('filterUnit').value = ''
  document.getElementById('searchNomor').value = ''
  
  filteredMaterials = [...allMaterials]
  renderTable()
}

function renderTable() {
  const tbody = document.getElementById('kebutuhanTable')
  
  if (filteredMaterials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-8 text-center text-gray-500">
          ${allMaterials.length === 0 ? 'Belum ada data kebutuhan material' : 'Tidak ada data yang sesuai filter'}
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = filteredMaterials.map((item, index) => {
    const statusColor = getStatusColor(item.status)
    const lokasiTujuan = item.lokasiTujuan || item.unitULD || '-'
    
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
        <td class="px-4 py-3">${item.mesin}</td>
        <td class="px-4 py-3 text-center font-semibold">${item.jumlah}</td>
        <td class="px-4 py-3">${lokasiTujuan}</td>
        <td class="px-4 py-3 text-center">
          <select 
            onchange="updateStatus('${item.nomorLH05}', '${item.partNumber}', this.value)"
            class="px-3 py-1 border rounded ${statusColor} font-semibold text-sm">
            <option value="N/A" ${item.status === 'N/A' ? 'selected' : ''}>N/A</option>
            <option value="Pengadaan" ${item.status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
            <option value="Tunda" ${item.status === 'Tunda' ? 'selected' : ''}>Tunda</option>
            <option value="Reject" ${item.status === 'Reject' ? 'selected' : ''}>Reject</option>
            <option value="Terkirim" ${item.status === 'Terkirim' ? 'selected' : ''}>Terkirim</option>
            <option value="Tersedia" ${item.status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
          </select>
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
  let csv = 'No,Nomor LH05,Part Number,Material,Mesin,Jumlah,Unit/Lokasi Tujuan,Status\n'
  
  filteredMaterials.forEach((item, index) => {
    const lokasiTujuan = item.lokasiTujuan || item.unitULD || '-'
    csv += `${index + 1},"${item.nomorLH05}","${item.partNumber}","${item.material}","${item.mesin}",${item.jumlah},"${lokasiTujuan}","${item.status}"\n`
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
