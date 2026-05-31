// DATA KHS - Kontrak Harga Satuan
console.log('✅ Data KHS Script Loaded')

let allKHSData = []

// Load KHS data on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing DATA KHS...')
  await loadKHSData()
})

// Load all KHS from API
async function loadKHSData() {
  try {
    console.log('🔄 Loading KHS data from API...')
    
    const response = await fetch('/api/rab', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to load KHS data')
    }
    
    const data = await response.json()
    console.log('📦 Received RAB data:', data)
    console.log('📦 Data structure check:', {
      isArray: Array.isArray(data),
      hasDataProperty: !!data.data,
      dataLength: data.data?.length || data.length || 0,
      firstItem: data.data?.[0] || data[0]
    })
    
    // Filter only KHS (jenis_rab = 'KHS')
    // Try both data.data and direct array
    const allRAB = Array.isArray(data) ? data : (data.data || [])
    allKHSData = allRAB.filter(rab => {
      console.log(`Checking RAB: ${rab.nomor_rab}, jenis_rab: ${rab.jenis_rab}`)
      return rab.jenis_rab === 'KHS'
    })
    
    console.log(`✅ Found ${allKHSData.length} KHS records from ${allRAB.length} total RAB`)
    console.log('KHS Data:', allKHSData)
    
    renderKHSList()
    updateDataInfo()
    
  } catch (error) {
    console.error('❌ Failed to load KHS data:', error)
    document.getElementById('khsListContainer').innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
        <p>Gagal memuat data KHS</p>
        <button onclick="loadKHSData()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <i class="fas fa-refresh mr-2"></i>Coba Lagi
        </button>
      </div>
    `
  }
}

// Render KHS list as cards with scrollable materials table
function renderKHSList() {
  const container = document.getElementById('khsListContainer')
  
  if (allKHSData.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-md p-8 text-center">
        <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-500 text-lg">Belum ada data KHS</p>
        <a href="/dashboard/create-khs" class="mt-4 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <i class="fas fa-plus mr-2"></i>Buat KHS Baru
        </a>
      </div>
    `
    return
  }
  
  // Sort by created_at desc (newest first)
  const sortedKHS = [...allKHSData].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })
  
  container.innerHTML = sortedKHS.map((khs, index) => `
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <!-- KHS Header -->
      <div class="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="text-xl font-bold mb-2">
              <i class="fas fa-file-contract mr-2"></i>
              ${khs.nomor_rab || `KHS-${String(index + 1).padStart(3, '0')}`}
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span class="opacity-80">Tanggal:</span>
                <p class="font-semibold">${formatDate(khs.tanggal_rab)}</p>
              </div>
              <div>
                <span class="opacity-80">Total Item:</span>
                <p class="font-semibold">${khs.item_count || 0} material</p>
              </div>
              <div>
                <span class="opacity-80">Status:</span>
                <p class="font-semibold">
                  <span class="px-2 py-1 rounded text-xs ${getStatusColor(khs.status)}">
                    ${khs.status || 'Draft'}
                  </span>
                </p>
              </div>
              <div>
                <span class="opacity-80">Dibuat:</span>
                <p class="font-semibold">${khs.created_by || '-'}</p>
              </div>
            </div>
          </div>
          <button onclick="toggleKHSDetails(${index})" 
                  class="ml-4 px-4 py-2 bg-white text-green-700 rounded hover:bg-gray-100 transition">
            <i class="fas fa-chevron-down mr-2" id="toggle-icon-${index}"></i>
            <span id="toggle-text-${index}">Lihat Detail</span>
          </button>
        </div>
      </div>
      
      <!-- KHS Details (collapsed by default) -->
      <div id="khs-details-${index}" class="hidden p-4">
        <!-- Materials Table with Fixed Header and Scrollable Body -->
        <div class="mb-4">
          <h4 class="text-lg font-semibold text-gray-800 mb-3">
            <i class="fas fa-boxes text-green-600 mr-2"></i>
            Daftar Material (<span class="text-green-600">${khs.item_count || 0}</span> item)
          </h4>
          
          <!-- Scrollable Table Container -->
          <div class="border border-gray-300 rounded-lg overflow-hidden">
            <!-- Fixed Header -->
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead class="bg-green-600 text-white sticky top-0 z-10">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">No</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">Nomor LH05</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">Part Number</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">Material</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">Mesin</th>
                    <th class="px-4 py-3 text-center text-xs font-semibold uppercase">Jumlah</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">Unit</th>
                  </tr>
                </thead>
              </table>
            </div>
            
            <!-- Scrollable Body (max-height with scroll) -->
            <div class="overflow-y-auto" style="max-height: 400px;">
              <table class="min-w-full">
                <tbody id="materials-${khs.id}" class="bg-white divide-y divide-gray-200">
                  <tr>
                    <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                      <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                      <p>Loading materials...</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-2 justify-end mt-4">
          <button onclick="exportKHSToExcel(${index})" 
                  class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            <i class="fas fa-file-excel mr-2"></i>Export Excel
          </button>
          <button onclick="printKHS(${index})" 
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <i class="fas fa-print mr-2"></i>Print
          </button>
        </div>
      </div>
    </div>
  `).join('')
}

// Toggle KHS details
async function toggleKHSDetails(index) {
  const detailsDiv = document.getElementById(`khs-details-${index}`)
  const icon = document.getElementById(`toggle-icon-${index}`)
  const text = document.getElementById(`toggle-text-${index}`)
  
  if (detailsDiv.classList.contains('hidden')) {
    // Show details
    detailsDiv.classList.remove('hidden')
    icon.classList.remove('fa-chevron-down')
    icon.classList.add('fa-chevron-up')
    text.textContent = 'Sembunyikan'
    
    // Load materials for this KHS
    await loadKHSMaterials(allKHSData[index])
  } else {
    // Hide details
    detailsDiv.classList.add('hidden')
    icon.classList.remove('fa-chevron-up')
    icon.classList.add('fa-chevron-down')
    text.textContent = 'Lihat Detail'
  }
}

// Load materials for specific KHS
async function loadKHSMaterials(khs) {
  try {
    console.log(`🔄 Loading materials for KHS ${khs.nomor_rab}...`)
    
    const response = await fetch(`/api/rab/${khs.id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to load KHS materials')
    }
    
    const data = await response.json()
    console.log('📦 KHS details:', data)
    
    const tbody = document.getElementById(`materials-${khs.id}`)
    const items = data.items || []
    
    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-4 py-8 text-center text-gray-500">
            <i class="fas fa-inbox text-4xl mb-2"></i>
            <p>Tidak ada material</p>
          </td>
        </tr>
      `
      return
    }
    
    tbody.innerHTML = items.map((item, idx) => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm">${idx + 1}</td>
        <td class="px-4 py-3 text-sm font-mono">${item.nomor_lh05 || '-'}</td>
        <td class="px-4 py-3 text-sm font-semibold text-blue-600">${item.part_number || '-'}</td>
        <td class="px-4 py-3 text-sm">${item.material || '-'}</td>
        <td class="px-4 py-3 text-sm">${item.mesin || '-'}</td>
        <td class="px-4 py-3 text-sm text-center font-semibold">${item.jumlah || 0}</td>
        <td class="px-4 py-3 text-sm">${item.unit_uld || '-'}</td>
      </tr>
    `).join('')
    
  } catch (error) {
    console.error('❌ Failed to load materials:', error)
    const tbody = document.getElementById(`materials-${khs.id}`)
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Gagal memuat material</p>
        </td>
      </tr>
    `
  }
}

// Update data info
function updateDataInfo() {
  const info = document.getElementById('dataInfo')
  info.textContent = `Total: ${allKHSData.length} KHS | Terakhir dimuat: ${new Date().toLocaleString('id-ID')}`
}

// Refresh data
async function refreshData() {
  await loadKHSData()
  alert('✅ Data berhasil di-refresh!')
}

// Export all KHS to Excel
function exportToExcel() {
  if (allKHSData.length === 0) {
    alert('❌ Tidak ada data untuk di-export!')
    return
  }
  
  // Prepare data for Excel
  const excelData = allKHSData.map((khs, index) => ({
    'No': index + 1,
    'Nomor KHS': khs.nomor_rab || '-',
    'Tanggal': formatDate(khs.tanggal_rab),
    'Total Item': khs.item_count || 0,
    'Status': khs.status || 'Draft',
    'Dibuat Oleh': khs.created_by || '-',
    'Tanggal Dibuat': new Date(khs.created_at).toLocaleDateString('id-ID')
  }))
  
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data KHS')
  
  // Export file
  const filename = `DATA_KHS_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
  
  console.log(`✅ Exported ${allKHSData.length} KHS to ${filename}`)
}

// Export single KHS to Excel (with materials)
async function exportKHSToExcel(index) {
  const khs = allKHSData[index]
  
  try {
    // Load materials first
    const response = await fetch(`/api/rab/${khs.id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    const data = await response.json()
    const items = data.items || []
    
    // Prepare Excel data
    const excelData = items.map((item, idx) => ({
      'No': idx + 1,
      'Nomor LH05': item.nomor_lh05 || '-',
      'Part Number': item.part_number || '-',
      'Material': item.material || '-',
      'Mesin': item.mesin || '-',
      'Jumlah': item.jumlah || 0,
      'Unit': item.unit_uld || '-'
    }))
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Material KHS')
    
    // Export file
    const filename = `KHS_${khs.nomor_rab || 'DRAFT'}_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
    
    console.log(`✅ Exported KHS ${khs.nomor_rab} to ${filename}`)
    
  } catch (error) {
    console.error('❌ Export failed:', error)
    alert('❌ Gagal export KHS')
  }
}

// Print KHS
function printKHS(index) {
  alert('🖨️ Print KHS feature coming soon!')
}

// Helper: Format date
function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// Helper: Get status color
function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'disetujui':
      return 'bg-green-100 text-green-800'
    case 'pending':
    case 'menunggu':
      return 'bg-yellow-100 text-yellow-800'
    case 'rejected':
    case 'ditolak':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Logout function
function logout() {
  localStorage.removeItem('sessionToken')
  window.location.href = '/login'
}
