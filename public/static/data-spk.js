// Data SPK JavaScript
let allData = []
let filteredData = []

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Data SPK page loaded')
  await loadData()
})

// Load data from GitHub JSON
async function loadData() {
  try {
    console.log('🔄 Loading data from GitHub...')
    
    const jsonUrl = 'https://raw.githubusercontent.com/ipanrifan-create/DATA-SPK/refs/heads/main/data_scm.json'
    const response = await fetch(jsonUrl)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const jsonData = await response.json()
    const records = jsonData['Data Izin Prinsip'] || []
    
    console.log(`📦 Loaded ${records.length} records from JSON`)
    
    // Parse data (skip header rows)
    allData = []
    for (let i = 2; i < records.length; i++) {
      const row = records[i]
      if (!row || row.length < 17) continue
      
      allData.push({
        no: row[0],
        nomor_ip: row[1] || '-',
        bidang: row[2] || '-',
        unit_pelaksana: row[3] || '-',
        metode_pengadaan: row[4] || '-',
        jenis_item: row[5] || '-',
        nilai: row[6] || '0',
        ppn: row[7] || '0',
        total: row[8] || '0',
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
    
    // Populate filters
    populateFilters()
    
    // Display data
    filteredData = [...allData]
    renderTable()
    
    // Update info
    document.getElementById('dataInfo').innerHTML = `
      <i class="fas fa-info-circle mr-1"></i>
      Total <strong>${allData.length}</strong> records loaded from GitHub
      <span class="ml-4">
        <i class="fas fa-clock mr-1"></i>
        Last updated: ${new Date().toLocaleString('id-ID')}
      </span>
    `
    
  } catch (error) {
    console.error('❌ Failed to load data:', error)
    document.getElementById('dataTableBody').innerHTML = `
      <tr>
        <td colspan="17" class="px-4 py-8 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
          <p class="font-semibold">Gagal memuat data</p>
          <p class="text-sm">${error.message}</p>
          <button onclick="loadData()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-sync-alt mr-2"></i>Coba Lagi
          </button>
        </td>
      </tr>
    `
  }
}

// Populate filter dropdowns
function populateFilters() {
  // Get unique values
  const bidangSet = new Set()
  const statusSet = new Set()
  
  allData.forEach(item => {
    if (item.bidang && item.bidang !== '-') bidangSet.add(item.bidang)
    if (item.status && item.status !== '-') statusSet.add(item.status)
  })
  
  // Populate Bidang filter
  const filterBidang = document.getElementById('filterBidang')
  const bidangOptions = Array.from(bidangSet).sort()
  bidangOptions.forEach(bidang => {
    const option = document.createElement('option')
    option.value = bidang
    option.textContent = bidang
    filterBidang.appendChild(option)
  })
  
  // Populate Status filter
  const filterStatus = document.getElementById('filterStatus')
  const statusOptions = Array.from(statusSet).sort()
  statusOptions.forEach(status => {
    const option = document.createElement('option')
    option.value = status
    option.textContent = status
    filterStatus.appendChild(option)
  })
}

// Filter data
function filterData() {
  const bidangFilter = document.getElementById('filterBidang').value
  const statusFilter = document.getElementById('filterStatus').value
  const searchText = document.getElementById('searchBox').value.toLowerCase()
  
  filteredData = allData.filter(item => {
    // Filter by Bidang
    if (bidangFilter && item.bidang !== bidangFilter) return false
    
    // Filter by Status
    if (statusFilter && item.status !== statusFilter) return false
    
    // Filter by search text
    if (searchText) {
      const searchableText = `${item.nomor_ip} ${item.keterangan} ${item.project} ${item.nomor_spk}`.toLowerCase()
      if (!searchableText.includes(searchText)) return false
    }
    
    return true
  })
  
  renderTable()
}

// Render table
function renderTable() {
  const tbody = document.getElementById('dataTableBody')
  
  if (filteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="17" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-3xl mb-2"></i>
          <p>Tidak ada data yang ditampilkan</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = filteredData.map((item, index) => {
    // Format currency
    const formatCurrency = (value) => {
      if (!value || value === '-' || value === '0') return '-'
      const num = parseFloat(value.toString().replace(/\./g, '').replace(/,/g, ''))
      if (isNaN(num)) return value
      return new Intl.NumberFormat('id-ID').format(num)
    }
    
    // Status badge color
    let statusColor = 'gray'
    if (item.status.includes('Acc')) statusColor = 'green'
    else if (item.status.includes('Menunggu')) statusColor = 'yellow'
    else if (item.status.includes('Reject')) statusColor = 'red'
    
    return `
      <tr class="hover:bg-blue-50 transition-colors">
        <td class="px-3 py-2 text-xs text-gray-900 border-r">${index + 1}</td>
        <td class="px-3 py-2 text-xs text-gray-900 font-semibold border-r whitespace-nowrap">${item.nomor_ip}</td>
        <td class="px-3 py-2 text-xs border-r">
          <span class="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
            ${item.bidang}
          </span>
        </td>
        <td class="px-3 py-2 text-xs text-gray-700 border-r whitespace-nowrap">${item.unit_pelaksana}</td>
        <td class="px-3 py-2 text-xs text-gray-700 border-r whitespace-nowrap">${item.metode_pengadaan}</td>
        <td class="px-3 py-2 text-xs border-r">
          <span class="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 whitespace-nowrap">
            ${item.jenis_item}
          </span>
        </td>
        <td class="px-3 py-2 text-xs text-right text-gray-900 font-mono border-r whitespace-nowrap">
          ${formatCurrency(item.nilai)}
        </td>
        <td class="px-3 py-2 text-xs text-right text-gray-900 font-mono border-r whitespace-nowrap">
          ${formatCurrency(item.ppn)}
        </td>
        <td class="px-3 py-2 text-xs text-right text-gray-900 font-semibold font-mono border-r whitespace-nowrap bg-yellow-50">
          ${formatCurrency(item.total)}
        </td>
        <td class="px-3 py-2 text-xs text-gray-700 border-r" style="max-width: 250px;">
          <div class="truncate" title="${item.project}">
            ${item.project}
          </div>
        </td>
        <td class="px-3 py-2 text-xs text-gray-700 border-r" style="max-width: 300px;">
          <div class="truncate" title="${item.keterangan}">
            ${item.keterangan}
          </div>
        </td>
        <td class="px-3 py-2 text-xs border-r">
          <span class="px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
            statusColor === 'green' ? 'bg-green-100 text-green-800' :
            statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
            statusColor === 'red' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }">
            ${item.status}
          </span>
        </td>
        <td class="px-3 py-2 text-xs text-gray-700 border-r whitespace-nowrap">${item.tgl_disetujui}</td>
        <td class="px-3 py-2 text-xs text-gray-900 font-medium border-r whitespace-nowrap">${item.nomor_spk}</td>
        <td class="px-3 py-2 text-xs text-gray-700 border-r whitespace-nowrap">${item.dibuat_oleh}</td>
        <td class="px-3 py-2 text-xs text-gray-700 font-mono border-r whitespace-nowrap">${item.nip}</td>
        <td class="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">${item.tgl_dibuat}</td>
      </tr>
    `
  }).join('')
}

// Refresh data
async function refreshData() {
  document.getElementById('dataTableBody').innerHTML = `
    <tr>
      <td colspan="17" class="px-4 py-8 text-center text-gray-500">
        <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
        <p>Memuat ulang data...</p>
      </td>
    </tr>
  `
  await loadData()
}

// Export to Excel
function exportToExcel() {
  try {
    // Prepare data for export
    const exportData = filteredData.map((item, index) => ({
      'No': index + 1,
      'Nomor Izin Prinsip': item.nomor_ip,
      'Bidang': item.bidang,
      'Unit Pelaksana': item.unit_pelaksana,
      'Metode Pengadaan': item.metode_pengadaan,
      'Jenis Item': item.jenis_item,
      'Nilai (Rp)': item.nilai,
      'PPN (Rp)': item.ppn,
      'Total Nilai + PPN (Rp)': item.total,
      'Project': item.project,
      'Keterangan': item.keterangan,
      'Status': item.status,
      'Tgl Disetujui': item.tgl_disetujui,
      'Nomor SPK': item.nomor_spk,
      'Dibuat Oleh': item.dibuat_oleh,
      'NIP': item.nip,
      'Tgl Dibuat': item.tgl_dibuat
    }))
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // Create workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data SPK')
    
    // Generate filename with date
    const filename = `Data_SPK_${new Date().toISOString().split('T')[0]}.xlsx`
    
    // Save file
    XLSX.writeFile(wb, filename)
    
    console.log('✅ Excel file exported:', filename)
  } catch (error) {
    console.error('❌ Failed to export Excel:', error)
    alert('Gagal export Excel: ' + error.message)
  }
}

// Logout function
function logout() {
  if (confirm('Apakah Anda yakin ingin logout?')) {
    localStorage.removeItem('sessionToken')
    localStorage.removeItem('username')
    window.location.href = '/login'
  }
}
