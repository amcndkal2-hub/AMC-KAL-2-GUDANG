// Dashboard Resume - AMC Material System
console.log('Dashboard Resume loaded')

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing dashboard resume...')
  loadResumeData()
  
  // Auto-refresh every 60 seconds
  setInterval(loadResumeData, 60000)
})

async function loadResumeData() {
  try {
    console.log('Loading resume data from API...')
    const response = await fetch('/api/dashboard/resume')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Resume data loaded:', data)
    
    // Render each section
    renderTopMaterials(data.topMaterials || [])
    renderStokKritis(data.stokKritis || [])
    renderStatusKebutuhan(data.statusKebutuhan || {})
    
  } catch (error) {
    console.error('Failed to load resume data:', error)
    showError('Gagal memuat data resume')
  }
}

function renderTopMaterials(materials) {
  const tbody = document.getElementById('topMaterialsTable')
  if (!tbody) return
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Belum ada data material keluar</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map((item, index) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3 text-center">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${getRankColor(index + 1)} text-white font-bold">
          ${index + 1}
        </span>
      </td>
      <td class="px-4 py-3 font-mono text-sm">${item.part_number || '-'}</td>
      <td class="px-4 py-3">${item.jenis_barang || '-'}</td>
      <td class="px-4 py-3">${item.material || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${item.mesin || '-'}</td>
      <td class="px-4 py-3 text-center">
        <span class="px-3 py-1 bg-red-100 text-red-700 rounded-full font-bold">
          ${item.total_keluar || 0}x
        </span>
      </td>
    </tr>
  `).join('')
}

function renderStokKritis(materials) {
  const tbody = document.getElementById('stokKritisTable')
  if (!tbody) return
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-check-circle text-4xl mb-2 text-green-500"></i>
          <p>Tidak ada stok kritis (< 5)</p>
          <p class="text-sm">Semua material memiliki stok yang cukup</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map((item, index) => {
    const stokAkhir = item.stok_akhir || 0
    const alertLevel = getStokAlertLevel(stokAkhir)
    
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-3 text-center text-gray-600">${index + 1}</td>
        <td class="px-4 py-3 font-mono text-sm">${item.part_number || '-'}</td>
        <td class="px-4 py-3">${item.jenis_barang || '-'}</td>
        <td class="px-4 py-3">${item.material || '-'}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${item.mesin || '-'}</td>
        <td class="px-4 py-3 text-center">
          <span class="px-3 py-1 ${alertLevel.bgColor} ${alertLevel.textColor} rounded-full font-bold">
            ${stokAkhir} ${alertLevel.icon}
          </span>
        </td>
      </tr>
    `
  }).join('')
}

function renderStatusKebutuhan(status) {
  // Update statistik cards
  document.getElementById('totalPengadaan').textContent = status.pengadaan || 0
  document.getElementById('totalTunda').textContent = status.tunda || 0
  document.getElementById('totalTerkirim').textContent = status.terkirim || 0
  document.getElementById('totalReject').textContent = status.reject || 0
  document.getElementById('totalTersedia').textContent = status.tersedia || 0
  
  // Calculate total
  const total = (status.pengadaan || 0) + (status.tunda || 0) + (status.terkirim || 0) + (status.reject || 0) + (status.tersedia || 0)
  document.getElementById('totalKebutuhan').textContent = total
}

function getRankColor(rank) {
  switch(rank) {
    case 1: return 'bg-yellow-500' // Gold
    case 2: return 'bg-gray-400'   // Silver
    case 3: return 'bg-orange-600' // Bronze
    default: return 'bg-blue-500'
  }
}

function getStokAlertLevel(stok) {
  if (stok === 0) {
    return {
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      icon: '<i class="fas fa-exclamation-triangle ml-1"></i>'
    }
  } else if (stok <= 2) {
    return {
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      icon: '<i class="fas fa-exclamation-circle ml-1"></i>'
    }
  } else {
    return {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      icon: '<i class="fas fa-info-circle ml-1"></i>'
    }
  }
}

function showError(message) {
  // You can implement a toast notification here
  console.error(message)
  alert(message)
}

// Export PDF function (optional)
function exportResumeAsPDF() {
  window.print()
}
