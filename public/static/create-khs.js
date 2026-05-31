// CREATE KHS - Kontrak Harga Satuan
console.log('✅ Create KHS Script Loaded')

let allMaterials = []
let filteredMaterials = []
let selectedKHSMaterials = []

// Load materials on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing CREATE KHS...')
  
  // Set default date to today
  document.getElementById('tanggalKHS').valueAsDate = new Date()
  
  // Load available materials
  await loadMaterials()
})

// Load materials from API (same as CREATE RAB)
async function loadMaterials() {
  try {
    console.log('🔄 Loading materials from API...')
    
    const response = await fetch('/api/material-pengadaan', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to load materials')
    }
    
    const data = await response.json()
    console.log('📦 Received materials:', data)
    
    // Use ALL materials from API (same as CREATE RAB)
    // Sort by part_number for grouping similar materials
    if (Array.isArray(data)) {
      allMaterials = data.sort((a, b) => {
        const partA = (a.part_number || '').toUpperCase()
        const partB = (b.part_number || '').toUpperCase()
        if (partA < partB) return -1
        if (partA > partB) return 1
        return 0
      })
    } else if (data.materials) {
      allMaterials = data.materials.sort((a, b) => {
        const partA = (a.part_number || '').toUpperCase()
        const partB = (b.part_number || '').toUpperCase()
        if (partA < partB) return -1
        if (partA > partB) return 1
        return 0
      })
    } else {
      allMaterials = []
    }
    
    filteredMaterials = [...allMaterials]
    
    console.log(`✅ Loaded ${allMaterials.length} available materials`)
    
    // Populate unit checkboxes
    populateUnitCheckboxes()
    
    // Render materials table
    renderMaterialsTable()
    
  } catch (error) {
    console.error('❌ Failed to load materials:', error)
    document.getElementById('materialsTableBody').innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
          <p>Gagal memuat daftar material</p>
          <button onclick="loadMaterials()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <i class="fas fa-refresh mr-2"></i>Coba Lagi
          </button>
        </td>
      </tr>
    `
  }
}

// Populate unit checkboxes for filter
function populateUnitCheckboxes() {
  const units = [...new Set(allMaterials.map(m => m.lokasi_tujuan || m.unit_uld || 'N/A'))]
  const container = document.getElementById('filterUnitCheckboxes')
  
  const checkAllHTML = `
    <div class="flex items-center">
      <input type="checkbox" id="checkAllUnits" class="w-4 h-4 text-blue-600 rounded mr-2" onchange="toggleAllUnits()">
      <label for="checkAllUnits" class="text-sm text-gray-300 font-semibold">Pilih Semua</label>
    </div>
    <hr class="border-gray-700 my-2">
  `
  
  const unitsHTML = units.map(unit => `
    <div class="flex items-center">
      <input type="checkbox" id="unit_${unit}" value="${unit}" class="unit-checkbox w-4 h-4 text-blue-600 rounded mr-2" onchange="updateCheckAllUnits()">
      <label for="unit_${unit}" class="text-sm text-gray-300">${unit}</label>
    </div>
  `).join('')
  
  container.innerHTML = checkAllHTML + unitsHTML
}

// Toggle all unit checkboxes
function toggleAllUnits() {
  const checkAll = document.getElementById('checkAllUnits')
  const checkboxes = document.querySelectorAll('.unit-checkbox')
  checkboxes.forEach(cb => cb.checked = checkAll.checked)
}

// Update check all checkbox
function updateCheckAllUnits() {
  const checkAll = document.getElementById('checkAllUnits')
  const checkboxes = document.querySelectorAll('.unit-checkbox')
  const allChecked = Array.from(checkboxes).every(cb => cb.checked)
  checkAll.checked = allChecked
}

// Apply filters
function applyFilters() {
  console.log('🔍 Applying filters...')
  
  const nomorLH05 = document.getElementById('filterNomorLH05').value.toLowerCase()
  const namaMaterial = document.getElementById('filterNamaMaterial').value.toLowerCase()
  const jenisBarang = document.getElementById('filterJenisBarang').value
  
  const selectedUnits = Array.from(document.querySelectorAll('.unit-checkbox:checked')).map(cb => cb.value)
  
  filteredMaterials = allMaterials.filter(mat => {
    // Filter by Nomor LH05
    if (nomorLH05 && !mat.nomor_lh05.toLowerCase().includes(nomorLH05)) return false
    
    // Filter by Material name
    if (namaMaterial && !mat.material.toLowerCase().includes(namaMaterial)) return false
    
    // Filter by Jenis Barang
    if (jenisBarang && mat.jenis_barang !== jenisBarang) return false
    
    // Filter by Unit
    if (selectedUnits.length > 0) {
      const matUnit = mat.lokasi_tujuan || mat.unit_uld || 'N/A'
      if (!selectedUnits.includes(matUnit)) return false
    }
    
    return true
  })
  
  console.log(`✅ Filtered: ${filteredMaterials.length} materials`)
  renderMaterialsTable()
}

// Reset filters
function resetFilters() {
  document.getElementById('filterNomorLH05').value = ''
  document.getElementById('filterNamaMaterial').value = ''
  document.getElementById('filterJenisBarang').value = ''
  
  const checkboxes = document.querySelectorAll('.unit-checkbox')
  checkboxes.forEach(cb => cb.checked = false)
  document.getElementById('checkAllUnits').checked = false
  
  filteredMaterials = [...allMaterials]
  renderMaterialsTable()
}

// Render materials table
function renderMaterialsTable() {
  const tbody = document.getElementById('materialsTableBody')
  
  if (filteredMaterials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-3"></i>
          <p>Tidak ada material tersedia</p>
        </td>
      </tr>
    `
    document.getElementById('totalMaterials').textContent = '0'
    return
  }
  
  tbody.innerHTML = filteredMaterials.map((mat, index) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3 text-center">
        <input type="checkbox" class="material-checkbox w-5 h-5" data-id="${mat.id}">
      </td>
      <td class="px-4 py-3">${index + 1}</td>
      <td class="px-4 py-3 font-mono text-sm">${mat.nomor_lh05}</td>
      <td class="px-4 py-3 font-semibold text-blue-600">${mat.part_number}</td>
      <td class="px-4 py-3">${mat.material}</td>
      <td class="px-4 py-3">${mat.mesin}</td>
      <td class="px-4 py-3 text-center font-semibold">${mat.jumlah}</td>
      <td class="px-4 py-3">${mat.lokasi_tujuan || mat.unit_uld || '-'}</td>
      <td class="px-4 py-3">${mat.jenis_barang || 'Material Handal'}</td>
    </tr>
  `).join('')
  
  document.getElementById('totalMaterials').textContent = filteredMaterials.length
}

// Toggle select all
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll')
  const checkboxes = document.querySelectorAll('.material-checkbox')
  checkboxes.forEach(cb => cb.checked = selectAll.checked)
}

// Add selected materials to KHS
function addSelectedToKHS() {
  const checkboxes = document.querySelectorAll('.material-checkbox:checked')
  
  if (checkboxes.length === 0) {
    alert('❌ Pilih minimal 1 material terlebih dahulu!')
    return
  }
  
  let addedCount = 0
  checkboxes.forEach(checkbox => {
    const matId = parseInt(checkbox.dataset.id)
    const mat = filteredMaterials.find(m => m.id === matId)
    
    if (!mat) return
    
    // Check if already added
    if (selectedKHSMaterials.find(m => m.id === matId)) {
      console.warn(`⚠️ Material ${mat.part_number} sudah ditambahkan`)
      return
    }
    
    selectedKHSMaterials.push({
      id: mat.id,
      nomorLH05: mat.nomor_lh05,
      partNumber: mat.part_number,
      material: mat.material,
      mesin: mat.mesin,
      jumlah: mat.jumlah,
      unitUld: mat.lokasi_tujuan || mat.unit_uld || '',
      jenisBarang: mat.jenis_barang || 'Material Handal'
    })
    
    addedCount++
    checkbox.checked = false
  })
  
  document.getElementById('selectAll').checked = false
  
  if (addedCount > 0) {
    alert(`✅ ${addedCount} material ditambahkan ke KHS`)
  }
  
  updatePreviewTable()
}

// Update preview table
function updatePreviewTable() {
  const tbody = document.getElementById('previewTableKHS')
  
  if (selectedKHSMaterials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Belum ada material dipilih</p>
        </td>
      </tr>
    `
    document.getElementById('totalSelectedMaterials').textContent = '0'
    return
  }
  
  tbody.innerHTML = selectedKHSMaterials.map((mat, index) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3">${index + 1}</td>
      <td class="px-4 py-3 font-mono text-sm">${mat.nomorLH05}</td>
      <td class="px-4 py-3 font-semibold text-blue-600">${mat.partNumber}</td>
      <td class="px-4 py-3">${mat.material}</td>
      <td class="px-4 py-3">${mat.mesin}</td>
      <td class="px-4 py-3 text-center font-semibold">${mat.jumlah}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="removeFromKHS(${mat.id})" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('')
  
  document.getElementById('totalSelectedMaterials').textContent = selectedKHSMaterials.length
}

// Remove material from KHS
function removeFromKHS(matId) {
  selectedKHSMaterials = selectedKHSMaterials.filter(m => m.id !== matId)
  updatePreviewTable()
}

// Submit KHS
async function submitKHS() {
  // Validation
  if (selectedKHSMaterials.length === 0) {
    alert('❌ Minimal harus ada 1 material!')
    return
  }
  
  const tanggal = document.getElementById('tanggalKHS').value
  if (!tanggal) {
    alert('❌ Tanggal KHS harus diisi!')
    return
  }
  
  const payload = {
    tanggal_rab: tanggal,
    jenis_rab: 'KHS',
    rok_percentage: 0,  // No ROK for KHS
    use_ppn: false,     // No PPN for KHS (will be handled in backend)
    items: selectedKHSMaterials.map(mat => ({
      nomor_lh05: mat.nomorLH05,
      part_number: mat.partNumber,
      material: mat.material,
      mesin: mat.mesin,
      jumlah: mat.jumlah,
      unit_uld: mat.unitUld,
      harga_satuan: 0,    // No harga satuan for KHS
      subtotal: 0,        // No subtotal for KHS
      material_gangguan_id: mat.id
    }))
  }
  
  console.log('📤 Submitting KHS:', payload)
  
  try {
    const response = await fetch('/api/create-rab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify(payload)
    })
    
    const result = await response.json()
    
    if (result.success) {
      alert(`✅ KHS berhasil dibuat!\nNomor: ${result.nomor_rab}`)
      window.location.href = '/dashboard/list-rab'
    } else {
      alert(`❌ Gagal membuat KHS: ${result.error}`)
    }
  } catch (error) {
    console.error('❌ Submit error:', error)
    alert('❌ Terjadi kesalahan saat menyimpan KHS')
  }
}

// Logout function
function logout() {
  localStorage.removeItem('sessionToken')
  window.location.href = '/login'
}
