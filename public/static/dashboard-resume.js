// Dashboard Resume - AMC Material System
console.log('Dashboard Resume loaded')

let currentResumeData = null
let allTopMaterials = []  // Store original data
let allStokKritis = []     // Store original data
let allKebutuhanDetail = [] // Store kebutuhan detail data

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing dashboard resume...')
  loadResumeData()
  loadKebutuhanDetail() // Load kebutuhan detail for filtering
  
  // Auto-refresh every 60 seconds
  setInterval(() => {
    loadResumeData()
    loadKebutuhanDetail()
  }, 60000)
  
  // Setup filter handlers
  setupFilterHandlers()
})

// Setup filter dropdown handlers
function setupFilterHandlers() {
  const dropdown = document.getElementById('filterTampilan')
  const filterMesin = document.getElementById('filterMesin')
  const filterPartNumber = document.getElementById('filterPartNumber')
  const filterUnitULD = document.getElementById('filterUnitULD')
  
  if (dropdown) {
    // Auto-apply filter saat dropdown berubah
    dropdown.addEventListener('change', () => {
      applyFilter()
      toggleFilterSections()
    })
    console.log('Filter dropdown handler attached')
  }
  
  if (filterMesin) {
    filterMesin.addEventListener('change', applyMesinFilter)
    console.log('Filter Mesin handler attached')
  }
  
  if (filterPartNumber) {
    filterPartNumber.addEventListener('input', applyStatusKebutuhanFilter)
    console.log('Filter Part Number handler attached')
  }
  
  if (filterUnitULD) {
    filterUnitULD.addEventListener('change', applyStatusKebutuhanFilter)
    console.log('Filter Unit/ULD handler attached')
  }
  
  // Show default section (Status Kebutuhan)
  applyFilter()
}

// Toggle visibility of filter sections based on selected view
function toggleFilterSections() {
  const dropdown = document.getElementById('filterTampilan')
  const mesinSection = document.getElementById('filterMesinSection')
  const statusKebutuhanSection = document.getElementById('filterStatusKebutuhanSection')
  
  if (!dropdown) return
  
  const selectedSection = dropdown.value
  
  // Show MESIN filter only for top-material and stok-kritis
  if (selectedSection === 'top-material' || selectedSection === 'stok-kritis') {
    if (mesinSection) mesinSection.style.display = 'block'
    if (statusKebutuhanSection) statusKebutuhanSection.style.display = 'none'
  } 
  // Show Part Number & Unit/ULD filter only for status-kebutuhan
  else if (selectedSection === 'status-kebutuhan') {
    if (mesinSection) mesinSection.style.display = 'none'
    if (statusKebutuhanSection) statusKebutuhanSection.style.display = 'block'
  }
  else {
    if (mesinSection) mesinSection.style.display = 'none'
    if (statusKebutuhanSection) statusKebutuhanSection.style.display = 'none'
  }
}

// Toggle visibility of MESIN filter based on selected section (legacy)
function toggleMesinFilter() {
  toggleFilterSections() // Use new function
}

// Populate MESIN dropdown with unique values
function populateMesinDropdown(materials) {
  const filterMesin = document.getElementById('filterMesin')
  if (!filterMesin) return
  
  // Extract unique mesin values
  const uniqueMesins = [...new Set(materials.map(m => m.mesin).filter(Boolean))].sort()
  
  // Build options HTML
  const options = uniqueMesins.map(mesin => 
    `<option value="${mesin}">${mesin}</option>`
  ).join('')
  
  filterMesin.innerHTML = `<option value="">Semua Mesin</option>${options}`
  console.log('📍 Mesin dropdown populated with', uniqueMesins.length, 'unique values')
}

// Apply MESIN filter to current section
function applyMesinFilter() {
  const dropdown = document.getElementById('filterTampilan')
  const filterMesin = document.getElementById('filterMesin')
  
  if (!dropdown || !filterMesin) return
  
  const selectedSection = dropdown.value
  const selectedMesin = filterMesin.value
  
  console.log('Applying MESIN filter:', selectedMesin)
  
  if (selectedSection === 'top-material') {
    // Filter top materials
    const filtered = selectedMesin 
      ? allTopMaterials.filter(m => m.mesin === selectedMesin)
      : allTopMaterials
    renderTopMaterials(filtered)
  } else if (selectedSection === 'stok-kritis') {
    // Filter stok kritis
    const filtered = selectedMesin 
      ? allStokKritis.filter(m => m.mesin === selectedMesin)
      : allStokKritis
    renderStokKritis(filtered)
  }
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
  
  // Reset MESIN filter when switching sections
  const filterMesin = document.getElementById('filterMesin')
  if (filterMesin) {
    filterMesin.value = ''
    applyMesinFilter()
  }
}

// Function untuk reset filter - show Status Kebutuhan (default)
function resetFilter() {
  const dropdown = document.getElementById('filterTampilan')
  const filterMesin = document.getElementById('filterMesin')
  const filterPartNumber = document.getElementById('filterPartNumber')
  const filterUnitULD = document.getElementById('filterUnitULD')
  
  if (dropdown) {
    dropdown.value = 'status-kebutuhan'
  }
  
  if (filterMesin) {
    filterMesin.value = ''
  }
  
  if (filterPartNumber) {
    filterPartNumber.value = ''
  }
  
  if (filterUnitULD) {
    filterUnitULD.value = ''
  }
  
  applyFilter()
  toggleFilterSections()
  
  // Reset status kebutuhan to original data
  if (currentResumeData && currentResumeData.statusKebutuhan) {
    updateStatusKebutuhanUI(currentResumeData.statusKebutuhan)
  }
  
  // Reset Detail Material table to all data
  if (allKebutuhanDetail && allKebutuhanDetail.length > 0) {
    renderDetailMaterialTable(allKebutuhanDetail)
  }
  
  console.log('Filter reset to default')
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
    
    // Store data globally for drill-down and filtering
    currentResumeData = data
    allTopMaterials = data.topMaterials || []
    allStokKritis = data.stokKritis || []
    
    // Populate MESIN dropdown with combined data
    const allMaterials = [...allTopMaterials, ...allStokKritis]
    populateMesinDropdown(allMaterials)
    
    // Render each section
    renderTopMaterials(allTopMaterials)
    renderStokKritis(allStokKritis)
    renderStatusKebutuhan(data.statusKebutuhan || {})
    
    // Toggle MESIN filter visibility based on current section
    toggleMesinFilter()
    
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
        <td colspan="7" class="px-4 py-8 text-center text-gray-500 border">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Belum ada data material keluar</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map((item, index) => {
    const rank = index + 1
    const isTopFive = rank <= 5
    const rowClass = isTopFive ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'
    
    return `
    <tr class="border-b ${rowClass}">
      <td class="px-4 py-3 text-center border">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${getRankColor(rank)} text-white font-bold">
          ${rank}
        </span>
      </td>
      <td class="px-4 py-3 font-mono text-sm border">${item.part_number || '-'}</td>
      <td class="px-4 py-3 border">${item.jenis_barang || '-'}</td>
      <td class="px-4 py-3 border">${item.material || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-600 border">${item.mesin || '-'}</td>
      <td class="px-4 py-3 text-center border">
        <span class="px-3 py-1 ${isTopFive ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} rounded-full font-bold">
          ${item.total_keluar || 0}x
        </span>
      </td>
      <td class="px-4 py-3 text-center border">
        <button 
          onclick="viewMaterialDetail('${item.part_number}')"
          class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors">
          <i class="fas fa-eye mr-1"></i>View
        </button>
      </td>
    </tr>
  `
  }).join('')
}

// Helper function to format date
function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

// Function to view material detail
async function viewMaterialDetail(partNumber) {
  try {
    console.log('📋 Viewing material detail:', partNumber)
    
    // Show modal
    const modal = document.getElementById('modalMaterialDetail')
    modal.classList.remove('hidden')
    modal.classList.add('flex')
    
    // Show loading
    const content = document.getElementById('materialDetailContent')
    content.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
        <p class="mt-4 text-gray-600">Memuat detail material...</p>
      </div>
    `
    
    // Fetch detail
    const response = await fetch(`/api/material-detail/${partNumber}`)
    const data = await response.json()
    
    if (!data.success || data.transactions.length === 0) {
      content.innerHTML = `
        <div class="text-center py-8">
          <i class="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
          <p class="text-gray-600">Tidak ada data transaksi keluar untuk material ini</p>
        </div>
      `
      return
    }
    
    // Render detail table
    const totalJumlah = data.transactions.reduce((sum, t) => sum + (t.jumlah || 0), 0)
    
    content.innerHTML = `
      <div class="mb-6">
        <div class="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4">
          <h4 class="text-lg font-bold text-gray-800 mb-2">
            <i class="fas fa-cube text-blue-600 mr-2"></i>
            ${partNumber}
          </h4>
          <p class="text-sm text-gray-600">
            <i class="fas fa-box mr-2"></i>
            Material: <span class="font-semibold">${data.transactions[0]?.material || '-'}</span>
          </p>
          <p class="text-sm text-gray-600 mt-1">
            <i class="fas fa-chart-line mr-2"></i>
            Total Keluar: <span class="font-bold text-blue-600">${totalJumlah} unit</span> dari ${data.total} transaksi
          </p>
        </div>
      </div>
      
      <div class="overflow-x-auto max-h-[400px] border rounded-lg">
        <table class="w-full border-collapse">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gray-100">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">No</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">Part Number</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">Material</th>
              <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">Jumlah Keluar</th>
              <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">Tanggal Keluar</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">Lokasi Tujuan</th>
            </tr>
          </thead>
          <tbody>
            ${data.transactions.map((item, index) => `
              <tr class="hover:bg-gray-50 border-b">
                <td class="px-4 py-3 text-center text-sm border">${index + 1}</td>
                <td class="px-4 py-3 text-sm font-mono border">${item.part_number || '-'}</td>
                <td class="px-4 py-3 text-sm border">${item.material || '-'}</td>
                <td class="px-4 py-3 text-center border">
                  <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">
                    ${item.jumlah || 0}
                  </span>
                </td>
                <td class="px-4 py-3 text-center text-sm border">${formatDate(item.tanggal)}</td>
                <td class="px-4 py-3 text-sm border">${item.lokasi_tujuan || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-blue-50 font-bold">
              <td colspan="3" class="px-4 py-3 text-right border">Total:</td>
              <td class="px-4 py-3 text-center border">
                <span class="px-3 py-1 bg-blue-600 text-white rounded-full font-bold">
                  ${totalJumlah}
                </span>
              </td>
              <td colspan="2" class="px-4 py-3 border"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
  } catch (error) {
    console.error('Failed to load material detail:', error)
    const content = document.getElementById('materialDetailContent')
    content.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
        <p class="text-red-600 font-semibold">Gagal memuat detail material</p>
        <p class="text-gray-500 text-sm mt-2">${error.message}</p>
      </div>
    `
  }
}

function renderStokKritis(materials) {
  const tbody = document.getElementById('stokKritisTable')
  if (!tbody) return
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-gray-500 border">
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
    const rank = index + 1
    const isTopFive = rank <= 5
    const alertLevel = getStokAlertLevel(stokAkhir, isTopFive)
    const rowClass = isTopFive ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'
    
    return `
      <tr class="border-b ${rowClass}">
        <td class="px-4 py-3 text-center text-gray-600 border">${rank}</td>
        <td class="px-4 py-3 font-mono text-sm border">${item.part_number || '-'}</td>
        <td class="px-4 py-3 border">${item.jenis_barang || '-'}</td>
        <td class="px-4 py-3 border">${item.material || '-'}</td>
        <td class="px-4 py-3 text-sm text-gray-600 border">${item.mesin || '-'}</td>
        <td class="px-4 py-3 text-center border">
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

function getStokAlertLevel(stok, isTopFive = false) {
  // Jika top 5, force red color
  if (isTopFive) {
    return {
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      icon: '<i class="fas fa-exclamation-triangle ml-1"></i>'
    }
  }
  
  // For rank 6-15, use normal alert levels
  if (stok === 0) {
    return {
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      icon: '<i class="fas fa-exclamation-triangle ml-1"></i>'
    }
  } else if (stok <= 2) {
    return {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      icon: '<i class="fas fa-exclamation-circle ml-1"></i>'
    }
  } else {
    return {
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
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

// Global variable untuk store current materials
let currentDetailMaterials = []

// Modified showStatusDetail untuk populate table instead of modal
async function populateDetailTable(status) {
  try {
    console.log(`Loading ${status} materials for table...`)
    
    // Fetch materials by status
    const response = await fetch(`/api/kebutuhan-material?status=${encodeURIComponent(status)}`)
    const data = await response.json()
    
    const materials = data.materials || []
    currentDetailMaterials = materials // Store for export
    console.log(`Found ${materials.length} materials with status: ${status}`)
    
    const tbody = document.getElementById('detailMaterialTable')
    if (!tbody) return
    
    if (materials.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-4 py-8 text-center text-gray-400 border">
            <i class="fas fa-inbox text-2xl"></i>
            <p class="mt-2">Tidak ada material dengan status <strong>${status}</strong></p>
          </td>
        </tr>
      `
      return
    }
    
    tbody.innerHTML = materials.map((item, index) => {
      // Map snake_case to camelCase
      const nomorLH05 = item.nomor_lh05 || item.nomorLH05 || '-'
      const partNumber = item.part_number || item.partNumber || '-'
      const material = item.material || '-'
      const mesin = item.mesin || '-'
      const jumlah = item.jumlah || 0
      const unitULD = item.unit_uld || item.unitULD || '-'
      const lokasiTujuan = item.lokasi_tujuan || item.lokasiTujuan || '-'
      const status = item.status || 'Pending'
      
      return `
      <tr class="hover:bg-gray-50 border-b">
        <td class="px-4 py-3 border">${index + 1}</td>
        <td class="px-4 py-3 border">
          <a href="#" onclick="viewLH05('${nomorLH05}'); return false;" 
             class="text-blue-600 hover:text-blue-800 hover:underline font-semibold">
            ${nomorLH05}
          </a>
        </td>
        <td class="px-4 py-3 border font-mono">${partNumber}</td>
        <td class="px-4 py-3 border">${material}</td>
        <td class="px-4 py-3 border">${mesin}</td>
        <td class="px-4 py-3 text-center border font-semibold">${jumlah}</td>
        <td class="px-4 py-3 border">${unitULD}</td>
        <td class="px-4 py-3 border">${lokasiTujuan}</td>
        <td class="px-4 py-3 text-center border">
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}">
            ${status}
          </span>
        </td>
      </tr>
    `}).join('')
    
  } catch (error) {
    console.error('Failed to load detail materials:', error)
    const tbody = document.getElementById('detailMaterialTable')
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-4 py-8 text-center text-red-500 border">
            <i class="fas fa-exclamation-triangle text-2xl"></i>
            <p class="mt-2">Gagal memuat data material</p>
          </td>
        </tr>
      `
    }
  }
}

// Override showStatusDetail untuk call populateDetailTable
const originalShowStatusDetail = showStatusDetail
showStatusDetail = async function(status) {
  // Populate table
  await populateDetailTable(status)
  
  // Also show modal (original behavior)
  await originalShowStatusDetail(status)
}

// Export Status Kebutuhan to Excel
function exportStatusToExcel() {
  if (currentDetailMaterials.length === 0) {
    alert('Tidak ada data untuk di-export. Silakan klik salah satu status card terlebih dahulu.')
    return
  }
  
  // Create CSV content
  const headers = ['No', 'Nomor LH05', 'Part Number', 'Material', 'Mesin', 'Jumlah', 'Unit/ULD', 'Tujuan', 'Status']
  const csvContent = [
    headers.join(','),
    ...currentDetailMaterials.map((item, index) => [
      index + 1,
      item.nomor_lh05 || item.nomorLH05 || '-',
      item.part_number || item.partNumber || '-',
      item.material || '-',
      item.mesin || '-',
      item.jumlah || 0,
      item.unit_uld || item.unitULD || '-',
      item.lokasi_tujuan || item.lokasiTujuan || '-',
      item.status || 'Pending'
    ].map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  // Download CSV
  downloadCSV(csvContent, 'Status_Kebutuhan_Material.csv')
}

// Export Top 5 Material to Excel
function exportTopMaterialToExcel() {
  if (!currentResumeData || !currentResumeData.topMaterials || currentResumeData.topMaterials.length === 0) {
    alert('Tidak ada data Top 5 Material untuk di-export.')
    return
  }
  
  const headers = ['Peringkat', 'Part Number', 'Jenis Barang', 'Material', 'Mesin', 'Total Keluar']
  const csvContent = [
    headers.join(','),
    ...currentResumeData.topMaterials.map((item, index) => [
      index + 1,
      item.part_number || '-',
      item.jenis_barang || '-',
      item.material || '-',
      item.mesin || '-',
      item.total_keluar || 0
    ].map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  downloadCSV(csvContent, 'Top_5_Material_Sering_Keluar.csv')
}

// Export Stok Kritis to Excel
function exportStokKritisToExcel() {
  if (!currentResumeData || !currentResumeData.stokKritis || currentResumeData.stokKritis.length === 0) {
    alert('Tidak ada data Stok Kritis untuk di-export.')
    return
  }
  
  const headers = ['No', 'Part Number', 'Jenis Barang', 'Material', 'Mesin', 'Stok Akhir']
  const csvContent = [
    headers.join(','),
    ...currentResumeData.stokKritis.map((item, index) => [
      index + 1,
      item.part_number || '-',
      item.jenis_barang || '-',
      item.material || '-',
      item.mesin || '-',
      item.stok_akhir || 0
    ].map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  downloadCSV(csvContent, 'Top_5_Stok_Kritis.csv')
}

// Helper function to download CSV
function downloadCSV(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  console.log(`Exported: ${filename}`)
}

// Load kebutuhan detail data for filtering
async function loadKebutuhanDetail() {
  try {
    console.log('Loading kebutuhan detail from API...')
    const response = await fetch('/api/kebutuhan-detail')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Kebutuhan detail loaded:', data)
    
    if (data.success) {
      allKebutuhanDetail = data.kebutuhanList || []
      
      // Populate Unit/ULD dropdown
      populateUnitULDDropdown(data.uniqueUnits || [])
      
      // Render initial table (all data, no filter)
      renderDetailMaterialTable(allKebutuhanDetail)
    }
  } catch (error) {
    console.error('Failed to load kebutuhan detail:', error)
  }
}

// Populate Unit/ULD dropdown with unique values
function populateUnitULDDropdown(uniqueUnits) {
  const filterUnitULD = document.getElementById('filterUnitULD')
  if (!filterUnitULD) return
  
  const options = uniqueUnits.map(unit => 
    `<option value="${unit}">${unit}</option>`
  ).join('')
  
  filterUnitULD.innerHTML = `<option value="">Semua Unit/ULD</option>${options}`
  console.log('📍 Unit/ULD dropdown populated with', uniqueUnits.length, 'unique values')
}

// Apply Part Number & Unit/ULD filter for Status Kebutuhan
function applyStatusKebutuhanFilter() {
  const filterPartNumber = document.getElementById('filterPartNumber')
  const filterUnitULD = document.getElementById('filterUnitULD')
  
  if (!filterPartNumber || !filterUnitULD) return
  
  const partNumberSearch = filterPartNumber.value.toLowerCase().trim()
  const selectedUnit = filterUnitULD.value
  
  console.log('🔍 Filtering Status Kebutuhan:', { partNumberSearch, selectedUnit })
  
  // Filter data
  let filteredData = allKebutuhanDetail
  
  if (partNumberSearch) {
    filteredData = filteredData.filter(item => 
      (item.part_number || '').toLowerCase().includes(partNumberSearch)
    )
  }
  
  if (selectedUnit) {
    filteredData = filteredData.filter(item => 
      item.lokasi_tujuan === selectedUnit
    )
  }
  
  // Calculate status summary
  const statusSummary = {
    pengadaan: 0,
    tunda: 0,
    terkirim: 0,
    reject: 0,
    tersedia: 0
  }
  
  filteredData.forEach(item => {
    const status = (item.status || '').toLowerCase()
    if (status === 'pengadaan') statusSummary.pengadaan++
    else if (status === 'tunda') statusSummary.tunda++
    else if (status === 'terkirim') statusSummary.terkirim++
    else if (status === 'reject') statusSummary.reject++
    else if (status === 'tersedia') statusSummary.tersedia++
  })
  
  // Update UI with filtered data
  updateStatusKebutuhanUI(statusSummary)
  
  // Update Detail Material Kebutuhan table with filtered data
  renderDetailMaterialTable(filteredData)
  
  console.log('✅ Filtered kebutuhan:', filteredData.length, 'items')
}

// Update Status Kebutuhan UI with filtered data
function updateStatusKebutuhanUI(statusData) {
  const total = statusData.pengadaan + statusData.tunda + statusData.terkirim + statusData.reject + statusData.tersedia
  
  // Update cards
  const cards = {
    'statusTotal': total,
    'statusPengadaan': statusData.pengadaan,
    'statusTunda': statusData.tunda,
    'statusTerkirim': statusData.terkirim,
    'statusReject': statusData.reject,
    'statusTersedia': statusData.tersedia
  }
  
  for (const [id, value] of Object.entries(cards)) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }
  
  console.log('✅ Status Kebutuhan UI updated')
}

// Render Detail Material Kebutuhan table with filtered data
function renderDetailMaterialTable(materials) {
  const tbody = document.getElementById('detailMaterialTable')
  if (!tbody) return
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-gray-400 border">
          <i class="fas fa-inbox text-2xl"></i>
          <p class="mt-2">Tidak ada material yang sesuai dengan filter</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map((item, index) => {
    const nomorLH05 = item.nomor_lh05 || '-'
    const partNumber = item.part_number || '-'
    const material = item.material || '-'
    const mesin = item.mesin || '-'
    const jumlah = item.jumlah || 0
    const lokasiTujuan = item.lokasi_tujuan || '-'
    const status = item.status || 'Pending'
    
    return `
      <tr class="hover:bg-gray-50 border-b">
        <td class="px-4 py-3 border">${index + 1}</td>
        <td class="px-4 py-3 border">
          <a href="#" onclick="viewLH05('${nomorLH05}'); return false;" 
             class="text-blue-600 hover:text-blue-800 hover:underline font-semibold">
            ${nomorLH05}
          </a>
        </td>
        <td class="px-4 py-3 border font-mono">${partNumber}</td>
        <td class="px-4 py-3 border">${material}</td>
        <td class="px-4 py-3 border">${mesin}</td>
        <td class="px-4 py-3 text-center border font-semibold">${jumlah}</td>
        <td class="px-4 py-3 border">${lokasiTujuan}</td>
        <td class="px-4 py-3 border">${lokasiTujuan}</td>
        <td class="px-4 py-3 text-center border">
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}">
            ${status}
          </span>
        </td>
      </tr>
    `
  }).join('')
  
  console.log('✅ Detail Material table rendered with', materials.length, 'items')
}
