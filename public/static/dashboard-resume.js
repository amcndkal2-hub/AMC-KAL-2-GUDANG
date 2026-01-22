// Dashboard Resume - AMC Material System
console.log('Dashboard Resume loaded')

let currentResumeData = null

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing dashboard resume...')
  loadResumeData()
  
  // Auto-refresh every 60 seconds
  setInterval(loadResumeData, 60000)
  
  // Setup filter handlers
  setupFilterHandlers()
})

// Setup filter dropdown handlers
function setupFilterHandlers() {
  const dropdown = document.getElementById('filterTampilan')
  if (dropdown) {
    // Auto-apply filter saat dropdown berubah
    dropdown.addEventListener('change', applyFilter)
    console.log('Filter dropdown handler attached')
  }
  
  // Show default section (Status Kebutuhan)
  applyFilter()
}

// Function untuk apply filter - show only selected section
function applyFilter() {
  const dropdown = document.getElementById('filterTampilan')
  if (!dropdown) return
  
  const selectedSection = dropdown.value
  console.log('Applying filter:', selectedSection)
  
  // Hide all sections
  document.querySelectorAll('.section-content').forEach(section => {
    section.style.display = 'none'
  })
  
  // Show selected section
  const targetSection = document.getElementById(selectedSection)
  if (targetSection) {
    targetSection.style.display = 'block'
    console.log('Section displayed:', selectedSection)
  }
}

// Function untuk reset filter - show Status Kebutuhan (default)
function resetFilter() {
  const dropdown = document.getElementById('filterTampilan')
  if (dropdown) {
    dropdown.value = 'status-kebutuhan'
    applyFilter()
    console.log('Filter reset to default')
  }
}

async function loadResumeData() {
  try {
    console.log('Loading resume data from API...')
    const response = await fetch('/api/dashboard/resume')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Resume data loaded:', data)
    
    // Store data globally for drill-down
    currentResumeData = data
    
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

// Show detail modal for status kebutuhan
async function showStatusDetail(status) {
  try {
    console.log(`Loading ${status} materials...`)
    
    // Fetch materials by status
    const response = await fetch(`/api/kebutuhan-material?status=${encodeURIComponent(status)}`)
    const data = await response.json()
    
    const materials = data.materials || []
    console.log(`Found ${materials.length} materials with status: ${status}`)
    
    // Create modal
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto'
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-6xl w-full my-8 shadow-2xl">
        <!-- Header -->
        <div class="bg-gradient-to-r ${getStatusGradient(status)} text-white p-6 rounded-t-lg">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold">
                ${getStatusIcon(status)}
                Detail Material - Status: ${status}
              </h2>
              <p class="text-white text-opacity-90 mt-1">Total: ${materials.length} item</p>
            </div>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-white hover:text-gray-200 text-3xl">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <!-- Content -->
        <div class="p-6">
          ${materials.length === 0 ? `
            <div class="text-center py-12 text-gray-500">
              <i class="fas fa-inbox text-5xl mb-4"></i>
              <p class="text-lg">Tidak ada material dengan status <strong>${status}</strong></p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr class="border-b">
                    <th class="px-4 py-3 text-left text-sm font-bold text-gray-700">No</th>
                    <th class="px-4 py-3 text-left text-sm font-bold text-gray-700">Nomor LH05</th>
                    <th class="px-4 py-3 text-left text-sm font-bold text-gray-700">Part Number</th>
                    <th class="px-4 py-3 text-left text-sm font-bold text-gray-700">Material</th>
                    <th class="px-4 py-3 text-left text-sm font-bold text-gray-700">Mesin</th>
                    <th class="px-4 py-3 text-center text-sm font-bold text-gray-700">Jumlah</th>
                    <th class="px-4 py-3 text-left text-sm font-bold text-gray-700">Unit ULD</th>
                    <th class="px-4 py-3 text-center text-sm font-bold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${materials.map((item, index) => `
                    <tr class="border-b hover:bg-gray-50">
                      <td class="px-4 py-3 text-center text-gray-600">${index + 1}</td>
                      <td class="px-4 py-3">
                        <a href="/dashboard/gangguan?nomor=${encodeURIComponent(item.nomor_lh05 || item.nomorLH05 || '')}" 
                           class="text-blue-600 hover:underline font-mono text-sm">
                          ${item.nomor_lh05 || item.nomorLH05 || '-'}
                        </a>
                      </td>
                      <td class="px-4 py-3 font-mono text-sm">${item.part_number || item.partNumber || '-'}</td>
                      <td class="px-4 py-3">${item.material || '-'}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">${item.mesin || '-'}</td>
                      <td class="px-4 py-3 text-center font-bold">${item.jumlah || 0}</td>
                      <td class="px-4 py-3">${item.unit_uld || item.unitULD || '-'}</td>
                      <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 ${getStatusColor(status)} rounded-full text-xs font-semibold">
                          ${status}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
        
        <!-- Footer -->
        <div class="bg-gray-100 p-4 rounded-b-lg flex justify-end">
          <button onclick="this.closest('.fixed').remove()" 
            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            <i class="fas fa-times mr-2"></i>Tutup
          </button>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
  } catch (error) {
    console.error('Failed to load status detail:', error)
    alert('Gagal memuat detail material')
  }
}

function getStatusGradient(status) {
  switch(status.toLowerCase()) {
    case 'pengadaan': return 'from-orange-500 to-orange-600'
    case 'tunda': return 'from-yellow-500 to-yellow-600'
    case 'terkirim': return 'from-green-500 to-green-600'
    case 'reject': return 'from-red-500 to-red-600'
    case 'tersedia': return 'from-cyan-500 to-cyan-600'
    default: return 'from-blue-500 to-blue-600'
  }
}

function getStatusIcon(status) {
  switch(status.toLowerCase()) {
    case 'pengadaan': return '<i class="fas fa-shopping-cart mr-2"></i>'
    case 'tunda': return '<i class="fas fa-clock mr-2"></i>'
    case 'terkirim': return '<i class="fas fa-check-circle mr-2"></i>'
    case 'reject': return '<i class="fas fa-times-circle mr-2"></i>'
    case 'tersedia': return '<i class="fas fa-box mr-2"></i>'
    default: return '<i class="fas fa-list mr-2"></i>'
  }
}

function getStatusColor(status) {
  switch(status.toLowerCase()) {
    case 'pengadaan': return 'bg-orange-100 text-orange-700'
    case 'tunda': return 'bg-yellow-100 text-yellow-700'
    case 'terkirim': return 'bg-green-100 text-green-700'
    case 'reject': return 'bg-red-100 text-red-700'
    case 'tersedia': return 'bg-cyan-100 text-cyan-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

// Export PDF function (optional)
function exportResumeAsPDF() {
  window.print()
}
