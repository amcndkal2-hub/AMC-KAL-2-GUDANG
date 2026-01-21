// Dashboard Utama - Analytics
// Fetch data dan render tables

async function loadDashboardData() {
  try {
    console.log('🔄 Loading dashboard data...')
    
    const response = await fetch('/api/dashboard/main', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to load dashboard data')
    }
    
    const data = await response.json()
    console.log('✅ Dashboard data loaded:', data)
    
    // Update summary cards
    document.getElementById('totalTransactions').textContent = data.summary.totalTransactions
    document.getElementById('totalTopMaterials').textContent = data.summary.totalTopMaterials
    document.getElementById('totalCriticalStock').textContent = data.summary.totalCriticalStock
    
    // Render Top Materials Table
    renderTopMaterialsTable(data.topMaterials)
    
    // Render Critical Stock Table
    renderCriticalStockTable(data.criticalStock)
    
  } catch (error) {
    console.error('❌ Error loading dashboard:', error)
    alert('Gagal memuat data dashboard: ' + error.message)
  }
}

function renderTopMaterialsTable(materials) {
  const tbody = document.getElementById('topMaterialsTable')
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-3"></i>
          <p>Belum ada data material keluar</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map((mat, index) => {
    const rankColors = [
      'bg-yellow-400 text-white', // Rank 1 - Gold
      'bg-gray-400 text-white',   // Rank 2 - Silver
      'bg-orange-400 text-white', // Rank 3 - Bronze
      'bg-blue-100 text-blue-800' // Others
    ]
    const rankColor = rankColors[index] || rankColors[3]
    
    const rankIcons = [
      '<i class="fas fa-trophy"></i>', // Rank 1
      '<i class="fas fa-medal"></i>',  // Rank 2
      '<i class="fas fa-award"></i>',  // Rank 3
      ''                               // Others
    ]
    const rankIcon = rankIcons[index] || ''
    
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-3">
          <span class="${rankColor} px-3 py-1 rounded-full font-bold text-lg">
            ${rankIcon} #${index + 1}
          </span>
        </td>
        <td class="px-4 py-3 font-mono font-semibold">${mat.partNumber}</td>
        <td class="px-4 py-3">${mat.material || '-'}</td>
        <td class="px-4 py-3">${mat.mesin || '-'}</td>
        <td class="px-4 py-3 text-center">
          <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold">
            ${mat.frekuensi}x
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-semibold">
            ${mat.totalKeluar} pcs
          </span>
        </td>
        <td class="px-4 py-3">
          <span class="text-sm bg-gray-200 px-2 py-1 rounded">${mat.jenisBarang || '-'}</span>
        </td>
      </tr>
    `
  }).join('')
}

function renderCriticalStockTable(materials) {
  const tbody = document.getElementById('criticalStockTable')
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-check-circle text-4xl text-green-500 mb-3"></i>
          <p class="text-green-600 font-semibold">Semua material stok aman (> 5 buah)</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map(mat => {
    // Status berdasarkan stok
    let statusClass = 'bg-yellow-100 text-yellow-800'
    let statusIcon = 'fa-exclamation-triangle'
    let statusText = 'Perlu Perhatian'
    
    if (mat.stokAkhir === 0) {
      statusClass = 'bg-red-100 text-red-800'
      statusIcon = 'fa-times-circle'
      statusText = 'HABIS'
    } else if (mat.stokAkhir <= 2) {
      statusClass = 'bg-orange-100 text-orange-800'
      statusIcon = 'fa-exclamation-circle'
      statusText = 'KRITIS'
    }
    
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-3 font-mono font-semibold">${mat.partNumber}</td>
        <td class="px-4 py-3">${mat.material || '-'}</td>
        <td class="px-4 py-3">${mat.mesin || '-'}</td>
        <td class="px-4 py-3 text-center">
          <span class="${statusClass} px-4 py-2 rounded-full font-bold text-lg">
            ${mat.stokAkhir}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="${statusClass} px-3 py-1 rounded-full font-semibold">
            <i class="fas ${statusIcon} mr-1"></i>
            ${statusText}
          </span>
        </td>
        <td class="px-4 py-3">
          <span class="text-sm bg-gray-200 px-2 py-1 rounded">${mat.jenisBarang || '-'}</span>
        </td>
      </tr>
    `
  }).join('')
}

// Logout function
function logout() {
  sessionStorage.removeItem('sessionToken')
  sessionStorage.removeItem('username')
  sessionStorage.removeItem('role')
  window.location.href = '/login'
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData()
  
  // Auto-refresh setiap 5 menit
  setInterval(loadDashboardData, 5 * 60 * 1000)
})
