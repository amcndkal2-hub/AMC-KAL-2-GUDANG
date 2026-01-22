let transactions = [];

// Wait for auth check before loading data
async function initDashboard() {
    // Check if user is authenticated
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        console.log('No session token, redirecting to login');
        window.location.href = '/login';
        return;
    }
    
    // Load transactions after auth check
    await loadTransactions();
    setupFilters();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initDashboard);

async function loadTransactions() {
    try {
        console.log('🔄 Loading transactions from D1...');
        const response = await fetch('/api/transactions');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if data has expected structure
        if (!data.transactions || !Array.isArray(data.transactions)) {
            console.error('❌ Invalid response structure:', data);
            throw new Error('Invalid response structure');
        }
        
        transactions = data.transactions;
        console.log(`✅ Loaded ${transactions.length} transactions from ${data.source || 'unknown source'}`);
        
        // Populate dynamic dropdowns
        populateUnitTujuanDropdown();
        
        renderMutasiTable();
    } catch (error) {
        console.error('❌ Failed to load transactions:', error);
        
        // Show error message to user
        const tbody = document.getElementById('mutasiTable');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-4 py-8 text-center">
                        <div class="text-red-600">
                            <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                            <p class="font-semibold">Gagal memuat data transaksi</p>
                            <p class="text-sm mt-2">${error.message}</p>
                            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                <i class="fas fa-sync-alt mr-2"></i>Coba Lagi
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

function populateUnitTujuanDropdown() {
    const dropdown = document.getElementById('filterUnitTujuan');
    if (!dropdown) {
        console.warn('⚠️ filterUnitTujuan dropdown not found!');
        return;
    }
    
    // Extract unique lokasi_tujuan values
    const uniqueLocations = [...new Set(transactions.map(tx => tx.lokasi_tujuan))].filter(Boolean);
    
    // Sort alphabetically
    uniqueLocations.sort();
    
    // Build dropdown options
    let html = '<option value="">Semua Unit</option>';
    uniqueLocations.forEach(location => {
        html += `<option value="${location}">${location}</option>`;
    });
    
    dropdown.innerHTML = html;
    console.log(`📍 Loaded ${uniqueLocations.length} unique Unit Tujuan:`, uniqueLocations);
}

function setupFilters() {
    document.getElementById('filterTanggal').addEventListener('change', filterData);
    document.getElementById('filterNomorBA').addEventListener('input', filterData);
    document.getElementById('filterPartNumber').addEventListener('input', filterData);
    document.getElementById('filterUnitTujuan').addEventListener('input', filterData);
}

function filterData() {
    const tanggal = document.getElementById('filterTanggal').value;
    const nomorBA = document.getElementById('filterNomorBA').value.toLowerCase();
    const partNumber = document.getElementById('filterPartNumber').value.toLowerCase();
    const unitTujuan = document.getElementById('filterUnitTujuan').value.toLowerCase();
    
    let filtered = transactions;
    
    if (tanggal) {
        filtered = filtered.filter(tx => tx.tanggal === tanggal);
    }
    
    if (nomorBA) {
        filtered = filtered.filter(tx => 
            tx.nomor_ba.toLowerCase().includes(nomorBA)
        );
    }
    
    if (partNumber) {
        filtered = filtered.filter(tx => 
            tx.materials.some(mat => 
                (mat.partNumber || mat.part_number || '').toLowerCase().includes(partNumber)
            )
        );
    }
    
    if (unitTujuan) {
        filtered = filtered.filter(tx => 
            tx.lokasi_tujuan.toLowerCase().includes(unitTujuan)
        );
    }
    
    renderMutasiTable(filtered);
}

function resetFilter() {
    document.getElementById('filterTanggal').value = '';
    document.getElementById('filterNomorBA').value = '';
    document.getElementById('filterPartNumber').value = '';
    document.getElementById('filterUnitTujuan').value = '';
    renderMutasiTable(transactions);
}

function renderMutasiTable(data = transactions) {
    const tbody = document.getElementById('mutasiTable');
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="px-4 py-8 text-center text-gray-500">
                    Tidak ada data mutasi
                </td>
            </tr>
        `;
        return;
    }
    
    const isAdminUser = isAdmin();
    let html = '';
    
    data.forEach(tx => {
        tx.materials.forEach((mat, idx) => {
            const jenisClass = tx.jenis_transaksi.includes('Masuk') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800';
            
            const jenisIcon = tx.jenis_transaksi.includes('Masuk') 
                ? 'arrow-down' 
                : 'arrow-up';
            
            html += `
                <tr class="border-b hover:bg-gray-50">
                    ${idx === 0 ? `
                        <td class="px-4 py-3 font-bold" rowspan="${tx.materials.length}">
                            <a href="#" onclick="viewBA('${tx.nomor_ba}')" class="text-blue-600 hover:underline">
                                ${tx.nomor_ba}
                            </a>
                        </td>
                        <td class="px-4 py-3" rowspan="${tx.materials.length}">
                            ${formatDate(tx.tanggal)}
                        </td>
                        <td class="px-4 py-3" rowspan="${tx.materials.length}">
                            <span class="inline-block ${jenisClass} px-3 py-1 rounded-full text-sm">
                                <i class="fas fa-${jenisIcon} mr-1"></i>
                                ${tx.jenis_transaksi}
                            </span>
                        </td>
                    ` : ''}
                    <td class="px-4 py-3">${mat.partNumber || mat.part_number}</td>
                    <td class="px-4 py-3 text-center font-semibold">${mat.jumlah}</td>
                    ${idx === 0 ? `
                        <td class="px-4 py-3" rowspan="${tx.materials.length}">${tx.lokasi_asal}</td>
                        <td class="px-4 py-3" rowspan="${tx.materials.length}">${tx.lokasi_tujuan}</td>
                        <td class="px-4 py-3" rowspan="${tx.materials.length}">${tx.pemeriksa}</td>
                        <td class="px-4 py-3" rowspan="${tx.materials.length}">${tx.penerima}</td>
                        <td class="px-4 py-3 text-center" rowspan="${tx.materials.length}">
                            <button onclick="exportBA('${tx.nomor_ba}')" 
                                class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm">
                                <i class="fas fa-download mr-1"></i>Terkirim
                            </button>
                        </td>
                        <td class="px-4 py-3 text-center" rowspan="${tx.materials.length}">
                            ${isAdminUser ? `
                                <button onclick="deleteTransaction('${tx.nomor_ba}')" 
                                    class="admin-only btn-delete bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm">
                                    <i class="fas fa-trash mr-1"></i>Hapus
                                </button>
                            ` : ''}
                        </td>
                    ` : ''}
                </tr>
            `;
        });
    });
    
    tbody.innerHTML = html;
}

async function viewBA(nomorBA) {
    try {
        const response = await fetch(`/api/ba/${nomorBA}`);
        const data = await response.json();
        
        if (data.ba) {
            showBAModal(data.ba);
        }
    } catch (error) {
        console.error('Failed to load BA:', error);
    }
}

function showBAModal(ba) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Berita Acara - ${ba.nomor_ba}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="border-2 border-gray-300 p-6 rounded-lg mb-6">
                <div class="text-center mb-6">
                    <h3 class="text-xl font-bold">DAFTAR PENGELUARAN (MUTASI) BARANG-BARANG</h3>
                    <p class="text-sm text-gray-600 mt-2">Nomor: ${ba.nomor_ba}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <p><strong>Tanggal:</strong> ${formatDate(ba.tanggal)}</p>
                        <p><strong>Lokasi Awal:</strong> ${ba.lokasi_asal}</p>
                        <p><strong>Jenis Input:</strong> ${ba.jenis_transaksi}</p>
                    </div>
                    <div>
                        <p><strong>Tanggal Keluar:</strong> ${formatDate(ba.tanggal)}</p>
                        <p><strong>Dasar Pengeluaran:</strong> LH 02</p>
                        <p><strong>Unit/ULD Tujuan:</strong> ${ba.lokasi_tujuan}</p>
                    </div>
                </div>
                
                <table class="w-full border-collapse border border-gray-300 mb-6">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border border-gray-300 px-3 py-2">PART NUMBER</th>
                            <th class="border border-gray-300 px-3 py-2">MATERIAL</th>
                            <th class="border border-gray-300 px-3 py-2">MESIN</th>
                            <th class="border border-gray-300 px-3 py-2">JUMLAH</th>
                            <th class="border border-gray-300 px-3 py-2">S/N MESIN</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ba.materials.map(mat => `
                            <tr>
                                <td class="border border-gray-300 px-3 py-2">${mat.partNumber || mat.part_number}</td>
                                <td class="border border-gray-300 px-3 py-2">${mat.material}</td>
                                <td class="border border-gray-300 px-3 py-2">${mat.mesin}</td>
                                <td class="border border-gray-300 px-3 py-2 text-center">${mat.jumlah}</td>
                                <td class="border border-gray-300 px-3 py-2">${mat.snMesin || mat.sn_mesin || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="grid grid-cols-2 gap-8 mt-8">
                    <div class="text-center">
                        <p class="font-semibold mb-2">Diperiksa oleh</p>
                        <p class="mb-16">Diterima</p>
                        ${ba.ttd_pemeriksa ? `<img src="${ba.ttd_pemeriksa}" class="mx-auto h-20 mb-2">` : '<div class="h-20"></div>'}
                        <p class="font-bold">${ba.pemeriksa}</p>
                    </div>
                    <div class="text-center">
                        <p class="font-semibold mb-2">Penerima</p>
                        <p class="mb-16">Diterima Unit</p>
                        ${ba.ttd_penerima ? `<img src="${ba.ttd_penerima}" class="mx-auto h-20 mb-2">` : '<div class="h-20"></div>'}
                        <p class="font-bold">${ba.penerima}</p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end gap-4">
                <button onclick="printBA('${ba.nomor_ba}')" 
                    class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                    <i class="fas fa-print mr-2"></i>Print
                </button>
                <button onclick="downloadBA('${ba.nomor_ba}')" 
                    class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                    <i class="fas fa-download mr-2"></i>Download PDF
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function exportBA(nomorBA) {
    viewBA(nomorBA);
}

function exportAllBA() {
    if (transactions.length === 0) {
        alert('Tidak ada data untuk di-export');
        return;
    }
    
    alert(`Export semua BA (${transactions.length} dokumen) - Fitur akan segera tersedia`);
}

function printBA(nomorBA) {
    window.print();
}

function downloadBA(nomorBA) {
    alert(`Download BA ${nomorBA} sebagai PDF - Fitur akan segera tersedia`);
}

async function deleteTransaction(nomorBA) {
    if (!confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus transaksi:\n${nomorBA}\n\nData yang terhapus TIDAK BISA dikembalikan!\n\nLanjutkan hapus?`)) {
        return;
    }
    
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        const response = await fetch(`/api/transaction/${encodeURIComponent(nomorBA)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Transaksi ${nomorBA} berhasil dihapus!`);
            // Reload data
            await loadTransactions();
        } else {
            alert(`❌ Gagal menghapus transaksi:\n${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('❌ Terjadi kesalahan saat menghapus transaksi');
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID');
}
