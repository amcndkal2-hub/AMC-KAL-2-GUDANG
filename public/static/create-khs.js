// CREATE KHS - Kontrak Harga Satuan
console.log('✅ Create KHS Script Loaded')

let availableMaterials = []
let selectedMaterials = []
let materialIdCounter = 0

// Load available materials on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Set default date to today
  document.getElementById('tanggalKHS').valueAsDate = new Date()
  
  // Load available materials
  await loadAvailableMaterials()
  
  // Setup form submit
  document.getElementById('formCreateKHS').addEventListener('submit', handleSubmit)
})

// Load materials that are available (not selected for SPK or Pembelian Langsung)
async function loadAvailableMaterials() {
  try {
    console.log('🔄 Loading available materials for KHS...')
    
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
    
    // Filter out materials that already have is_rab_created = 1
    // These are materials already selected for SPK or Pembelian Langsung
    availableMaterials = (data.materials || []).filter(mat => {
      return !mat.is_rab_created || mat.is_rab_created === 0
    })
    
    console.log(`✅ Found ${availableMaterials.length} available materials (not yet in RAB)`)
    
    renderMaterialList()
  } catch (error) {
    console.error('❌ Failed to load materials:', error)
    document.getElementById('materialListContainer').innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
        <p>Gagal memuat daftar material</p>
        <button onclick="loadAvailableMaterials()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <i class="fas fa-refresh mr-2"></i>Coba Lagi
        </button>
      </div>
    `
  }
}

// Render material list with checkboxes
function renderMaterialList() {
  const container = document.getElementById('materialListContainer')
  
  if (availableMaterials.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i class="fas fa-inbox text-4xl mb-3"></i>
        <p class="font-semibold">Tidak ada material tersedia</p>
        <p class="text-sm mt-2">Semua material sudah dipilih untuk SPK atau Pembelian Langsung</p>
      </div>
    `
    return
  }
  
  container.innerHTML = availableMaterials.map((mat, index) => `
    <div class="border border-gray-300 rounded-lg p-4 hover:bg-blue-50 transition">
      <div class="flex items-start gap-3">
        <input type="checkbox" 
               id="mat_${index}" 
               class="material-checkbox mt-1 w-5 h-5 text-blue-600 rounded"
               data-index="${index}"
               onchange="updateSelectedCount()">
        <label for="mat_${index}" class="flex-1 cursor-pointer">
          <div class="font-semibold text-gray-800">
            ${mat.material}
          </div>
          <div class="text-sm text-gray-600 mt-1 grid grid-cols-2 gap-2">
            <div><span class="font-medium">LH05:</span> ${mat.nomor_lh05}</div>
            <div><span class="font-medium">Part Number:</span> ${mat.part_number}</div>
            <div><span class="font-medium">Mesin:</span> ${mat.mesin}</div>
            <div><span class="font-medium">Jumlah:</span> ${mat.jumlah}</div>
            <div><span class="font-medium">Unit:</span> ${mat.lokasi_tujuan || mat.unit_uld || '-'}</div>
            <div><span class="font-medium">Jenis:</span> ${mat.jenis_barang || 'Material Handal'}</div>
          </div>
        </label>
      </div>
    </div>
  `).join('')
  
  console.log(`✅ Rendered ${availableMaterials.length} materials`)
}

// Update selected count
function updateSelectedCount() {
  const checked = document.querySelectorAll('.material-checkbox:checked').length
  console.log(`📊 Selected: ${checked} materials`)
}

// Add selected materials to preview
function addSelectedMaterials() {
  const checkboxes = document.querySelectorAll('.material-checkbox:checked')
  
  if (checkboxes.length === 0) {
    alert('❌ Pilih minimal 1 material terlebih dahulu!')
    return
  }
  
  checkboxes.forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index)
    const mat = availableMaterials[index]
    
    // Check if already added
    if (selectedMaterials.find(m => m.materialGangguanId === mat.id)) {
      console.warn(`⚠️ Material ${mat.part_number} sudah ditambahkan`)
      return
    }
    
    materialIdCounter++
    selectedMaterials.push({
      id: materialIdCounter,
      materialGangguanId: mat.id,
      nomorLH05: mat.nomor_lh05,
      partNumber: mat.part_number,
      material: mat.material,
      mesin: mat.mesin,
      jumlah: mat.jumlah,
      hargaSatuan: 0,
      subtotal: 0,
      unitUld: mat.lokasi_tujuan || mat.unit_uld || '',
      jenisBarang: mat.jenis_barang || 'Material Handal'
    })
    
    // Uncheck and disable
    checkbox.checked = false
    checkbox.disabled = true
  })
  
  updatePreviewTable()
  updateTotal()
}

// Update preview table
function updatePreviewTable() {
  const tbody = document.getElementById('previewTableKHS')
  
  if (selectedMaterials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Belum ada material dipilih</p>
        </td>
      </tr>
    `
    document.getElementById('totalMaterialsKHS').textContent = '0'
    return
  }
  
  tbody.innerHTML = selectedMaterials.map((mat, index) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3">${index + 1}</td>
      <td class="px-4 py-3">${mat.nomorLH05}</td>
      <td class="px-4 py-3 font-semibold text-blue-600">${mat.partNumber}</td>
      <td class="px-4 py-3">${mat.material}</td>
      <td class="px-4 py-3">${mat.mesin}</td>
      <td class="px-4 py-3 text-center">${mat.jumlah}</td>
      <td class="px-4 py-3 text-right">
        <input type="number" 
               class="w-full px-2 py-1 border rounded text-right"
               value="${mat.hargaSatuan}"
               min="0"
               step="1000"
               onchange="updateHargaSatuan(${mat.id}, this.value)"
               placeholder="Harga">
      </td>
      <td class="px-4 py-3 text-right font-semibold">${formatRupiah(mat.subtotal)}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="removeMaterial(${mat.id})" 
                class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('')
  
  document.getElementById('totalMaterialsKHS').textContent = selectedMaterials.length
}

// Update harga satuan
function updateHargaSatuan(matId, harga) {
  const mat = selectedMaterials.find(m => m.id === matId)
  if (!mat) return
  
  mat.hargaSatuan = parseFloat(harga) || 0
  mat.subtotal = mat.hargaSatuan * mat.jumlah
  
  updatePreviewTable()
  updateTotal()
}

// Remove material
function removeMaterial(matId) {
  const mat = selectedMaterials.find(m => m.id === matId)
  if (!mat) return
  
  // Re-enable checkbox
  const matIndex = availableMaterials.findIndex(m => m.id === mat.materialGangguanId)
  if (matIndex !== -1) {
    const checkbox = document.querySelector(`input[data-index="${matIndex}"]`)
    if (checkbox) {
      checkbox.disabled = false
    }
  }
  
  selectedMaterials = selectedMaterials.filter(m => m.id !== matId)
  updatePreviewTable()
  updateTotal()
}

// Update total
function updateTotal() {
  const subtotal = selectedMaterials.reduce((sum, mat) => sum + mat.subtotal, 0)
  const ppn = subtotal * 0.11
  const total = subtotal + ppn
  
  document.getElementById('totalKHS').textContent = formatRupiah(total)
}

// Format Rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

// Handle form submit
async function handleSubmit(e) {
  e.preventDefault()
  
  // Validation
  if (selectedMaterials.length === 0) {
    alert('❌ Minimal harus ada 1 material!')
    return
  }
  
  // Check all materials have harga satuan
  const missingPrice = selectedMaterials.find(mat => mat.hargaSatuan === 0)
  if (missingPrice) {
    alert(`❌ Material "${missingPrice.material}" belum diisi harga satuan!`)
    return
  }
  
  const tanggal = document.getElementById('tanggalKHS').value
  const rokPercentage = parseFloat(document.getElementById('rokPercentage').value) || 10
  
  const payload = {
    tanggal_rab: tanggal,
    jenis_rab: 'KHS',
    rok_percentage: rokPercentage,
    use_ppn: true,
    items: selectedMaterials.map(mat => ({
      nomor_lh05: mat.nomorLH05,
      part_number: mat.partNumber,
      material: mat.material,
      mesin: mat.mesin,
      jumlah: mat.jumlah,
      unit_uld: mat.unitUld,
      harga_satuan: mat.hargaSatuan,
      subtotal: mat.subtotal,
      material_gangguan_id: mat.materialGangguanId
    }))
  }
  
  console.log('📤 Submitting KHS:', payload)
  
  try {
    const response = await fetch('/api/rab/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify(payload)
    })
    
    const result = await response.json()
    
    if (result.success) {
      alert(`✅ KHS berhasil dibuat!\nNomor: ${result.nomor_rab}\nTotal: ${formatRupiah(result.total_harga)}`)
      window.location.href = '/dashboard/list-rab'
    } else {
      alert(`❌ Gagal membuat KHS: ${result.error}`)
    }
  } catch (error) {
    console.error('❌ Submit error:', error)
    alert('❌ Terjadi kesalahan saat menyimpan KHS')
  }
}

// Add button untuk menambahkan material yang dipilih
document.addEventListener('DOMContentLoaded', () => {
  // Add button after material list
  setTimeout(() => {
    const container = document.getElementById('materialListContainer')
    if (container && availableMaterials.length > 0) {
      const addButton = document.createElement('button')
      addButton.type = 'button'
      addButton.className = 'mt-4 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold'
      addButton.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>Tambah Material yang Dipilih'
      addButton.onclick = addSelectedMaterials
      container.appendChild(addButton)
    }
  }, 1000)
})
