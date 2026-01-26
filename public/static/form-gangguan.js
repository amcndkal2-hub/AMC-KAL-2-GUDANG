// =============================================
// Form Gangguan dan Permintaan Material - LH05
// =============================================

let materialRowCountGangguan = 0

// Signature Pad
let canvasPelapor, ctxPelapor, isDrawingPelapor = false

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Form Gangguan initialized');
  initializeForm()
  setupSignaturePads()
  loadDropdownUnits()
  
  // NOTE: Material rows now handled by form-gangguan-material-list.js
  // No longer calling addMaterialRow() here
})

function initializeForm() {
  console.log('✅ Initializing form controls');
  
  // Set default datetime to now
  const now = new Date()
  const localDateTime = now.toISOString().slice(0, 16)
  const hariTanggalInput = document.getElementById('hariTanggal');
  if (hariTanggalInput) {
    hariTanggalInput.value = localDateTime
    console.log('✅ Default datetime set:', localDateTime);
  }
  
  // Form submit
  const gangguanForm = document.getElementById('gangguanForm');
  if (gangguanForm) {
    gangguanForm.addEventListener('submit', handleFormSubmit)
    console.log('✅ Form submit handler attached');
  }
  
  // Reset button
  const resetBtn = document.getElementById('resetFormGangguan');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetForm)
    console.log('✅ Reset button handler attached');
  }
}

// Load Unit/ULD dropdown from API
async function loadDropdownUnits() {
  console.log('📋 Loading Unit/ULD dropdown...');
  try {
    const response = await fetch('/api/dropdown-values')
    const data = await response.json()
    
    console.log('✅ Dropdown data received:', data);
    
    const unitSelect = document.getElementById('unitULD')
    
    if (!unitSelect) {
      console.error('❌ unitULD select element not found!');
      return;
    }
    
    if (data.units && data.units.length > 0) {
      data.units.forEach(unit => {
        const option = document.createElement('option')
        option.value = unit
        option.textContent = unit
        unitSelect.appendChild(option)
      })
      console.log(`✅ Added ${data.units.length} units to dropdown`);
    } else {
      console.warn('⚠️ No units data received');
    }
  } catch (error) {
    console.error('❌ Error loading units:', error)
  }
}

// ===== Signature Pad =====
function setupSignaturePads() {
  console.log('🖊️ Setting up signature pads...');
  
  // Pelapor
  canvasPelapor = document.getElementById('signaturePelapor')
  
  if (!canvasPelapor) {
    console.error('❌ signaturePelapor canvas not found!');
    return;
  }
  
  console.log('✅ signaturePelapor canvas found');
  ctxPelapor = canvasPelapor.getContext('2d')
  setupCanvas(canvasPelapor, ctxPelapor)
  
  canvasPelapor.addEventListener('mousedown', (e) => startDrawing(e, 'pelapor'))
  canvasPelapor.addEventListener('mousemove', (e) => draw(e, 'pelapor'))
  canvasPelapor.addEventListener('mouseup', () => stopDrawing('pelapor'))
  canvasPelapor.addEventListener('mouseout', () => stopDrawing('pelapor'))
  
  // Touch events for mobile
  canvasPelapor.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    canvasPelapor.dispatchEvent(mouseEvent)
  })
  canvasPelapor.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    canvasPelapor.dispatchEvent(mouseEvent)
  })
  canvasPelapor.addEventListener('touchend', (e) => {
    e.preventDefault()
    const mouseEvent = new MouseEvent('mouseup', {})
    canvasPelapor.dispatchEvent(mouseEvent)
  })
  
  // Clear button
  document.getElementById('clearPelapor').addEventListener('click', () => clearSignature('pelapor'))
}

function setupCanvas(canvas, ctx) {
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function startDrawing(e, type) {
  isDrawingPelapor = true
  const rect = canvasPelapor.getBoundingClientRect()
  ctxPelapor.beginPath()
  ctxPelapor.moveTo(e.clientX - rect.left, e.clientY - rect.top)
}

function draw(e, type) {
  if (!isDrawingPelapor) return
  
  const rect = canvasPelapor.getBoundingClientRect()
  ctxPelapor.lineTo(e.clientX - rect.left, e.clientY - rect.top)
  ctxPelapor.stroke()
}

function stopDrawing(type) {
  isDrawingPelapor = false
}

function clearSignature(type) {
  ctxPelapor.clearRect(0, 0, canvasPelapor.width, canvasPelapor.height)
}

// ===== Material Management =====
function addMaterialRow() {
  materialRowCountGangguan++
  const rowId = `material-gangguan-${materialRowCountGangguan}`
  
  const materialRow = document.createElement('div')
  materialRow.id = rowId
  materialRow.className = 'bg-gray-50 p-4 rounded-lg border-2 border-gray-200'
  materialRow.innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <h3 class="font-semibold text-gray-700">
        <i class="fas fa-box mr-2 text-red-600"></i>Material #${materialRowCountGangguan}
      </h3>
      ${materialRowCountGangguan > 1 ? `
        <button type="button" onclick="removeMaterialRow('${rowId}')" class="text-red-600 hover:text-red-700">
          <i class="fas fa-times"></i>
        </button>
      ` : ''}
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="md:col-span-2">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          <i class="fas fa-search mr-1"></i>Part Number (Searchable)
        </label>
        <input type="text" 
          class="part-number-search w-full px-4 py-2 border border-gray-300 rounded-lg"
          placeholder="Ketik part number untuk search..."
          data-row="${rowId}">
        <div class="search-results mt-2" id="${rowId}-results"></div>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Barang</label>
        <input type="text" readonly
          class="jenis-barang w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Material</label>
        <input type="text" readonly
          class="material w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Mesin</label>
        <input type="text" readonly
          class="mesin w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Jumlah Dibutuhkan</label>
        <input type="number" required min="1"
          class="jumlah w-full px-4 py-2 border border-gray-300 rounded-lg">
      </div>
    </div>
  `
  
  document.getElementById('materialListGangguan').appendChild(materialRow)
  
  // Setup search for this row
  setupMaterialSearch(rowId)
}

function removeMaterialRow(rowId) {
  document.getElementById(rowId).remove()
}

function setupMaterialSearch(rowId) {
  const row = document.getElementById(rowId)
  const searchInput = row.querySelector('.part-number-search')
  const resultsDiv = row.querySelector('.search-results')
  
  let searchTimeout
  
  searchInput.addEventListener('input', function() {
    const query = this.value.trim()
    
    clearTimeout(searchTimeout)
    
    if (query.length < 1) {
      resultsDiv.innerHTML = ''
      return
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search-part?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        
        if (data.results && data.results.length > 0) {
          resultsDiv.innerHTML = data.results.map(item => `
            <div class="p-2 hover:bg-blue-100 cursor-pointer border-b" 
                 onclick="selectMaterial('${rowId}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <div class="font-semibold text-blue-600">${item.PART_NUMBER}</div>
              <div class="text-sm text-gray-600">${item.MATERIAL} - ${item.MESIN}</div>
            </div>
          `).join('')
        } else {
          resultsDiv.innerHTML = '<div class="p-2 text-gray-500 text-sm">Tidak ada hasil</div>'
        }
      } catch (error) {
        console.error('Search error:', error)
        resultsDiv.innerHTML = '<div class="p-2 text-red-500 text-sm">Error pencarian</div>'
      }
    }, 300)
  })
}

function selectMaterial(rowId, item) {
  const row = document.getElementById(rowId)
  
  console.log('Selecting material:', item) // Debug log
  
  // Fill autofill fields with fallback to '-' if empty
  row.querySelector('.part-number-search').value = item.PART_NUMBER || ''
  row.querySelector('.jenis-barang').value = item.JENIS_BARANG || '-'
  row.querySelector('.material').value = item.MATERIAL || '-'
  row.querySelector('.mesin').value = item.MESIN || '-'
  
  console.log('Filled values:', {
    partNumber: item.PART_NUMBER,
    jenisBarang: item.JENIS_BARANG || '-',
    material: item.MATERIAL || '-',
    mesin: item.MESIN || '-'
  }) // Debug log
  
  // Clear search results
  row.querySelector('.search-results').innerHTML = ''
}

// ===== Form Submit =====
async function handleFormSubmit(e) {
  e.preventDefault()
  
  // Validate signature
  if (isCanvasEmpty(canvasPelapor)) {
    alert('Tanda tangan Pelapor harus diisi!')
    return
  }
  
  // Use new material list system if available
  let materials = [];
  if (typeof getMaterialsDataGangguan === 'function' && typeof materialsDataGangguan !== 'undefined') {
    materials = getMaterialsDataGangguan();
    console.log('Using new material list system (Gangguan):', materials);
  } else {
    // Fallback to old system
    const materialRows = document.querySelectorAll('#materialListGangguan > div')
    
    for (const row of materialRows) {
      const partNumber = row.querySelector('.part-number-search').value
      const jenisBarang = row.querySelector('.jenis-barang').value
      const material = row.querySelector('.material').value
      const mesin = row.querySelector('.mesin').value
      const jumlah = parseInt(row.querySelector('.jumlah').value)
      
      if (!partNumber || !jumlah) {
        alert('Semua material harus diisi lengkap!')
        return
      }
      
      materials.push({
        partNumber,
        jenisBarang,
        material,
        mesin,
        jumlah
      })
    }
  }
  
  // Validate at least one material
  if (materials.length === 0) {
    alert('❌ Minimal harus ada 1 material yang diisi!')
    return
  }
  
  // Collect form data
  const formData = {
    hariTanggal: document.getElementById('hariTanggal').value,
    unitULD: document.getElementById('unitULD').value,
    kelompokSPD: document.getElementById('kelompokSPD').value,
    komponenRusak: document.getElementById('komponenRusak').value,
    gejala: document.getElementById('gejala').value,
    uraianKejadian: document.getElementById('uraianKejadian').value,
    analisaPenyebab: document.getElementById('analisaPenyebab').value,
    kesimpulan: document.getElementById('kesimpulan').value,
    bebanPuncak: parseFloat(document.getElementById('bebanPuncak').value),
    dayaMampu: parseFloat(document.getElementById('dayaMampu').value),
    pemadaman: document.getElementById('pemadaman').value,
    tindakanPenanggulangan: document.getElementById('tindakanPenanggulangan').value,
    rencanaPerbaikan: document.getElementById('rencanaPerbaikan').value,
    materials: materials,
    namaPelapor: document.getElementById('namaPelapor').value,
    ttdPelapor: canvasPelapor.toDataURL('image/png')
  }
  
  try {
    const response = await fetch('/api/save-gangguan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    
    const result = await response.json()
    
    if (result.success) {
      // Show success modal (will auto-redirect to Dashboard Gangguan)
      showSuccessModal(result.nomorLH05)
    } else {
      alert('Gagal menyimpan: ' + (result.error || 'Unknown error'))
    }
  } catch (error) {
    console.error('Submit error:', error)
    alert('Error: ' + error.message)
  }
}

function showSuccessModal(nomorLH05) {
  const modal = document.createElement('div')
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-8 max-w-md shadow-2xl animate-fade-in">
      <div class="text-center">
        <div class="mb-4">
          <i class="fas fa-check-circle text-6xl text-green-500"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Form Berhasil Disimpan!</h2>
        <p class="text-gray-600 mb-4">Nomor BA LH05:</p>
        <p class="text-2xl font-bold text-red-600 mb-6">${nomorLH05}</p>
        <p class="text-sm text-gray-500 mb-4">
          <i class="fas fa-info-circle mr-1"></i>
          Data akan muncul di Dashboard Gangguan dalam 2 detik...
        </p>
        <div class="space-x-3">
          <button onclick="redirectToDashboard()" 
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            <i class="fas fa-chart-line mr-2"></i>Lihat Dashboard Sekarang
          </button>
          <button onclick="this.closest('.fixed').remove()" 
            class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
            Input Lagi
          </button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  // Auto redirect to Dashboard Gangguan after 2 seconds to ensure data is loaded
  setTimeout(() => {
    redirectToDashboard()
  }, 2000)
}

// Function to redirect with timestamp to force reload
function redirectToDashboard() {
  // Add timestamp parameter to force page reload and bypass cache
  window.location.href = '/dashboard/gangguan?t=' + Date.now()
}

function resetForm() {
  document.getElementById('gangguanForm').reset()
  clearSignature('pelapor')
  
  // Reset materials to 1 row
  document.getElementById('materialListGangguan').innerHTML = ''
  materialRowCountGangguan = 0
  addMaterialRow()
  
  // Reset datetime
  const now = new Date()
  const localDateTime = now.toISOString().slice(0, 16)
  document.getElementById('hariTanggal').value = localDateTime
}

function isCanvasEmpty(canvas) {
  const ctx = canvas.getContext('2d')
  const pixelBuffer = new Uint32Array(
    ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
  )
  return !pixelBuffer.some(color => color !== 0)
}
