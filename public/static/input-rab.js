// Input Material dari RAB Tersedia
let rabMaterials = [];
let allRABMaterials = []; // Store all materials
let selectedMaterials = [];
let rabList = []; // Store unique RAB list
let dropdownDataRAB = { pemeriksa: [], penerima: [] }; // Store dropdown data

// Load dropdown data for RAB input
async function loadRABDropdownData() {
    try {
        const response = await fetch('/api/dropdown-values');
        const data = await response.json();
        
        dropdownDataRAB = data;
        
        // Populate dropdowns
        populateRABDropdown('rabPemeriksa', data.pemeriksa);
        populateRABDropdown('rabPenerima', data.penerima);
        
        console.log('✅ RAB dropdown data loaded');
    } catch (error) {
        console.error('❌ Failed to load RAB dropdown data:', error);
    }
}

// Populate dropdown with options
function populateRABDropdown(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
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


// Load RAB materials with status Tersedia
async function loadRABMaterials() {
    console.log('🔄 Loading RAB materials...');
    
    try {
        const response = await fetch('/api/rab/materials-tersedia');
        console.log('📡 Response status:', response.status);
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (data.success === false) {
            throw new Error(data.error || 'Failed to load materials');
        }
        
        allRABMaterials = data.materials || [];
        console.log(`✅ Loaded ${allRABMaterials.length} materials`);
        
        // Extract unique RAB list
        populateRABSelector();
        
    } catch (error) {
        console.error('❌ Error loading RAB materials:', error);
        const selector = document.getElementById('rabSelector');
        if (selector) {
            selector.innerHTML = `
                <option value="">Error: ${error.message}</option>
            `;
        }
    }
}

// Populate RAB selector dropdown
function populateRABSelector() {
    const selector = document.getElementById('rabSelector');
    if (!selector) {
        console.error('❌ RAB selector not found');
        return;
    }
    
    // Get unique RAB numbers
    const uniqueRABs = [...new Set(allRABMaterials.map(m => m.nomor_rab))].filter(Boolean);
    rabList = uniqueRABs.map(nomor_rab => {
        const materials = allRABMaterials.filter(m => m.nomor_rab === nomor_rab);
        return {
            nomor_rab,
            count: materials.length,
            tanggal: materials[0]?.tanggal_rab || ''
        };
    });
    
    console.log(`📋 Found ${rabList.length} unique RABs:`, rabList);
    
    if (rabList.length === 0) {
        selector.innerHTML = `
            <option value="">-- Belum ada RAB dengan status Tersedia --</option>
        `;
        return;
    }
    
    // Populate dropdown
    selector.innerHTML = `
        <option value="">-- Pilih Nomor RAB (${rabList.length} tersedia) --</option>
        ${rabList.map(rab => `
            <option value="${rab.nomor_rab}">
                ${rab.nomor_rab} (${rab.count} items)
            </option>
        `).join('')}
    `;
}

// Filter materials by selected RAB
function filterMaterialsByRAB() {
    const selector = document.getElementById('rabSelector');
    const selectedRAB = selector?.value;
    
    console.log('🔍 Filtering by RAB:', selectedRAB);
    
    if (!selectedRAB) {
        // Hide materials section
        const section = document.getElementById('rabMaterialsSection');
        if (section) section.classList.add('hidden');
        
        rabMaterials = [];
        selectedMaterials = [];
        updateRABSelectedSummary();
        return;
    }
    
    // Filter materials by selected RAB
    rabMaterials = allRABMaterials.filter(m => m.nomor_rab === selectedRAB);
    console.log(`✅ Filtered ${rabMaterials.length} materials for ${selectedRAB}`);
    
    // Show materials section
    const section = document.getElementById('rabMaterialsSection');
    if (section) section.classList.remove('hidden');
    
    // Update count badge
    const badge = document.getElementById('materialCountBadge');
    if (badge) badge.textContent = `${rabMaterials.length} items`;
    
    // Render table
    renderRABMaterialsTable();
    
    // Reset selections
    selectedMaterials = [];
    updateRABSelectedSummary();
}

// Render RAB materials table
function renderRABMaterialsTable() {
    const tbody = document.getElementById('rabMaterialsTable');
    if (!tbody) {
        console.error('❌ Element rabMaterialsTable not found!');
        return;
    }
    
    console.log(`🎨 Rendering ${rabMaterials.length} materials...`);
    
    if (rabMaterials.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-arrow-up text-4xl mb-2 text-gray-300"></i>
                    <p class="text-lg font-semibold">Pilih Nomor RAB di atas</p>
                    <p class="text-sm text-gray-400 mt-2">Material akan ditampilkan setelah Anda memilih RAB</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = rabMaterials.map((item, index) => {
        const isTransacted = item.is_transacted === 1;
        const rowClass = isTransacted ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50';
        const textClass = isTransacted ? 'text-gray-400' : 'text-gray-900';
        const checkboxDisabled = isTransacted ? 'disabled checked' : '';
        const checkboxClass = isTransacted 
            ? 'w-4 h-4 text-gray-400 border-gray-300 rounded cursor-not-allowed' 
            : 'w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer';
        
        return `
            <tr class="${rowClass}">
                <td class="px-4 py-3 border text-center">
                    <input type="checkbox" 
                           class="${checkboxClass}"
                           data-material-id="${item.id}"
                           data-index="${index}"
                           ${checkboxDisabled}
                           onchange="toggleRABMaterialSelection(this)">
                </td>
                <td class="px-4 py-3 border text-sm ${textClass}">${item.nomor_lh05 || '-'}</td>
                <td class="px-4 py-3 border text-sm font-medium ${textClass}">${item.part_number || '-'}</td>
                <td class="px-4 py-3 border text-sm ${textClass}">${item.material || '-'}</td>
                <td class="px-4 py-3 border text-sm ${textClass}">${item.mesin || '-'}</td>
                <td class="px-4 py-3 border text-center text-sm ${textClass}">${item.jumlah || 0}</td>
                <td class="px-4 py-3 border text-sm ${textClass}">
                    ${item.unit_uld || '-'}
                    ${isTransacted ? '<span class="ml-2 text-xs text-green-600 font-semibold">✓ Sudah ditransaksikan</span>' : ''}
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Table rendered successfully');
}

// Toggle select all
function toggleSelectAllRAB() {
    const selectAll = document.getElementById('selectAllRAB');
    const checkboxes = document.querySelectorAll('input[type="checkbox"][data-material-id]:not([disabled])');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        toggleRABMaterialSelection(cb);
    });
}

// Toggle material selection
function toggleRABMaterialSelection(checkbox) {
    // Skip if checkbox is disabled (already transacted)
    if (checkbox.disabled) {
        return;
    }
    
    const materialId = parseInt(checkbox.dataset.materialId);
    const index = parseInt(checkbox.dataset.index);
    const material = rabMaterials[index];
    
    // Skip if material is already transacted
    if (material && material.is_transacted === 1) {
        checkbox.checked = true; // Keep it checked
        checkbox.disabled = true; // Ensure it stays disabled
        return;
    }
    
    if (checkbox.checked) {
        if (material && !selectedMaterials.find(m => m.material_gangguan_id === materialId)) {
            selectedMaterials.push(material);
            // Disable the checkbox immediately after selection
            checkbox.disabled = true;
            const row = checkbox.closest('tr');
            if (row) {
                row.classList.remove('hover:bg-gray-50');
                row.classList.add('bg-gray-100', 'opacity-60');
                row.querySelectorAll('td').forEach(td => {
                    td.classList.remove('text-gray-900');
                    td.classList.add('text-gray-400');
                });
            }
        }
    } else {
        // Should not happen since we disable after check, but keep for safety
        selectedMaterials = selectedMaterials.filter(m => m.material_gangguan_id !== materialId);
        // Uncheck select all if any checkbox is unchecked
        const selectAll = document.getElementById('selectAllRAB');
        if (selectAll) selectAll.checked = false;
    }
    
    updateRABSelectedSummary();
}

// Update selected summary
function updateRABSelectedSummary() {
    const summary = document.getElementById('selectedRABSummary');
    const count = document.getElementById('selectedRABCount');
    const list = document.getElementById('selectedRABList');
    const formSection = document.getElementById('rabInputForm');
    
    if (selectedMaterials.length > 0) {
        summary.classList.remove('hidden');
        formSection.classList.remove('hidden');
        count.textContent = selectedMaterials.length;
        
        // Show list of selected materials
        list.innerHTML = selectedMaterials.map(m => 
            `<div class="mb-1">• ${m.part_number} - ${m.material} (${m.jumlah} pcs)</div>`
        ).join('');
        
        // Check if all are selected
        const selectAll = document.getElementById('selectAllRAB');
        if (selectAll) {
            const allCheckboxes = document.querySelectorAll('input[type="checkbox"][data-material-id]');
            selectAll.checked = allCheckboxes.length > 0 && selectedMaterials.length === allCheckboxes.length;
        }
    } else {
        summary.classList.add('hidden');
        formSection.classList.add('hidden');
        const selectAll = document.getElementById('selectAllRAB');
        if (selectAll) selectAll.checked = false;
    }
}

// Initialize signature pads for RAB
let rabSignaturePads = {};

function initRABSignaturePads() {
    const pemeriksaCanvas = document.getElementById('rabCanvasPemeriksa');
    const penerimaCanvas = document.getElementById('rabCanvasPenerima');
    
    if (pemeriksaCanvas) {
        rabSignaturePads.pemeriksa = new SignaturePad(pemeriksaCanvas);
    }
    
    if (penerimaCanvas) {
        rabSignaturePads.penerima = new SignaturePad(penerimaCanvas);
    }
}

// Clear RAB signature
function clearRABSignature(canvasId) {
    if (canvasId === 'rabCanvasPemeriksa' && rabSignaturePads.pemeriksa) {
        rabSignaturePads.pemeriksa.clear();
    } else if (canvasId === 'rabCanvasPenerima' && rabSignaturePads.penerima) {
        rabSignaturePads.penerima.clear();
    }
}

// Submit RAB transaction
async function saveRABTransaction() {
    if (selectedMaterials.length === 0) {
        alert('Pilih minimal 1 material!');
        return;
    }
    
    // Validate form
    const pemeriksa = document.getElementById('rabPemeriksa')?.value.trim();
    const penerima = document.getElementById('rabPenerima')?.value.trim();
    
    if (!pemeriksa || !penerima) {
        alert('Pemeriksa dan Penerima harus diisi!');
        return;
    }
    
    if (rabSignaturePads.pemeriksa && rabSignaturePads.pemeriksa.isEmpty()) {
        alert('TTD Pemeriksa harus diisi!');
        return;
    }
    
    if (rabSignaturePads.penerima && rabSignaturePads.penerima.isEmpty()) {
        alert('TTD Penerima harus diisi!');
        return;
    }
    
    // Prepare data
    const transactionData = {
        jenis: 'Masuk',
        tanggal: new Date().toISOString().split('T')[0],
        lokasi_asal: 'Supplier/Gudang',
        lokasi_tujuan: selectedMaterials[0].unit_uld || 'Gudang',
        pemeriksa: pemeriksa,
        penerima: penerima,
        ttd_pemeriksa: rabSignaturePads.pemeriksa.toDataURL(),
        ttd_penerima: rabSignaturePads.penerima.toDataURL(),
        rab_id: selectedMaterials[0].rab_id, // Add rab_id for status update
        materials: selectedMaterials.map(m => ({
            part_number: m.part_number,
            jenis_barang: m.jenis_barang || '-',  // Add jenis_barang
            material: m.material,
            mesin: m.mesin || '-',  // Ensure mesin has value
            jumlah: m.jumlah,
            material_gangguan_id: m.material_gangguan_id
        }))
    };
    
    console.log('📤 Sending transaction data:', transactionData);
    
    try {
        const response = await fetch('/api/save-transaction-from-rab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('❌ Server error:', result);
            throw new Error(result.error || result.message || 'Failed to save transaction');
        }
        
        if (!result.success) {
            console.error('❌ Transaction failed:', result);
            throw new Error(result.error || result.message || 'Failed to save transaction');
        }
        
        console.log('✅ Transaction saved successfully:', result);
        
        alert(`Transaksi berhasil disimpan!\nNomor BA: ${result.nomor_ba}`);
        
        // Reset form
        resetRABForm();
        
        // Reload data
        await loadRABMaterials();
        
    } catch (error) {
        console.error('❌ Error saving transaction:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
        alert('Gagal menyimpan transaksi: ' + error.message);
    }
}

// Reset RAB form
function resetRABForm() {
    selectedMaterials = [];
    
    // Uncheck all checkboxes
    document.querySelectorAll('input[type="checkbox"][data-material-id]').forEach(cb => {
        cb.checked = false;
    });
    
    const selectAll = document.getElementById('selectAllRAB');
    if (selectAll) selectAll.checked = false;
    
    // Clear form fields
    const pemeriksaInput = document.getElementById('rabPemeriksa');
    const penerimaInput = document.getElementById('rabPenerima');
    
    if (pemeriksaInput) pemeriksaInput.value = '';
    if (penerimaInput) penerimaInput.value = '';
    
    // Clear signatures
    if (rabSignaturePads.pemeriksa) rabSignaturePads.pemeriksa.clear();
    if (rabSignaturePads.penerima) rabSignaturePads.penerima.clear();
    
    updateRABSelectedSummary();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Content Loaded - Input RAB script initialized');
    
    // Initialize signature pads
    initRABSignaturePads();
    
    // Load dropdown data for Pemeriksa & Penerima
    loadRABDropdownData();
    
    // Make loadRABMaterials globally accessible for debugging
    window.loadRABMaterials = loadRABMaterials;
    window.rabDebug = {
        materials: rabMaterials,
        selected: selectedMaterials,
        reload: loadRABMaterials
    };
    
    console.log('🔍 Debug: window.loadRABMaterials is available');
    console.log('🔍 Debug: Try calling loadRABMaterials() manually');
    
    // Load materials on page load (in case user is already on RAB tab)
    const rabTab = document.getElementById('contentRAB');
    if (rabTab && !rabTab.classList.contains('hidden')) {
        console.log('📦 RAB tab is visible, loading materials...');
        loadRABMaterials();
    } else {
        console.log('⏳ RAB tab is hidden, waiting for user to click...');
    }
});
