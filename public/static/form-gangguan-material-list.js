// =====================================================
// MATERIAL LIST MANAGEMENT FOR FORM GANGGUAN
// Single material input with preview table
// =====================================================

// Global state for material list (Form Gangguan)
let materialsDataGangguan = [];
let materialIdCounterGangguan = 0;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize empty table
    updateMaterialPreviewTableGangguan();
    
    // Bind "Tambah" button
    const addBtn = document.getElementById('addMaterialBtnGangguan');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addMaterialToListGangguan();
        });
    }
    
    // Bind Enter key on Part Number input
    const partNumberInput = document.querySelector('.part-number-search-gangguan');
    if (partNumberInput) {
        partNumberInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addMaterialToListGangguan();
            }
        });
    }
    
    // Setup part number search
    setupPartNumberSearchForGangguan();
});

// Setup part number search for Form Gangguan
function setupPartNumberSearchForGangguan() {
    const searchInput = document.querySelector('.part-number-search-gangguan');
    const resultsDiv = document.querySelector('.search-results-gangguan');
    
    if (!searchInput || !resultsDiv) return;
    
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
                
                displaySearchResultsForGangguan(resultsDiv, data.results);
            } catch (error) {
                console.error('Search failed:', error);
            }
        }, 300);
    });
    
    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.parentElement.contains(e.target)) {
            resultsDiv.classList.add('hidden');
        }
    });
}

// Display search results for Form Gangguan
function displaySearchResultsForGangguan(resultsDiv, results) {
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="p-3 text-gray-500 text-sm">Tidak ada hasil</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }
    
    resultsDiv.innerHTML = results.map(item => {
        const jenisBarang = item.JENIS_BARANG || '-';
        const material = item.MATERIAL || '-';
        const mesin = item.MESIN || '-';
        
        return `
        <div class="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 search-result-item" 
            data-part='${JSON.stringify(item)}'>
            <div class="font-semibold text-sm">${item.PART_NUMBER}</div>
            <div class="text-xs text-gray-600">
                ${jenisBarang} • ${material} • ${mesin}
            </div>
        </div>
        `;
    }).join('');
    
    resultsDiv.classList.remove('hidden');
    
    // Add click handlers
    resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const data = JSON.parse(item.dataset.part);
            fillMaterialDataForGangguan(data);
            resultsDiv.classList.add('hidden');
        });
    });
}

// Fill material data from selected part (Form Gangguan)
async function fillMaterialDataForGangguan(data) {
    const partNumber = data.PART_NUMBER ? String(data.PART_NUMBER) : '';
    let jenisBarang = data.JENIS_BARANG || '';
    const material = data.MATERIAL || '-';
    const mesin = data.MESIN || '-';
    
    // TEMPORARY FIX: Fallback JENIS_BARANG if empty
    if (!jenisBarang || jenisBarang === '' || jenisBarang === '-') {
        const materialUpper = material.toUpperCase();
        
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
            jenisBarang = 'MATERIAL HANDAL';
        }
        
        console.log('⚠️ JENIS_BARANG empty (Gangguan), using fallback:', jenisBarang);
    }
    
    document.querySelector('.part-number-search-gangguan').value = partNumber;
    document.querySelector('.jenis-barang-gangguan').value = jenisBarang;
    document.querySelector('.material-gangguan').value = material;
    document.querySelector('.mesin-gangguan').value = mesin;
    
    // CHECK STOCK for Form Gangguan (Permintaan = Keluar)
    if (partNumber) {
        await checkStockForGangguan(partNumber);
    }
}

// Check stock for Form Gangguan
async function checkStockForGangguan(partNumber) {
    try {
        const response = await fetch(`/api/check-stock/${encodeURIComponent(partNumber)}`);
        const data = await response.json();
        
        // Display stock info
        const stockInfoDiv = document.getElementById('stockInfoGangguan');
        if (stockInfoDiv) {
            if (data.stok === 0) {
                stockInfoDiv.innerHTML = `
                    <div class="p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800">
                        <i class="fas fa-info-circle"></i>
                        <strong>INFO:</strong> Stok saat ini: <strong>0</strong> (kosong). 
                        <span class="text-sm">Tetap bisa diminta untuk Form Gangguan.</span>
                    </div>
                `;
                stockInfoDiv.classList.remove('hidden');
                console.log('ℹ️ INFO: STOK HABIS untuk Part:', partNumber, '- tetap bisa diminta');
            } else if (data.stok > 0) {
                stockInfoDiv.innerHTML = `
                    <div class="p-3 bg-green-100 border border-green-300 rounded-lg text-green-800">
                        <i class="fas fa-check-circle"></i>
                        Stok tersedia: <strong>${data.stok}</strong>
                    </div>
                `;
                stockInfoDiv.classList.remove('hidden');
                console.log('✅ Stok tersedia untuk Part:', partNumber, '=', data.stok);
            } else {
                stockInfoDiv.classList.add('hidden');
            }
        }
        
        // Store stock info for validation
        window.currentStockGangguan = data;
        
    } catch (error) {
        console.error('❌ Failed to check stock:', error);
        // Continue anyway (emergency fallback)
        window.currentStockGangguan = { stok: 999, available: true };
    }
}

// Add material to the list (Form Gangguan)
function addMaterialToListGangguan() {
    // Get form values
    const partNumber = document.querySelector('.part-number-search-gangguan').value.trim();
    const jenisBarang = document.querySelector('.jenis-barang-gangguan').value.trim();
    const material = document.querySelector('.material-gangguan').value.trim();
    const mesin = document.querySelector('.mesin-gangguan').value.trim();
    const snMesin = document.querySelector('.sn-mesin-gangguan').value.trim();
    const jumlah = document.querySelector('.jumlah-gangguan').value.trim();
    
    // VALIDATION: Part Number (WAJIB)
    if (!partNumber) {
        alert('❌ Part Number wajib diisi!');
        document.querySelector('.part-number-search-gangguan').focus();
        return;
    }
    
    // VALIDATION: Data material lengkap
    if (!jenisBarang || !material || !mesin || jenisBarang === '-' || material === '-' || mesin === '-') {
        alert('❌ Data material tidak lengkap! Pastikan Part Number sudah dipilih dari dropdown.');
        document.querySelector('.part-number-search-gangguan').focus();
        return;
    }
    
    // VALIDATION: S/N Mesin (WAJIB)
    if (!snMesin || snMesin.trim() === '') {
        alert('❌ S/N Mesin wajib diisi!');
        document.querySelector('.sn-mesin-gangguan').focus();
        return;
    }
    
    // VALIDATION: Jumlah (WAJIB, harus > 0)
    if (!jumlah || parseInt(jumlah) <= 0) {
        alert('❌ Jumlah wajib diisi dan harus lebih dari 0!');
        document.querySelector('.jumlah-gangguan').focus();
        return;
    }
    
    // STOCK INFO (INFORMATIONAL ONLY - NOT BLOCKING)
    // Form Gangguan adalah untuk permintaan material, jadi stok 0 tetap bisa diminta
    const currentStock = window.currentStockGangguan || { stok: 0, available: false };
    const requestedQty = parseInt(jumlah);
    
    if (currentStock.stok === 0) {
        console.warn('⚠️ INFO: Stok habis untuk Part:', partNumber, '- tetap bisa diminta (Form Gangguan)');
    } else if (currentStock.stok < requestedQty) {
        console.warn('⚠️ INFO: Stok tidak cukup untuk Part:', partNumber, 
            `(tersedia: ${currentStock.stok}, diminta: ${requestedQty}) - tetap bisa diminta (Form Gangguan)`);
    }
    
    // Add to materials array
    materialIdCounterGangguan++;
    const materialData = {
        id: materialIdCounterGangguan,
        partNumber,
        jenisBarang,
        material,
        mesin,
        snMesin: snMesin || '-',
        jumlah: parseInt(jumlah)
    };
    
    materialsDataGangguan.push(materialData);
    
    // Clear form inputs
    clearMaterialFormGangguan();
    
    // Update preview table
    updateMaterialPreviewTableGangguan();
    
    // Show success message
    showTemporaryMessageGangguan(`✅ Material "${partNumber}" berhasil ditambahkan!`, 'success');
}

// Clear material form (Form Gangguan)
function clearMaterialFormGangguan() {
    document.querySelector('.part-number-search-gangguan').value = '';
    document.querySelector('.jenis-barang-gangguan').value = '';
    document.querySelector('.material-gangguan').value = '';
    document.querySelector('.mesin-gangguan').value = '';
    document.querySelector('.sn-mesin-gangguan').value = '';
    document.querySelector('.jumlah-gangguan').value = '1';
    
    // Focus back to part number
    document.querySelector('.part-number-search-gangguan').focus();
}

// Update preview table (Form Gangguan)
function updateMaterialPreviewTableGangguan() {
    const tableBody = document.getElementById('materialPreviewBodyGangguan');
    
    if (!tableBody) return;
    
    if (materialsDataGangguan.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>Belum ada material yang ditambahkan.</p>
                    <p class="text-sm mt-1">Isi form di atas dan klik "Tambah" untuk menambahkan material.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Build table rows
    let html = '';
    materialsDataGangguan.forEach((mat, index) => {
        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-center border-b">${index + 1}</td>
                <td class="px-4 py-3 border-b font-medium">${mat.partNumber}</td>
                <td class="px-4 py-3 border-b">${mat.jenisBarang}</td>
                <td class="px-4 py-3 border-b">${mat.material}</td>
                <td class="px-4 py-3 border-b">${mat.mesin}</td>
                <td class="px-4 py-3 border-b text-center">${mat.snMesin}</td>
                <td class="px-4 py-3 border-b text-center">${mat.jumlah}</td>
                <td class="px-4 py-3 border-b text-center">
                    <button type="button" 
                        onclick="removeMaterialFromListGangguan(${mat.id})"
                        class="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Update total count
    const countElement = document.getElementById('totalMaterialsCountGangguan');
    if (countElement) countElement.textContent = materialsDataGangguan.length;
}

// Remove material from list (Form Gangguan)
function removeMaterialFromListGangguan(id) {
    const material = materialsDataGangguan.find(m => m.id === id);
    
    if (!confirm(`🗑️ Hapus material "${material.partNumber}" dari list?`)) {
        return;
    }
    
    materialsDataGangguan = materialsDataGangguan.filter(m => m.id !== id);
    updateMaterialPreviewTableGangguan();
    showTemporaryMessageGangguan('✅ Material berhasil dihapus dari list.', 'success');
}

// Show temporary message (Form Gangguan)
function showTemporaryMessageGangguan(message, type = 'success') {
    const messageDiv = document.getElementById('tempMessageGangguan');
    
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `p-4 rounded-lg mb-4 ${
        type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
        type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
        'bg-blue-100 text-blue-800 border border-blue-300'
    }`;
    messageDiv.classList.remove('hidden');
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 3000);
}

// Get materials data for form submission (Form Gangguan)
function getMaterialsDataGangguan() {
    return materialsDataGangguan.map(mat => ({
        partNumber: mat.partNumber,
        jenisBarang: mat.jenisBarang,
        material: mat.material,
        mesin: mat.mesin,
        snMesin: mat.snMesin === '-' ? '' : mat.snMesin,
        jumlah: mat.jumlah
    }));
}

// Reset all materials (Form Gangguan)
function resetMaterialsListGangguan() {
    if (materialsDataGangguan.length > 0) {
        if (!confirm('🗑️ Hapus semua material dari list?')) {
            return;
        }
    }
    
    materialsDataGangguan = [];
    materialIdCounterGangguan = 0;
    updateMaterialPreviewTableGangguan();
    clearMaterialFormGangguan();
    showTemporaryMessageGangguan('✅ List material dikosongkan.', 'success');
}
