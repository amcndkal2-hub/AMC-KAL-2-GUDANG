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
    
    // Sort by part_number untuk grouping material yang sama berdekatan
    data.sort((a, b) => {
      const partA = (a.part_number || '').toUpperCase()
      const partB = (b.part_number || '').toUpperCase()
      if (partA < partB) return -1
      if (partA > partB) return 1
      return 0
    })
    
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
    console.log('🔄 Loading unit filters...')
    const response = await fetch('/api/dropdown-values')
    const data = await response.json()
    console.log('📦 Units data:', data)
    
    const container = document.getElementById('filterUnitCheckboxes')
    if (!container) {
      console.error('❌ Container filterUnitCheckboxes not found!')
      return
    }
    
    // Save "Pilih Semua" section HTML
    const checkAllHTML = `
      <div class="flex items-center">
        <input type="checkbox" id="checkAllUnits" class="w-4 h-4 text-blue-600 rounded mr-2">
        <label for="checkAllUnits" class="text-sm text-gray-300 font-semibold">Pilih Semua</label>
      </div>
      <hr class="border-gray-700 my-2">
    `
    
    // Build unit checkboxes HTML
    let unitsHTML = ''
    if (data.units && data.units.length > 0) {
      data.units.forEach(unit => {
        unitsHTML += `
          <div class="flex items-center mb-2">
            <input type="checkbox" id="unit_${unit.replace(/\s+/g, '_')}" value="${unit}" 
                   class="unit-checkbox w-4 h-4 text-blue-600 rounded mr-2"
                   onchange="handleUnitChange()">
            <label for="unit_${unit.replace(/\s+/g, '_')}" class="text-sm text-gray-300">${unit}</label>
          </div>
        `
      })
    } else {
      unitsHTML = '<p class="text-xs text-gray-500">No units available</p>'
    }
    
    // Set container HTML
    container.innerHTML = checkAllHTML + unitsHTML
    
    // Check all by default
    document.getElementById('checkAllUnits').checked = true
    document.querySelectorAll('.unit-checkbox').forEach(cb => cb.checked = true)
    
    // Add event listener for "Check All"
    document.getElementById('checkAllUnits').addEventListener('change', function() {
      document.querySelectorAll('.unit-checkbox').forEach(cb => {
        cb.checked = this.checked
      })
    })
    
    console.log('✅ Unit filters loaded:', data.units.length, 'units')
    
  } catch (error) {
    console.error('❌ Failed to load units:', error)
    const container = document.getElementById('filterUnitCheckboxes')
    if (container) {
      container.innerHTML = '<p class="text-xs text-red-500">Failed to load units</p>'
    }
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
  
  // Sort by part_number untuk grouping
  filteredMaterialPengadaan.sort((a, b) => {
    const partA = (a.part_number || '').toUpperCase()
    const partB = (b.part_number || '').toUpperCase()
    if (partA < partB) return -1
    if (partA > partB) return 1
    return 0
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
    
    // Check if this material is already selected
    const isSelected = selectedMaterials.some(m => m.id === item.id)
    const disabledAttr = isSelected ? 'disabled' : ''
    const disabledClass = isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    const rowClass = isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
    
    return `
    <tr class="${rowClass}">
      <td class="px-4 py-3 border text-center">
        <input type="checkbox" 
               id="check_${item.id}" 
               class="w-5 h-5 ${disabledClass}"
               ${disabledAttr}
               ${isSelected ? 'checked' : ''}
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
               class="w-full px-2 py-1 border rounded text-right ${isSelected ? 'bg-gray-100' : ''}"
               placeholder="0"
               min="0"
               step="1000"
               ${disabledAttr}>
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
    
    const hargaSatuanDasar = parseInt(hargaInput.value) || 0
    
    if (hargaSatuanDasar === 0) {
      alert('Mohon masukkan harga satuan!')
      checkbox.checked = false
      return
    }
    
    // Apply ROK directly to unit price
    const rokPercentage = parseFloat(document.getElementById('rokPercentage')?.value) || 0
    const hargaSatuanWithROK = rokPercentage > 0 
      ? hargaSatuanDasar * (1 + rokPercentage / 100)
      : hargaSatuanDasar
    
    const subtotal = material.jumlah * hargaSatuanWithROK
    
    selectedMaterials.push({
      id: materialId,
      material_gangguan_id: materialId, // Add this for tracking
      nomor_lh05: material.nomor_lh05,
      part_number: material.part_number,
      material: material.material,
      mesin: material.mesin,
      jumlah: material.jumlah,
      unit_uld: material.lokasi_tujuan,
      harga_satuan_dasar: hargaSatuanDasar, // Store base price
      rok_percentage: rokPercentage, // Store ROK percentage
      harga_satuan: hargaSatuanWithROK, // Final price with ROK
      subtotal: subtotal
    })
    
    console.log('Material added with ROK:', material, 'ROK%:', rokPercentage, 'Final Price:', hargaSatuanWithROK)
  } else {
    // Remove from selected
    selectedMaterials = selectedMaterials.filter(m => m.id !== materialId)
    console.log('Material removed:', materialId)
  }
  
  // Re-render tabel pengadaan untuk update disabled state
  renderMaterialPengadaan(filteredMaterialPengadaan)
  
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
  
  // Group materials by part_number
  const groupedMaterials = {}
  selectedMaterials.forEach(item => {
    const key = item.part_number
    if (!groupedMaterials[key]) {
      groupedMaterials[key] = []
    }
    groupedMaterials[key].push(item)
  })
  
  // Build HTML with merged cells
  let html = ''
  let rowNumber = 0
  
  Object.keys(groupedMaterials).sort().forEach(partNumber => {
    const items = groupedMaterials[partNumber]
    const itemCount = items.length
    
    // Calculate total quantity and total subtotal for this part number
    const totalJumlah = items.reduce((sum, item) => sum + item.jumlah, 0)
    const totalSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    
    // First item of the group (with merged cells)
    const firstItem = items[0]
    
    items.forEach((item, index) => {
      rowNumber++
      html += `<tr class="hover:bg-gray-50">`
      
      // No - merged (only first row)
      if (index === 0) {
        html += `<td class="px-4 py-3 border text-center bg-blue-50 font-semibold" rowspan="${itemCount}">${rowNumber}</td>`
      }
      
      // Nomor LH05 - always show
      html += `<td class="px-4 py-3 border font-mono text-sm">${item.nomor_lh05}</td>`
      
      // Part Number - merged (only first row)
      if (index === 0) {
        html += `<td class="px-4 py-3 border font-mono text-sm bg-blue-50" rowspan="${itemCount}">${item.part_number}</td>`
      }
      
      // Material - merged (only first row)
      if (index === 0) {
        html += `<td class="px-4 py-3 border bg-blue-50" rowspan="${itemCount}">${item.material}</td>`
      }
      
      // Mesin - merged (only first row)
      if (index === 0) {
        html += `<td class="px-4 py-3 border text-sm bg-blue-50" rowspan="${itemCount}">${item.mesin || '-'}</td>`
      }
      
      // Jumlah (individual) - always show
      html += `<td class="px-4 py-3 border text-center">${item.jumlah}</td>`
      
      // Unit/ULD - always show
      html += `<td class="px-4 py-3 border">${item.unit_uld || '-'}</td>`
      
      // Jumlah Total - merged (only first row)
      if (index === 0) {
        html += `<td class="px-4 py-3 border text-center font-bold bg-yellow-50" rowspan="${itemCount}">${totalJumlah}</td>`
      }
      
      // Harga Satuan - merged (only first row)
      if (index === 0) {
        html += `<td class="px-4 py-3 border text-right bg-blue-50" rowspan="${itemCount}">${formatRupiah(item.harga_satuan)}</td>`
      }
      
      // Subtotal - merged (only first row, show total for all items with same part)
      if (index === 0) {
        html += `<td class="px-4 py-3 border text-right font-semibold bg-blue-50" rowspan="${itemCount}">${formatRupiah(totalSubtotal)}</td>`
      }
      
      // Aksi - always show
      html += `
        <td class="px-4 py-3 border text-center">
          <button onclick="removeMaterial(${item.id})" 
                  class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs">
            <i class="fas fa-times"></i>
          </button>
        </td>
      `
      
      html += `</tr>`
    })
  })
  
  tbody.innerHTML = html
}

// Remove material from selected
function removeMaterial(materialId) {
  const checkbox = document.getElementById(`check_${materialId}`)
  if (checkbox) checkbox.checked = false
  
  selectedMaterials = selectedMaterials.filter(m => m.id !== materialId)
  
  // Re-render tabel pengadaan untuk update disabled state
  renderMaterialPengadaan(filteredMaterialPengadaan)
  
  renderSelectedMaterials()
  updateTotalHarga()
}

// Update total harga
function updateTotalHarga() {
  // Subtotal is already calculated with ROK in item prices
  const subtotal = selectedMaterials.reduce((sum, item) => sum + item.subtotal, 0)
  
  // PPN (applied to subtotal that already includes ROK)
  const usePPN = document.getElementById('usePPN')?.checked || false
  const ppn = usePPN ? subtotal * 0.11 : 0
  
  // Total
  const total = subtotal + ppn
  
  // Update subtotal (already includes ROK per material)
  document.getElementById('subtotalHarga').textContent = formatRupiah(subtotal)
  
  // Hide ROK row since it's now per-material
  const rokRow = document.getElementById('rokRow')
  if (rokRow) {
    rokRow.style.display = 'none'
  }
  
  // Show/hide and update PPN row
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
    const rokPercentage = parseFloat(document.getElementById('rokPercentage')?.value) || 0
    const rok = rokPercentage > 0 ? (subtotal * rokPercentage / 100) : 0
    const usePPN = document.getElementById('usePPN')?.checked || false
    const subtotalAfterROK = subtotal + rok
    const ppn = usePPN ? subtotalAfterROK * 0.11 : 0
    const totalHarga = subtotalAfterROK + ppn
    
    let confirmMessage = `Create RAB dengan:\n\n` +
      `• Jenis RAB: ${jenisRAB}\n` +
      `• Tanggal: ${tanggalRAB}\n` +
      `• Total Material: ${selectedMaterials.length} items\n` +
      `• Subtotal: ${formatRupiah(subtotal)}\n`
    
    if (rokPercentage > 0) {
      confirmMessage += `• ROK ${rokPercentage}%: ${formatRupiah(rok)}\n`
    }
    
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
      rok_percentage: rokPercentage,
      rok_amount: rok,
      use_ppn: usePPN,
      ppn_amount: ppn,
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
