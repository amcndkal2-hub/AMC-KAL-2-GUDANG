// Referensi Harga Material - Search and Display
let allMaterials = []
let filteredMaterials = []

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔍 Initializing Ref. Harga page...')
  loadRefHarga()
})

// Load material price reference data
async function loadRefHarga() {
  try {
    console.log('📋 Loading price reference data...')
    
    const response = await fetch('/api/ref-harga')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    allMaterials = data
    filteredMaterials = data
    
    console.log(`✅ Loaded ${allMaterials.length} material price references`)
    
    updateStats()
    renderMaterials()
  } catch (error) {
    console.error('❌ Failed to load ref-harga:', error)
    showError('Gagal memuat data referensi harga: ' + error.message)
  }
}

// Filter materials based on search input
function filterMaterials() {
  const searchInput = document.getElementById('searchInput')
  const searchTerm = searchInput.value.toLowerCase().trim()
  
  if (searchTerm === '') {
    filteredMaterials = allMaterials
  } else {
    filteredMaterials = allMaterials.filter(item => {
      const material = (item.material || '').toLowerCase()
      const partNumber = (item.part_number || '').toLowerCase()
      const mesin = (item.mesin || '').toLowerCase()
      const nomorLH05 = (item.nomor_lh05 || '').toLowerCase()
      const nomorRAB = (item.nomor_rab || '').toLowerCase()
      
      return material.includes(searchTerm) ||
             partNumber.includes(searchTerm) ||
             mesin.includes(searchTerm) ||
             nomorLH05.includes(searchTerm) ||
             nomorRAB.includes(searchTerm)
    })
  }
  
  console.log(`🔍 Search "${searchTerm}": ${filteredMaterials.length} results`)
  
  updateStats()
  renderMaterials()
}

// Update statistics
function updateStats() {
  const totalCount = document.getElementById('totalCount')
  const totalCountBottom = document.getElementById('totalCountBottom')
  const displayCount = document.getElementById('displayCount')
  
  if (totalCount) totalCount.textContent = allMaterials.length
  if (totalCountBottom) totalCountBottom.textContent = allMaterials.length
  if (displayCount) displayCount.textContent = filteredMaterials.length
}

// Render materials table
function renderMaterials() {
  const tbody = document.getElementById('refHargaTable')
  
  if (filteredMaterials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-12 text-center text-gray-500">
          <i class="fas fa-search text-5xl mb-4 text-gray-300"></i>
          <p class="text-lg">Tidak ada data yang sesuai dengan pencarian</p>
          <p class="text-sm mt-2">Coba kata kunci lain atau reset pencarian</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = filteredMaterials.map((item, index) => {
    const hargaSebelumROK = item.harga_sebelum_rok || 0
    const hargaSetelahROK = item.harga_setelah_rok || 0
    const rokPercentage = item.rok_percentage || 0
    
    // Highlight if ROK was applied
    const rokBadge = rokPercentage > 0 
      ? `<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded ml-2">+${rokPercentage}% ROK</span>`
      : ''
    
    return `
      <tr class="hover:bg-blue-50 transition-colors">
        <td class="px-4 py-3 border text-center font-semibold text-gray-700">${index + 1}</td>
        <td class="px-4 py-3 border">
          <span class="font-mono text-sm text-blue-600">${item.nomor_lh05}</span>
        </td>
        <td class="px-4 py-3 border">
          <span class="font-mono text-sm font-semibold text-gray-800">${item.nomor_rab}</span>
          <br>
          <span class="text-xs text-gray-500">${formatDate(item.tanggal)}</span>
          <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-1">${item.jenis_rab}</span>
        </td>
        <td class="px-4 py-3 border">
          <span class="font-mono text-sm font-semibold">${item.part_number}</span>
        </td>
        <td class="px-4 py-3 border">
          <span class="font-medium text-gray-800">${item.material}</span>
        </td>
        <td class="px-4 py-3 border text-sm text-gray-700">
          ${item.mesin}
        </td>
        <td class="px-4 py-3 border text-sm text-gray-700">
          ${item.unit_uld || '-'}
        </td>
        <td class="px-4 py-3 border text-right">
          <span class="font-semibold text-gray-800">${formatRupiah(hargaSebelumROK)}</span>
        </td>
        <td class="px-4 py-3 border text-right">
          <span class="font-bold text-green-700">${formatRupiah(hargaSetelahROK)}</span>
          ${rokBadge}
        </td>
      </tr>
    `
  }).join('')
}

// Format date to Indonesian format
function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const options = { year: 'numeric', month: 'short', day: 'numeric' }
  return date.toLocaleDateString('id-ID', options)
}

// Format number to Rupiah currency
function formatRupiah(amount) {
  if (amount === null || amount === undefined) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Show error message
function showError(message) {
  const tbody = document.getElementById('refHargaTable')
  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="px-4 py-12 text-center">
        <i class="fas fa-exclamation-triangle text-5xl mb-4 text-red-500"></i>
        <p class="text-lg text-red-600 font-semibold">${message}</p>
        <button onclick="loadRefHarga()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
          <i class="fas fa-redo mr-2"></i>Coba Lagi
        </button>
      </td>
    </tr>
  `
}

// Logout function
function logout() {
  if (confirm('Apakah Anda yakin ingin logout?')) {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
}
