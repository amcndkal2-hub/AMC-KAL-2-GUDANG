// Global state
let materialCount = 0;
let dropdownData = { units: [], pemeriksa: [], penerima: [] };

// Signature pad setup
class SignaturePad {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        this.setupCanvas();
        this.bindEvents();
    }
    
    setupCanvas() {
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }
    
    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }
    
    stopDrawing() {
        this.isDrawing = false;
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    isEmpty() {
        const pixelData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        return !pixelData.data.some(channel => channel !== 0);
    }
    
    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }
}

// Initialize signature pads
let signaturePemeriksa, signaturePenerima;

document.addEventListener('DOMContentLoaded', async () => {
    // Set default date
    document.getElementById('tanggal').valueAsDate = new Date();
    
    // Initialize signature pads
    signaturePemeriksa = new SignaturePad(document.getElementById('signaturePemeriksa'));
    signaturePenerima = new SignaturePad(document.getElementById('signaturePenerima'));
    
    // Clear signature buttons
    document.getElementById('clearPemeriksa').addEventListener('click', () => {
        signaturePemeriksa.clear();
    });
    
    document.getElementById('clearPenerima').addEventListener('click', () => {
        signaturePenerima.clear();
    });
    
    // Load dropdown data
    await loadDropdownData();
    
    // NOTE: No longer adding material rows automatically
    // Material input now uses single form + table preview (app-material-list.js)
    
    // Form submit
    document.getElementById('transactionForm').addEventListener('submit', handleSubmit);
    
    // Reset button
    document.getElementById('resetForm').addEventListener('click', resetForm);
    
    // Update status label based on jenis transaksi
    document.getElementById('jenisTransaksi').addEventListener('change', updateStatusLabels);
    
    // Initialize status labels on page load
    updateStatusLabels();
});

// Load dropdown data from API
async function loadDropdownData() {
    try {
        const response = await fetch('/api/dropdown-values');
        const data = await response.json();
        
        dropdownData = data;
        
        // Populate dropdowns
        populateDropdown('lokasiAsal', data.units);
        populateDropdown('lokasiTujuan', data.units);
        populateDropdown('pemeriksa', data.pemeriksa);
        populateDropdown('penerima', data.penerima);
    } catch (error) {
        console.error('Failed to load dropdown data:', error);
        alert('Gagal memuat data dropdown. Silakan refresh halaman.');
    }
}

// Populate dropdown with options
function populateDropdown(selectId, options) {
    const select = document.getElementById(selectId);
    const firstOption = select.querySelector('option:first-child');
    
    // Clear existing options except the first one
    select.innerHTML = '';
    if (firstOption) {
        select.appendChild(firstOption);
    }
    
    // Add new options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// Update status field labels based on transaction type
function updateStatusLabels() {
    const jenisTransaksi = document.getElementById('jenisTransaksi').value;
    const statusLabels = document.querySelectorAll('.status-label');
    const statusInputs = document.querySelectorAll('.status');
    
    // Determine label and placeholder based on transaction type
    const isMasuk = jenisTransaksi.includes('Masuk');
    const label = isMasuk ? 'Status *' : 'S/N Mesin *';
    const placeholder = isMasuk ? 'Status material (WAJIB)' : 'Serial Number Mesin (WAJIB)';
    
    // Update all status labels and inputs
    statusLabels.forEach(labelElement => {
        labelElement.textContent = label;
    });
    
    statusInputs.forEach(input => {
        input.placeholder = placeholder;
        input.setAttribute('required', 'required');
    });
}

// Add material row
function addMaterialRow() {
    materialCount++;
    const materialList = document.getElementById('materialList');
    
    const materialDiv = document.createElement('div');
    materialDiv.className = 'border-l-4 border-blue-500 pl-4 py-4 bg-gray-50 rounded-lg';
    materialDiv.dataset.materialId = materialCount;
    
    materialDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-800">DETAIL MATERIAL #${materialCount}</h3>
            ${materialCount > 1 ? `<button type="button" class="text-red-600 hover:text-red-700 remove-material" data-id="${materialCount}">
                <i class="fas fa-trash mr-1"></i>Hapus
            </button>` : ''}
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="lg:col-span-1">
                <label class="block text-sm font-medium text-gray-700 mb-2">Part Number (Cari)</label>
                <div class="relative">
                    <input type="text" 
                        class="part-number-search w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        placeholder="Ketik atau pilih Part Number"
                        data-material-id="${materialCount}"
                        autocomplete="off">
                    <div class="search-results absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg hidden max-h-60 overflow-y-auto"></div>
                </div>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Jenis Barang</label>
                <input type="text" class="jenis-barang w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Material</label>
                <input type="text" class="material w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Mesin</label>
                <input type="text" class="mesin w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
            </div>
            
            <div class="lg:col-span-2">
                <label class="status-label block text-sm font-medium text-gray-700 mb-2">Status</label>
                <input type="text" class="status w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Status material (opsional)">
            </div>
            
            <div class="lg:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
                <input type="number" class="jumlah w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Kuantitas" min="1" required>
            </div>
        </div>
    `;
    
    materialList.appendChild(materialDiv);
    
    // Setup part number search for this row
    setupPartNumberSearch(materialDiv);
    
    // Setup remove button
    const removeBtn = materialDiv.querySelector('.remove-material');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            materialDiv.remove();
        });
    }
}

// Setup part number search functionality
function setupPartNumberSearch(materialDiv) {
    const searchInput = materialDiv.querySelector('.part-number-search');
    const resultsDiv = materialDiv.querySelector('.search-results');
    
    let searchTimeout;
    
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            resultsDiv.classList.add('hidden');
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search-part?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                displaySearchResults(resultsDiv, data.results, materialDiv);
            } catch (error) {
                console.error('Search failed:', error);
            }
        }, 300);
    });
    
    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!materialDiv.contains(e.target)) {
            resultsDiv.classList.add('hidden');
        }
    });
}

// Display search results
function displaySearchResults(resultsDiv, results, materialDiv) {
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="p-3 text-gray-500 text-sm">Tidak ada hasil</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }
    
    console.log('Search results:', results); // Debug log
    
    resultsDiv.innerHTML = results.map(item => {
        const jenisBarang = item.JENIS_BARANG || '-';
        const material = item.MATERIAL || '-';
        const mesin = item.MESIN || '-';
        
        return `
        <div class="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 search-result-item" 
            data-part='${JSON.stringify(item)}'>
            <div class="font-semibold text-sm">${item.PART_NUMBER}</div>
            <div class="text-xs text-gray-600">
                <span class="font-medium text-blue-600">${jenisBarang}</span> | ${material} | ${mesin}
            </div>
        </div>
        `;
    }).join('');
    
    resultsDiv.classList.remove('hidden');
    
    // Add click handlers
    resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const data = JSON.parse(item.dataset.part);
            fillMaterialData(materialDiv, data);
            resultsDiv.classList.add('hidden');
        });
    });
}

// Fill material data from selected part
function fillMaterialData(materialDiv, data) {
    console.log('Filling material data:', data); // Debug log
    
    // Convert PART_NUMBER to string if it's a number
    const partNumber = data.PART_NUMBER ? String(data.PART_NUMBER) : '';
    let jenisBarang = data.JENIS_BARANG || '';
    const material = data.MATERIAL || '-';
    const mesin = data.MESIN || '-';
    
    // TEMPORARY FIX: Fallback JENIS_BARANG if empty
    // Because Google Apps Script doesn't read column A correctly
    if (!jenisBarang || jenisBarang === '' || jenisBarang === '-') {
        // Default to "MATERIAL HANDAL" for common materials
        const materialUpper = material.toUpperCase();
        
        // Check material keywords to determine JENIS_BARANG
        if (materialUpper.includes('PUMP') || 
            materialUpper.includes('OIL') || 
            materialUpper.includes('WATER') || 
            materialUpper.includes('FUEL')) {
            jenisBarang = 'MATERIAL HANDAL';
        } else if (materialUpper.includes('GASKET') || 
                   materialUpper.includes('SEAL') || 
                   materialUpper.includes('BEARING')) {
            jenisBarang = 'SPAREPART';
        } else if (materialUpper.includes('FILTER')) {
            jenisBarang = 'FILTER';
        } else if (materialUpper.includes('BELT') || 
                   materialUpper.includes('HOSE')) {
            jenisBarang = 'CONSUMABLE';
        } else {
            // Default fallback
            jenisBarang = 'MATERIAL HANDAL';
        }
        
        console.log('⚠️ JENIS_BARANG empty, using fallback:', jenisBarang);
    }
    
    materialDiv.querySelector('.part-number-search').value = partNumber;
    materialDiv.querySelector('.jenis-barang').value = jenisBarang;
    materialDiv.querySelector('.material').value = material;
    materialDiv.querySelector('.mesin').value = mesin;
    
    console.log('Filled values:', { partNumber, jenisBarang, material, mesin }); // Debug log
}

// Handle form submit
async function handleSubmit(e) {
    e.preventDefault();
    
    // Validate required form fields
    const tanggal = document.getElementById('tanggal').value;
    const jenisTransaksi = document.getElementById('jenisTransaksi').value;
    const lokasiAsal = document.getElementById('lokasiAsal').value;
    const lokasiTujuan = document.getElementById('lokasiTujuan').value;
    const pemeriksa = document.getElementById('pemeriksa').value;
    const penerima = document.getElementById('penerima').value;
    
    if (!tanggal) {
        alert('❌ Tanggal harus diisi!');
        document.getElementById('tanggal').focus();
        return;
    }
    
    if (!jenisTransaksi) {
        alert('❌ Jenis Transaksi harus diisi!');
        document.getElementById('jenisTransaksi').focus();
        return;
    }
    
    if (!lokasiAsal) {
        alert('❌ Lokasi Asal harus diisi!');
        document.getElementById('lokasiAsal').focus();
        return;
    }
    
    if (!lokasiTujuan) {
        alert('❌ Lokasi Tujuan harus diisi!');
        document.getElementById('lokasiTujuan').focus();
        return;
    }
    
    if (!pemeriksa) {
        alert('❌ Pemeriksa harus diisi!');
        document.getElementById('pemeriksa').focus();
        return;
    }
    
    if (!penerima) {
        alert('❌ Penerima harus diisi!');
        document.getElementById('penerima').focus();
        return;
    }
    
    // Validate signatures
    if (signaturePemeriksa.isEmpty()) {
        alert('Tanda tangan pemeriksa harus diisi!');
        return;
    }
    
    if (signaturePenerima.isEmpty()) {
        alert('Tanda tangan penerima harus diisi!');
        return;
    }
    
    // Collect form data
    const formData = {
        tanggal: tanggal,
        jenisTransaksi: jenisTransaksi,
        lokasiAsal: lokasiAsal,
        lokasiTujuan: lokasiTujuan,
        pemeriksa: pemeriksa,
        penerima: penerima,
        ttdPemeriksa: signaturePemeriksa.toDataURL(),
        ttdPenerima: signaturePenerima.toDataURL(),
        materials: []
    };
    
    // Use new material list system if available (getMaterialsData from app-material-list.js)
    if (typeof getMaterialsData === 'function' && typeof materialsData !== 'undefined' && materialsData.length > 0) {
        formData.materials = getMaterialsData();
        console.log('Using new material list system:', formData.materials);
    } else {
        // Fallback to old system (multiple rows)
        const materialDivs = document.querySelectorAll('#materialList > div');
        materialDivs.forEach(div => {
            const partNumber = div.querySelector('.part-number-search').value;
            const jumlah = div.querySelector('.jumlah').value;
            
            if (partNumber && jumlah) {
                formData.materials.push({
                    partNumber: partNumber,
                    jenisBarang: div.querySelector('.jenis-barang').value,
                    material: div.querySelector('.material').value,
                    mesin: div.querySelector('.mesin').value,
                    status: div.querySelector('.status').value,
                    jumlah: parseInt(jumlah)
                });
            }
        });
    }
    
    // Validate at least one material
    if (formData.materials.length === 0) {
        alert('Minimal harus ada 1 material yang diisi!');
        return;
    }
    
    try {
        const response = await fetch('/api/save-transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Transaksi berhasil disimpan!\nNomor BA: ${result.nomorBA}`);
            
            // Show success modal with BA number
            showSuccessModal(result.nomorBA, formData);
            
            // Optional: Reset form after delay
            setTimeout(() => {
                if (confirm('Data sudah disimpan. Ingin membuat transaksi baru?')) {
                    resetForm();
                }
            }, 2000);
        } else {
            alert('❌ Gagal menyimpan transaksi: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Submit failed:', error);
        alert('❌ Terjadi kesalahan saat menyimpan transaksi');
    }
}

// Display transaction summary
function displayTransactionSummary(data) {
    const summary = `
===========================================
📋 RINGKASAN TRANSAKSI
===========================================

📅 Tanggal: ${data.tanggal}
📦 Jenis: ${data.jenisTransaksi}
📍 Dari: ${data.lokasiAsal}
📍 Ke: ${data.lokasiTujuan}

🔧 MATERIAL (${data.materials.length} item):
${data.materials.map((m, i) => `
  ${i+1}. Part: ${m.partNumber}
     Material: ${m.material}
     Mesin: ${m.mesin}
     Status: ${m.status || '-'}
     Jumlah: ${m.jumlah}
`).join('\n')}

👤 Pemeriksa: ${data.pemeriksa}
👤 Penerima: ${data.penerima}

===========================================
    `;
    
    console.log(summary);
}

// Show success modal
function showSuccessModal(nomorBA, data) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div class="text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <i class="fas fa-check text-green-600 text-2xl"></i>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Transaksi Berhasil Disimpan!</h3>
                <p class="text-sm text-gray-500 mb-4">
                    Nomor Berita Acara: <strong class="text-blue-600">${nomorBA}</strong>
                </p>
                <div class="flex gap-3">
                    <a href="/dashboard/mutasi" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Lihat BA
                    </a>
                    <button onclick="this.closest('.fixed').remove()" 
                        class="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Reset form
function resetForm() {
    if (!confirm('Yakin ingin mereset form? Semua data akan hilang.')) {
        return;
    }
    
    document.getElementById('transactionForm').reset();
    document.getElementById('tanggal').valueAsDate = new Date();
    
    signaturePemeriksa.clear();
    signaturePenerima.clear();
    
    // Reset new material list system
    if (typeof resetMaterialsList === 'function') {
        materialsData = [];
        materialIdCounter = 0;
        updateMaterialPreviewTable();
        clearMaterialForm();
    } else {
        // Fallback to old system
        document.getElementById('materialList').innerHTML = '';
        materialCount = 0;
        addMaterialRow();
    }
}
