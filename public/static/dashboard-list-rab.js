// Dashboard List RAB - AMC Material System
console.log('Dashboard List RAB loaded')

let allRABList = []
let currentRABDetail = null

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, loading RAB list...')
  loadRABList()
})

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
    renderRABList(data)
    
  } catch (error) {
    console.error('Failed to load RAB list:', error)
    showError('Gagal memuat daftar RAB')
  }
}

// Render RAB list table
function renderRABList(rabList) {
  const tbody = document.getElementById('rabListTable')
  
  if (rabList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Belum ada RAB yang dibuat</p>
          <p class="text-sm mt-2">Buat RAB baru di menu Create RAB</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = rabList.map((rab, index) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 border text-center">${index + 1}</td>
      <td class="px-4 py-3 border font-mono text-sm font-semibold text-blue-600">${rab.nomor_rab || '-'}</td>
      <td class="px-4 py-3 border text-center">${formatDate(rab.tanggal_rab)}</td>
      <td class="px-4 py-3 border text-center">
        <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
          ${rab.item_count || 0} items
        </span>
      </td>
      <td class="px-4 py-3 border text-right font-semibold">${formatRupiah(rab.total_harga)}</td>
      <td class="px-4 py-3 border text-center">
        <select onchange="updateRABStatus(${rab.id}, this.value)" 
                class="px-3 py-1 rounded text-xs font-semibold border-0 cursor-pointer ${getStatusColorSelect(rab.status)}">
          <option value="Draft" ${rab.status === 'Draft' ? 'selected' : ''}>Draft</option>
          <option value="Pengadaan" ${rab.status === 'Pengadaan' ? 'selected' : ''}>Pengadaan</option>
          <option value="Tersedia" ${rab.status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
        </select>
      </td>
      <td class="px-4 py-3 border text-center">
        <button onclick="viewRABDetail(${rab.id})" 
                class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
          <i class="fas fa-eye mr-1"></i>View
        </button>
      </td>
    </tr>
  `).join('')
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
    'Tersedia': 'bg-green-100 text-green-700'
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
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
    
    // Reload list
    loadRABList()
    
  } catch (error) {
    console.error('Failed to update RAB status:', error)
    alert('❌ Gagal update status: ' + error.message)
    
    // Reset dropdown to previous value
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
  
  const items = rab.items || []
  const totalHarga = items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
  
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
        <label class="text-sm font-semibold text-gray-600">Status:</label>
        <p class="text-lg"><span class="px-3 py-1 rounded-full ${getStatusColor(rab.status)}">${rab.status}</span></p>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-600">Total Harga:</label>
        <p class="text-xl font-bold text-green-600">${formatRupiah(totalHarga)}</p>
      </div>
    </div>
    
    <!-- RAB Items Table -->
    <h3 class="text-lg font-bold text-gray-800 mb-4">
      <i class="fas fa-list mr-2"></i>Detail Material (${items.length} items)
    </h3>
    
    <div class="overflow-x-auto border rounded-lg">
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 border text-center">No</th>
            <th class="px-4 py-3 border text-left">Nomor LH05</th>
            <th class="px-4 py-3 border text-left">Part Number</th>
            <th class="px-4 py-3 border text-left">Material</th>
            <th class="px-4 py-3 border text-left">Mesin</th>
            <th class="px-4 py-3 border text-center">Jumlah</th>
            <th class="px-4 py-3 border text-left">Unit/ULD</th>
            <th class="px-4 py-3 border text-right">Harga Satuan</th>
            <th class="px-4 py-3 border text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 border text-center">${index + 1}</td>
              <td class="px-4 py-3 border font-mono text-sm">${item.nomor_lh05 || '-'}</td>
              <td class="px-4 py-3 border font-mono text-sm">${item.part_number || '-'}</td>
              <td class="px-4 py-3 border">${item.material || '-'}</td>
              <td class="px-4 py-3 border text-sm">${item.mesin || '-'}</td>
              <td class="px-4 py-3 border text-center">${item.jumlah || 0}</td>
              <td class="px-4 py-3 border">${item.unit_uld || '-'}</td>
              <td class="px-4 py-3 border text-right">${formatRupiah(item.harga_satuan)}</td>
              <td class="px-4 py-3 border text-right font-semibold">${formatRupiah(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot class="bg-gray-100 font-bold">
          <tr>
            <td colspan="8" class="px-4 py-3 border text-right text-lg">TOTAL HARGA:</td>
            <td class="px-4 py-3 border text-right text-xl text-green-600">${formatRupiah(totalHarga)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `
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
  data.push([])
  data.push(['', '', '', '', '', '', '', 'TOTAL HARGA:', totalHarga])
  
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
  doc.text(`Status: ${rab.status}`, 14, 49)
  
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
    startY: 58,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 25 },
      8: { halign: 'right', cellWidth: 25 }
    }
  })
  
  // Total
  const finalY = doc.lastAutoTable.finalY + 10
  const totalHarga = items.reduce((sum, item) => sum + item.subtotal, 0)
  
  doc.setFont(undefined, 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL HARGA:', 120, finalY)
  doc.text(formatRupiah(totalHarga), 170, finalY)
  
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

// Logout
function logout() {
  if (confirm('Yakin ingin logout?')) {
    fetch('/api/logout', { method: 'POST' })
      .then(() => {
        window.location.href = '/'
      })
  }
}
