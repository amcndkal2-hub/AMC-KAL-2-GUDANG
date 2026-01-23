// Input Material dari RAB Tersedia
let rabMaterials = [];
let selectedMaterials = [];

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
        
        rabMaterials = data.materials || [];
        console.log(`✅ Loaded ${rabMaterials.length} materials`);
        
        renderRABMaterialsTable();
    } catch (error) {
        console.error('❌ Error loading RAB materials:', error);
        const tbody = document.getElementById('rabMaterialsTable');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-8 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
                        <p class="font-semibold">Gagal memuat data</p>
                        <p class="text-sm mt-2">${error.message}</p>
                        <button onclick="loadRABMaterials()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            <i class="fas fa-refresh mr-2"></i>Coba Lagi
                        </button>
                    </td>
                </tr>
            `;
        }
    }
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
                <td colspan="8" class="px-4 py-12 text-center text-gray-500">
                    <i class="fas fa-inbox text-6xl mb-4 text-gray-300"></i>
                    <p class="text-lg font-semibold mb-2">Belum ada material dari RAB dengan status Tersedia</p>
                    <p class="text-sm text-gray-400 mb-4">
                        Untuk menggunakan fitur ini:
                    </p>
                    <ol class="text-sm text-left inline-block text-gray-600">
                        <li>1. Buat RAB di menu <strong>Create RAB</strong></li>
                        <li>2. Buka <strong>List RAB</strong></li>
                        <li>3. Ubah status RAB menjadi <strong>Tersedia</strong></li>
                        <li>4. Material akan muncul di sini</li>
                    </ol>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = rabMaterials.map((item, index) => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 border text-center">
                <input type="checkbox" 
                       class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                       data-material-id="${item.id}"
                       data-index="${index}"
                       onchange="toggleRABMaterialSelection(this)">
            </td>
            <td class="px-4 py-3 border text-sm text-gray-900">${item.nomor_rab || '-'}</td>
            <td class="px-4 py-3 border text-sm text-gray-900">${item.nomor_lh05 || '-'}</td>
            <td class="px-4 py-3 border text-sm font-medium text-gray-900">${item.part_number || '-'}</td>
            <td class="px-4 py-3 border text-sm text-gray-900">${item.material || '-'}</td>
            <td class="px-4 py-3 border text-sm text-gray-900">${item.mesin || '-'}</td>
            <td class="px-4 py-3 border text-center text-sm text-gray-900">${item.jumlah || 0}</td>
            <td class="px-4 py-3 border text-sm text-gray-900">${item.unit_uld || '-'}</td>
        </tr>
    `).join('');
    
    console.log('✅ Table rendered successfully');
}

// Toggle select all
function toggleSelectAllRAB() {
    const selectAll = document.getElementById('selectAllRAB');
    const checkboxes = document.querySelectorAll('input[type="checkbox"][data-material-id]');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        toggleRABMaterialSelection(cb);
    });
}

// Toggle material selection
function toggleRABMaterialSelection(checkbox) {
    const materialId = parseInt(checkbox.dataset.materialId);
    const index = parseInt(checkbox.dataset.index);
    const material = rabMaterials[index];
    
    if (checkbox.checked) {
        if (material && !selectedMaterials.find(m => m.material_gangguan_id === materialId)) {
            selectedMaterials.push(material);
        }
    } else {
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
        materials: selectedMaterials.map(m => ({
            part_number: m.part_number,
            material: m.material,
            mesin: m.mesin,
            jumlah: m.jumlah,
            material_gangguan_id: m.material_gangguan_id
        }))
    };
    
    try {
        const response = await fetch('/api/save-transaction-from-rab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save transaction');
        }
        
        const result = await response.json();
        
        alert(`Transaksi berhasil disimpan!\nNomor BA: ${result.nomor_ba}`);
        
        // Reset form
        resetRABForm();
        
        // Reload data
        await loadRABMaterials();
        
    } catch (error) {
        console.error('❌ Error saving transaction:', error);
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
