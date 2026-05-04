// Dashboard List RAB - AMC Material System
console.log('Dashboard List RAB loaded')

// Detect if we're on Realisasi page
const isListTORPage = window.location.pathname.includes('/list-tor')
console.log('Page detected:', isListTORPage ? 'Realisasi' : 'List RAB')

let allRABList = []
let filteredRABList = []
let currentRABDetail = null
let currentStatusFilter = 'All'
let currentJenisFilter = 'All'
let autoCheckInterval = null
let isDataLoaded = false
let allSPKData = [] // Data SPK from GitHub JSON
let isSPKDataLoaded = false

// MAIN LOADING FUNCTION
async function initializeData() {
  if (isDataLoaded) {
    console.log('⚠️ Data already loaded, skipping...')
    return
  }
  
  console.log('🔄 Initializing List RAB data...')
  
  // Load SPK data first (for Status SCM matching)
  await loadSPKData()
  
  // Then load RAB list
  await loadRABList()
  console.log('✅ RAB list loaded and rendered')
  
  isDataLoaded = true
  
  // Start auto-check every 2 minutes (120000 ms) - only once
  if (!autoCheckInterval) {
    console.log('Starting auto-check timer (2 minutes)...')
    autoCheckInterval = setInterval(async () => {
      console.log('⏱️ Auto-check triggered...')
      await loadRABList() // Re-render RAB list
    }, 120000) // 2 minutes
    console.log('✅ Auto-check timer started')
  }
}

// Initialize on page load - MULTIPLE TRIGGERS
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOMContentLoaded event triggered')
  await initializeData()
})

// FALLBACK: Also load on window load (in case DOM event missed)
window.addEventListener('load', async () => {
  if (!isDataLoaded) {
    console.log('⚠️ Fallback: window.load event triggered')
    await initializeData()
  }
})

// IMMEDIATE LOAD: Execute immediately if DOM is already ready
if (document.readyState === 'loading') {
  console.log('⏳ Document still loading, waiting for DOMContentLoaded...')
} else {
  console.log('✅ Document already loaded, loading data immediately...')
  initializeData()
}

// Auto-check RAB status (Draft → Pengadaan → Tersedia)
async function autoCheckRABStatus() {
  try {
    console.log('🔄 Running auto-check...')
    const response = await fetch('/api/rab/auto-check-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) {
      console.log('Auto-check failed:', response.status)
      return
    }
    
    const result = await response.json()
    console.log('✅ Auto-check result:', result)
    
    // Reload RAB list to show updated statuses
    if (result.updated > 0) {
      console.log(`🔄 ${result.updated} RAB status updated, reloading list...`)
      await loadRABList()
    }
  } catch (error) {
    console.error('Auto-check error:', error)
  }
}

// Load Data SPK from GitHub JSON
async function loadSPKData() {
  if (isSPKDataLoaded) {
    console.log('⚠️ SPK data already loaded, skipping...')
    return
  }
  
  try {
    console.log('🔄 Loading SPK data from GitHub...')
    const response = await fetch('https://raw.githubusercontent.com/ipanrifan-create/DATA-SPK/refs/heads/main/data_scm.json')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const rawData = data['Data Izin Prinsip']
    
    // Parse data (skip first 2 header rows)
    allSPKData = rawData.slice(2).map(row => ({
      nomor_ip: row[1] || '',     // Kolom B (index 1) - Nomor Ijin Prinsip
      keterangan: row[10] || '',  // Kolom K (index 10) - Keterangan
      status: row[11] || '',      // Kolom L (index 11) - Status
      nomor_spk: row[13] || '-'   // Kolom N (index 13) - Nomor SPK
    })).filter(item => item.keterangan && item.status)
    
    console.log(`✅ Loaded ${allSPKData.length} SPK records`)
    console.log('Sample SPK data:', allSPKData.slice(0, 3)) // Log first 3 records
    isSPKDataLoaded = true
  } catch (error) {
    console.error('❌ Failed to load SPK data:', error)
    allSPKData = []
  }
}

// Extract TOR components (3 last digits + year) for matching
function extractTORComponents(torString) {
  if (!torString) return null
  
  // Pattern: 123/TOR/AMC/PLND-UPKAL2/IV/2026 or 0123/TOR/AMC/PLND-UPKAL2/IV/2026
  const regex = /(\d{3,4})\/TOR\/[A-Z0-9\/\-]+\/[IVX]+\/(\d{4})/i
  const match = torString.match(regex)
  
  if (!match) return null
  
  // Get last 3 digits of the first number and the year
  const number = match[1].slice(-3) // "123" or "0123" → "123"
  const year = match[2]              // "2026"
  
  return { number, year }
}

// Match two TOR strings based on last 3 digits + year
function matchTOR(tor1, tor2) {
  const comp1 = extractTORComponents(tor1)
  const comp2 = extractTORComponents(tor2)
  
  if (!comp1 || !comp2) return false
  
  return comp1.number === comp2.number && comp1.year === comp2.year
}

// Get SPK Status by TOR number
function getSPKStatusByTOR(nomorTOR) {
  if (!nomorTOR || allSPKData.length === 0) return '-'
  
  const spkItem = allSPKData.find(item => {
    return matchTOR(nomorTOR, item.keterangan)
  })
  
  return spkItem ? spkItem.status : '-'
}

// Clean Keterangan - Remove TOR number prefix
function cleanKeterangan(keterangan) {
  if (!keterangan) return '-'
  
  // Remove TOR pattern: "0133/TOR/AMC/PLND-UPKAL2/IV/2026 - "
  const regex = /^\d{3,4}\/TOR\/[A-Z0-9\/\-]+\/[IVX]+\/\d{4}\s*-\s*/i
  const cleaned = keterangan.replace(regex, '').trim()
  
  return cleaned || '-'
}

// Get all SPK data by TOR number (for populating columns)
function getSPKDataByTOR(nomorTOR) {
  if (!nomorTOR || allSPKData.length === 0) {
    return {
      nomor_ip: '-',
      nama_pekerjaan: '-',
      nomor_spk: '-',
      status: '-'
    }
  }
  
  const spkItem = allSPKData.find(item => matchTOR(nomorTOR, item.keterangan))
  
  if (!spkItem) {
    return {
      nomor_ip: '-',
      nama_pekerjaan: '-',
      nomor_spk: '-',
      status: '-'
    }
  }
  
  return {
    nomor_ip: spkItem.nomor_ip,
    nama_pekerjaan: cleanKeterangan(spkItem.keterangan),
    nomor_spk: spkItem.nomor_spk,
    status: spkItem.status
  }
}

// Get badge color for SCM Status
function getSCMStatusColor(status) {
  if (!status || status === '-') {
    return 'bg-gray-200 text-gray-700'
  }
  
  const statusLower = status.toLowerCase()
  
  if (statusLower.includes('acc') || statusLower.includes('disetujui')) {
    return 'bg-green-500 text-white'
  }
  if (statusLower.includes('menunggu') || statusLower.includes('pending')) {
    return 'bg-yellow-500 text-white'
  }
  if (statusLower.includes('reject') || statusLower.includes('ditolak')) {
    return 'bg-red-500 text-white'
  }
  
  return 'bg-blue-500 text-white'
}

// Truncate status to first 3 words
function truncateStatus(status) {
  if (!status || status === '-') return status
  
  const words = status.split(' ')
  
  // Take first 3 words only
  if (words.length > 3) {
    return words.slice(0, 3).join(' ')
  }
  
  return status
}

// Add styles for animation
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`
document.head.appendChild(style)

// Load RAB list from API
async function loadRABList() {
  try {
    console.log('Loading RAB list...')
    const response = await fetch('/api/rab', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Loaded RAB data:', data)
    
    allRABList = data
    
    // Re-apply current filters instead of resetting
    applyFilters()
    
    // Update button pills state to match current filter
    updateJenisFilterButtonState()
    
  } catch (error) {
    console.error('Failed to load RAB list:', error)
    showNotification('Gagal memuat daftar RAB', 'error')
  }
}

// Sort RAB by status priority (Draft first, then Pengadaan, Tersedia, Masuk Gudang)
function sortRABByStatus() {
  const statusPriority = {
    'Draft': 1,
    'Pengadaan': 2,
    'Tersedia': 3,
    'Masuk Gudang': 4,
    'Masuk Gudang (Auto)': 4
  }
  
  filteredRABList.sort((a, b) => {
    const priorityA = statusPriority[a.status] || 999
    const priorityB = statusPriority[b.status] || 999
    return priorityA - priorityB
  })
}

// Render RAB list
function renderRABList(rabList) {
  const tableBody = document.getElementById('rabListTable')
  if (!tableBody) {
    console.error('❌ Table body element not found! ID: rabListTable')
    return
  }
  
  console.log(`📊 Rendering ${rabList.length} RAB items`)
  
  if (rabList.length === 0) {
    const totalColumns = isListTORPage ? 10 : 13
    tableBody.innerHTML = `
      <tr>
        <td colspan="${totalColumns}" class="px-6 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p class="text-lg">Tidak ada data ${isListTORPage ? 'realisasi' : 'RAB'}</p>
        </td>
      </tr>
    `
    return
  }
  
  tableBody.innerHTML = rabList.map((rab, index) => {
    const createdDate = rab.created_at ? new Date(rab.created_at).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) : '-'
    
    const createdTime = rab.created_at ? new Date(rab.created_at).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    }) : ''
    
    // Check if current user is admin or AMC@12345
    const currentUser = localStorage.getItem('username') || ''
    const isAdmin = currentUser === 'admin'
    const isAMC = currentUser === 'AMC@12345'
    const isCreator = currentUser === (rab.username || rab.created_by)
    
    // Delete permission: admin OR creator
    const canDelete = isAdmin || isCreator
    
    // ROK Column (only for List RAB, not Realisasi)
    const rokColumn = !isListTORPage ? `
      <td class="px-3 py-2.5 border text-center align-middle">
        ${(() => {
          // Admin: Always editable
          if (isAdmin) {
            return `<input type="number" 
                     value="${rab.rok_percentage || 0}" 
                     min="0" 
                     max="100" 
                     onchange="updateROKPercentage(${rab.id}, this.value)"
                     class="w-20 px-2 py-1 text-xs text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                     /> %`
          }
          // AMC@12345: Editable only if empty (0 or null)
          else if (isAMC) {
            if (!rab.rok_percentage || rab.rok_percentage === 0) {
              return `<input type="number" 
                       value="${rab.rok_percentage || 0}" 
                       min="0" 
                       max="100" 
                       onchange="updateROKPercentage(${rab.id}, this.value)"
                       class="w-20 px-2 py-1 text-xs text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                       /> %`
            } else {
              return `<span class="text-gray-800 text-xs font-semibold">${rab.rok_percentage}%</span>
                      <span class="text-xs text-gray-400 block">(locked)</span>`
            }
          }
          // Other users: Read-only
          else {
            return `<span class="text-gray-700 text-xs font-semibold">${rab.rok_percentage || 0}%</span>`
          }
        })()}
      </td>
    ` : ''
    
    // Tanggal Column (only for Realisasi page)
    const tanggalColumn = isListTORPage ? `
      <td class="px-3 py-2.5 border text-center align-middle">
        <div class="text-xs">
          <div class="font-semibold text-gray-800">${createdDate}</div>
          <div class="text-gray-500">${createdTime}</div>
        </div>
      </td>
    ` : ''
    
    // History button (only for List RAB, not Realisasi)
    const historyButton = !isListTORPage ? `
      <button onclick="viewRABHistory(${rab.id})" 
              class="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs inline-flex items-center whitespace-nowrap" title="History">
        <i class="fas fa-history"></i>
      </button>
    ` : ''
    
    // Get SPK data for this RAB (matching by TOR)
    const spkData = getSPKDataByTOR(rab.nomor_tor)
    
    // Nomor RAB column (skip for Realisasi page)
    const nomorRABColumn = !isListTORPage ? `
      <td class="px-2 py-2 border text-center align-middle" style="position: sticky; left: 280px; background: white; z-index: 10; width: 160px; min-width: 160px; max-width: 160px;">
        <span class="text-blue-600 font-mono text-xs font-semibold">${rab.nomor_rab}</span>
      </td>
    ` : ''
    
    return `
    <tr class="hover:bg-gray-50 transition-colors border-b" style="animation: slideIn 0.3s ease-out ${index * 0.05}s both; height: 48px;">
      <td class="px-2 py-2 border text-center align-middle font-medium text-xs" style="position: sticky; left: 0; background: white; z-index: 10; width: 60px; min-width: 60px; max-width: 60px;">${index + 1}</td>
      <td class="px-2 py-2 border text-left align-middle" style="position: sticky; left: 60px; background: white; z-index: 10; width: 220px; min-width: 220px; max-width: 220px;">
        <span class="text-gray-700 font-mono text-xs">${spkData.nomor_ip}</span>
      </td>
      ${nomorRABColumn}
      <td class="px-2 py-2 border text-center align-middle" style="background: white; width: 280px; min-width: 280px; max-width: 280px;">
        ${(rab.jenis_rab === 'SPK') ? (() => {
          // Admin: Always editable
          if (isAdmin) {
            return `<input type="text" 
                     value="${rab.nomor_tor || ''}" 
                     placeholder="Isi No. TOR"
                     onchange="updateNomorTOR(${rab.id}, this.value)"
                     class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                     />`
          }
          // AMC@12345: Editable only if empty
          else if (isAMC) {
            if (!rab.nomor_tor || rab.nomor_tor === '') {
              return `<input type="text" 
                       value="" 
                       placeholder="Isi No. TOR"
                       onchange="updateNomorTOR(${rab.id}, this.value)"
                       class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                       />`
            } else {
              return `<span class="text-gray-800 text-xs font-mono block">${rab.nomor_tor}</span>`
            }
          }
          // Other users: Read-only
          else {
            return `<span class="text-gray-700 text-xs font-mono">${rab.nomor_tor || '-'}</span>`
          }
        })() : `<span class="text-gray-400 text-xs">-</span>`}
      </td>
      ${!isListTORPage ? `<td class="px-2 py-2 border text-center align-middle" style="background: white; width: 140px; min-width: 140px; max-width: 140px;">
        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getJenisRABColor(rab.jenis_rab)}">
          ${rab.jenis_rab || '-'}
        </span>
      </td>` : ''}
      ${!isListTORPage ? `<td class="px-2 py-2 border text-center align-middle" style="background: white; width: 140px; min-width: 140px; max-width: 140px;">
        <div class="text-xs">
          <div class="font-semibold text-gray-800">${createdDate}</div>
          <div class="text-gray-500">${createdTime}</div>
        </div>
      </td>` : ''}
      <td class="px-2 py-2 border text-center align-middle" style="background: white; width: 120px; min-width: 120px; max-width: 120px;">
        <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
          ${rab.item_count || 0}
        </span>
      </td>
      <td class="px-2 py-2 border text-right align-middle font-semibold text-xs" style="background: white; width: 180px; min-width: 180px; max-width: 180px;">${formatRupiah((rab.total_harga || 0) * 1.11)}</td>
      <td class="px-2 py-2 border text-center align-middle" style="background: white; width: 140px; min-width: 140px; max-width: 140px;">
        <select onchange="updateRABStatus(${rab.id}, this.value)" 
                class="w-full px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${getStatusColorSelect(rab.status)}">
          <option value="Draft" ${rab.status === 'Draft' ? 'selected' : ''}>Draft</option>
          <option value="Pengadaan" ${rab.status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
          <option value="Tersedia" ${rab.status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
          <option value="Masuk Gudang" ${rab.status === 'Masuk Gudang' ? 'selected' : ''} disabled>Masuk Gudang</option>
        </select>
      </td>
      <td class="px-2 py-2 border text-center align-middle" style="background: white; width: 200px; min-width: 200px; max-width: 200px;">
        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getSCMStatusColor(spkData.status)}">
          ${truncateStatus(spkData.status)}
        </span>
      </td>
      <td class="px-2 py-2 border text-left align-middle" style="background: white; width: 400px; min-width: 400px; max-width: 400px;">
        <span class="text-gray-700 text-[10px]">${spkData.nama_pekerjaan}</span>
      </td>
      <td class="px-2 py-2 border text-center align-middle" style="background: white; width: 150px; min-width: 150px; max-width: 150px;">
        <span class="text-gray-700 font-mono text-xs">${spkData.nomor_spk}</span>
      </td>
      <td class="px-2 py-2 border text-center align-middle" style="background: white; width: 120px; min-width: 120px; max-width: 120px;">
        <div class="flex gap-1 justify-center items-center flex-nowrap">
          <button onclick="viewRABDetail(${rab.id})" 
                  class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs inline-flex items-center whitespace-nowrap" title="View">
            <i class="fas fa-eye"></i>
          </button>
          ${historyButton}
          ${canDelete ? `
            <button onclick="deleteRAB(${rab.id}, '${rab.nomor_rab}')" 
                    class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs inline-flex items-center whitespace-nowrap" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `}).join('')
}

// Get status color badge
function getStatusColor(status) {
  switch (status) {
    case 'Draft': return 'bg-gray-100 text-gray-800'
    case 'Pengadaan': return 'bg-yellow-100 text-yellow-800'
    case 'Tersedia': return 'bg-green-100 text-green-800'
    case 'Masuk Gudang': return 'bg-purple-100 text-purple-800'
    case 'Masuk Gudang (Auto)': return 'bg-purple-100 text-purple-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// Get status color for select dropdown
function getStatusColorSelect(status) {
  switch (status) {
    case 'Draft': return 'bg-gray-100 text-gray-800'
    case 'Pengadaan': return 'bg-yellow-100 text-yellow-800'
    case 'Tersedia': return 'bg-green-100 text-green-800'
    case 'Masuk Gudang': return 'bg-purple-100 text-purple-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// Get jenis RAB color
function getJenisRABColor(jenis) {
  switch (jenis) {
    case 'SPK': return 'bg-blue-100 text-blue-800'
    case 'Pembelian Langsung': return 'bg-green-100 text-green-800'
    case 'KHS': return 'bg-purple-100 text-purple-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// Filter by status
function filterByStatus(status) {
  currentStatusFilter = status
  applyFilters()
  
  // Update button styles
  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white')
    btn.classList.add('bg-gray-100', 'text-gray-700')
  })
  
  const activeBtn = document.getElementById(`btn${status.replace(' ', '')}`)
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-100', 'text-gray-700')
    activeBtn.classList.add('bg-blue-600', 'text-white')
  }
}

// Filter by jenis RAB
function filterByJenis(jenis) {
  currentJenisFilter = jenis
  applyFilters()
  
  // Update button styles
  document.querySelectorAll('.jenis-filter-btn').forEach(btn => {
    btn.classList.remove('bg-green-600', 'text-white')
    btn.classList.add('bg-gray-100', 'text-gray-700')
  })
  
  const activeBtn = document.getElementById(`btnJenis${jenis.replace(' ', '')}`)
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-100', 'text-gray-700')
    activeBtn.classList.add('bg-green-600', 'text-white')
  }
}

// Select jenis filter (for button pills)
function selectJenisFilter(jenis) {
  currentJenisFilter = jenis
  
  // Update button styles
  document.querySelectorAll('.jenis-filter-pill').forEach(btn => {
    btn.classList.remove('bg-green-600', 'text-white')
    btn.classList.add('bg-gray-200', 'text-gray-700')
  })
  
  const activeBtn = document.getElementById(`btnJenis${jenis.replace(/ /g, '')}`)
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-200', 'text-gray-700')
    activeBtn.classList.add('bg-green-600', 'text-white')
  }
  
  console.log(`✅ Jenis filter selected: ${jenis}`)
}

// Update button pills state based on current filter
function updateJenisFilterButtonState() {
  // Reset all buttons to gray
  document.querySelectorAll('.jenis-filter-pill').forEach(btn => {
    btn.classList.remove('bg-green-600', 'text-white')
    btn.classList.add('bg-gray-200', 'text-gray-700')
  })
  
  // Set active button based on currentJenisFilter
  const activeBtn = document.getElementById(`btnJenis${currentJenisFilter.replace(/ /g, '')}`)
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-200', 'text-gray-700')
    activeBtn.classList.add('bg-green-600', 'text-white')
  }
  
  console.log(`✅ Button state updated: ${currentJenisFilter}`)
}

// Apply all filters (called by "Terapkan" button)
function applyFilters() {
  // Get values from dropdowns
  const statusDropdown = document.getElementById('filterStatusDropdown')
  
  if (statusDropdown) {
    currentStatusFilter = statusDropdown.value
  }
  
  // currentJenisFilter already set by selectJenisFilter()
  
  // Filter the list
  filteredRABList = allRABList.filter(rab => {
    // Status filter
    const statusMatch = currentStatusFilter === 'All' || rab.status === currentStatusFilter
    
    // Jenis RAB filter
    const jenisMatch = currentJenisFilter === 'All' || rab.jenis_rab === currentJenisFilter
    
    return statusMatch && jenisMatch
  })
  
  sortRABByStatus()
  renderRABList(filteredRABList)
  
  console.log(`✅ Filters applied: Status="${currentStatusFilter}", Jenis="${currentJenisFilter}", Results=${filteredRABList.length}`)
}

// Update RAB status
async function updateRABStatus(rabId, newStatus) {
  try {
    const response = await fetch(`/api/rab/${rabId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ status: newStatus })
    })
    
    if (!response.ok) throw new Error('Failed to update status')
    
    showNotification('Status berhasil diupdate', 'success')
    await loadRABList()
  } catch (error) {
    console.error('Error updating status:', error)
    showNotification('Gagal update status', 'error')
    await loadRABList()
  }
}

// Update Nomor TOR
async function updateNomorTOR(rabId, nomorTOR) {
  try {
    const response = await fetch(`/api/rab/${rabId}/tor`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ nomor_tor: nomorTOR })
    })
    
    if (!response.ok) throw new Error('Failed to update TOR')
    
    showNotification('Nomor TOR berhasil diupdate', 'success')
    await loadRABList()
  } catch (error) {
    console.error('Error updating TOR:', error)
    showNotification('Gagal update Nomor TOR', 'error')
    await loadRABList()
  }
}

// Update ROK percentage
async function updateROKPercentage(rabId, percentage) {
  try {
    const rok = parseFloat(percentage)
    if (isNaN(rok) || rok < 0 || rok > 100) {
      showNotification('ROK harus antara 0-100%', 'error')
      await loadRABList()
      return
    }
    
    const response = await fetch(`/api/rab/${rabId}/rok`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ rok_percentage: rok })
    })
    
    if (!response.ok) throw new Error('Failed to update ROK')
    
    showNotification('ROK berhasil diupdate', 'success')
    await loadRABList()
  } catch (error) {
    console.error('Error updating ROK:', error)
    showNotification('Gagal update ROK', 'error')
    await loadRABList()
  }
}

// View RAB detail
async function viewRABDetail(rabId) {
  try {
    console.log('🔍 View RAB Detail clicked! ID:', rabId)
    const response = await fetch(`/api/rab/${rabId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) throw new Error('Failed to load RAB detail')
    
    const rab = await response.json()
    console.log('✅ RAB data loaded:', rab)
    currentRABDetail = rab
    
    showRABDetailModal(rab)
  } catch (error) {
    console.error('❌ Error loading RAB detail:', error)
    showNotification('Gagal memuat detail RAB', 'error')
  }
}

// Show RAB detail modal
function showRABDetailModal(rab) {
  console.log('📋 Opening RAB detail modal for:', rab.nomor_rab)
  const modal = document.getElementById('rabDetailModal')
  if (!modal) {
    console.error('❌ Modal element not found! ID: rabDetailModal')
    return
  }
  console.log('✅ Modal element found:', modal)
  
  const createdDate = rab.created_at ? new Date(rab.created_at).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-'
  
  document.getElementById('detailNomorRAB').textContent = rab.nomor_rab
  document.getElementById('detailStatus').innerHTML = `<span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(rab.status)}">${rab.status}</span>`
  document.getElementById('detailJenisRAB').innerHTML = `<span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getJenisRABColor(rab.jenis_rab)}">${rab.jenis_rab}</span>`
  document.getElementById('detailNomorTOR').textContent = rab.nomor_tor || '-'
  document.getElementById('detailROK').textContent = `${rab.rok_percentage || 0}%`
  document.getElementById('detailCreated').textContent = createdDate
  document.getElementById('detailUsername').textContent = rab.username || '-'
  
  // Render items table
  const itemsTable = document.getElementById('detailItemsTable')
  if (rab.items && rab.items.length > 0) {
    console.log('📦 RAB Items data:', rab.items)
    console.log('📦 First item structure:', rab.items[0])
    console.log('📦 Item keys:', Object.keys(rab.items[0]))
    
    itemsTable.innerHTML = rab.items.map((item, index) => {
      // Try ALL possible field name variations
      const namaMaterial = item.nama_material || item.material_name || item.name || item.material || 'undefined'
      const qty = item.qty || item.quantity || item.jumlah || 0
      const hargaSatuan = item.harga_satuan || item.unit_price || item.price || 0
      
      // Existing fields
      const noLH05 = item.no_lh05 || item.nomor_lh05 || item.lh05_number || item.lh05 || '-'
      const partNumber = item.part_number || item.partNumber || item.part_no || '-'
      const snMesin = item.sn_mesin || item.snMesin || item.serial_number || '-'
      
      // Type Mesin and Unit/ULD
      const typeMesin = item.mesin || item.type_mesin || item.tipe_mesin || item.mesin_type || '-'
      const unitULD = item.unit_uld || item.unitULD || item.lokasi_gangguan || item.lokasi_tujuan || '-'
      
      const total = qty * hargaSatuan
      
      // NEW: Calculate for REALISASI page only
      const rokPercentage = rab.rok_percentage || 0
      // Tanpa ROK = Harga Satuan / (1 + ROK%)
      const tanpaROK = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
      // Total tanpa ROK = Tanpa ROK × Qty
      const totalTanpaROK = tanpaROK * qty
      const realisasi = item.realisasi || 0
      const totalRealisasi = realisasi * qty
      
      console.log(`Item ${index + 1}:`, {
        nama: namaMaterial,
        qty: qty,
        harga: hargaSatuan,
        no_lh05: noLH05,
        part_number: partNumber,
        sn_mesin: snMesin,
        type_mesin: typeMesin,
        unit_uld: unitULD,
        total: total,
        tanpaROK: tanpaROK,
        realisasi: realisasi
      })
      
      // Conditionally show 5 new columns only for REALISASI page
      const itemId = item.id || item.item_id || index
      console.log('🔍 Item ID Debug:', { 
        'item.id': item.id, 
        'item.item_id': item.item_id, 
        'index': index,
        'final itemId': itemId,
        'item keys': Object.keys(item)
      })
      
      // Calculate Saldo = Total tanpa ROK - Total Realisasi
      const saldo = totalTanpaROK - totalRealisasi
      
      const realisasiColumns = isListTORPage ? `
        <td class="px-2 py-2 text-right text-xs">${formatRupiah(tanpaROK)}</td>
        <td class="px-2 py-2 text-right text-xs">${formatRupiah(totalTanpaROK)}</td>
        <td class="px-2 py-2 text-center text-xs">
          <input type="number" 
                 value="${realisasi}" 
                 data-item-id="${itemId}"
                 data-rab-id="${rab.id}"
                 onchange="updateRealisasi(${rab.id}, ${itemId}, this.value)"
                 class="w-full px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                 placeholder="0" />
        </td>
        <td class="px-2 py-2 text-right text-xs font-semibold">${formatRupiah(totalRealisasi)}</td>
        <td class="px-2 py-2 text-right text-xs font-semibold ${saldo < 0 ? 'text-red-600' : 'text-green-600'}">${formatRupiah(saldo)}</td>
      ` : ''
      
      return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-2 py-2 text-center text-xs">${index + 1}</td>
        <td class="px-2 py-2 text-xs">${namaMaterial}</td>
        <td class="px-2 py-2 text-center text-xs">${noLH05}</td>
        <td class="px-2 py-2 text-center text-xs">${partNumber}</td>
        <td class="px-2 py-2 text-center text-xs">${typeMesin}</td>
        <td class="px-2 py-2 text-center text-xs">${snMesin}</td>
        <td class="px-2 py-2 text-center text-xs">${unitULD}</td>
        <td class="px-2 py-2 text-center text-xs">${qty}</td>
        <td class="px-2 py-2 text-right text-xs">${formatRupiah(hargaSatuan)}</td>
        <td class="px-2 py-2 text-right text-xs font-semibold">${formatRupiah(total)}</td>
        ${realisasiColumns}
      </tr>
      `
    }).join('')
    
    // Calculate summary totals for REALISASI page
    if (isListTORPage && rab.items && rab.items.length > 0) {
      const rokPercentage = rab.rok_percentage || 0
      
      // Calculate subtotals for Total, Total tanpa ROK, and Total Realisasi
      let subtotalTotal = 0
      let subtotalTanpaROK = 0
      let subtotalRealisasi = 0
      
      rab.items.forEach(item => {
        const qty = item.qty || item.quantity || item.jumlah || 0
        const hargaSatuan = item.harga_satuan || item.unit_price || item.price || 0
        const total = qty * hargaSatuan
        // Tanpa ROK = Harga Satuan / (1 + ROK%), then × Qty
        const tanpaROKPerItem = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
        const totalTanpaROK = tanpaROKPerItem * qty
        const realisasi = item.realisasi || 0
        
        subtotalTotal += total
        subtotalTanpaROK += totalTanpaROK
        subtotalRealisasi += (realisasi * qty)
      })
      
      // Calculate PPN 11% ONLY for Total column
      const ppnTotal = subtotalTotal * 0.11
      
      // Calculate Total + PPN ONLY for Total column
      const grandTotalTotal = subtotalTotal + ppnTotal
      
      // Calculate Saldo Subtotal = Subtotal Total tanpa ROK - Subtotal Total Realisasi
      const saldoSubtotal = subtotalTanpaROK - subtotalRealisasi
      
      // Add summary rows
      // Row 1: Subtotal (for Total, Total tanpa ROK, Total Realisasi, and Saldo)
      itemsTable.innerHTML += `
        <tr class="bg-gray-100 font-semibold border-t-2 border-gray-400">
          <td colspan="9" class="px-2 py-2 text-right text-xs">Subtotal:</td>
          <td class="px-2 py-2 text-right text-xs">${formatRupiah(subtotalTotal)}</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">${formatRupiah(subtotalTanpaROK)}</td>
          <td class="px-2 py-2 text-center text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">${formatRupiah(subtotalRealisasi)}</td>
          <td class="px-2 py-2 text-right text-xs font-semibold ${saldoSubtotal < 0 ? 'text-red-600' : 'text-green-600'}">${formatRupiah(saldoSubtotal)}</td>
        </tr>
        <tr class="bg-gray-100 font-semibold">
          <td colspan="9" class="px-2 py-2 text-right text-xs">PPN 11%:</td>
          <td class="px-2 py-2 text-right text-xs">${formatRupiah(ppnTotal)}</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-center text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
        </tr>
        <tr class="bg-blue-100 font-bold border-t-2 border-blue-400">
          <td colspan="9" class="px-2 py-2 text-right text-xs">Total + PPN:</td>
          <td class="px-2 py-2 text-right text-xs text-blue-600">${formatRupiah(grandTotalTotal)}</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-center text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
        </tr>
      `
    }
  } else {
    const colspanCount = isListTORPage ? 14 : 10
    itemsTable.innerHTML = `<tr><td colspan="${colspanCount}" class="px-4 py-8 text-center text-gray-500 text-xs">Tidak ada item</td></tr>`
  }
  
  // Calculate totals (keep this for LIST RAB page, but hide for REALISASI)
  const subtotal = rab.total_harga || 0
  const ppn = subtotal * 0.11
  const total = subtotal + ppn
  
  // Hide summary below table for REALISASI page
  if (isListTORPage) {
    // Hide the summary section
    const summarySection = document.querySelector('.mt-4.text-right')
    if (summarySection) {
      summarySection.style.display = 'none'
    }
  } else {
    // Show for LIST RAB
    document.getElementById('detailSubtotal').textContent = formatRupiah(subtotal)
    document.getElementById('detailPPN').textContent = formatRupiah(ppn)
    document.getElementById('detailTotal').textContent = formatRupiah(total)
  }
  
  modal.classList.remove('hidden')
}

// Close RAB detail modal
function closeRABDetailModal() {
  const modal = document.getElementById('rabDetailModal')
  if (modal) {
    modal.classList.add('hidden')
  }
}

// Update Realisasi value (for REALISASI page only)
async function updateRealisasi(rabId, itemId, value) {
  try {
    console.log('💰 Update Realisasi - RAW INPUT:', { rabId, itemId, value, valueType: typeof value })
    
    // Validate itemId
    if (!itemId || itemId === 0 || isNaN(itemId)) {
      console.error('❌ Invalid itemId:', itemId)
      showNotification('Error: Item ID tidak valid', 'error')
      return
    }
    
    // Convert value to number and validate
    const realisasiValue = parseFloat(value)
    console.log('💰 Converted realisasi value:', { realisasiValue, isNaN: isNaN(realisasiValue) })
    
    if (isNaN(realisasiValue) || realisasiValue < 0) {
      console.error('❌ Invalid realisasi value:', { value, realisasiValue })
      showNotification('Error: Nilai realisasi tidak valid. Harus berupa angka positif.', 'error')
      return
    }
    
    const requestBody = { realisasi: realisasiValue }
    console.log('💰 Request body:', requestBody)
    
    const response = await fetch(`/api/rab/${rabId}/item/${itemId}/realisasi`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify(requestBody)
    })
    
    console.log('💰 Response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ API Error Response:', errorData)
      throw new Error(errorData.error || 'Failed to update realisasi')
    }
    
    const result = await response.json()
    console.log('✅ Realisasi updated successfully:', result)
    
    showNotification('Realisasi berhasil diupdate', 'success')
    // Reload modal to show updated totals
    await viewRABDetail(rabId)
  } catch (error) {
    console.error('❌ Error updating realisasi:', error)
    showNotification(`Gagal update realisasi: ${error.message}`, 'error')
  }
}

// View RAB history
async function viewRABHistory(rabId) {
  try {
    console.log('🕒 View RAB History clicked! ID:', rabId)
    const response = await fetch(`/api/rab/${rabId}/history`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) throw new Error('Failed to load history')
    
    const history = await response.json()
    console.log('✅ History data loaded:', history)
    showRABHistoryModal(history)
  } catch (error) {
    console.error('❌ Error loading history:', error)
    showNotification('Gagal memuat history', 'error')
  }
}

// Show RAB history modal
function showRABHistoryModal(history) {
  console.log('📜 Opening RAB history modal')
  const modal = document.getElementById('rabHistoryModal')
  if (!modal) {
    console.error('❌ History modal not found! ID: rabHistoryModal')
    return
  }
  console.log('✅ History modal found:', modal)
  
  const rab = history.rab
  const statusHistory = history.history || []
  
  document.getElementById('historyNomorRAB').textContent = rab.nomor_rab
  
  // Render timeline
  const timeline = document.getElementById('historyTimeline')
  timeline.innerHTML = buildHistoryTimeline(rab, statusHistory)
  
  modal.classList.remove('hidden')
}

// Build history timeline
function buildHistoryTimeline(rab, statusHistory) {
  const steps = []
  
  // Always show "Masuk Gudang" entry based on tanggal_masuk_gudang
  steps.push({
    status: 'Masuk Gudang',
    date: rab.tanggal_masuk_gudang || null,
    icon: 'fa-box',
    color: 'purple',
    description: 'Material masuk gudang',
    completed: !!rab.tanggal_masuk_gudang
  })
  
  // If no tanggal_masuk_gudang, build normal flow
  if (!rab.tanggal_masuk_gudang) {
    // Draft
    steps.push({
      status: 'Draft',
      date: rab.created_at,
      icon: 'fa-file-alt',
      color: 'blue',
      description: 'RAB dibuat',
      completed: true
    })
    
    // Determine which steps are completed based on current status
    const statusOrder = ['Draft', 'Pengadaan', 'Tersedia', 'Masuk Gudang']
    const currentIndex = statusOrder.indexOf(rab.status)
    
    // Pengadaan
    steps.push({
      status: 'Pengadaan',
      date: currentIndex >= 1 ? rab.updated_at : null,
      icon: 'fa-shopping-cart',
      color: 'yellow',
      description: 'Proses pengadaan',
      completed: currentIndex >= 1
    })
    
    // Tersedia
    steps.push({
      status: 'Tersedia',
      date: currentIndex >= 2 ? rab.updated_at : null,
      icon: 'fa-check-circle',
      color: 'green',
      description: 'Material tersedia',
      completed: currentIndex >= 2
    })
    
    // Masuk Gudang
    steps.push({
      status: 'Masuk Gudang',
      date: currentIndex >= 3 ? rab.updated_at : null,
      icon: 'fa-box',
      color: 'purple',
      description: 'Material masuk gudang',
      completed: currentIndex >= 3
    })
  }
  
  return steps.map((step, index) => `
    <div class="flex items-start gap-4 ${index < steps.length - 1 ? 'pb-8' : ''}">
      <div class="flex flex-col items-center">
        <div class="w-10 h-10 rounded-full flex items-center justify-center ${step.completed ? `bg-${step.color}-100` : 'bg-gray-100'}">
          <i class="fas ${step.icon} ${step.completed ? `text-${step.color}-600` : 'text-gray-400'}"></i>
        </div>
        ${index < steps.length - 1 ? `<div class="w-0.5 h-full ${step.completed ? `bg-${step.color}-300` : 'bg-gray-300'} mt-2"></div>` : ''}
      </div>
      <div class="flex-1 ${index < steps.length - 1 ? 'pb-4' : ''}">
        <div class="font-semibold text-gray-800">${step.status}</div>
        <div class="text-sm text-gray-600">${step.description}</div>
        <div class="text-xs text-gray-500 mt-1">
          ${step.date ? new Date(step.date).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : '-'}
        </div>
      </div>
    </div>
  `).join('')
}

// Close history modal
function closeRABHistoryModal() {
  const modal = document.getElementById('rabHistoryModal')
  if (modal) {
    modal.classList.add('hidden')
  }
}

// Export RAB Detail to Excel
function exportRABDetailToExcel() {
  if (!currentRABDetail) {
    showNotification('Tidak ada data RAB untuk di-export', 'error')
    return
  }
  
  try {
    const rab = currentRABDetail
    const items = rab.items || []
    const rokPercentage = rab.rok_percentage || 0
    
    // Prepare data for Excel with 15 columns (matching REALISASI view)
    const excelData = items.map((item, index) => {
      const qty = item.qty || item.quantity || item.jumlah || 0
      const hargaSatuan = item.harga_satuan || item.unit_price || item.price || 0
      const total = qty * hargaSatuan
      
      // Calculate Tanpa ROK columns
      const tanpaROK = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
      const totalTanpaROK = tanpaROK * qty
      
      // Realisasi columns
      const realisasi = item.realisasi || 0
      const totalRealisasi = realisasi * qty
      
      // Saldo = Total tanpa ROK - Total Realisasi
      const saldo = totalTanpaROK - totalRealisasi
      
      return {
        'No': index + 1,
        'Nama Material': item.nama_material || item.material_name || item.name || '-',
        'No. LH05': item.no_lh05 || item.nomor_lh05 || '-',
        'Part Number': item.part_number || item.partNumber || '-',
        'Type Mesin': item.mesin || item.type_mesin || '-',
        'S/N Mesin': item.sn_mesin || item.snMesin || '-',
        'Unit/ULD': item.unit_uld || item.unitULD || item.lokasi_gangguan || '-',
        'Qty': qty,
        'Harga Satuan': hargaSatuan,
        'Total': total,
        'Tanpa ROK': tanpaROK,
        'Total tanpa ROK': totalTanpaROK,
        'Realisasi': realisasi,
        'Total Realisasi': totalRealisasi,
        'Saldo': saldo
      }
    })
    
    // Calculate summary totals
    let subtotalTotal = 0
    let subtotalTanpaROK = 0
    let subtotalRealisasi = 0
    
    items.forEach(item => {
      const qty = item.qty || item.quantity || item.jumlah || 0
      const hargaSatuan = item.harga_satuan || item.unit_price || item.price || 0
      const tanpaROKPerItem = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
      const realisasi = item.realisasi || 0
      
      subtotalTotal += (qty * hargaSatuan)
      subtotalTanpaROK += (tanpaROKPerItem * qty)
      subtotalRealisasi += (realisasi * qty)
    })
    
    const ppn = subtotalTotal * 0.11
    const totalWithPPN = subtotalTotal + ppn
    const saldoSubtotal = subtotalTanpaROK - subtotalRealisasi
    
    // Add summary rows
    excelData.push({})
    excelData.push({
      'No': '',
      'Nama Material': '',
      'No. LH05': '',
      'Part Number': '',
      'Type Mesin': '',
      'S/N Mesin': '',
      'Unit/ULD': '',
      'Qty': '',
      'Harga Satuan': 'Subtotal:',
      'Total': subtotalTotal,
      'Tanpa ROK': '-',
      'Total tanpa ROK': subtotalTanpaROK,
      'Realisasi': '-',
      'Total Realisasi': subtotalRealisasi,
      'Saldo': saldoSubtotal
    })
    excelData.push({
      'No': '',
      'Nama Material': '',
      'No. LH05': '',
      'Part Number': '',
      'Type Mesin': '',
      'S/N Mesin': '',
      'Unit/ULD': '',
      'Qty': '',
      'Harga Satuan': 'PPN 11%:',
      'Total': ppn,
      'Tanpa ROK': '-',
      'Total tanpa ROK': '-',
      'Realisasi': '-',
      'Total Realisasi': '-',
      'Saldo': '-'
    })
    excelData.push({
      'No': '',
      'Nama Material': '',
      'No. LH05': '',
      'Part Number': '',
      'Type Mesin': '',
      'S/N Mesin': '',
      'Unit/ULD': '',
      'Qty': '',
      'Harga Satuan': 'Total + PPN:',
      'Total': totalWithPPN,
      'Tanpa ROK': '-',
      'Total tanpa ROK': '-',
      'Realisasi': '-',
      'Total Realisasi': '-',
      'Saldo': '-'
    })
    
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Detail ${rab.nomor_rab}`)
    
    const date = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Detail_RAB_${rab.nomor_rab}_${date}.xlsx`)
    
    showNotification('Excel berhasil diunduh', 'success')
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    showNotification('Gagal export ke Excel', 'error')
  }
}

// Export RAB Detail to PDF
function exportRABDetailToPDF() {
  if (!currentRABDetail) {
    showNotification('Tidak ada data RAB untuk di-export', 'error')
    return
  }
  
  try {
    // Check if jsPDF is loaded
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('❌ jsPDF library not loaded!')
      showNotification('Library PDF belum dimuat. Silakan refresh halaman.', 'error')
      return
    }

    const rab = currentRABDetail
    const items = rab.items || []
    const rokPercentage = rab.rok_percentage || 0
    
    // Use landscape orientation for more columns
    const { jsPDF } = window.jspdf
    const doc = new jsPDF('l', 'mm', 'a4')
    
    // Title
    doc.setFontSize(16)
    doc.text(`Detail RAB: ${rab.nomor_rab}`, 14, 15)
    
    // RAB Info
    doc.setFontSize(10)
    doc.text(`Status: ${rab.status}`, 14, 25)
    doc.text(`Jenis RAB: ${rab.jenis_rab}`, 14, 30)
    doc.text(`Nomor TOR: ${rab.nomor_tor || '-'}`, 14, 35)
    doc.text(`ROK: ${rokPercentage}%`, 14, 40)
    
    const createdDate = rab.created_at ? new Date(rab.created_at).toLocaleDateString('id-ID') : '-'
    doc.text(`Tanggal Dibuat: ${createdDate}`, 14, 45)
    doc.text(`Dibuat Oleh: ${rab.username || '-'}`, 14, 50)
    
    // Table data with 15 columns (for REALISASI page)
    const tableData = items.map((item, index) => {
      const qty = item.qty || item.quantity || item.jumlah || 0
      const hargaSatuan = item.harga_satuan || item.unit_price || item.price || 0
      const total = qty * hargaSatuan
      
      // Calculate Tanpa ROK columns
      const tanpaROK = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
      const totalTanpaROK = tanpaROK * qty
      
      // Realisasi columns
      const realisasi = item.realisasi || 0
      const totalRealisasi = realisasi * qty
      
      // Saldo = Total tanpa ROK - Total Realisasi
      const saldo = totalTanpaROK - totalRealisasi
      
      return [
        index + 1,
        item.nama_material || item.material_name || '-',
        item.no_lh05 || '-',
        item.part_number || '-',
        item.mesin || '-',
        item.sn_mesin || '-',
        item.unit_uld || '-',
        qty,
        'Rp ' + hargaSatuan.toLocaleString('id-ID'),
        'Rp ' + total.toLocaleString('id-ID'),
        'Rp ' + tanpaROK.toLocaleString('id-ID'),
        'Rp ' + totalTanpaROK.toLocaleString('id-ID'),
        realisasi > 0 ? 'Rp ' + realisasi.toLocaleString('id-ID') : '-',
        totalRealisasi > 0 ? 'Rp ' + totalRealisasi.toLocaleString('id-ID') : 'Rp 0',
        'Rp ' + saldo.toLocaleString('id-ID')
      ]
    })
    
    // Calculate summary totals
    let subtotalTotal = 0
    let subtotalTanpaROK = 0
    let subtotalRealisasi = 0
    
    items.forEach(item => {
      const qty = item.qty || item.quantity || item.jumlah || 0
      const hargaSatuan = item.harga_satuan || item.unit_price || item.price || 0
      const total = qty * hargaSatuan
      const tanpaROKPerItem = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
      const totalTanpaROK = tanpaROKPerItem * qty
      const realisasi = item.realisasi || 0
      
      subtotalTotal += total
      subtotalTanpaROK += totalTanpaROK
      subtotalRealisasi += (realisasi * qty)
    })
    
    const ppnTotal = subtotalTotal * 0.11
    const grandTotalTotal = subtotalTotal + ppnTotal
    const saldoSubtotal = subtotalTanpaROK - subtotalRealisasi
    
    // Add summary rows
    tableData.push([
      '', '', '', '', '', '', '', '', 
      'Subtotal:', 
      'Rp ' + subtotalTotal.toLocaleString('id-ID'),
      '-',
      'Rp ' + subtotalTanpaROK.toLocaleString('id-ID'),
      '-',
      'Rp ' + subtotalRealisasi.toLocaleString('id-ID'),
      'Rp ' + saldoSubtotal.toLocaleString('id-ID')
    ])
    tableData.push([
      '', '', '', '', '', '', '', '', 
      'PPN 11%:', 
      'Rp ' + ppnTotal.toLocaleString('id-ID'),
      '-', '-', '-', '-', '-'
    ])
    tableData.push([
      '', '', '', '', '', '', '', '', 
      'Total + PPN:', 
      'Rp ' + grandTotalTotal.toLocaleString('id-ID'),
      '-', '-', '-', '-', '-'
    ])
    
    doc.autoTable({
      startY: 60,
      head: [[
        'No', 'Nama Material', 'No. LH05', 'Part Number', 
        'Type Mesin', 'S/N Mesin', 'Unit/ULD', 'Qty', 
        'Harga Satuan', 'Total', 'Tanpa ROK', 'Total tanpa ROK', 
        'Realisasi', 'Total Realisasi', 'Saldo'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },   // No
        1: { cellWidth: 28 },                     // Nama Material
        2: { cellWidth: 14, halign: 'center' },   // No. LH05
        3: { cellWidth: 14, halign: 'center' },   // Part Number
        4: { cellWidth: 14, halign: 'center' },   // Type Mesin
        5: { cellWidth: 14, halign: 'center' },   // S/N Mesin
        6: { cellWidth: 14, halign: 'center' },   // Unit/ULD
        7: { cellWidth: 10, halign: 'center' },   // Qty
        8: { cellWidth: 18, halign: 'right' },    // Harga Satuan
        9: { cellWidth: 20, halign: 'right' },    // Total
        10: { cellWidth: 18, halign: 'right' },   // Tanpa ROK
        11: { cellWidth: 20, halign: 'right' },   // Total tanpa ROK
        12: { cellWidth: 18, halign: 'right' },   // Realisasi
        13: { cellWidth: 20, halign: 'right' },   // Total Realisasi
        14: { cellWidth: 20, halign: 'right' }    // Saldo
      }
    })
    
    const date = new Date().toISOString().split('T')[0]
    doc.save(`Detail_RAB_${rab.nomor_rab}_${date}.pdf`)
    
    showNotification('PDF berhasil diunduh', 'success')
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    showNotification('Gagal export ke PDF', 'error')
  }
}

// Delete RAB
async function deleteRAB(rabId, nomorRAB) {
  if (!confirm(`Hapus RAB ${nomorRAB}?`)) return
  
  try {
    const response = await fetch(`/api/rab/${rabId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) throw new Error('Failed to delete')
    
    showNotification('RAB berhasil dihapus', 'success')
    await loadRABList()
  } catch (error) {
    console.error('Error deleting RAB:', error)
    showNotification('Gagal menghapus RAB', 'error')
  }
}

// Export to Excel
function exportToExcel() {
  try {
    const data = filteredRABList.map((rab, index) => ({
      'No': index + 1,
      'Nomor RAB': rab.nomor_rab,
      'Status': rab.status,
      'ROK %': rab.rok_percentage || 0,
      'No. TOR': rab.nomor_tor || '-',
      'Jenis RAB': rab.jenis_rab,
      'Item': rab.item_count || 0,
      'Total (+ PPN 11%)': (rab.total_harga || 0) * 1.11,
      'Dibuat': rab.created_at ? new Date(rab.created_at).toLocaleDateString('id-ID') : '-',
      'User': rab.username || rab.created_by || '-'
    }))
    
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'List RAB')
    
    const fileName = `List_RAB_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    
    showNotification('Excel berhasil di-export', 'success')
  } catch (error) {
    console.error('Error exporting Excel:', error)
    showNotification('Gagal export Excel', 'error')
  }
}

// Export RAB Detail to Excel
// Fungsi exportRABDetailToExcel yang lama sudah dihapus - menggunakan versi baru dengan 14 kolom di atas

// Export RAB Detail to PDF
// Fungsi exportRABDetailToPDF yang lama sudah dihapus - menggunakan versi baru dengan 14 kolom di atas

// Export List RAB to PDF
function exportListRABToPDF() {
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF('l', 'mm', 'a4')
    
    doc.setFontSize(16)
    doc.text('Daftar RAB - Rencana Anggaran Biaya', 14, 15)
    
    doc.setFontSize(10)
    doc.text(`Total: ${filteredRABList.length} RAB`, 14, 22)
    doc.text(`Export: ${new Date().toLocaleString('id-ID')}`, 14, 27)
    
    const tableData = filteredRABList.map((rab, index) => [
      index + 1,
      rab.nomor_rab,
      rab.status,
      `${rab.rok_percentage || 0}%`,
      rab.nomor_tor || '-',
      rab.jenis_rab,
      rab.item_count || 0,
      formatRupiah((rab.total_harga || 0) * 1.11)
    ])
    
    doc.autoTable({
      startY: 32,
      head: [['No', 'Nomor RAB', 'Status', 'ROK', 'No. TOR', 'Jenis', 'Item', 'Total + PPN']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    })
    
    const fileName = `List_RAB_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    
    showNotification('PDF berhasil di-export', 'success')
  } catch (error) {
    console.error('Error exporting PDF:', error)
    showNotification('Gagal export PDF', 'error')
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer')
  if (!container) return
  
  const notification = document.createElement('div')
  notification.className = `notification ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white px-6 py-3 rounded-lg shadow-lg`
  notification.textContent = message
  
  container.appendChild(notification)
  
  setTimeout(() => {
    notification.remove()
  }, 3000)
}

// Format rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

// Logout
function logout() {
  localStorage.removeItem('sessionToken')
  localStorage.removeItem('username')
  window.location.href = '/'
}
