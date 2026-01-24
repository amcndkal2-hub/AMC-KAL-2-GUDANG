// Material List Management for Input Manual
// Single form input with material list preview

// Global state for materials
let materialsData = [];
let materialIdCounter = 0;

// Initialize material input system
function initMaterialInput() {
    // Setup "Tambah ke List" button
    const addButton = document.getElementById('btnTambahMaterial');
    if (addButton) {
        addButton.addEventListener('click', tambahMaterialKeList);
    }

    // Setup part number search
    setupPartNumberSearch();
    
    // Render initial empty table
    renderMaterialsTable();
}

// Setup part number autocomplete search
function setupPartNumberSearch() {
    const partNumberInput = document.getElementById('inputPartNumber');
    const searchResults = document.getElementById('searchResults');
    
    if (!partNumberInput || !searchResults) return;

    let searchTimeout;
    
    partNumberInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.classList.add('hidden');
            searchResults.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search-part?q=${encodeURIComponent(query)}`);
                const results = await response.json();
                
                if (results.length > 0) {
                    searchResults.innerHTML = results.map(item => `
                        <div class="search-result-item px-4 py-2 hover:bg-blue-50 cursor-pointer border-b"
                             data-part='${JSON.stringify(item)}'>
                            <div class="font-semibold text-gray-800">${item.PART_NUMBER}</div>
                            <div class="text-sm text-gray-600">${item.NAMA_MATERIAL || ''}</div>
                            <div class="text-xs text-gray-500">${item.MESIN || ''}</div>
                        </div>
                    `).join('');
                    
                    searchResults.classList.remove('hidden');
                    
                    // Add click handlers to results
                    document.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', function() {
                            const data = JSON.parse(this.dataset.part);
                            fillMaterialForm(data);
                            searchResults.classList.add('hidden');
                        });
                    });
                } else {
                    searchResults.innerHTML = '<div class="px-4 py-2 text-gray-500">Tidak ada hasil</div>';
                    searchResults.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Search error:', error);
                searchResults.classList.add('hidden');
            }
        }, 300);
    });
    
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!partNumberInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
}

// Fill form with selected material data
function fillMaterialForm(data) {
    document.getElementById('inputPartNumber').value = data.PART_NUMBER || '';
    document.getElementById('inputJenisBarang').value = data.JENIS_BARANG || '';
    document.getElementById('inputMaterial').value = data.NAMA_MATERIAL || '';
    document.getElementById('inputMesin').value = data.MESIN || '';
}

// Add material to list
function tambahMaterialKeList() {
    const partNumber = document.getElementById('inputPartNumber').value.trim();
    const jenisBarang = document.getElementById('inputJenisBarang').value.trim();
    const material = document.getElementById('inputMaterial').value.trim();
    const mesin = document.getElementById('inputMesin').value.trim();
    const status = document.getElementById('inputStatus').value.trim();
    const jumlah = parseInt(document.getElementById('inputJumlah').value) || 0;
    
    // Validation
    if (!partNumber) {
        alert('❌ Part Number harus diisi!');
        document.getElementById('inputPartNumber').focus();
        return;
    }
    
    if (!jumlah || jumlah <= 0) {
        alert('❌ Jumlah harus diisi dan lebih dari 0!');
        document.getElementById('inputJumlah').focus();
        return;
    }
    
    // Add to materials array
    const newMaterial = {
        id: ++materialIdCounter,
        partNumber,
        jenisBarang: jenisBarang || '-',
        material: material || '-',
        mesin: mesin || '-',
        status: status || '',
        jumlah
    };
    
    materialsData.push(newMaterial);
    
    // Render updated table
    renderMaterialsTable();
    
    // Clear form for next input
    clearMaterialForm();
    
    // Focus back to part number for next entry
    document.getElementById('inputPartNumber').focus();
    
    // Show success feedback
    showTempMessage(`✅ Material ditambahkan! Total: ${materialsData.length} item`);
}

// Clear material input form
function clearMaterialForm() {
    document.getElementById('inputPartNumber').value = '';
    document.getElementById('inputJenisBarang').value = '';
    document.getElementById('inputMaterial').value = '';
    document.getElementById('inputMesin').value = '';
    document.getElementById('inputStatus').value = '';
    document.getElementById('inputJumlah').value = '';
    
    // Close search results if open
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.classList.add('hidden');
    }
}

// Render materials table
function renderMaterialsTable() {
    const tableBody = document.getElementById('materialsTableBody');
    const emptyState = document.getElementById('materialsEmptyState');
    const tableContainer = document.getElementById('materialsTableContainer');
    
    if (materialsData.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');
    
    const jenisTransaksi = document.getElementById('jenisTransaksi').value;
    const isMasuk = jenisTransaksi.includes('Masuk');
    const statusLabel = isMasuk ? 'Status' : 'S/N Mesin';
    
    tableBody.innerHTML = materialsData.map((mat, index) => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-center">${index + 1}</td>
            <td class="px-4 py-3">${mat.partNumber}</td>
            <td class="px-4 py-3">${mat.jenisBarang}</td>
            <td class="px-4 py-3">${mat.material}</td>
            <td class="px-4 py-3">${mat.mesin}</td>
            <td class="px-4 py-3">${mat.status || '-'}</td>
            <td class="px-4 py-3 text-center">${mat.jumlah}</td>
            <td class="px-4 py-3 text-center">
                <button type="button" 
                        onclick="hapusMaterialDariList(${mat.id})"
                        class="text-red-600 hover:text-red-800 font-medium">
                    <i class="fas fa-trash mr-1"></i>Hapus
                </button>
            </td>
        </tr>
    `).join('');
}

// Remove material from list
function hapusMaterialDariList(id) {
    if (!confirm('Hapus material ini dari list?')) return;
    
    materialsData = materialsData.filter(m => m.id !== id);
    renderMaterialsTable();
    
    showTempMessage(`🗑️ Material dihapus! Sisa: ${materialsData.length} item`);
}

// Show temporary message
function showTempMessage(message) {
    const msgDiv = document.getElementById('tempMessage');
    if (!msgDiv) return;
    
    msgDiv.textContent = message;
    msgDiv.classList.remove('hidden');
    
    setTimeout(() => {
        msgDiv.classList.add('hidden');
    }, 3000);
}

// Get materials data for form submission
function getMaterialsForSubmit() {
    return materialsData.map(mat => ({
        partNumber: mat.partNumber,
        jenisBarang: mat.jenisBarang,
        material: mat.material,
        mesin: mat.mesin,
        status: mat.status,
        jumlah: mat.jumlah
    }));
}

// Clear all materials (for form reset)
function clearAllMaterials() {
    materialsData = [];
    materialIdCounter = 0;
    renderMaterialsTable();
    clearMaterialForm();
}

// Export functions for use in main app.js
window.initMaterialInput = initMaterialInput;
window.tambahMaterialKeList = tambahMaterialKeList;
window.hapusMaterialDariList = hapusMaterialDariList;
window.getMaterialsForSubmit = getMaterialsForSubmit;
window.clearAllMaterials = clearAllMaterials;
