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

// MAIN LOADING FUNCTION
async function initializeData() {
  if (isDataLoaded) {
    console.log('⚠️ Data already loaded, skipping...')
    return
  }
  
  console.log('🔄 Initializing List RAB data...')
  
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
    filteredRABList = data
    
    sortRABByStatus()
    renderRABList(filteredRABList)
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
    tableBody.innerHTML = `
      <tr>
        <td colspan="12" class="px-6 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p class="text-lg">Tidak ada data RAB</p>
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
    const isCreator = currentUser === rab.username
    
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
    
    return `
    <tr class="hover:bg-gray-50 transition-colors border-b" style="animation: slideIn 0.3s ease-out ${index * 0.05}s both;">
      <td class="px-3 py-2.5 border text-center align-middle font-medium text-sm">${index + 1}</td>
      <td class="px-3 py-2.5 border text-center align-middle">
        <span class="text-blue-600 font-mono text-xs font-semibold">${rab.nomor_rab}</span>
      </td>
      <td class="px-3 py-2.5 border text-center align-middle">
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
              return `<span class="text-gray-800 text-xs font-mono block">${rab.nomor_tor}</span>
                      <span class="text-xs text-gray-400">(locked)</span>`
            }
          }
          // Other users: Read-only
          else {
            return `<span class="text-gray-700 text-xs font-mono">${rab.nomor_tor || '-'}</span>`
          }
        })() : `<span class="text-gray-400 text-xs">-</span>`}
      </td>
      <td class="px-3 py-2.5 border text-center align-middle">
        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getJenisRABColor(rab.jenis_rab)}">
          ${rab.jenis_rab || '-'}
        </span>
      </td>
      <td class="px-3 py-2.5 border text-center align-middle">
        <div class="text-xs">
          <div class="font-semibold text-gray-800">${createdDate}</div>
          <div class="text-gray-500">${createdTime}</div>
        </div>
      </td>
      <td class="px-3 py-2.5 border text-center align-middle">
        <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
          ${rab.item_count || 0}
        </span>
      </td>
      <td class="px-3 py-2.5 border text-right align-middle font-semibold text-sm">${formatRupiah((rab.total_harga || 0) * 1.11)}</td>
      <td class="px-2 py-2 border text-center align-middle">
        <select onchange="updateRABStatus(${rab.id}, this.value)" 
                class="w-full px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${getStatusColorSelect(rab.status)}">
          <option value="Draft" ${rab.status === 'Draft' ? 'selected' : ''}>Draft</option>
          <option value="Pengadaan" ${rab.status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
          <option value="Tersedia" ${rab.status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
          <option value="Masuk Gudang" ${rab.status === 'Masuk Gudang' ? 'selected' : ''} disabled>Masuk Gudang</option>
        </select>
      </td>
      <td class="px-2 py-2 border text-center align-middle">
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

// Apply all filters
function applyFilters() {
  filteredRABList = allRABList.filter(rab => {
    // Status filter
    const statusMatch = currentStatusFilter === 'All' || rab.status === currentStatusFilter
    
    // Jenis RAB filter
    const jenisMatch = currentJenisFilter === 'All' || rab.jenis_rab === currentJenisFilter
    
    return statusMatch && jenisMatch
  })
  
  sortRABByStatus()
  renderRABList(filteredRABList)
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
    itemsTable.innerHTML = rab.items.map((item, index) => `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-3 text-center">${index + 1}</td>
        <td class="px-4 py-3">${item.nama_material || item.material_name}</td>
        <td class="px-4 py-3 text-center">${item.qty || item.quantity || 0}</td>
        <td class="px-4 py-3 text-center">${item.satuan || item.unit || '-'}</td>
        <td class="px-4 py-3 text-right">${formatRupiah(item.harga_satuan || item.unit_price || 0)}</td>
        <td class="px-4 py-3 text-right font-semibold">${formatRupiah((item.qty || item.quantity || 0) * (item.harga_satuan || item.unit_price || 0))}</td>
      </tr>
    `).join('')
  } else {
    itemsTable.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Tidak ada item</td></tr>'
  }
  
  // Calculate totals
  const subtotal = rab.total_harga || 0
  const ppn = subtotal * 0.11
  const total = subtotal + ppn
  
  document.getElementById('detailSubtotal').textContent = formatRupiah(subtotal)
  document.getElementById('detailPPN').textContent = formatRupiah(ppn)
  document.getElementById('detailTotal').textContent = formatRupiah(total)
  
  modal.classList.remove('hidden')
}

// Close RAB detail modal
function closeRABDetailModal() {
  const modal = document.getElementById('rabDetailModal')
  if (modal) {
    modal.classList.add('hidden')
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
      'User': rab.username || '-'
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

// Export to PDF
function exportToPDF() {
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
