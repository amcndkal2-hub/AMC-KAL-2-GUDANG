// =============================================
// Dashboard Pengadaan Material
// Material dengan status Pengadaan dari LH05
// =============================================

let pengadaanData = []

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  loadPengadaanMaterial()
  
  // Auto refresh every 60 seconds
  setInterval(loadPengadaanMaterial, 60000)
})

async function loadPengadaanMaterial() {
  try {
    const response = await fetch('/api/material-pengadaan')
    const data = await response.json()
    
    pengadaanData = data || []
    updateStatistics()
    renderTable()
  } catch (error) {
    console.error('Load data error:', error)
    document.getElementById('pengadaanTable').innerHTML = `
      <tr>
        <td colspan="11" class="px-4 py-8 text-center text-red-500">
          <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
          <p>Gagal memuat data pengadaan</p>
        </td>
      </tr>
    `
  }
}

function updateStatistics() {
  const total = pengadaanData.length
  const withPO = pengadaanData.filter(m => m.no_po).length
  const withGRPO = pengadaanData.filter(m => m.no_grpo).length
  
  document.getElementById('totalPengadaan').textContent = total
  document.getElementById('totalWithPO').textContent = withPO
  document.getElementById('totalWithGRPO').textContent = withGRPO
}

function renderTable() {
  const tbody = document.getElementById('pengadaanTable')
  
  if (pengadaanData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="px-4 py-8 text-center text-gray-500">
          Belum ada material dalam status Pengadaan
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = pengadaanData.map((item, index) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3 text-center">${index + 1}</td>
      <td class="px-4 py-3">
        <a href="/dashboard/gangguan" class="text-blue-600 hover:underline font-semibold">
          ${item.nomor_lh05}
        </a>
      </td>
      <td class="px-4 py-3 font-semibold">${item.part_number}</td>
      <td class="px-4 py-3">${item.material || '-'}</td>
      <td class="px-4 py-3">${item.mesin || '-'}</td>
      <td class="px-4 py-3">${item.sn_mesin || '-'}</td>
      <td class="px-4 py-3 text-center font-semibold">${item.jumlah}</td>
      <td class="px-4 py-3">${item.lokasi_tujuan || '-'}</td>
      <td class="px-4 py-3">
        <input 
          type="text" 
          id="po_${item.id}" 
          value="${item.no_po || ''}" 
          placeholder="No PO"
          class="w-full px-2 py-1 border rounded text-sm"
          onblur="savePOGRPO(${item.id})"
        />
      </td>
      <td class="px-4 py-3">
        <input 
          type="text" 
          id="grpo_${item.id}" 
          value="${item.no_grpo || ''}" 
          placeholder="No GRPO"
          class="w-full px-2 py-1 border rounded text-sm"
          onblur="savePOGRPO(${item.id})"
        />
      </td>
      <td class="px-4 py-3 text-center">
        <button 
          onclick="savePOGRPO(${item.id})" 
          class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">
          <i class="fas fa-save"></i>
        </button>
      </td>
    </tr>
  `).join('')
}

async function savePOGRPO(materialId) {
  const noPO = document.getElementById(`po_${materialId}`).value.trim()
  const noGRPO = document.getElementById(`grpo_${materialId}`).value.trim()
  
  try {
    const response = await fetch('/api/update-po-grpo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: materialId,
        no_po: noPO || null,
        no_grpo: noGRPO || null
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      showNotification('✅ Data berhasil disimpan', 'success')
      loadPengadaanMaterial() // Reload data
    } else {
      showNotification('❌ Gagal menyimpan: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('Save error:', error)
    showNotification('❌ Terjadi kesalahan saat menyimpan', 'error')
  }
}

function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div')
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-semibold z-50 ${
    type === 'success' ? 'bg-green-600' : 'bg-red-600'
  }`
  notification.textContent = message
  
  document.body.appendChild(notification)
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.remove()
  }, 3000)
}
