let transactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadTransactions();
    setupFilters();
});

async function loadTransactions() {
    try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        transactions = data.transactions;
        renderMutasiTable();
    } catch (error) {
        console.error('Failed to load transactions:', error);
    }
}

function setupFilters() {
    document.getElementById('filterTanggal').addEventListener('change', filterData);
    document.getElementById('filterNomorBA').addEventListener('input', filterData);
}

function filterData() {
    const tanggal = document.getElementById('filterTanggal').value;
    const nomorBA = document.getElementById('filterNomorBA').value.toLowerCase();
    
    let filtered = transactions;
    
    if (tanggal) {
        filtered = filtered.filter(tx => tx.tanggal === tanggal);
    }
    
    if (nomorBA) {
        filtered = filtered.filter(tx => 
            tx.nomor_ba.toLowerCase().includes(nomorBA)
        );
    }
    
    renderMutasiTable(filtered);
}

function renderMutasiTable(data = transactions) {
    const tbody = document.getElementById('mutasiTable');
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                    Tidak ada data mutasi
                </td>
            </tr>
        `;
        return;
    }
    
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
                <h2 class="text-2xl font-bold">Berita Acara - ${ba.nomorBA}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="border-2 border-gray-300 p-6 rounded-lg mb-6">
                <div class="text-center mb-6">
                    <h3 class="text-xl font-bold">DAFTAR PENGELUARAN (MUTASI) BARANG-BARANG</h3>
                    <p class="text-sm text-gray-600 mt-2">Nomor: ${ba.nomorBA}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <p><strong>Tanggal:</strong> ${formatDate(ba.tanggal)}</p>
                        <p><strong>Lokasi Awal:</strong> ${ba.lokasiAsal}</p>
                        <p><strong>Jenis Input:</strong> ${ba.jenisTransaksi}</p>
                    </div>
                    <div>
                        <p><strong>Tanggal Keluar:</strong> ${formatDate(ba.tanggal)}</p>
                        <p><strong>Dasar Pengeluaran:</strong> LH 02</p>
                        <p><strong>Unit/ULD Tujuan:</strong> ${ba.lokasiTujuan}</p>
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
                                <td class="border border-gray-300 px-3 py-2">${mat.partNumber}</td>
                                <td class="border border-gray-300 px-3 py-2">${mat.material}</td>
                                <td class="border border-gray-300 px-3 py-2">${mat.mesin}</td>
                                <td class="border border-gray-300 px-3 py-2 text-center">${mat.jumlah}</td>
                                <td class="border border-gray-300 px-3 py-2">${mat.snMesin || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="grid grid-cols-2 gap-8 mt-8">
                    <div class="text-center">
                        <p class="font-semibold mb-2">Diperiksa oleh</p>
                        <p class="mb-16">Diterima</p>
                        ${ba.ttdPemeriksa ? `<img src="${ba.ttdPemeriksa}" class="mx-auto h-20 mb-2">` : '<div class="h-20"></div>'}
                        <p class="font-bold">${ba.pemeriksa}</p>
                    </div>
                    <div class="text-center">
                        <p class="font-semibold mb-2">Penerima</p>
                        <p class="mb-16">Diterima Unit</p>
                        ${ba.ttdPenerima ? `<img src="${ba.ttdPenerima}" class="mx-auto h-20 mb-2">` : '<div class="h-20"></div>'}
                        <p class="font-bold">${ba.penerima}</p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end gap-4">
                <button onclick="printBA('${ba.nomorBA}')" 
                    class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                    <i class="fas fa-print mr-2"></i>Print
                </button>
                <button onclick="downloadBA('${ba.nomorBA}')" 
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

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID');
}
