// =====================================================
// MATERIAL LIST MANAGEMENT SYSTEM
// Single material input with preview table
// =====================================================

// Global state for material list
let materialsData = [];
let materialIdCounter = 0;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize empty table
    updateMaterialPreviewTable();
    
    // Bind "Tambah" button
    const addBtn = document.getElementById('addMaterialBtn');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addMaterialToList();
        });
    }
    
    // Bind Enter key on Part Number input
    const partNumberInput = document.querySelector('.part-number-search');
    if (partNumberInput) {
        partNumberInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addMaterialToList();
            }
        });
    }
    
    // Setup part number search using existing functionality from app.js
    setupPartNumberSearchForMaterialInput();
});

// Setup part number search for single material input
function setupPartNumberSearchForMaterialInput() {
    const searchInput = document.querySelector('.part-number-search');
    const resultsDiv = document.querySelector('.search-results');
    
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
                
                displaySearchResultsForMaterialInput(resultsDiv, data.results);
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

// Display search results for material input
function displaySearchResultsForMaterialInput(resultsDiv, results) {
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
            fillMaterialDataForInput(data);
            resultsDiv.classList.add('hidden');
        });
    });
}

// Fill material data from selected part
function fillMaterialDataForInput(data) {
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
    
    document.querySelector('.part-number-search').value = partNumber;
    document.querySelector('.jenis-barang').value = jenisBarang;
    document.querySelector('.material').value = material;
    document.querySelector('.mesin').value = mesin;
}

// Add material to the list
function addMaterialToList() {
    // Get form values
    const partNumber = document.querySelector('.part-number-search').value.trim();
    const jenisBarang = document.querySelector('.jenis-barang').value.trim();
    const material = document.querySelector('.material').value.trim();
    const mesin = document.querySelector('.mesin').value.trim();
    const status = document.querySelector('.status').value.trim();
    const jumlah = document.querySelector('.jumlah').value.trim();
    
    // Validation
    if (!partNumber) {
        alert('❌ Part Number wajib diisi!');
        return;
    }
    
    if (!jenisBarang || !material || !mesin || jenisBarang === '-' || material === '-' || mesin === '-') {
        alert('❌ Data material tidak lengkap! Pastikan Part Number sudah dipilih dari dropdown.');
        return;
    }
    
    if (!jumlah || parseInt(jumlah) <= 0) {
        alert('❌ Jumlah harus lebih dari 0!');
        return;
    }
    
    // Add to materials array
    materialIdCounter++;
    const materialData = {
        id: materialIdCounter,
        partNumber,
        jenisBarang,
        material,
        mesin,
        status: status || '-',
        jumlah: parseInt(jumlah)
    };
    
    materialsData.push(materialData);
    
    // Clear form inputs
    clearMaterialForm();
    
    // Update preview table
    updateMaterialPreviewTable();
    
    // Show success message
    showTemporaryMessage(`✅ Material "${partNumber}" berhasil ditambahkan!`, 'success');
}

// Clear material form
function clearMaterialForm() {
    document.querySelector('.part-number-search').value = '';
    document.querySelector('.jenis-barang').value = '';
    document.querySelector('.material').value = '';
    document.querySelector('.mesin').value = '';
    document.querySelector('.status').value = '';
    document.querySelector('.jumlah').value = '1';
    
    // Focus back to part number
    document.querySelector('.part-number-search').focus();
}

// Update preview table
function updateMaterialPreviewTable() {
    const tableBody = document.getElementById('materialPreviewBody');
    
    if (materialsData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>Belum ada material yang ditambahkan.</p>
                    <p class="text-sm mt-1">Isi form di atas dan klik "Tambah" untuk menambahkan material.</p>
                </td>
            </tr>
        `;
        
        // Hide submit button if no materials
        const submitBtn = document.getElementById('submitTransactionBtn');
        if (submitBtn) submitBtn.disabled = true;
        return;
    }
    
    // Enable submit button
    const submitBtn = document.getElementById('submitTransactionBtn');
    if (submitBtn) submitBtn.disabled = false;
    
    // Build table rows
    let html = '';
    materialsData.forEach((mat, index) => {
        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-center border-b">${index + 1}</td>
                <td class="px-4 py-3 border-b font-medium">${mat.partNumber}</td>
                <td class="px-4 py-3 border-b">${mat.jenisBarang}</td>
                <td class="px-4 py-3 border-b">${mat.material}</td>
                <td class="px-4 py-3 border-b">${mat.mesin}</td>
                <td class="px-4 py-3 border-b text-center">${mat.status}</td>
                <td class="px-4 py-3 border-b text-center">${mat.jumlah}</td>
                <td class="px-4 py-3 border-b text-center">
                    <button type="button" 
                        onclick="removeMaterialFromList(${mat.id})"
                        class="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Update total count
    const countElement = document.getElementById('totalMaterialsCount');
    if (countElement) countElement.textContent = materialsData.length;
}

// Remove material from list
function removeMaterialFromList(id) {
    const material = materialsData.find(m => m.id === id);
    
    if (!confirm(`🗑️ Hapus material "${material.partNumber}" dari list?`)) {
        return;
    }
    
    materialsData = materialsData.filter(m => m.id !== id);
    updateMaterialPreviewTable();
    showTemporaryMessage('✅ Material berhasil dihapus dari list.', 'success');
}

// Show temporary message
function showTemporaryMessage(message, type = 'success') {
    const messageDiv = document.getElementById('tempMessage');
    
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

// Get materials data for form submission
function getMaterialsData() {
    return materialsData.map(mat => ({
        partNumber: mat.partNumber,
        jenisBarang: mat.jenisBarang,
        material: mat.material,
        mesin: mat.mesin,
        status: mat.status === '-' ? '' : mat.status,
        jumlah: mat.jumlah
    }));
}

// Reset all materials
function resetMaterialsList() {
    if (materialsData.length > 0) {
        if (!confirm('🗑️ Hapus semua material dari list?')) {
            return;
        }
    }
    
    materialsData = [];
    materialIdCounter = 0;
    updateMaterialPreviewTable();
    clearMaterialForm();
    showTemporaryMessage('✅ List material dikosongkan.', 'success');
}
