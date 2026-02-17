// Dashboard Create RAB - AMC Material System
console.log('Dashboard Create RAB loaded')

let allMaterialPengadaan = []
let filteredMaterialPengadaan = []
let selectedMaterials = []

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing Create RAB...')
  
  // Set tanggal RAB to today
  const today = new Date().toISOString().split('T')[0]
  document.getElementById('tanggalRAB').value = today
  
  // Load material pengadaan
  loadMaterialPengadaan()
  
  // Populate unit checkboxes
  populateUnitFilter()
})

// Load material with status Pengadaan
async function loadMaterialPengadaan() {
  try {
    console.log('Loading material pengadaan...')
    const response = await fetch('/api/material-pengadaan')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Material pengadaan loaded:', data)
    
    allMaterialPengadaan = data
    filteredMaterialPengadaan = [...data]
    renderMaterialPengadaan(filteredMaterialPengadaan)
    
  } catch (error) {
    console.error('Failed to load material pengadaan:', error)
    showError('Gagal memuat data material pengadaan')
  }
}

// Populate unit filter checkboxes
async function populateUnitFilter() {
  try {
    const response = await fetch('/api/dropdown-values')
    const data = await response.json()
    
    const container = document.getElementById('filterUnitCheckboxes')
    const checkAllDiv = container.querySelector('.flex.items-center').parentElement
    
    // Clear existing except "Pilih Semua"
    container.innerHTML = ''
    container.appendChild(checkAllDiv)
    
    // Add unit checkboxes
    data.units.forEach(unit => {
      const div = document.createElement('div')
      div.className = 'flex items-center'
      div.innerHTML = `
        <input type="checkbox" id="unit_${unit}" value="${unit}" 
               class="unit-checkbox w-4 h-4 text-blue-600 rounded mr-2"
               onchange="handleUnitChange()">
        <label for="unit_${unit}" class="text-sm text-gray-300">${unit}</label>
      `
      container.appendChild(div)
    })
    
    // Check all by default
    document.getElementById('checkAllUnits').checked = true
    document.querySelectorAll('.unit-checkbox').forEach(cb => cb.checked = true)
    
    // Add event listener for "Check All"
    document.getElementById('checkAllUnits').addEventListener('change', function() {
      document.querySelectorAll('.unit-checkbox').forEach(cb => {
        cb.checked = this.checked
      })
    })
    
  } catch (error) {
    console.error('Failed to load units:', error)
  }
}

// Handle unit checkbox change
function handleUnitChange() {
  const allCheckboxes = document.querySelectorAll('.unit-checkbox')
  const checkedCount = document.querySelectorAll('.unit-checkbox:checked').length
  const checkAll = document.getElementById('checkAllUnits')
  
  // Update "Pilih Semua" state
  checkAll.checked = checkedCount === allCheckboxes.length
}

// Apply filters
function applyFilters() {
  const jenisBarangFilter = document.getElementById('filterJenisBarang').value
  const selectedUnits = Array.from(document.querySelectorAll('.unit-checkbox:checked'))
    .map(cb => cb.value)
  
  filteredMaterialPengadaan = allMaterialPengadaan.filter(item => {
    let match = true
    
    // Filter by Jenis Barang
    if (jenisBarangFilter) {
      const itemJenis = (item.jenis_barang || 'Material Handal').toUpperCase()
      const filterJenis = jenisBarangFilter.toUpperCase()
      if (itemJenis !== filterJenis) {
        match = false
      }
    }
    
    // Filter by Unit (if any units selected)
    if (selectedUnits.length > 0) {
      const itemUnit = item.lokasi_tujuan || item.unit_uld || ''
      if (!selectedUnits.includes(itemUnit)) {
        match = false
      }
    }
    
    return match
  })
  
  renderMaterialPengadaan(filteredMaterialPengadaan)
}

// Reset filters
function resetFilters() {
  document.getElementById('filterJenisBarang').value = ''
  document.getElementById('checkAllUnits').checked = true
  document.querySelectorAll('.unit-checkbox').forEach(cb => cb.checked = true)
  
  filteredMaterialPengadaan = [...allMaterialPengadaan]
  renderMaterialPengadaan(filteredMaterialPengadaan)
}

// Render material pengadaan table
function renderMaterialPengadaan(materials) {
  const tbody = document.getElementById('materialPengadaanTable')
  
  if (materials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Tidak ada material dengan status Pengadaan</p>
          <p class="text-sm mt-2">Material akan muncul setelah input gangguan dengan status Pengadaan</p>
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = materials.map((item, index) => {
    const jenisBarang = item.jenis_barang || 'Material Handal'
    let jenisBadge = ''
    if (jenisBarang === 'Material Handal' || jenisBarang === 'MATERIAL HANDAL') {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">Material Handal</span>`
    } else if (jenisBarang === 'Filter' || jenisBarang === 'FILTER') {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">Filter</span>`
    } else if (jenisBarang === 'Material Bekas' || jenisBarang === 'MATERIAL BEKAS') {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">Material Bekas</span>`
    } else {
      jenisBadge = `<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">${jenisBarang}</span>`
    }
    
    return `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 border text-center">
        <input type="checkbox" 
               id="check_${item.id}" 
               class="w-5 h-5 cursor-pointer"
               onchange="toggleMaterial(${item.id})">
      </td>
      <td class="px-4 py-3 border font-mono text-sm">${item.nomor_lh05 || '-'}</td>
      <td class="px-4 py-3 border font-mono text-sm">${item.part_number || '-'}</td>
      <td class="px-4 py-3 border">${item.material || '-'}</td>
      <td class="px-4 py-3 border">${jenisBadge}</td>
      <td class="px-4 py-3 border text-sm">${item.mesin || '-'}</td>
      <td class="px-4 py-3 border text-center">${item.jumlah || 0}</td>
      <td class="px-4 py-3 border">${item.lokasi_tujuan || '-'}</td>
      <td class="px-4 py-3 border">
        <input type="number" 
               id="harga_${item.id}" 
               class="w-full px-2 py-1 border rounded text-right"
               placeholder="0"
               min="0"
               step="1000">
      </td>
    </tr>
  `
  }).join('')
}

// Toggle material selection
function toggleMaterial(materialId) {
  const checkbox = document.getElementById(`check_${materialId}`)
  const hargaInput = document.getElementById(`harga_${materialId}`)
  
  if (checkbox.checked) {
    // Add to selected
    const material = allMaterialPengadaan.find(m => m.id === materialId)
    if (!material) return
    
    const hargaSatuan = parseInt(hargaInput.value) || 0
    
    if (hargaSatuan === 0) {
      alert('Mohon masukkan harga satuan!')
      checkbox.checked = false
      return
    }
    
    const subtotal = material.jumlah * hargaSatuan
    
    selectedMaterials.push({
      id: materialId,
      material_gangguan_id: materialId, // Add this for tracking
      nomor_lh05: material.nomor_lh05,
      part_number: material.part_number,
      material: material.material,
      mesin: material.mesin,
      jumlah: material.jumlah,
      unit_uld: material.lokasi_tujuan,
      harga_satuan: hargaSatuan,
      subtotal: subtotal
    })
    
    console.log('Material added:', material)
  } else {
    // Remove from selected
    selectedMaterials = selectedMaterials.filter(m => m.id !== materialId)
    console.log('Material removed:', materialId)
  }
  
  renderSelectedMaterials()
  updateTotalHarga()
}

// Render selected materials table
function renderSelectedMaterials() {
  const section = document.getElementById('selectedMaterialsSection')
  const tbody = document.getElementById('selectedMaterialsTable')
  
  if (selectedMaterials.length === 0) {
    section.classList.add('hidden')
    return
  }
  
  section.classList.remove('hidden')
  
  tbody.innerHTML = selectedMaterials.map((item, index) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 border text-center">${index + 1}</td>
      <td class="px-4 py-3 border font-mono text-sm">${item.nomor_lh05}</td>
      <td class="px-4 py-3 border font-mono text-sm">${item.part_number}</td>
      <td class="px-4 py-3 border">${item.material}</td>
      <td class="px-4 py-3 border text-sm">${item.mesin || '-'}</td>
      <td class="px-4 py-3 border text-center">${item.jumlah}</td>
      <td class="px-4 py-3 border">${item.unit_uld || '-'}</td>
      <td class="px-4 py-3 border text-right">${formatRupiah(item.harga_satuan)}</td>
      <td class="px-4 py-3 border text-right font-semibold">${formatRupiah(item.subtotal)}</td>
      <td class="px-4 py-3 border text-center">
        <button onclick="removeMaterial(${item.id})" 
                class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs">
          <i class="fas fa-times"></i>
        </button>
      </td>
    </tr>
  `).join('')
}

// Remove material from selected
function removeMaterial(materialId) {
  const checkbox = document.getElementById(`check_${materialId}`)
  if (checkbox) checkbox.checked = false
  
  selectedMaterials = selectedMaterials.filter(m => m.id !== materialId)
  
  renderSelectedMaterials()
  updateTotalHarga()
}

// Update total harga
function updateTotalHarga() {
  const subtotal = selectedMaterials.reduce((sum, item) => sum + item.subtotal, 0)
  const usePPN = document.getElementById('usePPN')?.checked || false
  const ppn = usePPN ? subtotal * 0.11 : 0
  const total = subtotal + ppn
  
  // Update subtotal
  document.getElementById('subtotalHarga').textContent = formatRupiah(subtotal)
  
  // Show/hide PPN row
  const ppnRow = document.getElementById('ppnRow')
  if (ppnRow) {
    ppnRow.style.display = usePPN ? 'table-row' : 'none'
    document.getElementById('ppnHarga').textContent = formatRupiah(ppn)
  }
  
  // Update total
  document.getElementById('totalHarga').textContent = formatRupiah(total)
}

// Format rupiah
function formatRupiah(number) {
  return 'Rp ' + number.toLocaleString('id-ID')
}

// Reset RAB
function resetRAB() {
  if (!confirm('Reset semua pilihan material?')) return
  
  // Uncheck all checkboxes
  selectedMaterials.forEach(item => {
    const checkbox = document.getElementById(`check_${item.id}`)
    if (checkbox) checkbox.checked = false
  })
  
  // Clear selected materials
  selectedMaterials = []
  
  // Clear harga inputs
  allMaterialPengadaan.forEach(item => {
    const hargaInput = document.getElementById(`harga_${item.id}`)
    if (hargaInput) hargaInput.value = ''
  })
  
  renderSelectedMaterials()
  updateTotalHarga()
  
  console.log('RAB reset')
}

// Create RAB
async function createRAB() {
  try {
    // Validation
    const tanggalRAB = document.getElementById('tanggalRAB').value
    const jenisRAB = document.getElementById('jenisRAB').value
    
    if (!tanggalRAB) {
      alert('Mohon pilih tanggal RAB!')
      return
    }
    
    if (!jenisRAB) {
      alert('Mohon pilih jenis RAB!')
      return
    }
    
    if (selectedMaterials.length === 0) {
      alert('Mohon pilih minimal 1 material!')
      return
    }
    
    // Confirm
    const subtotal = selectedMaterials.reduce((sum, item) => sum + item.subtotal, 0)
    const usePPN = document.getElementById('usePPN')?.checked || false
    const ppn = usePPN ? subtotal * 0.11 : 0
    const totalHarga = subtotal + ppn
    
    let confirmMessage = `Create RAB dengan:\n\n` +
      `• Jenis RAB: ${jenisRAB}\n` +
      `• Tanggal: ${tanggalRAB}\n` +
      `• Total Material: ${selectedMaterials.length} items\n` +
      `• Subtotal: ${formatRupiah(subtotal)}\n`
    
    if (usePPN) {
      confirmMessage += `• PPN 11%: ${formatRupiah(ppn)}\n`
    }
    
    confirmMessage += `• Total Harga: ${formatRupiah(totalHarga)}\n\n` +
      `Lanjutkan?`
    
    const confirmation = confirm(confirmMessage)
    
    if (!confirmation) return
    
    console.log('Creating RAB...')
    
    // Prepare data
    const rabData = {
      tanggal_rab: tanggalRAB,
      jenis_rab: jenisRAB,
      items: selectedMaterials.map(item => ({
        nomor_lh05: item.nomor_lh05,
        part_number: item.part_number,
        material: item.material,
        mesin: item.mesin || '',
        jumlah: item.jumlah,
        unit_uld: item.unit_uld || '',
        harga_satuan: item.harga_satuan,
        subtotal: item.subtotal
      })),
      status: 'Draft',
      created_by: 'System'
    }
    
    console.log('RAB data:', rabData)
    
    // Send to API
    const response = await fetch('/api/create-rab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rabData)
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to create RAB')
    }
    
    console.log('RAB created:', result)
    
    alert(
      `✅ RAB berhasil dibuat!\n\n` +
      `Nomor RAB: ${result.nomor_rab}\n` +
      `Total Harga: ${formatRupiah(result.total_harga)}`
    )
    
    // Reset form
    resetRAB()
    
    // Reload material pengadaan
    loadMaterialPengadaan()
    
  } catch (error) {
    console.error('Failed to create RAB:', error)
    alert('❌ Gagal membuat RAB: ' + error.message)
  }
}

// Show error message
function showError(message) {
  const tbody = document.getElementById('materialPengadaanTable')
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="px-4 py-8 text-center text-red-500">
        <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
        <p>${message}</p>
      </td>
    </tr>
  `
}

// Logout function
function logout() {
  if (confirm('Yakin ingin logout?')) {
    fetch('/api/logout', { method: 'POST' })
      .then(() => {
        window.location.href = '/'
      })
  }
}
