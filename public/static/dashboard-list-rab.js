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
  
  // Load RAB list immediately (don't wait for SPK data)
  await loadRABList()
  console.log('✅ RAB list loaded and rendered')
  
  // Load SPK data in background (for Status SCM matching)
  loadSPKData().then(() => {
    console.log('✅ SPK data loaded, re-rendering to show Status SCM...')
    renderRABList(filteredRABList) // Re-render to show Status SCM column
  }).catch(err => {
    console.error('SPK data load failed:', err)
  })
  
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
    
    // Check if current user is admin or AMC@12345 or Andalcekatan
    const currentUser = localStorage.getItem('username') || ''
    const isAdmin = currentUser === 'admin'
    const isAMC = currentUser === 'AMC@12345'
    const isAndalcekatan = currentUser === 'Andalcekatan'
    const isCreator = currentUser === (rab.username || rab.created_by)
    
    // Delete permission: admin OR creator OR Andalcekatan
    const canDelete = isAdmin || isCreator || isAndalcekatan
    
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
          // AMC@12345: Editable only if empty or null
          else if (isAMC) {
            if (!rab.nomor_tor || rab.nomor_tor === '') {
              return `<input type="text" 
                       value="" 
                       placeholder="Isi No. TOR"
                       onchange="updateNomorTOR(${rab.id}, this.value)"
                       class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                       />`
            } else {
              return `<span class="text-gray-800 text-xs font-mono block">${rab.nomor_tor}</span>
                      <span class="text-gray-400 text-xs italic">(locked)</span>`
            }
          }
          // Andalcekatan: Always editable (can edit existing values)
          else if (isAndalcekatan) {
            return `<input type="text" 
                     value="${rab.nomor_tor || ''}" 
                     placeholder="Isi No. TOR"
                     onchange="updateNomorTOR(${rab.id}, this.value)"
                     class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                     />`
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
      <td class="px-2 py-2 border text-right align-middle font-semibold text-xs" style="background: white; width: 180px; min-width: 180px; max-width: 180px;">
        ${(() => {
          const subtotal = rab.total_harga || 0
          // PPN logic: Add 11% unless "Pembelian Langsung" with 0% ROK
          const usePPN = !(rab.jenis_rab === 'Pembelian Langsung' && (!rab.rok_percentage || rab.rok_percentage === 0))
          const totalWithPPN = usePPN ? Math.round(subtotal * 1.11) : subtotal
          return formatRupiah(totalWithPPN)
        })()}
      </td>
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
  
  // Get search input values (for Realisasi page)
  const filterTORInput = document.getElementById('filterTORInput')
  const filterIPInput = document.getElementById('filterIPInput')
  const filterNamaPekerjaanInput = document.getElementById('filterNamaPekerjaanInput')
  const filterJenisHidden = document.getElementById('filterJenisHidden')
  
  const searchTOR = filterTORInput ? filterTORInput.value.toLowerCase().trim() : ''
  const searchIP = filterIPInput ? filterIPInput.value.toLowerCase().trim() : ''
  const searchNamaPekerjaan = filterNamaPekerjaanInput ? filterNamaPekerjaanInput.value.toLowerCase().trim() : ''
  
  // If hidden filter exists (Realisasi page), use it
  if (filterJenisHidden) {
    currentJenisFilter = filterJenisHidden.value
  }
  
  // Filter the list
  filteredRABList = allRABList.filter(rab => {
    // Status filter
    const statusMatch = currentStatusFilter === 'All' || rab.status === currentStatusFilter
    
    // Jenis RAB filter
    const jenisMatch = currentJenisFilter === 'All' || rab.jenis_rab === currentJenisFilter
    
    // TOR search filter (if input exists and has value)
    const torMatch = !searchTOR || (rab.nomor_tor && rab.nomor_tor.toLowerCase().includes(searchTOR))
    
    // Ijin Prinsip search filter - match first 4 characters
    let ipMatch = true
    if (searchIP && rab.nomor_ip) {
      const nomorIPLower = rab.nomor_ip.toLowerCase()
      const searchIPPrefix = searchIP.substring(0, 4) // Take first 4 chars from search input
      // Check if nomor_ip starts with the search prefix
      ipMatch = nomorIPLower.startsWith(searchIPPrefix)
    } else if (searchIP) {
      ipMatch = false // If search input exists but nomor_ip is null/empty, no match
    }
    
    // Nama Pekerjaan search filter - match any word in the job name
    let namaPekerjaanMatch = true
    if (searchNamaPekerjaan && rab.nama_pekerjaan) {
      const namaPekerjaanLower = rab.nama_pekerjaan.toLowerCase()
      const searchWords = searchNamaPekerjaan.split(/\s+/).filter(w => w.length > 0) // Split by spaces
      
      // Match if ANY search word is found in nama_pekerjaan
      namaPekerjaanMatch = searchWords.some(word => namaPekerjaanLower.includes(word))
    } else if (searchNamaPekerjaan) {
      namaPekerjaanMatch = false // If search input exists but nama_pekerjaan is null/empty, no match
    }
    
    return statusMatch && jenisMatch && torMatch && ipMatch && namaPekerjaanMatch
  })
  
  sortRABByStatus()
  renderRABList(filteredRABList)
  
  console.log(`✅ Filters applied: Status="${currentStatusFilter}", Jenis="${currentJenisFilter}", TOR="${searchTOR}", IP="${searchIP}", Pekerjaan="${searchNamaPekerjaan}", Results=${filteredRABList.length}`)
}

// Clear all filters
function clearFilters() {
  // Reset status filter
  const statusDropdown = document.getElementById('filterStatusDropdown')
  if (statusDropdown) {
    statusDropdown.value = 'All'
    currentStatusFilter = 'All'
  }
  
  // Reset search inputs (for Realisasi page)
  const filterTORInput = document.getElementById('filterTORInput')
  const filterIPInput = document.getElementById('filterIPInput')
  const filterNamaPekerjaanInput = document.getElementById('filterNamaPekerjaanInput')
  
  if (filterTORInput) filterTORInput.value = ''
  if (filterIPInput) filterIPInput.value = ''
  if (filterNamaPekerjaanInput) filterNamaPekerjaanInput.value = ''
  
  // Reset jenis filter (but keep SPK for Realisasi page)
  const filterJenisHidden = document.getElementById('filterJenisHidden')
  if (filterJenisHidden) {
    currentJenisFilter = filterJenisHidden.value // Keep SPK for Realisasi
  } else {
    currentJenisFilter = 'All' // Reset to All for List RAB page
  }
  
  // Apply filters (will show all items matching jenis filter)
  applyFilters()
  
  console.log('🔄 Filters cleared')
  showNotification('Filter telah di-reset', 'info')
}

// Update RAB status
async function updateRABStatus(rabId, newStatus) {
  try {
    console.log('🔄 Updating RAB status:', { rabId, newStatus })
    
    const response = await fetch(`/api/rab/${rabId}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ status: newStatus })
    })
    
    console.log('📡 Response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Error response:', errorData)
      throw new Error(errorData.details || errorData.error || 'Failed to update status')
    }
    
    const result = await response.json()
    console.log('✅ Update status success:', result)
    
    showNotification('Status berhasil diupdate', 'success')
    await loadRABList()
  } catch (error) {
    console.error('❌ Error updating status:', error)
    showNotification(`Gagal update status: ${error.message}`, 'error')
    await loadRABList()
  }
}

// Update Nomor TOR
async function updateNomorTOR(rabId, nomorTOR) {
  try {
    console.log('🔄 Updating Nomor TOR:', { rabId, nomorTOR })
    
    const response = await fetch(`/api/rab/${rabId}/update-tor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ nomor_tor: nomorTOR })
    })
    
    console.log('📡 Response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Error response:', errorData)
      throw new Error(errorData.details || errorData.error || 'Failed to update TOR')
    }
    
    const result = await response.json()
    console.log('✅ Update TOR success:', result)
    
    showNotification('Nomor TOR berhasil diupdate', 'success')
    await loadRABList()
  } catch (error) {
    console.error('❌ Error updating TOR:', error)
    showNotification(`Gagal update Nomor TOR: ${error.message}`, 'error')
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
async function showRABDetailModal(rab) {
  console.log('📋 Opening RAB detail modal for:', rab.nomor_rab)
  
  // Retry mechanism: Wait for DOM if modal not found
  const modal = document.getElementById('rabDetailModal')
  if (!modal) {
    console.warn('⚠️ Modal not found on first attempt, retrying in 100ms...')
    setTimeout(async () => {
      const retryModal = document.getElementById('rabDetailModal')
      if (!retryModal) {
        console.error('❌ Modal element not found after retry! ID: rabDetailModal')
        console.error('❌ Available modals:', Array.from(document.querySelectorAll('[id*="Modal"]')).map(m => m.id))
        alert('Error: Modal tidak ditemukan. Silakan refresh halaman.')
        return
      }
      console.log('✅ Modal found on retry:', retryModal)
      await _showRABDetailModalContent(rab, retryModal)
    }, 100)
    return
  }
  console.log('✅ Modal element found:', modal)
  await _showRABDetailModalContent(rab, modal)
}

// Helper function to populate modal content
async function _showRABDetailModalContent(rab, modal) {
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
  document.getElementById('detailNomorIjinPrinsip').textContent = rab.nomor_ijin_prinsip || '-'
  
  // ROK: Editable for admin and Andalcekatan
  const currentUser = localStorage.getItem('username') || ''
  const isAdmin = currentUser === 'admin'
  const isAndalcekatan = currentUser === 'Andalcekatan'
  const canEditROK = isAdmin || isAndalcekatan
  
  if (canEditROK) {
    document.getElementById('detailROK').innerHTML = `
      <input type="number" 
             value="${rab.rok_percentage || 0}" 
             min="0" 
             max="100" 
             onchange="updateRABROKInModal(${rab.id}, this.value)"
             class="w-24 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
             /> %`
  } else {
    document.getElementById('detailROK').textContent = `${rab.rok_percentage || 0}%`
  }
  
  document.getElementById('detailCreated').textContent = createdDate
  document.getElementById('detailUsername').textContent = rab.username || '-'
  
  // Render items table
  const itemsTable = document.getElementById('detailItemsTable')
  if (rab.items && rab.items.length > 0) {
    console.log('📦 RAB Items data:', rab.items)
    console.log('📦 First item structure:', rab.items[0])
    console.log('📦 Item keys:', Object.keys(rab.items[0]))
    
    itemsTable.innerHTML = rab.items.map((item, index) => {
      // Try ALL possible field name variations - prioritize 'nama' and 'harga'
      const namaMaterial = item.nama || item.nama_material || item.material_name || item.name || item.material || '-'
      const qty = item.qty || item.quantity || item.jumlah || 0
      const hargaSatuan = item.harga || item.harga_satuan || item.unit_price || item.price || 0
      
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
      
      // Check if current user can edit Harga Satuan
      const currentUser = localStorage.getItem('username') || ''
      const isAdmin = currentUser === 'admin'
      const isAndalcekatan = currentUser === 'Andalcekatan'
      const canEditHarga = isAdmin || isAndalcekatan
      
      const itemId = item.id || item.item_id || index
      
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
      
      // Harga Satuan column: editable for admin and Andalcekatan
      const hargaSatuanCell = canEditHarga ? `
        <input type="number" 
               value="${hargaSatuan}" 
               min="0"
               data-item-id="${itemId}"
               data-rab-id="${rab.id}"
               onchange="updateItemHargaSatuan(${rab.id}, ${itemId}, this.value)"
               class="w-full px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
               placeholder="0" />
      ` : `${formatRupiah(hargaSatuan)}`
      
      // For REALISASI page: show 5 additional columns (Tanpa ROK to Saldo)
      // For LIST RAB page: hide these columns
      let realisasiColumns = ''
      
      if (isListTORPage) {
        const saldo = totalTanpaROK - totalRealisasi
        
        realisasiColumns = `
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
        `
      }
      
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
        <td class="px-2 py-2 text-right text-xs">${hargaSatuanCell}</td>
        <td class="px-2 py-2 text-right text-xs font-semibold">${formatRupiah(total)}</td>
        ${realisasiColumns}
      </tr>
      `
    }).join('')
    
    // Add summary rows for LIST RAB page
    if (!isListTORPage && rab.items && rab.items.length > 0) {
      // Calculate totals for LIST RAB
      let subtotalTotal = 0
      rab.items.forEach(item => {
        const qty = item.qty || item.quantity || item.jumlah || 0
        const hargaSatuan = item.harga_satuan || item.harga || item.unit_price || item.price || 0
        subtotalTotal += (qty * hargaSatuan)
      })
      
      const rokPercentage = rab.rok_percentage || 0
      const usePPN = !(rab.jenis_rab === 'Pembelian Langsung' && rokPercentage === 0)
      const ppnTotal = usePPN ? subtotalTotal * 0.11 : 0
      const grandTotalTotal = subtotalTotal + ppnTotal
      
      // Add Subtotal row
      itemsTable.innerHTML += `
        <tr class="bg-gray-100 font-semibold border-t-2 border-gray-400">
          <td colspan="9" class="px-2 py-2 text-right text-xs">Subtotal:</td>
          <td class="px-2 py-2 text-right text-xs">${formatRupiah(subtotalTotal)}</td>
        </tr>
      `
      
      // Add PPN rows if applicable
      if (usePPN) {
        itemsTable.innerHTML += `
          <tr class="bg-gray-100 font-semibold">
            <td colspan="9" class="px-2 py-2 text-right text-xs">PPN 11%:</td>
            <td class="px-2 py-2 text-right text-xs">${formatRupiah(ppnTotal)}</td>
          </tr>
          <tr class="bg-blue-100 font-bold border-t-2 border-blue-400">
            <td colspan="9" class="px-2 py-2 text-right text-xs">Total + PPN:</td>
            <td class="px-2 py-2 text-right text-xs text-blue-600">${formatRupiah(grandTotalTotal)}</td>
          </tr>
        `
      }
    }
    
    // Calculate summary totals for REALISASI page
    if (isListTORPage && rab.items && rab.items.length > 0) {
      const rokPercentage = rab.rok_percentage || 0
      
      // Calculate subtotals for Total, Total tanpa ROK, and Total Realisasi
      let subtotalTotal = 0
      let subtotalTanpaROK = 0
      let subtotalRealisasi = 0
      
      rab.items.forEach(item => {
        const qty = item.qty || item.quantity || item.jumlah || 0
        const hargaSatuan = item.harga_satuan || item.harga || item.unit_price || item.price || 0
        const total = qty * hargaSatuan
        // Tanpa ROK = Harga Satuan / (1 + ROK%), then × Qty
        const tanpaROKPerItem = rokPercentage > 0 ? hargaSatuan / (1 + (rokPercentage / 100)) : hargaSatuan
        const totalTanpaROK = tanpaROKPerItem * qty
        const realisasi = item.realisasi || 0
        
        subtotalTotal += total
        subtotalTanpaROK += totalTanpaROK
        subtotalRealisasi += (realisasi * qty)
      })
      
      // Check if RAB uses PPN (Jenis RAB = "Pembelian Langsung" dan ROK = 0% = tidak pakai PPN)
      const usePPN = !(rab.jenis_rab === 'Pembelian Langsung' && rokPercentage === 0)
      
      // Calculate PPN 11% ONLY for Total column (if usePPN)
      const ppnTotal = usePPN ? subtotalTotal * 0.11 : 0
      
      // Calculate Total + PPN ONLY for Total column
      const grandTotalTotal = subtotalTotal + ppnTotal
      
      // Load linked RAB Pembelian Langsung and calculate total
      let totalPembelianLangsung = 0
      if (rab.jenis_rab === 'SPK') {
        await loadLinkedPembelianLangsung(rab.id).then(total => {
          totalPembelianLangsung = total
        })
      }
      
      // Calculate Saldo Subtotal = Subtotal Total tanpa ROK - Subtotal Total Realisasi - Total Pembelian Langsung
      const saldoSubtotal = subtotalTanpaROK - subtotalRealisasi - totalPembelianLangsung
      
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
          <td class="px-2 py-2 text-right text-xs">-</td>
        </tr>
      `
      
      // Row 2: RAB Pembelian Langsung (only for RAB SPK)
      if (rab.jenis_rab === 'SPK' && totalPembelianLangsung > 0) {
        itemsTable.innerHTML += `
          <tr class="bg-yellow-50 font-semibold">
            <td colspan="9" class="px-2 py-2 text-right text-xs">(-) RAB Pembelian Langsung:</td>
            <td class="px-2 py-2 text-right text-xs">-</td>
            <td class="px-2 py-2 text-right text-xs">-</td>
            <td class="px-2 py-2 text-right text-xs text-red-600">${formatRupiah(totalPembelianLangsung)}</td>
            <td class="px-2 py-2 text-center text-xs">-</td>
            <td class="px-2 py-2 text-right text-xs">-</td>
            <td class="px-2 py-2 text-right text-xs">-</td>
          </tr>
        `
      }
      
      // Row 3: Saldo (final calculation)
      itemsTable.innerHTML += `
        <tr class="bg-gray-200 font-bold border-t-2 border-gray-500">
          <td colspan="9" class="px-2 py-2 text-right text-xs">Saldo:</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-center text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs">-</td>
          <td class="px-2 py-2 text-right text-xs font-semibold ${saldoSubtotal < 0 ? 'text-red-600' : 'text-green-600'}">${formatRupiah(saldoSubtotal)}</td>
        </tr>
      `
      
      // Only show PPN rows if usePPN is true
      if (usePPN) {
        itemsTable.innerHTML += `
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
    }
  } else {
    const colspanCount = isListTORPage ? 15 : 10
    itemsTable.innerHTML = `<tr><td colspan="${colspanCount}" class="px-4 py-8 text-center text-gray-500 text-xs">Tidak ada item</td></tr>`
  }
  
  // Hide summary section below table for both LIST RAB and REALISASI
  // Summary is now inside the table
  const summarySection = document.querySelector('.mt-4.text-right')
  if (summarySection) {
    summarySection.style.display = 'none'
  }
  
  // Show/hide RAB Pembelian Langsung section based on page and RAB type
  const rabPembelianLangsungSection = document.getElementById('rabPembelianLangsungSection')
  if (rabPembelianLangsungSection) {
    if (isListTORPage && rab.jenis_rab === 'SPK') {
      rabPembelianLangsungSection.style.display = 'block'
      loadAvailablePembelianLangsung()
    } else {
      rabPembelianLangsungSection.style.display = 'none'
    }
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

// Update RAB ROK in modal (for admin and Andalcekatan)
async function updateRABROKInModal(rabId, percentage) {
  try {
    const rok = parseFloat(percentage)
    if (isNaN(rok) || rok < 0 || rok > 100) {
      showNotification('ROK harus antara 0-100%', 'error')
      await viewRABDetail(rabId)
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
    // Reload modal to show updated calculations
    await viewRABDetail(rabId)
  } catch (error) {
    console.error('Error updating ROK:', error)
    showNotification('Gagal update ROK', 'error')
    await viewRABDetail(rabId)
  }
}

// Update item Harga Satuan (for admin and Andalcekatan)
async function updateItemHargaSatuan(rabId, itemId, value) {
  try {
    console.log('💰 Update Harga Satuan - RAW INPUT:', { rabId, itemId, value, valueType: typeof value })
    
    // Validate itemId
    if (!itemId || itemId === 0 || isNaN(itemId)) {
      console.error('❌ Invalid itemId:', itemId)
      showNotification('Error: Item ID tidak valid', 'error')
      return
    }
    
    // Convert value to number and validate
    const hargaSatuan = parseFloat(value)
    console.log('💰 Converted harga satuan value:', { hargaSatuan, isNaN: isNaN(hargaSatuan) })
    
    if (isNaN(hargaSatuan) || hargaSatuan < 0) {
      console.error('❌ Invalid harga satuan value:', { value, hargaSatuan })
      showNotification('Error: Nilai harga satuan tidak valid. Harus berupa angka positif.', 'error')
      await viewRABDetail(rabId)
      return
    }
    
    console.log('📤 Sending update request:', {
      itemId,
      hargaSatuan,
      endpoint: `/api/rab/items/${itemId}/harga`
    })
    
    const response = await fetch(`/api/rab/items/${itemId}/harga`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ harga_satuan: hargaSatuan })
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Server error:', errorData)
      throw new Error(errorData.error || 'Failed to update harga satuan')
    }
    
    const result = await response.json()
    console.log('✅ Harga satuan updated successfully:', result)
    
    showNotification('Harga satuan berhasil diupdate', 'success')
    // Reload modal to show updated totals
    await viewRABDetail(rabId)
  } catch (error) {
    console.error('❌ Error updating harga satuan:', error)
    showNotification(`Gagal update harga satuan: ${error.message}`, 'error')
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

// Export RAB Detail to Excel - RESET VERSION
function exportRABDetailToExcel() {
  if (!currentRABDetail) {
    showNotification('Tidak ada data RAB untuk di-export', 'error')
    return
  }
  
  try {
    const rab = currentRABDetail
    
    // CRITICAL DEBUG: Log entire RAB object structure
    console.log('🔍 FULL RAB OBJECT:', rab)
    console.log('🔍 RAB keys:', Object.keys(rab))
    console.log('🔍 RAB.items type:', typeof rab.items)
    console.log('🔍 RAB.items is array?:', Array.isArray(rab.items))
    console.log('🔍 RAB.items length:', rab.items ? rab.items.length : 'UNDEFINED')
    console.log('🔍 RAB.items full:', rab.items)
    
    const items = rab.items || []
    const rokPercentage = rab.rok_percentage || 0
    
    if (items.length === 0) {
      console.error('❌ No items found in RAB!')
      showNotification('Tidak ada item untuk di-export', 'error')
      return
    }
    
    console.log('📊 EXCEL EXPORT START - Total items:', items.length)
    console.log('📊 First item full object:', items[0])
    console.log('📊 First item keys:', Object.keys(items[0]))
    
    // Build Excel data array directly without complex mapping
    const excelData = []
    
    // Add data rows
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      // Log every single field access
      console.log(`📊 Item ${i} - Field by field:`, {
        'item': item,
        'item.nama': item.nama,
        'item.qty': item.qty,
        'item.harga': item.harga,
        'item.no_lh05': item.no_lh05,
        'item.part_number': item.part_number,
        'item.type_mesin': item.type_mesin,
        'item.sn_mesin': item.sn_mesin,
        'item.unit_uld': item.unit_uld
      })
      
      // Extract values directly - FIXED FIELD NAMES
      const no = i + 1
      const nama = String(item.material || item.nama || '-')
      const noLH05 = String(item.nomor_lh05 || item.no_lh05 || '-')
      const partNumber = String(item.part_number || '-')
      const typeMesin = String(item.mesin || item.type_mesin || item.tipe_mesin || '-')
      const snMesin = String(item.sn_mesin || '-')
      const unitULD = String(item.unit_uld || item.lokasi_gangguan || item.lokasi_tujuan || '-')
      const qty = Number(item.jumlah || item.qty || item.quantity || 1)
      const harga = Number(item.harga_satuan || item.harga || item.unit_price || item.price || 0)
      const total = qty * harga
      
      console.log(`📊 Row ${no} - After extraction:`, {nama, qty, harga, noLH05, partNumber})
      
      // Push row object
      excelData.push({
        'No': no,
        'Nama Material': nama,
        'No. LH05': noLH05,
        'Part Number': partNumber,
        'Type Mesin': typeMesin,
        'S/N Mesin': snMesin,
        'Unit/ULD': unitULD,
        'Qty': qty,
        'Harga Satuan': harga,
        'Total': total
      })
    }
    
    // Calculate subtotal - FIXED FIELD NAMES
    let subtotalTotal = 0
    for (let i = 0; i < items.length; i++) {
      const qty = Number(items[i].jumlah || items[i].qty || items[i].quantity || 1)
      const harga = Number(items[i].harga_satuan || items[i].harga || items[i].unit_price || items[i].price || 0)
      subtotalTotal += (qty * harga)
    }
    
    console.log('📊 Subtotal calculated:', subtotalTotal)
    
    // Check if RAB uses PPN
    const usePPN = !(rab.jenis_rab === 'Pembelian Langsung' && rokPercentage === 0)
    const ppn = usePPN ? Math.round(subtotalTotal * 0.11) : 0
    const totalWithPPN = subtotalTotal + ppn
    
    console.log('📊 PPN:', ppn, 'Total+PPN:', totalWithPPN)
    
    // Add empty row
    excelData.push({
      'No': '',
      'Nama Material': '',
      'No. LH05': '',
      'Part Number': '',
      'Type Mesin': '',
      'S/N Mesin': '',
      'Unit/ULD': '',
      'Qty': '',
      'Harga Satuan': '',
      'Total': ''
    })
    
    // Add Subtotal row
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
      'Total': subtotalTotal
    })
    
    // Add PPN rows if applicable
    if (usePPN) {
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
        'Total': ppn
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
        'Total': totalWithPPN
      })
    }
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 35 },  // Nama Material
      { wch: 25 },  // No. LH05
      { wch: 20 },  // Part Number
      { wch: 20 },  // Type Mesin
      { wch: 15 },  // S/N Mesin
      { wch: 15 },  // Unit/ULD
      { wch: 8 },   // Qty
      { wch: 18 },  // Harga Satuan
      { wch: 18 }   // Total
    ]
    
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
    doc.text(`ROK: ${rokPercentage}%`, 100, 25)
    doc.text(`Nomor TOR: ${rab.nomor_tor || '-'}`, 100, 30)
    
    const createdDate = rab.created_at ? new Date(rab.created_at).toLocaleDateString('id-ID') : '-'
    doc.text(`Tanggal: ${createdDate}`, 180, 25)
    doc.text(`Dibuat: ${rab.username || '-'}`, 180, 30)
    
    console.log('📄 PDF EXPORT START - Total items:', items.length)
    
    // Build table data array directly
    const tableData = []
    
    // Add data rows
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      const no = i + 1
      const nama = String(item.material || item.nama || '-')
      const noLH05 = String(item.nomor_lh05 || item.no_lh05 || '-')
      const partNumber = String(item.part_number || '-')
      const typeMesin = String(item.mesin || item.type_mesin || item.tipe_mesin || '-')
      const snMesin = String(item.sn_mesin || '-')
      const unitULD = String(item.unit_uld || item.lokasi_gangguan || item.lokasi_tujuan || '-')
      const qty = Number(item.jumlah || item.qty || item.quantity || 1)
      const harga = Number(item.harga_satuan || item.harga || item.unit_price || item.price || 0)
      const total = qty * harga
      
      console.log(`PDF Row ${no}:`, {nama, qty, harga})
      
      tableData.push([
        no,
        nama,
        noLH05,
        partNumber,
        typeMesin,
        snMesin,
        unitULD,
        qty,
        formatRupiah(harga),
        formatRupiah(total)
      ])
    }
    
    // Calculate subtotal
    let subtotalTotal = 0
    for (let i = 0; i < items.length; i++) {
      const qty = Number(items[i].jumlah || items[i].qty || items[i].quantity || 1)
      const harga = Number(items[i].harga_satuan || items[i].harga || items[i].unit_price || items[i].price || 0)
      subtotalTotal += (qty * harga)
    }
    
    console.log('📄 PDF Subtotal:', subtotalTotal)
    
    // Check if RAB uses PPN (same logic as view)
    const usePPN = !(rab.jenis_rab === 'Pembelian Langsung' && rokPercentage === 0)
    
    const ppnTotal = usePPN ? Math.round(subtotalTotal * 0.11) : 0
    const grandTotal = subtotalTotal + ppnTotal
    
    // Add summary rows
    tableData.push([
      '', '', '', '', '', '', '', '', 
      'Subtotal:', 
      formatRupiah(subtotalTotal)
    ])
    
    // Add PPN rows only if usePPN is true
    if (usePPN) {
      tableData.push([
        '', '', '', '', '', '', '', '', 
        'PPN 11%:', 
        formatRupiah(ppnTotal)
      ])
      
      tableData.push([
        '', '', '', '', '', '', '', '', 
        'Total + PPN:', 
        formatRupiah(grandTotal)
      ])
    }
    
    // Table headers - 10 columns
    const headers = [
      'No', 'Nama Material', 'No. LH05', 'Part Number', 
      'Type Mesin', 'S/N Mesin', 'Unit/ULD', 'Qty', 
      'Harga Satuan', 'Total'
    ]
    
    // Create table with autoTable
    doc.autoTable({
      startY: 38,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [34, 197, 94],  // Green-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 7,
        cellPadding: 2
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },   // No
        1: { halign: 'left', cellWidth: 45 },     // Nama Material
        2: { halign: 'left', cellWidth: 30 },     // No. LH05
        3: { halign: 'left', cellWidth: 25 },     // Part Number
        4: { halign: 'left', cellWidth: 25 },     // Type Mesin
        5: { halign: 'center', cellWidth: 20 },   // S/N Mesin
        6: { halign: 'center', cellWidth: 20 },   // Unit/ULD
        7: { halign: 'center', cellWidth: 10 },   // Qty
        8: { halign: 'right', cellWidth: 25 },    // Harga Satuan
        9: { halign: 'right', cellWidth: 25 }     // Total
      },
      // Highlight summary rows
      didParseCell: function(data) {
        if (data.row.index >= items.length && data.column.index === 8) {
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.row.index >= items.length && data.column.index === 9) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [243, 244, 246]  // Gray-100
        }
      }
    })
    
    // Save PDF
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
      'Total': rab.total_harga || 0,
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
      formatRupiah(rab.total_harga || 0)
    ])
    
    doc.autoTable({
      startY: 32,
      head: [['No', 'Nomor RAB', 'Status', 'ROK', 'No. TOR', 'Jenis', 'Item', 'Total']],
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

// ==================== RAB Pembelian Langsung Functions ====================

// Load linked RAB Pembelian Langsung and return total
async function loadLinkedPembelianLangsung(rabSpkId) {
  try {
    const response = await fetch(`/api/rab/${rabSpkId}/linked-pembelian-langsung`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) throw new Error('Failed to load linked Pembelian Langsung')
    
    const result = await response.json()
    const linkedRABs = result.data || []
    
    // Calculate total
    let total = 0
    linkedRABs.forEach(rab => {
      const rokPercentage = rab.rok_percentage || 0
      const totalTanpaROK = rokPercentage > 0 
        ? Math.round(rab.total_harga / (1 + rokPercentage / 100))
        : rab.total_harga
      total += totalTanpaROK
    })
    
    // Update UI if on Realisasi page and RAB is SPK
    if (isListTORPage && currentRABDetail && currentRABDetail.jenis_rab === 'SPK') {
      displayLinkedPembelianLangsung(linkedRABs)
      document.getElementById('totalPembelianLangsung').textContent = formatRupiah(total)
      document.getElementById('rabPembelianLangsungSection').classList.remove('hidden')
    }
    
    return total
  } catch (error) {
    console.error('Error loading linked Pembelian Langsung:', error)
    return 0
  }
}

// Display linked RAB Pembelian Langsung
function displayLinkedPembelianLangsung(linkedRABs) {
  const container = document.getElementById('linkedPembelianLangsungList')
  if (!container) return
  
  if (linkedRABs.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 italic">Belum ada RAB Pembelian Langsung terkait</p>'
    return
  }
  
  // Check if user is Andalcekatan
  const username = localStorage.getItem('username') || ''
  const canDelete = username === 'Andalcekatan'
  
  // Create table with RAB Pembelian Langsung list
  let tableHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full border border-gray-300 text-sm">
        <thead class="bg-green-600 text-white">
          <tr>
            <th class="px-3 py-2 text-left border-r border-green-500">No</th>
            <th class="px-3 py-2 text-left border-r border-green-500">Nomor RAB</th>
            <th class="px-3 py-2 text-right border-r border-green-500">Total Harga</th>
            <th class="px-3 py-2 text-center border-r border-green-500">ROK %</th>
            <th class="px-3 py-2 text-right border-r border-green-500">Total Tanpa ROK</th>
            ${canDelete ? '<th class="px-3 py-2 text-center">Aksi</th>' : ''}
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
  `
  
  linkedRABs.forEach((rab, index) => {
    const rokPercentage = rab.rok_percentage || 0
    const totalTanpaROK = rokPercentage > 0 
      ? Math.round(rab.total_harga / (1 + rokPercentage / 100))
      : rab.total_harga
    
    tableHTML += `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2 border-r border-gray-200 text-center font-medium">${index + 1}</td>
        <td class="px-3 py-2 border-r border-gray-200 font-semibold text-gray-800">${rab.nomor_rab}</td>
        <td class="px-3 py-2 border-r border-gray-200 text-right">${formatRupiah(rab.total_harga)}</td>
        <td class="px-3 py-2 border-r border-gray-200 text-center">
          ${rokPercentage > 0 ? `<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">${rokPercentage}%</span>` : '<span class="text-gray-400">-</span>'}
        </td>
        <td class="px-3 py-2 border-r border-gray-200 text-right font-semibold text-green-700">${formatRupiah(totalTanpaROK)}</td>
        ${canDelete ? `
        <td class="px-3 py-2 text-center">
          <button onclick="removePembelianLangsung(${rab.link_id})" 
                  class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition shadow-sm">
            <i class="fas fa-trash-alt mr-1"></i>Hapus
          </button>
        </td>
        ` : ''}
      </tr>
    `
  })
  
  tableHTML += `
        </tbody>
      </table>
    </div>
  `
  
  container.innerHTML = tableHTML
}

// Load available RAB Pembelian Langsung for dropdown
async function loadAvailablePembelianLangsung() {
  try {
    console.log('🔄 Loading available RAB Pembelian Langsung...')
    
    const response = await fetch('/api/rab/pembelian-langsung/available', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) throw new Error('Failed to load available Pembelian Langsung')
    
    const result = await response.json()
    const availableRABs = result.data || []
    
    console.log('✅ Loaded RAB Pembelian Langsung:', availableRABs.length, 'items')
    
    const select = document.getElementById('selectPembelianLangsung')
    if (!select) {
      console.error('❌ Dropdown element not found: selectPembelianLangsung')
      return
    }
    
    console.log('✅ Dropdown element found, populating options...')
    
    select.innerHTML = '<option value="">-- Pilih RAB Pembelian Langsung --</option>'
    
    availableRABs.forEach(rab => {
      const rokPercentage = rab.rok_percentage || 0
      const totalTanpaROK = rokPercentage > 0 
        ? Math.round(rab.total_harga / (1 + rokPercentage / 100))
        : rab.total_harga
      
      const option = document.createElement('option')
      option.value = rab.id
      option.textContent = `${rab.nomor_rab} - ${formatRupiah(totalTanpaROK)}`
      select.appendChild(option)
    })
    
    console.log('✅ Dropdown populated with', availableRABs.length, 'options')
    
  } catch (error) {
    console.error('❌ Error loading available Pembelian Langsung:', error)
    showNotification('Gagal memuat daftar RAB Pembelian Langsung', 'error')
  }
}

// Add RAB Pembelian Langsung
async function addPembelianLangsung() {
  try {
    console.log('🔄 Adding RAB Pembelian Langsung...')
    
    const select = document.getElementById('selectPembelianLangsung')
    const rabPembelianLangsungId = parseInt(select.value)
    
    console.log('📝 Selected RAB ID:', rabPembelianLangsungId)
    console.log('📝 Current RAB Detail:', currentRABDetail)
    
    if (!rabPembelianLangsungId) {
      showNotification('Silakan pilih RAB Pembelian Langsung terlebih dahulu', 'error')
      return
    }
    
    if (!currentRABDetail || !currentRABDetail.id) {
      console.error('❌ Current RAB Detail is missing!')
      showNotification('RAB SPK tidak ditemukan', 'error')
      return
    }
    
    console.log(`🌐 Sending POST request to /api/rab/${currentRABDetail.id}/link-pembelian-langsung`)
    console.log('📦 Request body:', { rab_pembelian_langsung_id: rabPembelianLangsungId })
    
    const response = await fetch(`/api/rab/${currentRABDetail.id}/link-pembelian-langsung`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ rab_pembelian_langsung_id: rabPembelianLangsungId })
    })
    
    console.log('📡 Response status:', response.status)
    
    const result = await response.json()
    console.log('📦 Response data:', result)
    
    if (!response.ok) {
      console.error('❌ API Error:', result)
      throw new Error(result.details || result.error || 'Failed to link Pembelian Langsung')
    }
    
    console.log('✅ RAB Pembelian Langsung added successfully!')
    showNotification('RAB Pembelian Langsung berhasil ditambahkan', 'success')
    
    // Reload modal to show updated data
    console.log('🔄 Reloading RAB detail...')
    await viewRABDetail(currentRABDetail.id)
    
  } catch (error) {
    console.error('❌ Error adding Pembelian Langsung:', error)
    showNotification(`Gagal menambahkan: ${error.message}`, 'error')
  }
}

// Remove RAB Pembelian Langsung
async function removePembelianLangsung(linkId) {
  try {
    // Check if user is Andalcekatan
    const username = localStorage.getItem('username') || ''
    if (username !== 'Andalcekatan') {
      showNotification('Hanya akun Andalcekatan yang dapat menghapus RAB Pembelian Langsung', 'error')
      return
    }
    
    if (!confirm('Apakah Anda yakin ingin menghapus RAB Pembelian Langsung ini dari daftar?')) {
      return
    }
    
    if (!currentRABDetail || !currentRABDetail.id) {
      showNotification('RAB SPK tidak ditemukan', 'error')
      return
    }
    
    const response = await fetch(`/api/rab/${currentRABDetail.id}/unlink-pembelian-langsung/${linkId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) throw new Error('Failed to unlink Pembelian Langsung')
    
    showNotification('RAB Pembelian Langsung berhasil dihapus dari daftar', 'success')
    
    // Reload modal to show updated data
    await viewRABDetail(currentRABDetail.id)
    
  } catch (error) {
    console.error('Error removing Pembelian Langsung:', error)
    showNotification('Gagal menghapus RAB Pembelian Langsung', 'error')
  }
}

// ==================== End RAB Pembelian Langsung Functions ====================

// Logout
function logout() {
  localStorage.removeItem('sessionToken')
  localStorage.removeItem('username')
  window.location.href = '/'
}
