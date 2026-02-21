// =====================================================
// FORM INPUT MATERIAL - DARI LH05 (GANGGUAN)
// Handle material selection from LH05 reports
// =====================================================

let selectedLH05 = null;
let lh05Materials = [];
let materialsDataLH05 = [];
let materialIdCounterLH05 = 0;
let addedMaterialIds = new Set(); // Track material_gangguan.id yang sudah di-add

// Signature pads for LH05 tab
let signaturePadPemeriksaLH05 = null;
let signaturePadPenerimaLH05 = null;

// Initialize LH05 tab on DOM load
document.addEventListener('DOMContentLoaded', () => {
    loadLH05Dropdown();
    setupSignaturePadsLH05();
    loadDropdownDataLH05();
});

// Load LH05 list for dropdown
async function loadLH05Dropdown() {
    try {
        const response = await fetch('/api/lh05-list');
        const data = await response.json();
        
        const selector = document.getElementById('lh05Selector');
        if (!selector) return;
        
        selector.innerHTML = '<option value="">-- Pilih Nomor LH05 --</option>';
        
        data.lh05List.forEach(lh05 => {
            const option = document.createElement('option');
            option.value = lh05.nomor_lh05;
            option.textContent = `${lh05.nomor_lh05} - ${lh05.unit_uld} (${lh05.material_count} material)`;
            option.dataset.unit = lh05.unit_uld;
            option.dataset.tanggal = lh05.tanggal_laporan;
            option.dataset.komponen = lh05.komponen_rusak;
            selector.appendChild(option);
        });
        
        console.log(`✅ Loaded ${data.lh05List.length} LH05 reports`);
    } catch (error) {
        console.error('❌ Failed to load LH05 list:', error);
        alert('Gagal memuat daftar LH05. Silakan refresh halaman.');
    }
}

// Load materials from selected LH05
async function loadMaterialsFromLH05() {
    const selector = document.getElementById('lh05Selector');
    const nomorLH05 = selector.value;
    
    // Reset state
    lh05Materials = [];
    selectedLH05 = null;
    
    // Hide/show elements
    const lh05Info = document.getElementById('lh05Info');
    const lh05MaterialsContainer = document.getElementById('lh05MaterialsContainer');
    const lh05EmptyState = document.getElementById('lh05EmptyState');
    
    if (!nomorLH05) {
        lh05Info.classList.add('hidden');
        lh05MaterialsContainer.classList.add('hidden');
        lh05EmptyState.classList.remove('hidden');
        return;
    }
    
    try {
        console.log(`🔄 Loading materials from LH05: ${nomorLH05}`);
        const response = await fetch(`/api/lh05/${encodeURIComponent(nomorLH05)}/materials`);
        const data = await response.json();
        
        selectedLH05 = data;
        lh05Materials = data.materials;
        
        // Update LH05 info display
        document.getElementById('lh05Unit').textContent = data.unit_uld;
        document.getElementById('lh05Tanggal').textContent = formatDate(data.tanggal_laporan);
        document.getElementById('lh05Komponen').textContent = data.komponen_rusak || '-';
        
        // Show info and materials container
        lh05Info.classList.remove('hidden');
        lh05MaterialsContainer.classList.remove('hidden');
        lh05EmptyState.classList.add('hidden');
        
        // Render materials list with checkboxes
        renderLH05MaterialsList();
        
        console.log(`✅ Loaded ${lh05Materials.length} materials from ${nomorLH05}`);
    } catch (error) {
        console.error('❌ Failed to load LH05 materials:', error);
        alert('Gagal memuat material dari LH05. Silakan coba lagi.');
    }
}

// Render materials list with checkboxes and stock info
function renderLH05MaterialsList() {
    const listContainer = document.getElementById('lh05MaterialsList');
    
    if (lh05Materials.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-inbox text-4xl mb-2"></i>
                <p>Tidak ada material untuk LH05 ini</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = lh05Materials.map((mat, index) => {
        const isAvailable = mat.stok >= mat.jumlah;
        const isAlreadySent = mat.alreadySent || false;
        const isAlreadyAdded = addedMaterialIds.has(mat.id); // Check if already added to preview
        const isDisabled = !isAvailable || isAlreadySent || isAlreadyAdded; // FIXED: Disable if stock insufficient
        
        let stockBadge = '';
        if (isAlreadyAdded) {
            stockBadge = '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded"><i class="fas fa-check-circle mr-1"></i>SUDAH DITAMBAHKAN</span>';
        } else if (isAlreadySent) {
            stockBadge = '<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded"><i class="fas fa-check-circle mr-1"></i>SUDAH TERKIRIM</span>';
        } else if (mat.stok === 0) {
            stockBadge = '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">STOK HABIS</span>';
        } else if (!isAvailable) {
            stockBadge = `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">Stok: ${mat.stok} (Kurang)</span>`;
        } else {
            stockBadge = `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Stok: ${mat.stok}</span>`;
        }
        
        return `
            <div class="border ${isDisabled ? 'border-gray-300 bg-gray-50' : 'border-blue-200 bg-blue-50'} rounded-lg p-4 ${isDisabled ? 'opacity-50' : ''}">
                <div class="flex items-start gap-4">
                    <div class="pt-1">
                        <input type="checkbox" 
                               id="material_${index}" 
                               class="lh05-material-checkbox w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                               data-index="${index}"
                               ${isDisabled ? 'disabled' : ''}
                               onchange="updateSelectedCount()">
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <label for="material_${index}" class="font-semibold text-gray-800 cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}">
                                Part Number: <span class="text-blue-600">${mat.partNumber}</span>
                            </label>
                            ${stockBadge}
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                            <div><span class="font-medium">Jenis:</span> ${mat.jenisBarang}</div>
                            <div><span class="font-medium">Material:</span> ${mat.material}</div>
                            <div><span class="font-medium">Mesin:</span> ${mat.mesin}</div>
                            <div><span class="font-medium">S/N Mesin:</span> ${mat.status || '-'}</div>
                            <div><span class="font-medium">Jumlah Diminta:</span> <strong>${mat.jumlah}</strong></div>
                            <div><span class="font-medium">Stok Tersedia:</span> <strong class="${mat.stok === 0 ? 'text-red-600' : mat.stok < mat.jumlah ? 'text-yellow-600' : 'text-green-600'}">${mat.stok}</strong></div>
                        </div>
                        ${isAlreadyAdded ? '<p class="mt-2 text-xs text-blue-600"><i class="fas fa-check-circle mr-1"></i>Material ini sudah ditambahkan ke preview table</p>' : ''}
                        ${isAlreadySent ? '<p class="mt-2 text-xs text-purple-600"><i class="fas fa-check-circle mr-1"></i>Material ini sudah dikirim sebelumnya dan tidak dapat dipilih lagi</p>' : ''}
                        ${!isAvailable && mat.stok === 0 && !isAlreadySent && !isAlreadyAdded ? '<p class="mt-2 text-xs text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i>Stok habis! Material tidak dapat dipilih.</p>' : ''}
                        ${!isAvailable && mat.stok > 0 && !isAlreadySent && !isAlreadyAdded ? '<p class="mt-2 text-xs text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i>Stok tidak mencukupi! Tersedia: ' + mat.stok + ', Diminta: ' + mat.jumlah + '. Material tidak dapat dipilih.</p>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    updateSelectedCount();
}

// Update selected materials count
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.lh05-material-checkbox:checked');
    const count = checkboxes.length;
    document.getElementById('selectedCount').textContent = count;
}

// Add selected materials to preview table
function addSelectedLH05Materials() {
    const checkboxes = document.querySelectorAll('.lh05-material-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert('❌ Pilih minimal 1 material terlebih dahulu!');
        return;
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    checkboxes.forEach(checkbox => {
        const index = parseInt(checkbox.dataset.index);
        const mat = lh05Materials[index];
        
        // Check if material already added (prevent duplicate)
        if (addedMaterialIds.has(mat.id)) {
            console.warn(`⚠️ Material ${mat.partNumber} sudah ditambahkan sebelumnya, skip!`);
            checkbox.checked = false; // Uncheck
            checkbox.disabled = true; // Disable untuk prevent re-add
            skippedCount++;
            return;
        }
        
        // Add to materials data
        materialIdCounterLH05++;
        const materialData = {
            id: materialIdCounterLH05,
            partNumber: mat.partNumber,
            jenisBarang: mat.jenisBarang,
            material: mat.material,
            mesin: mat.mesin,
            snMesin: mat.status || '-',
            jumlah: mat.jumlah,
            lokasiTujuan: selectedLH05.unit_uld, // Auto-fill from LH05
            materialGangguanId: mat.id // Reference to material_gangguan.id
        };
        
        materialsDataLH05.push(materialData);
        addedMaterialIds.add(mat.id); // Track as added
        
        // Disable checkbox after adding
        checkbox.checked = false;
        checkbox.disabled = true;
        
        addedCount++;
    });
    
    // Update preview table
    updateMaterialPreviewTableLH05();
    updateSelectedCount();
    
    // Show success message
    if (addedCount > 0) {
        showTemporaryMessageLH05(`✅ ${addedCount} material berhasil ditambahkan ke transaksi!`, 'success');
    }
    
    if (skippedCount > 0) {
        showTemporaryMessageLH05(`⚠️ ${skippedCount} material dilewati (sudah ditambahkan sebelumnya)`, 'info');
    }
}

// Update preview table for LH05 materials
function updateMaterialPreviewTableLH05() {
    const tableBody = document.getElementById('materialPreviewBodyLH05');
    
    if (materialsDataLH05.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-gray-500 border">
                    <i class="fas fa-inbox text-gray-300 text-3xl mb-2"></i>
                    <p>Belum ada material yang ditambahkan</p>
                    <p class="text-sm mt-1">Pilih material dari LH05 di atas</p>
                </td>
            </tr>
        `;
        document.getElementById('totalMaterialsLH05').textContent = '0';
        return;
    }
    
    tableBody.innerHTML = materialsDataLH05.map((mat, index) => `
        <tr class="border hover:bg-gray-50">
            <td class="px-4 py-3 text-center border">${index + 1}</td>
            <td class="px-4 py-3 border font-semibold text-blue-600">${mat.partNumber}</td>
            <td class="px-4 py-3 border">${mat.jenisBarang}</td>
            <td class="px-4 py-3 border">${mat.material}</td>
            <td class="px-4 py-3 border">${mat.mesin}</td>
            <td class="px-4 py-3 border">${mat.snMesin}</td>
            <td class="px-4 py-3 text-center border font-semibold">${mat.jumlah}</td>
            <td class="px-4 py-3 text-center border">
                <button onclick="removeMaterialLH05(${mat.id})" 
                        class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('totalMaterialsLH05').textContent = materialsDataLH05.length;
}

// Remove material from preview
function removeMaterialLH05(materialId) {
    // Find material data before removing
    const materialToRemove = materialsDataLH05.find(m => m.id === materialId);
    
    if (materialToRemove) {
        // Remove from added tracking
        addedMaterialIds.delete(materialToRemove.materialGangguanId);
        
        // Re-enable checkbox in materials list
        const materialIndex = lh05Materials.findIndex(mat => mat.id === materialToRemove.materialGangguanId);
        if (materialIndex !== -1) {
            const checkbox = document.querySelector(`input[data-index="${materialIndex}"]`);
            if (checkbox) {
                checkbox.disabled = false; // Re-enable untuk bisa dipilih lagi
                console.log(`✅ Re-enabled checkbox for ${materialToRemove.partNumber}`);
            }
        }
    }
    
    // Remove from data array
    materialsDataLH05 = materialsDataLH05.filter(m => m.id !== materialId);
    updateMaterialPreviewTableLH05();
    showTemporaryMessageLH05('Material berhasil dihapus dari transaksi', 'info');
}

// Setup signature pads for LH05 tab
function setupSignaturePadsLH05() {
    const canvasPemeriksa = document.getElementById('signaturePemeriksaLH05');
    const canvasPenerima = document.getElementById('signaturePenerimaLH05');
    
    if (canvasPemeriksa && typeof SignaturePad !== 'undefined') {
        signaturePadPemeriksaLH05 = new SignaturePad(canvasPemeriksa);
    }
    
    if (canvasPenerima && typeof SignaturePad !== 'undefined') {
        signaturePadPenerimaLH05 = new SignaturePad(canvasPenerima);
    }
}

// Clear signature
function clearSignatureLH05(type) {
    if (type === 'pemeriksa' && signaturePadPemeriksaLH05) {
        signaturePadPemeriksaLH05.clear();
    } else if (type === 'penerima' && signaturePadPenerimaLH05) {
        signaturePadPenerimaLH05.clear();
    }
}

// Load dropdown data (pemeriksa, penerima)
async function loadDropdownDataLH05() {
    try {
        const response = await fetch('/api/dropdown-values');
        const data = await response.json();
        
        // Populate Pemeriksa
        const pemeriksaSelect = document.getElementById('pemeriksaLH05');
        if (pemeriksaSelect && data.pemeriksa) {
            pemeriksaSelect.innerHTML = '<option value="">-- Pilih Pemeriksa --</option>';
            data.pemeriksa.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                pemeriksaSelect.appendChild(option);
            });
        }
        
        // Populate Penerima
        const penerimaSelect = document.getElementById('penerimaLH05');
        if (penerimaSelect && data.penerima) {
            penerimaSelect.innerHTML = '<option value="">-- Pilih Penerima --</option>';
            data.penerima.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                penerimaSelect.appendChild(option);
            });
        }
        
        console.log('✅ Dropdown data loaded for LH05 tab');
    } catch (error) {
        console.error('❌ Failed to load dropdown data:', error);
    }
}

// Submit transaction from LH05
async function submitTransactionFromLH05() {
    try {
        // Validation: Check materials
        if (materialsDataLH05.length === 0) {
            alert('❌ Minimal harus ada 1 material yang ditambahkan!');
            return;
        }
        
        // Validation: Pemeriksa & Penerima
        const pemeriksa = document.getElementById('pemeriksaLH05').value;
        const penerima = document.getElementById('penerimaLH05').value;
        
        if (!pemeriksa) {
            alert('❌ Pemeriksa wajib diisi!');
            return;
        }
        
        if (!penerima) {
            alert('❌ Penerima wajib diisi!');
            return;
        }
        
        // Validation: Signatures
        if (!signaturePadPemeriksaLH05 || signaturePadPemeriksaLH05.isEmpty()) {
            alert('❌ Tanda tangan Pemeriksa wajib diisi!');
            return;
        }
        
        if (!signaturePadPenerimaLH05 || signaturePadPenerimaLH05.isEmpty()) {
            alert('❌ Tanda tangan Penerima wajib diisi!');
            return;
        }
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Prepare transaction data
        const formData = {
            tanggal: today,
            jenisTransaksi: 'Pengeluaran / Keluar', // Always Keluar for LH05
            jenisPengeluaran: `LH05 - ${selectedLH05.lh05}`, // ✅ Dasar Pengeluaran = Nomor LH05
            lokasiAsal: 'GUDANG KAL 2',
            lokasiTujuan: selectedLH05.unit_uld, // From LH05
            pemeriksa: pemeriksa,
            penerima: penerima,
            ttdPemeriksa: signaturePadPemeriksaLH05.toDataURL(),
            ttdPenerima: signaturePadPenerimaLH05.toDataURL(),
            materials: materialsDataLH05.map(m => ({
                partNumber: m.partNumber,
                jenisBarang: m.jenisBarang,
                material: m.material,
                mesin: m.mesin,
                status: m.snMesin,
                jumlah: m.jumlah
            })),
            fromLH05: selectedLH05.lh05, // Mark that this transaction is from LH05
            materialGangguanIds: materialsDataLH05.map(m => m.materialGangguanId) // For updating status
        };
        
        console.log('📤 Submitting transaction from LH05:', formData);
        
        // Submit
        const response = await fetch('/api/save-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success modal
            showSuccessModal(result.nomorBA);
            
            // Reset form
            resetFormLH05();
        } else {
            alert(`❌ Gagal menyimpan transaksi: ${result.error}`);
        }
    } catch (error) {
        console.error('❌ Submit error:', error);
        alert('❌ Terjadi kesalahan saat menyimpan transaksi');
    }
}

// Reset form LH05
function resetFormLH05() {
    // Reset selector
    document.getElementById('lh05Selector').value = '';
    
    // Reset materials data
    materialsDataLH05 = [];
    materialIdCounterLH05 = 0;
    selectedLH05 = null;
    lh05Materials = [];
    addedMaterialIds.clear(); // Clear tracking set
    
    // Hide containers
    document.getElementById('lh05Info').classList.add('hidden');
    document.getElementById('lh05MaterialsContainer').classList.add('hidden');
    document.getElementById('lh05EmptyState').classList.remove('hidden');
    
    // Clear preview table
    updateMaterialPreviewTableLH05();
    
    // Clear signatures
    clearSignatureLH05('pemeriksa');
    clearSignatureLH05('penerima');
    
    // Reset dropdowns
    document.getElementById('pemeriksaLH05').value = '';
    document.getElementById('penerimaLH05').value = '';
    
    console.log('🔄 Form LH05 reset');
}

// Show temporary message
function showTemporaryMessageLH05(message, type = 'success') {
    const colors = {
        success: 'bg-green-100 text-green-800 border-green-300',
        error: 'bg-red-100 text-red-800 border-red-300',
        info: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 ${colors[type]} px-6 py-3 rounded-lg border-2 shadow-lg z-50 animate-fade-in`;
    messageDiv.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Format date helper
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
}

// Export function for getting materials data (used by main app.js)
function getMaterialsDataLH05() {
    return materialsDataLH05;
}

// =====================================================
// EXPOSE FUNCTIONS TO GLOBAL WINDOW SCOPE
// (Required for inline onclick/onchange handlers)
// =====================================================
window.loadMaterialsFromLH05 = loadMaterialsFromLH05;
window.addSelectedLH05Materials = addSelectedLH05Materials;
window.updateSelectedCount = updateSelectedCount;
window.removeMaterialLH05 = removeMaterialLH05;
window.getMaterialsDataLH05 = getMaterialsDataLH05;
window.clearSignatureLH05 = clearSignatureLH05;
window.submitLH05Transaction = submitLH05Transaction;
