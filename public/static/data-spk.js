// Data SPK - AMC Material System
console.log('Data SPK script loaded')

let allData = []
let filteredData = []
let isDataLoaded = false

// Load data on page load - MULTIPLE TRIGGERS
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOMContentLoaded event triggered')
  await loadData()
})

// FALLBACK: Also load on window load (in case DOM event missed)
window.addEventListener('load', async () => {
  if (!isDataLoaded) {
    console.log('⚠️ Fallback: window.load event triggered (DOMContentLoaded was missed)')
    await loadData()
  }
})

// IMMEDIATE LOAD: Execute immediately if DOM is already ready
if (document.readyState === 'loading') {
  console.log('⏳ Document still loading, waiting for DOMContentLoaded...')
} else {
  console.log('✅ Document already loaded, loading data immediately...')
  loadData()
}

// Load data from GitHub JSON
async function loadData() {
  try {
    console.log('🔄 Loading SPK data from GitHub...')
    
    const jsonUrl = 'https://raw.githubusercontent.com/ipanrifan-create/DATA-SPK/refs/heads/main/data_scm.json'
    const response = await fetch(jsonUrl)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const jsonData = await response.json()
    const records = jsonData['Data Izin Prinsip'] || []
    
    console.log(`📦 Loaded ${records.length} records from JSON`)
    
    // Parse data (skip first 2 rows: header and column names)
    allData = []
    for (let i = 2; i < records.length; i++) {
      const row = records[i]
      if (!row || row.length < 17) continue
      
      allData.push({
        no: row[0] || '-',
        nomor_ip: row[1] || '-',
        bidang: row[2] || '-',
        unit_pelaksana: row[3] || '-',
        metode_pengadaan: row[4] || '-',
        jenis_item: row[5] || '-',
        nilai: parseFloat(row[6]) || 0,
        ppn: parseFloat(row[7]) || 0,
        total: parseFloat(row[8]) || 0,
        project: row[9] || '-',
        keterangan: row[10] || '-',
        status: row[11] || '-',
        tgl_disetujui: row[12] || '-',
        nomor_spk: row[13] || '-',
        dibuat_oleh: row[14] || '-',
        nip: row[15] || '-',
        tgl_dibuat: row[16] || '-'
      })
    }
    
    console.log(`✅ Parsed ${allData.length} valid records`)
    
    // Mark as loaded
    isDataLoaded = true
    
    // Populate filter options
    populateFilters()
    
    // Apply default PEMBANGKITAN filter
    filterData()
    
    // Display data
    renderTable()
    updateDataInfo()
    
    console.log('✅ Data SPK successfully loaded and displayed!')
    
  } catch (error) {
    console.error('❌ Failed to load data:', error)
    console.error('Error details:', error.stack)
    isDataLoaded = false
    showError('Gagal memuat data SPK: ' + error.message)
  }
}

// Populate filter dropdowns
function populateFilters() {
  // Get unique Bidang values
  const bidangSet = new Set()
  const statusSet = new Set()
  
  allData.forEach(item => {
    if (item.bidang && item.bidang !== '-') bidangSet.add(item.bidang)
    if (item.status && item.status !== '-') statusSet.add(item.status)
  })
  
  // Populate Bidang filter
  const filterBidang = document.getElementById('filterBidang')
  filterBidang.innerHTML = '<option value="">Semua Bidang</option>'
  Array.from(bidangSet).sort().forEach(bidang => {
    filterBidang.innerHTML += `<option value="${bidang}">${bidang}</option>`
  })
  
  // Set default filter to PEMBANGKITAN
  filterBidang.value = 'PEMBANGKITAN'
  console.log('✅ Filter Bidang set to: PEMBANGKITAN (permanent default)')
  
  // Populate Status filter
  const filterStatus = document.getElementById('filterStatus')
  filterStatus.innerHTML = '<option value="">Semua Status</option>'
  Array.from(statusSet).sort().forEach(status => {
    filterStatus.innerHTML += `<option value="${status}">${status}</option>`
  })
}

// Filter data
function filterData() {
  const bidang = document.getElementById('filterBidang').value
  const status = document.getElementById('filterStatus').value
  const search = document.getElementById('searchBox').value.toLowerCase()
  
  filteredData = allData.filter(item => {
    // Filter by Bidang
    if (bidang && item.bidang !== bidang) return false
    
    // Filter by Status
    if (status && item.status !== status) return false
    
    // Filter by search
    if (search) {
      const searchableText = [
        item.nomor_ip,
        item.keterangan,
        item.project,
        item.nomor_spk,
        item.dibuat_oleh
      ].join(' ').toLowerCase()
      
      if (!searchableText.includes(search)) return false
    }
    
    return true
  })
  
  renderTable()
  updateDataInfo()
}

// Render table
function renderTable() {
  const tbody = document.getElementById('dataTableBody')
  
  if (filteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="17" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Tidak ada data yang ditampilkan</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = filteredData.map((item, index) => {
    // Get status badge color
    let statusColor = 'bg-gray-100 text-gray-800'
    if (item.status.includes('Acc') || item.status.includes('Disetujui')) {
      statusColor = 'bg-green-100 text-green-800'
    } else if (item.status.includes('Menunggu')) {
      statusColor = 'bg-yellow-100 text-yellow-800'
    } else if (item.status.includes('Reject')) {
      statusColor = 'bg-red-100 text-red-800'
    }
    
    return `
      <tr class="hover:bg-blue-50 transition-colors">
        <td class="px-3 py-2 text-center text-xs border-r border-gray-200">${index + 1}</td>
        <td class="px-3 py-2 text-xs font-mono border-r border-gray-200">${item.nomor_ip}</td>
        <td class="hidden-col px-3 py-2 text-xs border-r border-gray-200">
          <span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">${item.bidang}</span>
        </td>
        <td class="hidden-col px-3 py-2 text-xs border-r border-gray-200">${item.unit_pelaksana}</td>
        <td class="hidden-col px-3 py-2 text-xs border-r border-gray-200">${item.metode_pengadaan}</td>
        <td class="hidden-col px-3 py-2 text-xs border-r border-gray-200">
          <span class="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">${item.jenis_item}</span>
        </td>
        <td class="hidden-col px-3 py-2 text-right text-xs font-semibold border-r border-gray-200">${formatRupiah(item.nilai)}</td>
        <td class="hidden-col px-3 py-2 text-right text-xs font-semibold border-r border-gray-200">${formatRupiah(item.ppn)}</td>
        <td class="hidden-col px-3 py-2 text-right text-xs font-bold bg-yellow-50 border-r border-gray-200">${formatRupiah(item.total)}</td>
        <td class="px-3 py-2 text-xs border-r border-gray-200" style="max-width: 250px;">
          <div class="truncate" title="${item.project}">${item.project}</div>
        </td>
        <td class="px-3 py-2 text-xs border-r border-gray-200">
          <div class="whitespace-normal break-words" style="max-width: 400px;">${item.keterangan}</div>
        </td>
        <td class="px-3 py-2 text-xs border-r border-gray-200">
          <span class="inline-block px-2 py-1 ${statusColor} rounded text-xs font-medium whitespace-normal">${item.status}</span>
        </td>
        <td class="px-3 py-2 text-xs text-center border-r border-gray-200">${item.tgl_disetujui}</td>
        <td class="px-3 py-2 text-xs font-mono border-r border-gray-200">${item.nomor_spk}</td>
        <td class="hidden-col px-3 py-2 text-xs border-r border-gray-200">${item.dibuat_oleh}</td>
        <td class="hidden-col px-3 py-2 text-xs font-mono border-r border-gray-200">${item.nip}</td>
        <td class="hidden-col px-3 py-2 text-xs text-center">${item.tgl_dibuat}</td>
      </tr>
    `
  }).join('')
  
  // Apply hidden columns after rendering
  applyHiddenColumns()
}

// Update data info
function updateDataInfo() {
  const info = document.getElementById('dataInfo')
  const now = new Date().toLocaleString('id-ID')
  info.innerHTML = `
    <i class="fas fa-info-circle mr-2"></i>
    Menampilkan <strong>${filteredData.length}</strong> dari <strong>${allData.length}</strong> data | 
    Terakhir diupdate: ${now}
  `
}

// Format Rupiah
function formatRupiah(number) {
  if (!number || number === 0) return 'Rp 0'
  return 'Rp ' + number.toLocaleString('id-ID')
}

// Refresh data
async function refreshData() {
  console.log('🔄 Refreshing data...')
  await loadData()
  alert('✅ Data berhasil di-refresh!')
}

// Export to Excel
function exportToExcel() {
  if (filteredData.length === 0) {
    alert('Tidak ada data untuk di-export')
    return
  }
  
  // Prepare data for Excel
  const excelData = [
    [
      'No',
      'Nomor Izin Prinsip',
      'Bidang',
      'Unit Pelaksana',
      'Metode Pengadaan',
      'Jenis Item',
      'Nilai (Rp)',
      'PPN (Rp)',
      'Total Nilai + PPN (Rp)',
      'Project',
      'Keterangan',
      'Status',
      'Tgl Disetujui',
      'Nomor SPK',
      'Dibuat Oleh',
      'NIP',
      'Tgl Dibuat'
    ]
  ]
  
  filteredData.forEach((item, index) => {
    excelData.push([
      index + 1,
      item.nomor_ip,
      item.bidang,
      item.unit_pelaksana,
      item.metode_pengadaan,
      item.jenis_item,
      item.nilai,
      item.ppn,
      item.total,
      item.project,
      item.keterangan,
      item.status,
      item.tgl_disetujui,
      item.nomor_spk,
      item.dibuat_oleh,
      item.nip,
      item.tgl_dibuat
    ])
  })
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(excelData)
  
  // Set column widths
  ws['!cols'] = [
    {wch: 5},   // No
    {wch: 25},  // Nomor IP
    {wch: 20},  // Bidang
    {wch: 20},  // Unit Pelaksana
    {wch: 20},  // Metode Pengadaan
    {wch: 15},  // Jenis Item
    {wch: 15},  // Nilai
    {wch: 15},  // PPN
    {wch: 18},  // Total
    {wch: 35},  // Project
    {wch: 50},  // Keterangan
    {wch: 30},  // Status
    {wch: 15},  // Tgl Disetujui
    {wch: 20},  // Nomor SPK
    {wch: 25},  // Dibuat Oleh
    {wch: 15},  // NIP
    {wch: 15}   // Tgl Dibuat
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, 'Data SPK')
  
  // Download
  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `Data_SPK_${timestamp}.xlsx`)
  
  console.log('✅ Data exported to Excel')
}

// Toggle hidden columns
let columnsVisible = false
function toggleHiddenColumns() {
  columnsVisible = !columnsVisible
  const hiddenCols = document.querySelectorAll('.hidden-col')
  const toggleBtn = document.getElementById('toggleColumnsBtn')
  
  hiddenCols.forEach(col => {
    if (columnsVisible) {
      col.style.display = ''
    } else {
      col.style.display = 'none'
    }
  })
  
  // Update button text and icon
  if (columnsVisible) {
    toggleBtn.innerHTML = '<i class="fas fa-eye-slash mr-2"></i>Hide Columns'
    toggleBtn.className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow'
  } else {
    toggleBtn.innerHTML = '<i class="fas fa-eye mr-2"></i>Show Hidden Columns'
    toggleBtn.className = 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow'
  }
  
  console.log(`✅ Hidden columns ${columnsVisible ? 'shown' : 'hidden'}`)
}

// Initialize: Hide columns by default on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Page loaded, hidden columns will be applied after data renders')
})

// Show error
function showError(message) {
  const tbody = document.getElementById('dataTableBody')
  tbody.innerHTML = `
    <tr>
      <td colspan="17" class="px-4 py-8 text-center text-red-500">
        <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
        <p>${message}</p>
        <button onclick="loadData()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          <i class="fas fa-sync-alt mr-2"></i>Coba Lagi
        </button>
      </td>
    </tr>
  `
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
