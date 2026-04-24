// Dashboard List RAB - AMC Material System
console.log('Dashboard List RAB loaded')

// Detect if we're on List TOR page
const isListTORPage = window.location.pathname.includes('/list-tor')
console.log('Page detected:', isListTORPage ? 'List TOR' : 'List RAB')

let allRABList = []
let filteredRABList = []
let currentRABDetail = null
let currentStatusFilter = 'All' // Changed from 'Semua' to 'All'
let currentJenisFilter = 'All' // Filter for Jenis RAB
let pengadaanData = [] // Store Pengadaan data for Status SCM matching
let autoCheckInterval = null // Auto-check timer

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, loading data...')
  await loadPengadaanData() // Load Pengadaan data first
  await loadRABList()
  
  // Start auto-check every 2 minutes (120000 ms)
  console.log('Starting auto-check timer (2 minutes)...')
  autoCheckInterval = setInterval(async () => {
    console.log('⏱️ Auto-check triggered...')
    await autoCheckRABStatus()
  }, 120000) // 2 minutes
  
  console.log('✅ Auto-check timer started')
})

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
      throw new Error(`HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ Auto-check result:', result)
    
    // Show notification if there are updates
    if (result.updates && result.updates.length > 0) {
      showNotification(result.updates)
      
      // Reload RAB list and Pengadaan data
      await loadPengadaanData()
      await loadRABList()
    }
    
    return result
  } catch (error) {
    console.error('❌ Auto-check failed:', error)
    return null
  }
}

// Show notification for status updates
function showNotification(updates) {
  if (!updates || updates.length === 0) return
  
  const container = document.getElementById('notificationContainer')
  
  // Create notification element
  const notif = document.createElement('div')
  notif.className = 'fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl z-50 animate-bounce max-w-md'
  notif.style.animation = 'slideIn 0.5s ease-out'
  
  const updateList = updates.map(u => `
    <div class="mb-2">
      <strong>${u.nomor_rab}</strong>: 
      <span class="line-through">${u.old_status}</span> → 
      <span class="font-bold">${u.new_status}</span>
      <br><span class="text-xs text-green-200">${u.reason}</span>
    </div>
  `).join('')
  
  notif.innerHTML = `
    <div class="flex items-start gap-3">
      <i class="fas fa-bell text-2xl"></i>
      <div class="flex-1">
        <h3 class="font-bold text-lg mb-2">
          <i class="fas fa-check-circle mr-1"></i>
          Status RAB Diupdate!
        </h3>
        <div class="text-sm">
          ${updateList}
        </div>
        <p class="text-xs text-green-200 mt-2">
          ${updates.length} RAB telah diupdate otomatis
        </p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `
  
  document.body.appendChild(notif)
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    notif.style.animation = 'slideOut 0.5s ease-out'
    setTimeout(() => notif.remove(), 500)
  }, 10000)
}

// Add CSS animations for notification
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`
document.head.appendChild(style)

// Load all RAB
async function loadRABList() {
  try {
    console.log('Loading RAB list...')
    const response = await fetch('/api/rab')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('RAB list loaded:', data)
    
    allRABList = data
    filteredRABList = data
    
    // Sort by status priority: Draft > Pengadaan > Tersedia > Masuk Gudang
    sortRABByStatus()
    
    renderRABList(filteredRABList)
    
  } catch (error) {
    console.error('Failed to load RAB list:', error)
    showError('Gagal memuat daftar RAB')
  }
}

// Load Pengadaan data from Google Sheets
async function loadPengadaanData() {
  try {
    console.log('Loading Pengadaan data for Status SCM...')
    const PENGADAAN_URL = 'https://script.google.com/macros/s/AKfycbynUyVrOfSXn-X6V4HFE6YbanXJZo2tBGWEvBbTMie1DyK2wL0RM9UOvVpfoWDmuxhm/exec'
    const response = await fetch(PENGADAAN_URL)
    const jsonData = await response.json()
    
    // Extract data from "data KR" key
    const allData = jsonData['data KR'] || []
    console.log('Total Pengadaan rows fetched:', allData.length)
    
    // Filter only PEMBANGKITAN (skip header row at index 0)
    pengadaanData = allData.slice(1).filter(item => {
      const bidang = item.Kolom_3 || item['Kolom_3'] || ''
      return bidang.toUpperCase().includes('PEMBANGKITAN')
    })
    
    console.log('Filtered PEMBANGKITAN rows:', pengadaanData.length)
  } catch (error) {
    console.error('Error loading Pengadaan data:', error)
    pengadaanData = []
  }
}

// Extract TOR from Keterangan (same logic as Pengadaan page)
function extractTORFromKeterangan(keterangan) {
  if (!keterangan || keterangan === '-') return null
  
  // Strategy 1: Find TOR pattern anywhere in text
  const torPattern = new RegExp('(\\d+\\/TOR\\/[A-Z0-9\\/\\-]+)', 'gi')
  const matches = keterangan.match(torPattern)
  
  if (matches && matches.length > 0) {
    return matches[0].trim()
  }
  
  // Strategy 2: Look for pattern after " - "
  const parts = keterangan.split('-')
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim()
    if (lastPart.includes('TOR')) {
      return lastPart
    }
  }
  
  return null
}

// Get Status SCM from Pengadaan data by matching TOR
function getStatusSCM(nomorTOR) {
  if (!nomorTOR || nomorTOR.trim() === '') {
    return 'Belum ada di Pengadaan'
  }
  
  // Find all Pengadaan rows with matching TOR
  const matchedRows = pengadaanData.filter(item => {
    const keterangan = item.Kolom_11 || item['Kolom_11'] || ''
    const extractedTOR = extractTORFromKeterangan(keterangan)
    
    if (!extractedTOR) return false
    
    // Partial match
    return extractedTOR.includes(nomorTOR) || nomorTOR.includes(extractedTOR)
  })
  
  if (matchedRows.length === 0) {
    return 'Belum ada di Pengadaan'
  }
  
  // Get all unique statuses
  const statuses = matchedRows.map(item => item.Kolom_12 || item['Kolom_12'] || '-')
  const uniqueStatuses = [...new Set(statuses)].filter(s => s !== '-')
  
  // Join multiple statuses with comma
  return uniqueStatuses.length > 0 ? uniqueStatuses.join(', ') : 'Belum ada di Pengadaan'
}

// Sort RAB by status priority
function sortRABByStatus() {
  const statusPriority = {
    'Draft': 1,
    'Pengadaan': 2,
    'Tersedia': 3,
    'Masuk Gudang': 4,
    'Masuk Gudang (Auto)': 4 // Same as Masuk Gudang
  }
  
  filteredRABList.sort((a, b) => {
    const priorityA = statusPriority[a.status] || 999
    const priorityB = statusPriority[b.status] || 999
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // If same status, sort by date (newest first)
    return new Date(b.tanggal_rab) - new Date(a.tanggal_rab)
  })
}

// Filter RAB by status and jenis
function applyFilters() {
  let filtered = [...allRABList]
  
  // Apply status filter
  if (currentStatusFilter !== 'All') {
    if (currentStatusFilter === 'Masuk Gudang') {
      // Include both "Masuk Gudang" and "Masuk Gudang (Auto)"
      filtered = filtered.filter(rab => 
        rab.status === 'Masuk Gudang' || rab.status === 'Masuk Gudang (Auto)'
      )
    } else {
      filtered = filtered.filter(rab => rab.status === currentStatusFilter)
    }
  }
  
  // Apply jenis RAB filter
  if (currentJenisFilter !== 'All') {
    filtered = filtered.filter(rab => rab.jenis_rab === currentJenisFilter)
  }
  
  filteredRABList = filtered
  
  // Sort after filtering
  sortRABByStatus()
  renderRABList(filteredRABList)
}

// Handle status filter button click
function filterByStatus(status) {
  console.log('Filter by status:', status)
  currentStatusFilter = status
  
  // Update button styling
  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white')
    btn.classList.add('bg-gray-100', 'text-gray-700')
  })
  
  // Highlight active button
  const activeBtn = document.getElementById('btn' + status.replace(' ', ''))
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-100', 'text-gray-700')
    activeBtn.classList.add('bg-blue-600', 'text-white')
  }
  
  // Apply filters
  applyFilters()
}

// Handle jenis RAB filter button click
function filterByJenis(jenis) {
  console.log('Filter by jenis:', jenis)
  currentJenisFilter = jenis
  
  // Update button styling
  document.querySelectorAll('.jenis-filter-btn').forEach(btn => {
    btn.classList.remove('bg-green-600', 'text-white')
    btn.classList.add('bg-gray-100', 'text-gray-700')
  })
  
  // Highlight active button
  let btnId = 'btnJenisAll'
  if (jenis === 'SPK') btnId = 'btnJenisSPK'
  else if (jenis === 'Pembelian Langsung') btnId = 'btnJenisPembelianLangsung'
  else if (jenis === 'KHS') btnId = 'btnJenisKHS'
  
  const activeBtn = document.getElementById(btnId)
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-100', 'text-gray-700')
    activeBtn.classList.add('bg-green-600', 'text-white')
  }
  
  // Apply filters
  applyFilters()
}

// LEGACY: Filter RAB by status only (kept for compatibility)
function filterRABByStatus() {
  applyFilters()
}

// Handle status filter change (LEGACY - kept for compatibility)
function handleStatusFilterChange(value) {
  currentStatusFilter = value
  applyFilters()
}

// Render RAB list table
function renderRABList(rabList) {
  const tbody = document.getElementById('rabListTable')
  const username = localStorage.getItem('username') || ''
  const userRole = localStorage.getItem('userRole') || ''
  const canDelete = userRole === 'admin' || username === 'Andalcekatan'
  const isAndalcekatan = username === 'Andalcekatan'
  const isAMC = username === 'AMC@12345'
  
  if (rabList.length === 0) {
    // Adjust colspan based on page (List TOR has fewer columns)
    const colspanCount = isListTORPage ? 8 : 10
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspanCount}" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Belum ada RAB yang dibuat</p>
          <p class="text-sm mt-2">Buat RAB baru di menu Create RAB</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = rabList.map((rab, index) => {
    // For List TOR page, skip Nomor RAB and Tanggal columns
    const nomorRABColumn = !isListTORPage ? `
      <td class="px-4 py-3 border text-left">
        <span class="font-mono font-semibold text-gray-800">${rab.nomor_rab}</span>
      </td>` : ''
    
    const tanggalColumn = !isListTORPage ? `
      <td class="px-4 py-3 border text-center">${formatDate(rab.tanggal_rab)}</td>` : ''
    
    // For List TOR page, hide History button
    const historyButton = !isListTORPage ? `
      <button onclick="viewRABHistory(${rab.id})" 
              class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs">
        <i class="fas fa-history mr-1"></i>History
      </button>` : ''
    
    return `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 border text-center">${index + 1}</td>
      ${nomorRABColumn}
      <td class="px-4 py-3 border text-center">
        ${(rab.jenis_rab === 'SPK') ? (() => {
          // Andalcekatan: Always editable
          if (isAndalcekatan) {
            return `<input type="text" 
                     value="${rab.nomor_tor || ''}" 
                     placeholder="Isi No. TOR"
                     onchange="updateNomorTOR(${rab.id}, this.value)"
                     class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono font-semibold text-blue-600"
                     />`
          }
          // AMC@12345: Editable only if empty
          else if (isAMC) {
            if (!rab.nomor_tor || rab.nomor_tor === '') {
              return `<input type="text" 
                       value="" 
                       placeholder="Isi No. TOR"
                       onchange="updateNomorTOR(${rab.id}, this.value)"
                       class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono font-semibold text-blue-600"
                       />`
            } else {
              return `<span class="text-gray-700 text-sm font-medium font-mono">${rab.nomor_tor}</span>
                      <span class="text-xs text-gray-400 block mt-1">(locked)</span>`
            }
          }
          // Other users: Read-only
          else {
            return `<span class="text-gray-600 text-sm font-mono">${rab.nomor_tor || '-'}</span>`
          }
        })() : `<span class="text-gray-400 text-sm">-</span>`}
      </td>
      <td class="px-4 py-3 border text-center">
        <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold ${getJenisRABColor(rab.jenis_rab)}">
          ${rab.jenis_rab || '-'}
        </span>
      </td>
      ${tanggalColumn}
      <td class="px-4 py-3 border text-center">
        <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
          ${rab.item_count || 0} items
        </span>
      </td>
      <td class="px-4 py-3 border text-right font-semibold">${formatRupiah((rab.total_harga || 0) * 1.11)}</td>
      <td class="px-4 py-3 border text-center">
        <select onchange="updateRABStatus(${rab.id}, this.value)" 
                class="px-3 py-1 rounded text-xs font-semibold border-0 cursor-pointer ${getStatusColorSelect(rab.status)}">
          <option value="Draft" ${rab.status === 'Draft' ? 'selected' : ''}>Draft</option>
          <option value="Pengadaan" ${rab.status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
          <option value="Tersedia" ${rab.status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
          <option value="Masuk Gudang" ${rab.status === 'Masuk Gudang' ? 'selected' : ''} disabled>Masuk Gudang (Auto)</option>
        </select>
      </td>
      <td class="px-4 py-3 border text-center">
        <div class="flex gap-2 justify-center">
          <button onclick="viewRABDetail(${rab.id})" 
                  class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
            <i class="fas fa-eye mr-1"></i>View
          </button>
          ${historyButton}
          ${canDelete ? `
            <button onclick="deleteRAB(${rab.id}, '${rab.nomor_rab}')" 
                    class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">
              <i class="fas fa-trash mr-1"></i>Delete
            </button>
          ` : ''}
        </div>
      </td>
      <td class="px-2 py-3 border text-center">
        ${(rab.jenis_rab === 'SPK') ? (() => {
          const statusSCM = getStatusSCM(rab.nomor_tor)
          const isNotFound = statusSCM === 'Belum ada di Pengadaan'
          
          // Get status badge color (same logic as Pengadaan page)
          let statusColor = 'bg-gray-100 text-gray-800'
          if (!isNotFound) {
            if (statusSCM.includes('Acc Direktur') || statusSCM.includes('Disetujui')) {
              statusColor = 'bg-green-100 text-green-800'
            } else if (statusSCM.includes('Menunggu')) {
              statusColor = 'bg-yellow-100 text-yellow-800'
            }
          }
          
          return `<div class="flex items-center justify-center">
            <span class="inline-block px-2 py-1 ${statusColor} rounded text-xs font-medium whitespace-normal break-words max-w-full">
              ${statusSCM}
            </span>
          </div>`
        })() : `<span class="text-gray-400 text-xs">-</span>`}
      </td>
    </tr>
  `}).join('')
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Format rupiah
function formatRupiah(number) {
  return 'Rp ' + (number || 0).toLocaleString('id-ID')
}

// Get status color
function getStatusColor(status) {
  const colors = {
    'Draft': 'bg-gray-100 text-gray-700',
    'Pengadaan': 'bg-orange-100 text-orange-700',
    'Tersedia': 'bg-green-100 text-green-700'
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

// Get status color for select dropdown
function getStatusColorSelect(status) {
  const colors = {
    'Draft': 'bg-gray-100 text-gray-700',
    'Pengadaan': 'bg-orange-100 text-orange-700',
    'Tersedia': 'bg-green-100 text-green-700',
    'Masuk Gudang': 'bg-purple-100 text-purple-700'
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

// Get Jenis RAB color
function getJenisRABColor(jenisRAB) {
  const colors = {
    'Pembelian Langsung': 'bg-blue-100 text-blue-700',
    'SPK': 'bg-green-100 text-green-700',
    'KHS': 'bg-purple-100 text-purple-700'
  }
  return colors[jenisRAB] || 'bg-gray-100 text-gray-700'
}

// Update RAB status
async function updateRABStatus(rabId, newStatus) {
  try {
    // Confirmation message based on status
    let confirmMessage = ''
    if (newStatus === 'Pengadaan') {
      confirmMessage = `Ubah status menjadi Pengadaan?\n\n` +
                      `⚠️ PERHATIAN:\n` +
                      `- Status material di Menu Kebutuhan akan otomatis berubah menjadi PENGADAAN\n` +
                      `- Status material TIDAK BISA DIUBAH LAGI setelah ini\n\n` +
                      `Lanjutkan?`
    } else if (newStatus === 'Tersedia') {
      confirmMessage = `Ubah status menjadi Tersedia?\n\n` +
                      `✅ Status material di Menu Kebutuhan akan otomatis berubah menjadi TERSEDIA\n\n` +
                      `Lanjutkan?`
    } else {
      confirmMessage = `Ubah status menjadi Draft?\n\n` +
                      `Status material di Menu Kebutuhan masih bisa diubah manual.\n\n` +
                      `Lanjutkan?`
    }
    
    if (!confirm(confirmMessage)) {
      // Reset dropdown to previous value
      loadRABList()
      return
    }
    
    console.log('Updating RAB status:', { rabId, newStatus })
    
    const response = await fetch(`/api/rab/${rabId}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update status')
    }
    
    console.log('Status updated:', result)
    
    // Success message
    let successMessage = '✅ Status RAB berhasil diupdate!'
    if (newStatus === 'Pengadaan' || newStatus === 'Tersedia') {
      successMessage += `\n\n📋 Status material di Menu Kebutuhan telah diupdate menjadi ${newStatus}`
    }
    
    alert(successMessage)
    
    // Reload list (with fresh Pengadaan data for Status SCM)
    await loadPengadaanData()
    await loadRABList()
    
  } catch (error) {
    console.error('Failed to update RAB status:', error)
    alert('❌ Gagal update status: ' + error.message)
    
    // Reset dropdown to previous value
    loadRABList()
  }
}

// Update Nomor TOR (Andalcekatan: full access, AMC@12345: insert only)
async function updateNomorTOR(rabId, nomorTOR) {
  try {
    console.log('Updating Nomor TOR:', { rabId, nomorTOR })
    
    // Validate username
    const username = localStorage.getItem('username') || ''
    if (username !== 'Andalcekatan' && username !== 'AMC@12345') {
      alert('❌ Hanya user Andalcekatan atau AMC@12345 yang bisa mengisi No. TOR!')
      loadRABList()
      return
    }
    
    // Get session token
    const sessionToken = localStorage.getItem('sessionToken')
    if (!sessionToken) {
      alert('❌ Session tidak valid. Silakan login kembali.')
      window.location.href = '/login'
      return
    }
    
    const response = await fetch(`/api/rab/${rabId}/update-tor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ nomor_tor: nomorTOR })
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update No. TOR')
    }
    
    console.log('No. TOR updated:', result)
    
    // Success message (silent - no alert, just reload)
    // Reload Pengadaan data first, then RAB list (for real-time Status SCM update)
    await loadPengadaanData()
    await loadRABList()
    
  } catch (error) {
    console.error('Failed to update No. TOR:', error)
    alert('❌ Gagal update No. TOR: ' + error.message)
    loadRABList()
  }
}

// View RAB detail
async function viewRABDetail(rabId) {
  try {
    console.log('Loading RAB detail:', rabId)
    const response = await fetch(`/api/rab/${rabId}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const rab = await response.json()
    console.log('RAB detail loaded:', rab)
    
    currentRABDetail = rab
    renderRABDetail(rab)
    
    // Show modal
    document.getElementById('viewRABModal').classList.remove('hidden')
    
  } catch (error) {
    console.error('Failed to load RAB detail:', error)
    alert('Gagal memuat detail RAB')
  }
}

// Render RAB detail in modal
function renderRABDetail(rab) {
  const content = document.getElementById('rabDetailContent')
  const username = localStorage.getItem('username') || ''
  const isAndalcekatan = username === 'Andalcekatan'
  const allowedStatuses = ['Draft', 'Pengadaan', 'Tersedia']
  const canEditPrice = isAndalcekatan && allowedStatuses.includes(rab.status)
  
  const items = rab.items || []
  const rokPercentage = rab.rok_percentage || 0
  
  // Calculate totals for each price type
  const totalHargaRAB = items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
  const totalHargaSPK = items.reduce((sum, item) => sum + ((item.subtotal_spk || (item.harga_satuan_spk || item.harga_satuan) * item.jumlah)), 0)
  const totalHargaTanpaROK = items.reduce((sum, item) => sum + ((item.subtotal_tanpa_rok || (item.harga_satuan_tanpa_rok || item.harga_satuan) * item.jumlah)), 0)
  const totalHargaRealisasi = items.reduce((sum, item) => sum + ((item.subtotal_realisasi || (item.harga_satuan_realisasi || item.harga_satuan) * item.jumlah)), 0)
  
  const ppnRAB = totalHargaRAB * 0.11
  const ppnSPK = totalHargaSPK * 0.11
  const ppnTanpaROK = totalHargaTanpaROK * 0.11
  const ppnRealisasi = totalHargaRealisasi * 0.11
  
  const grandTotalRAB = totalHargaRAB + ppnRAB
  const grandTotalSPK = totalHargaSPK + ppnSPK
  const grandTotalTanpaROK = totalHargaTanpaROK + ppnTanpaROK
  const grandTotalRealisasi = totalHargaRealisasi + ppnRealisasi
  
  content.innerHTML = `
    <!-- RAB Header -->
    <div class="grid grid-cols-2 gap-4 mb-6 bg-blue-50 p-4 rounded-lg">
      <div>
        <label class="text-sm font-semibold text-gray-600">Nomor RAB:</label>
        <p class="text-lg font-bold text-blue-600">${rab.nomor_rab}</p>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-600">Tanggal RAB:</label>
        <p class="text-lg font-bold">${formatDate(rab.tanggal_rab)}</p>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-600">Jenis RAB:</label>
        <p class="text-lg font-bold">${formatJenisRAB(rab.jenis_rab)}</p>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-600">Status:</label>
        <p class="text-lg"><span class="px-3 py-1 rounded-full ${getStatusColor(rab.status)}">${rab.status}</span></p>
      </div>
      
      <!-- ROK Percentage Input -->
      <div class="col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
        <label class="text-sm font-semibold text-gray-700 mb-2 block">
          <i class="fas fa-percentage mr-2 text-orange-600"></i>
          ROK (Rabat Omset Kasar) % - Markup dari Harga Tanpa ROK ke Harga SPK
        </label>
        <div class="flex items-center gap-3">
          <input type="number" 
                 id="rokInput" 
                 value="${rokPercentage}" 
                 min="0" 
                 max="100" 
                 step="0.1"
                 ${canEditPrice ? '' : 'disabled'}
                 class="w-32 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-bold text-center ${canEditPrice ? '' : 'bg-gray-100 cursor-not-allowed'}" />
          <span class="text-lg font-semibold text-orange-600">%</span>
          ${canEditPrice ? `
            <button onclick="saveROKPercentage(${rab.id})" 
                    class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition">
              <i class="fas fa-save mr-2"></i>Save ROK
            </button>
          ` : ''}
          <span class="text-sm text-gray-600 ml-3">
            Harga SPK = Harga Tanpa ROK × (1 + ROK%)
          </span>
        </div>
      </div>
      
      <div class="col-span-2">
        <label class="text-sm font-semibold text-gray-600">Total Harga RAB (inc. PPN 11%):</label>
        <p class="text-xl font-bold text-green-600" id="grandTotalDisplay">${formatRupiah(grandTotalRAB)}</p>
      </div>
      ${canEditPrice ? `
        <div class="col-span-2 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
          <p class="text-sm text-yellow-800">
            <i class="fas fa-edit mr-2"></i>
            <strong>Mode Edit:</strong> Anda dapat mengedit harga satuan dengan klik pada kolom harga. (Status: ${rab.status})
          </p>
        </div>
      ` : ''}
    </div>
    
    <!-- RAB Items Table -->
    <h3 class="text-lg font-bold text-gray-800 mb-4">
      <i class="fas fa-list mr-2"></i>Detail Material (${items.length} items)
    </h3>
    
    <div class="overflow-x-auto border rounded-lg">
      <table class="min-w-full text-xs border-collapse">
        <thead class="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <tr>
            <th class="px-2 py-2 border text-center" rowspan="2">No</th>
            <th class="px-2 py-2 border text-left text-xs" rowspan="2">Nomor LH05</th>
            <th class="px-2 py-2 border text-left text-xs" rowspan="2">Part Number</th>
            <th class="px-3 py-2 border text-left text-xs" rowspan="2">Material</th>
            <th class="px-2 py-2 border text-left text-xs" rowspan="2">Mesin</th>
            <th class="px-2 py-2 border text-center" rowspan="2">Jml</th>
            <th class="px-2 py-2 border text-left text-xs" rowspan="2">Unit</th>
            <th class="px-2 py-2 border text-center bg-blue-500" colspan="2">RAB</th>
            <th class="px-2 py-2 border text-center bg-green-500" colspan="2">SPK</th>
            <th class="px-2 py-2 border text-center bg-yellow-500" colspan="2">Tanpa ROK</th>
            <th class="px-2 py-2 border text-center bg-purple-500" colspan="2">Realisasi</th>
          </tr>
          <tr>
            <th class="px-2 py-1 border text-right bg-blue-100 text-blue-900 text-xs">Harga ${canEditPrice ? '<i class="fas fa-edit text-yellow-600 ml-1 text-xs"></i>' : ''}</th>
            <th class="px-2 py-1 border text-right bg-blue-100 text-blue-900 text-xs">Subtotal</th>
            <th class="px-2 py-1 border text-right bg-green-100 text-green-900 text-xs">Harga</th>
            <th class="px-2 py-1 border text-right bg-green-100 text-green-900 text-xs">Subtotal</th>
            <th class="px-2 py-1 border text-right bg-yellow-100 text-yellow-900 text-xs">Harga</th>
            <th class="px-2 py-1 border text-right bg-yellow-100 text-yellow-900 text-xs">Subtotal</th>
            <th class="px-2 py-1 border text-right bg-purple-100 text-purple-900 text-xs">Harga</th>
            <th class="px-2 py-1 border text-right bg-purple-100 text-purple-900 text-xs">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            const hargaSatuanRAB = item.harga_satuan || 0
            const hargaSatuanSPK = item.harga_satuan_spk || hargaSatuanRAB
            const hargaSatuanTanpaROK = item.harga_satuan_tanpa_rok || hargaSatuanRAB
            const hargaSatuanRealisasi = item.harga_satuan_realisasi || hargaSatuanRAB
            
            const subtotalRAB = hargaSatuanRAB * item.jumlah
            const subtotalSPK = hargaSatuanSPK * item.jumlah
            const subtotalTanpaROK = hargaSatuanTanpaROK * item.jumlah
            const subtotalRealisasi = hargaSatuanRealisasi * item.jumlah
            
            return `
            <tr class="hover:bg-gray-50 text-xs">
              <td class="px-2 py-2 border text-center">${index + 1}</td>
              <td class="px-2 py-2 border font-mono">${item.nomor_lh05 || '-'}</td>
              <td class="px-2 py-2 border font-mono">${item.part_number || '-'}</td>
              <td class="px-2 py-2 border">${item.material || '-'}</td>
              <td class="px-2 py-2 border">${item.mesin || '-'}</td>
              <td class="px-2 py-2 border text-center font-semibold">${item.jumlah || 0}</td>
              <td class="px-2 py-2 border">${item.unit_uld || '-'}</td>
              
              <!-- Harga Satuan RAB (Read-only in List TOR, Editable in List RAB) -->
              <td class="px-2 py-2 border text-right bg-blue-50 ${!isListTORPage && canEditPrice ? 'cursor-pointer hover:bg-yellow-50' : ''}" 
                  ${!isListTORPage && canEditPrice ? `onclick="editItemPrice(${rab.id}, ${item.id}, ${hargaSatuanRAB}, ${item.jumlah}, this)"` : ''}>
                <span id="price-${item.id}" class="${!isListTORPage && canEditPrice ? 'inline-flex items-center gap-1' : ''}">
                  ${formatRupiah(hargaSatuanRAB)}
                  ${!isListTORPage && canEditPrice ? '<i class="fas fa-pencil-alt text-xs text-gray-400"></i>' : ''}
                  ${isListTORPage ? '<i class="fas fa-lock text-xs text-gray-400 ml-1" title="Read-only"></i>' : ''}
                </span>
              </td>
              <td class="px-2 py-2 border text-right font-semibold bg-blue-50" id="subtotal-${item.id}">${formatRupiah(subtotalRAB)}</td>
              
              <!-- Harga Satuan SPK (Editable) -->
              <td class="px-2 py-2 border text-right bg-green-50 ${canEditPrice ? 'cursor-pointer hover:bg-yellow-50' : ''}" 
                  ${canEditPrice ? `onclick="editSPKPrice(${rab.id}, ${item.id}, ${hargaSatuanSPK}, ${item.jumlah}, ${rokPercentage}, this)"` : ''}>
                <span id="price-spk-${item.id}" class="${canEditPrice ? 'inline-flex items-center gap-1' : ''}">
                  ${formatRupiah(hargaSatuanSPK)}
                  ${canEditPrice ? '<i class="fas fa-pencil-alt text-xs text-gray-400"></i>' : ''}
                </span>
              </td>
              <td class="px-2 py-2 border text-right font-semibold bg-green-50" id="subtotal-spk-${item.id}">${formatRupiah(subtotalSPK)}</td>
              
              <!-- Harga Satuan Tanpa ROK (Auto-calculated, Read-only) -->
              <td class="px-2 py-2 border text-right bg-yellow-50">
                <span class="inline-flex items-center gap-1">
                  ${formatRupiah(hargaSatuanTanpaROK)}
                  <i class="fas fa-calculator text-xs text-gray-400" title="Auto-calculated: SPK ÷ (1 + ROK%)"></i>
                </span>
              </td>
              <td class="px-2 py-2 border text-right font-semibold bg-yellow-50" id="subtotal-tanpa-rok-${item.id}">${formatRupiah(subtotalTanpaROK)}</td>
              
              <!-- Harga Satuan Realisasi (Editable) -->
              <td class="px-2 py-2 border text-right bg-purple-50 ${canEditPrice ? 'cursor-pointer hover:bg-yellow-50' : ''}" 
                  ${canEditPrice ? `onclick="editRealisasiPrice(${rab.id}, ${item.id}, ${hargaSatuanRealisasi}, ${item.jumlah}, this)"` : ''}>
                <span id="price-realisasi-${item.id}" class="${canEditPrice ? 'inline-flex items-center gap-1' : ''}">
                  ${formatRupiah(hargaSatuanRealisasi)}
                  ${canEditPrice ? '<i class="fas fa-pencil-alt text-xs text-gray-400"></i>' : ''}
                </span>
              </td>
              <td class="px-2 py-2 border text-right font-semibold bg-purple-50" id="subtotal-realisasi-${item.id}">${formatRupiah(subtotalRealisasi)}</td>
            </tr>
          `}).join('')}
        </tbody>
        <tfoot class="bg-gray-100 font-bold text-xs">
          <tr>
            <td colspan="7" class="px-2 py-2 border text-right">Subtotal:</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-blue-100" id="subtotalRABDisplay">${formatRupiah(totalHargaRAB)}</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-green-100" id="subtotalSPKDisplay">${formatRupiah(totalHargaSPK)}</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-yellow-100" id="subtotalTanpaROKDisplay">${formatRupiah(totalHargaTanpaROK)}</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-purple-100" id="subtotalRealisasiDisplay">${formatRupiah(totalHargaRealisasi)}</td>
          </tr>
          <tr>
            <td colspan="7" class="px-2 py-2 border text-right">PPN 11%:</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-blue-100" id="ppnRABDisplay">${formatRupiah(ppnRAB)}</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-green-100" id="ppnSPKDisplay">${formatRupiah(ppnSPK)}</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-yellow-100" id="ppnTanpaROKDisplay">${formatRupiah(ppnTanpaROK)}</td>
            <td colspan="2" class="px-2 py-2 border text-right bg-purple-100" id="ppnRealisasiDisplay">${formatRupiah(ppnRealisasi)}</td>
          </tr>
          <tr class="bg-gray-200 text-sm">
            <td colspan="7" class="px-2 py-2 border text-right font-bold">TOTAL HARGA:</td>
            <td colspan="2" class="px-2 py-2 border text-right font-bold bg-blue-200" id="totalRABDisplay">${formatRupiah(grandTotalRAB)}</td>
            <td colspan="2" class="px-2 py-2 border text-right font-bold bg-green-200" id="totalSPKDisplay">${formatRupiah(grandTotalSPK)}</td>
            <td colspan="2" class="px-2 py-2 border text-right font-bold bg-yellow-200" id="totalTanpaROKDisplay">${formatRupiah(grandTotalTanpaROK)}</td>
            <td colspan="2" class="px-2 py-2 border text-right font-bold bg-purple-200" id="totalRealisasiDisplay">${formatRupiah(grandTotalRealisasi)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `
}

// Edit item price inline (Andalcekatan only, Draft only)
async function editItemPrice(rabId, itemId, currentPrice, quantity, element) {
  const username = localStorage.getItem('username') || ''
  if (username !== 'Andalcekatan') {
    alert('Hanya Andalcekatan yang dapat mengedit harga')
    return
  }
  
  // Prompt for new price
  const newPriceStr = prompt(`Edit Harga Satuan:\n\nHarga saat ini: Rp ${currentPrice.toLocaleString('id-ID')}\nJumlah: ${quantity}\n\nMasukkan harga baru (angka saja):`, currentPrice)
  
  if (newPriceStr === null) {
    return // User cancelled
  }
  
  const newPrice = parseFloat(newPriceStr.replace(/[^0-9]/g, ''))
  
  if (isNaN(newPrice) || newPrice < 0) {
    alert('Harga tidak valid!')
    return
  }
  
  if (newPrice === currentPrice) {
    alert('Harga tidak berubah')
    return
  }
  
  // Confirm
  const confirmed = confirm(`Ubah harga dari Rp ${currentPrice.toLocaleString('id-ID')} menjadi Rp ${newPrice.toLocaleString('id-ID')}?\n\nSubtotal baru: Rp ${(newPrice * quantity).toLocaleString('id-ID')}`)
  
  if (!confirmed) {
    return
  }
  
  try {
    console.log('Updating price:', { rabId, itemId, newPrice })
    
    const response = await fetch(`/api/rab/${rabId}/update-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({
        item_id: itemId,
        harga_satuan: newPrice
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ Price updated:', result)
    
    // Update display
    document.getElementById(`price-${itemId}`).innerHTML = `
      ${formatRupiah(result.harga_satuan)}
      <i class="fas fa-pencil-alt text-xs text-gray-400"></i>
    `
    document.getElementById(`subtotal-${itemId}`).textContent = formatRupiah(result.subtotal)
    
    // Update totals
    const subtotal = result.total_harga
    const ppn = subtotal * 0.11
    const total = subtotal * 1.11
    
    document.getElementById('subtotalDisplay').textContent = formatRupiah(subtotal)
    document.getElementById('ppnDisplay').textContent = formatRupiah(ppn)
    document.getElementById('totalDisplay').textContent = formatRupiah(total)
    document.getElementById('grandTotalDisplay').textContent = formatRupiah(total)
    
    // Show success message
    alert(`✅ Harga berhasil diupdate!\n\nHarga baru: Rp ${newPrice.toLocaleString('id-ID')}\nSubtotal baru: Rp ${result.subtotal.toLocaleString('id-ID')}\nTotal RAB: Rp ${total.toLocaleString('id-ID')}`)
    
    // Reload RAB list to reflect changes
    await loadRABList()
    
  } catch (error) {
    console.error('Failed to update price:', error)
    alert(`❌ Gagal mengupdate harga:\n\n${error.message}`)
  }
}

// Save ROK percentage for RAB (with button click)
async function saveROKPercentage(rabId) {
  const username = localStorage.getItem('username') || ''
  if (username !== 'Andalcekatan') {
    alert('Hanya Andalcekatan yang dapat mengedit ROK percentage')
    return
  }
  
  const rokInput = document.getElementById('rokInput')
  const rokPercentage = parseFloat(rokInput.value)
  
  if (isNaN(rokPercentage) || rokPercentage < 0 || rokPercentage > 100) {
    alert('ROK percentage tidak valid! Harus antara 0-100')
    return
  }
  
  const confirmed = confirm(`Simpan ROK percentage ${rokPercentage}%?\n\nFormula: Harga SPK = Harga Tanpa ROK × (1 + ${rokPercentage}%)\n\nSemua Harga Tanpa ROK akan dihitung ulang.`)
  
  if (!confirmed) return
  
  try {
    const response = await fetch(`/api/rab/${rabId}/update-rok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({
        rok_percentage: rokPercentage
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ ROK updated:', result)
    
    alert(`✅ ROK percentage berhasil disimpan: ${rokPercentage}%\n\nHalaman akan di-refresh untuk menampilkan perubahan.`)
    
    // Reload RAB detail to reflect changes
    await viewRABDetail(rabId)
    
  } catch (error) {
    console.error('Failed to update ROK:', error)
    alert(`❌ Gagal menyimpan ROK:\n\n${error.message}`)
  }
}

// Update ROK percentage for RAB (deprecated - now using Save button)
async function updateROKPercentage(rabId, rokPercentage) {
  const username = localStorage.getItem('username') || ''
  if (username !== 'Andalcekatan') {
    alert('Hanya Andalcekatan yang dapat mengedit ROK percentage')
    return
  }
  
  try {
    const response = await fetch(`/api/rab/${rabId}/update-rok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({
        rok_percentage: parseFloat(rokPercentage)
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ ROK updated:', result)
    
    alert(`✅ ROK percentage berhasil diupdate menjadi ${rokPercentage}%\n\nSilakan refresh untuk melihat perubahan pada Harga Tanpa ROK.`)
    
    // Reload RAB detail to reflect changes
    await viewRABDetail(rabId)
    
  } catch (error) {
    console.error('Failed to update ROK:', error)
    alert(`❌ Gagal mengupdate ROK:\n\n${error.message}`)
  }
}

// Edit SPK price
async function editSPKPrice(rabId, itemId, currentPrice, quantity, rokPercentage, element) {
  const username = localStorage.getItem('username') || ''
  if (username !== 'Andalcekatan') {
    alert('Hanya Andalcekatan yang dapat mengedit harga SPK')
    return
  }
  
  const newPriceStr = prompt(`Edit Harga Satuan SPK:\n\nHarga saat ini: Rp ${currentPrice.toLocaleString('id-ID')}\nJumlah: ${quantity}\nROK: ${rokPercentage}%\n\nMasukkan harga SPK baru (angka saja):`, currentPrice)
  
  if (newPriceStr === null) return
  
  const newPrice = parseFloat(newPriceStr.replace(/[^0-9]/g, ''))
  
  if (isNaN(newPrice) || newPrice < 0) {
    alert('Harga tidak valid!')
    return
  }
  
  if (newPrice === currentPrice) {
    alert('Harga tidak berubah')
    return
  }
  
  // CORRECT FORMULA: ROK is markup (kenaikan), not discount
  // Harga SPK = Harga Tanpa ROK × (1 + ROK%)
  // Therefore: Harga Tanpa ROK = Harga SPK / (1 + ROK%)
  const hargaTanpaROK = newPrice / (1 + rokPercentage / 100)
  
  const confirmed = confirm(`Ubah harga SPK dari Rp ${currentPrice.toLocaleString('id-ID')} menjadi Rp ${newPrice.toLocaleString('id-ID')}?\n\nROK: ${rokPercentage}%\nSubtotal SPK: Rp ${(newPrice * quantity).toLocaleString('id-ID')}\n\nHarga Tanpa ROK: Rp ${hargaTanpaROK.toLocaleString('id-ID')}\nSubtotal Tanpa ROK: Rp ${(hargaTanpaROK * quantity).toLocaleString('id-ID')}`)
  
  if (!confirmed) return
  
  try {
    const response = await fetch(`/api/rab/${rabId}/update-spk-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({
        item_id: itemId,
        harga_satuan_spk: newPrice
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ SPK price updated:', result)
    
    alert(`✅ Harga SPK berhasil diupdate!\n\nHarga SPK: Rp ${newPrice.toLocaleString('id-ID')}\nHarga Tanpa ROK: Rp ${result.harga_satuan_tanpa_rok.toLocaleString('id-ID')}`)
    
    // Reload RAB detail to reflect changes
    await viewRABDetail(rabId)
    
  } catch (error) {
    console.error('Failed to update SPK price:', error)
    alert(`❌ Gagal mengupdate harga SPK:\n\n${error.message}`)
  }
}

// Edit Realisasi price
async function editRealisasiPrice(rabId, itemId, currentPrice, quantity, element) {
  const username = localStorage.getItem('username') || ''
  if (username !== 'Andalcekatan') {
    alert('Hanya Andalcekatan yang dapat mengedit harga Realisasi')
    return
  }
  
  const newPriceStr = prompt(`Edit Harga Satuan Realisasi:\n\nHarga saat ini: Rp ${currentPrice.toLocaleString('id-ID')}\nJumlah: ${quantity}\n\nMasukkan harga Realisasi baru (angka saja):`, currentPrice)
  
  if (newPriceStr === null) return
  
  const newPrice = parseFloat(newPriceStr.replace(/[^0-9]/g, ''))
  
  if (isNaN(newPrice) || newPrice < 0) {
    alert('Harga tidak valid!')
    return
  }
  
  if (newPrice === currentPrice) {
    alert('Harga tidak berubah')
    return
  }
  
  const confirmed = confirm(`Ubah harga Realisasi dari Rp ${currentPrice.toLocaleString('id-ID')} menjadi Rp ${newPrice.toLocaleString('id-ID')}?\n\nSubtotal Realisasi: Rp ${(newPrice * quantity).toLocaleString('id-ID')}`)
  
  if (!confirmed) return
  
  try {
    const response = await fetch(`/api/rab/${rabId}/update-realisasi-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({
        item_id: itemId,
        harga_satuan_realisasi: newPrice
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ Realisasi price updated:', result)
    
    alert(`✅ Harga Realisasi berhasil diupdate!\n\nHarga Realisasi: Rp ${newPrice.toLocaleString('id-ID')}\nSubtotal: Rp ${result.subtotal_realisasi.toLocaleString('id-ID')}`)
    
    // Reload RAB detail to reflect changes
    await viewRABDetail(rabId)
    
  } catch (error) {
    console.error('Failed to update Realisasi price:', error)
    alert(`❌ Gagal mengupdate harga Realisasi:\n\n${error.message}`)
  }
}

// Close modal
function closeViewRABModal() {
  document.getElementById('viewRABModal').classList.add('hidden')
  currentRABDetail = null
}

// Export RAB to Excel
function exportRABToExcel() {
  if (!currentRABDetail) {
    alert('Tidak ada data RAB untuk di-export')
    return
  }
  
  const rab = currentRABDetail
  const items = rab.items || []
  
  // Prepare data
  const data = [
    ['RENCANA ANGGARAN BIAYA (RAB)'],
    [],
    ['Nomor RAB:', rab.nomor_rab],
    ['Tanggal:', formatDate(rab.tanggal_rab)],
    ['Jenis RAB:', formatJenisRAB(rab.jenis_rab)],
    ['Status:', rab.status],
    [],
    ['No', 'Nomor LH05', 'Part Number', 'Material', 'Mesin', 'Jumlah', 'Unit/ULD', 'Harga Satuan', 'Subtotal']
  ]
  
  items.forEach((item, index) => {
    data.push([
      index + 1,
      item.nomor_lh05,
      item.part_number,
      item.material,
      item.mesin || '-',
      item.jumlah,
      item.unit_uld || '-',
      item.harga_satuan,
      item.subtotal
    ])
  })
  
  const totalHarga = items.reduce((sum, item) => sum + item.subtotal, 0)
  const ppn = totalHarga * 0.11
  const grandTotal = totalHarga + ppn
  
  data.push([])
  data.push(['', '', '', '', '', '', '', 'Subtotal:', totalHarga])
  data.push(['', '', '', '', '', '', '', 'PPN 11%:', ppn])
  data.push(['', '', '', '', '', '', '', 'TOTAL HARGA:', grandTotal])
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Set column widths
  ws['!cols'] = [
    {wch: 5}, {wch: 20}, {wch: 15}, {wch: 30}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 15}
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, 'RAB')
  
  // Download
  XLSX.writeFile(wb, `RAB_${rab.nomor_rab}.xlsx`)
  
  console.log('RAB exported to Excel:', rab.nomor_rab)
}

// Export RAB to PDF
function exportRABToPDF() {
  if (!currentRABDetail) {
    alert('Tidak ada data RAB untuk di-export')
    return
  }
  
  const rab = currentRABDetail
  const items = rab.items || []
  
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  
  // Title
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text('RENCANA ANGGARAN BIAYA (RAB)', 105, 20, { align: 'center' })
  
  // RAB Info
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text(`Nomor RAB: ${rab.nomor_rab}`, 14, 35)
  doc.text(`Tanggal: ${formatDate(rab.tanggal_rab)}`, 14, 42)
  doc.text(`Jenis RAB: ${formatJenisRAB(rab.jenis_rab)}`, 14, 49)
  doc.text(`Status: ${rab.status}`, 14, 56)
  
  // Table
  const tableData = items.map((item, index) => [
    index + 1,
    item.nomor_lh05,
    item.part_number,
    item.material,
    item.mesin || '-',
    item.jumlah,
    item.unit_uld || '-',
    formatRupiah(item.harga_satuan),
    formatRupiah(item.subtotal)
  ])
  
  doc.autoTable({
    head: [['No', 'Nomor LH05', 'Part Number', 'Material', 'Mesin', 'Jml', 'Unit/ULD', 'Harga Satuan', 'Subtotal']],
    body: tableData,
    startY: 65,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 25 },
      8: { halign: 'right', cellWidth: 25 }
    }
  })
  
  // Total with PPN
  let finalY = doc.lastAutoTable.finalY + 10
  const totalHarga = items.reduce((sum, item) => sum + item.subtotal, 0)
  const ppn = totalHarga * 0.11
  const grandTotal = totalHarga + ppn
  
  doc.setFont(undefined, 'normal')
  doc.setFontSize(11)
  
  // Subtotal
  doc.text('Subtotal:', 120, finalY)
  doc.text(formatRupiah(totalHarga), 170, finalY, { align: 'right' })
  
  // PPN 11%
  finalY += 7
  doc.text('PPN 11%:', 120, finalY)
  doc.text(formatRupiah(ppn), 170, finalY, { align: 'right' })
  
  // Total Harga (bold)
  finalY += 10
  doc.setFont(undefined, 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL HARGA:', 120, finalY)
  doc.text(formatRupiah(grandTotal), 170, finalY, { align: 'right' })
  
  // Download
  doc.save(`RAB_${rab.nomor_rab}.pdf`)
  
  console.log('RAB exported to PDF:', rab.nomor_rab)
}

// Show error
function showError(message) {
  const tbody = document.getElementById('rabListTable')
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="px-4 py-8 text-center text-red-500">
        <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
        <p>${message}</p>
      </td>
    </tr>
  `
}

// Format Jenis RAB with full label
function formatJenisRAB(jenis) {
  if (!jenis || jenis === null || jenis === '') {
    return '<span class="text-gray-400">-</span> <span class="text-xs text-gray-400">(Dibuat sebelum fitur Jenis RAB)</span>'
  }
  
  const jenisLabels = {
    'KHS': 'KHS (Kontrak Harga Satuan)',
    'SPK': 'SPK (Surat Perintah Kerja)',
    'Pembelian Langsung': 'Pembelian Langsung'
  }
  
  return jenisLabels[jenis] || jenis
}

// View RAB History (Timeline)
async function viewRABHistory(rabId) {
  try {
    const response = await fetch(`/api/rab/${rabId}/history`)
    if (!response.ok) throw new Error('Failed to load history')
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load history')
    }
    
    // Show modal with timeline
    showRABHistoryModal(data)
    
  } catch (error) {
    console.error('Error loading RAB history:', error)
    alert('Gagal memuat history: ' + error.message)
  }
}

// Show RAB History Modal
function showRABHistoryModal(data) {
  const { rab, timeline } = data
  
  // Build timeline HTML
  const timelineHTML = timeline.map((item, index) => {
    const isLast = index === timeline.length - 1
    const connectorClass = isLast ? 'hidden' : ''
    
    // Determine style based on completion status
    const isCompleted = item.completed !== false && item.tanggal !== null
    const bgOpacity = isCompleted ? '100' : '50'
    const textOpacity = isCompleted ? 'text-gray-800' : 'text-gray-400'
    const borderStyle = isCompleted ? `border-${item.color}-500` : 'border-gray-300'
    const dateDisplay = item.tanggal ? formatDateTime(item.tanggal) : '<span class="text-gray-400 italic">Belum dilakukan</span>'
    
    return `
      <div class="flex gap-4 relative">
        <!-- Timeline Icon -->
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full bg-${item.color}-${bgOpacity} flex items-center justify-center ${isCompleted ? `text-${item.color}-600` : 'text-gray-400'} text-2xl z-10 ${isCompleted ? '' : 'opacity-50'}">
            ${item.icon}
          </div>
          <!-- Connector Line -->
          <div class="${connectorClass} w-1 h-full ${isCompleted ? 'bg-gray-300' : 'bg-gray-200'} absolute top-12 ${isCompleted ? '' : 'opacity-30'}"></div>
        </div>
        
        <!-- Timeline Content -->
        <div class="flex-1 pb-8">
          <div class="bg-white rounded-lg shadow-md p-4 border-l-4 ${borderStyle} ${isCompleted ? '' : 'opacity-60'}">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold text-lg ${textOpacity}">${item.status}</h3>
              <span class="text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-400'}">${dateDisplay}</span>
            </div>
            <p class="${isCompleted ? 'text-gray-600' : 'text-gray-400'} text-sm">${item.description}</p>
          </div>
        </div>
      </div>
    `
  }).join('')
  
  // Create modal
  const modal = document.createElement('div')
  modal.id = 'historyModal'
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-lg">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold flex items-center">
              <i class="fas fa-history mr-3"></i>
              History Timeline
            </h2>
            <p class="text-purple-100 mt-1">RAB: ${rab.nomor_rab}</p>
          </div>
          <button onclick="closeHistoryModal()" 
                  class="text-white hover:text-gray-200 text-2xl leading-none">
            ×
          </button>
        </div>
      </div>
      
      <!-- Timeline Content -->
      <div class="p-6">
        ${timeline.length > 0 ? timelineHTML : `
          <div class="text-center py-8 text-gray-500">
            <i class="fas fa-info-circle text-4xl mb-2"></i>
            <p>Belum ada history untuk RAB ini</p>
          </div>
        `}
      </div>
      
      <!-- Footer -->
      <div class="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-lg border-t flex justify-between items-center">
        <div class="text-sm text-gray-600">
          <i class="fas fa-info-circle mr-1"></i>
          Status saat ini: <span class="font-semibold text-${getStatusColor(rab.status)}-600">${rab.status}</span>
        </div>
        <button onclick="closeHistoryModal()" 
                class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg">
          <i class="fas fa-times mr-2"></i>Tutup
        </button>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHistoryModal()
  })
}

// Close History Modal
function closeHistoryModal() {
  const modal = document.getElementById('historyModal')
  if (modal) {
    modal.remove()
  }
}

// Format date time
function formatDateTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get status color
function getStatusColor(status) {
  const colors = {
    'Draft': 'blue',
    'Pengadaan': 'yellow',
    'Tersedia': 'green',
    'Masuk Gudang': 'purple'
  }
  return colors[status] || 'gray'
}

// Delete RAB (Admin and Andalcekatan only)
async function deleteRAB(rabId, nomorRAB) {
  const username = localStorage.getItem('username') || ''
  const confirmMessage = `⚠️ HAPUS RAB ${nomorRAB}?\n\n` +
                        `PERHATIAN:\n` +
                        `- RAB akan dihapus permanen\n` +
                        `- Material dengan status Pengadaan akan kembali ke Dashboard Kebutuhan\n` +
                        `- Tindakan ini TIDAK BISA DIBATALKAN!\n\n` +
                        `Yakin ingin melanjutkan?`
  
  if (!confirm(confirmMessage)) {
    return
  }
  
  try {
    const sessionToken = localStorage.getItem('sessionToken')
    const response = await fetch(`/api/rab/${rabId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    })
    
    const result = await response.json()
    
    if (result.success) {
      showSuccess(`✅ RAB ${nomorRAB} berhasil dihapus!\n\nMaterial telah dikembalikan ke Dashboard Kebutuhan dengan status Pengadaan.`)
      // Reload RAB list
      loadRABList()
    } else {
      showError(`❌ Gagal menghapus RAB: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to delete RAB:', error)
    showError('Gagal menghapus RAB')
  }
}

// Logout
function logout() {
  if (confirm('Yakin ingin logout?')) {
    fetch('/api/logout', { method: 'POST' })
      .then(() => {
        window.location.href = '/'
      })
  }
}
