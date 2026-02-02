let ageData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadAgeData();
    setupFilters();
    populateLokasiFilter();
});

async function loadAgeData() {
    try {
        const response = await fetch('/api/dashboard/umur-material');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('✅ Loaded age data:', data.ageData?.length || 0, 'items');
        ageData = data.ageData || [];
        renderAgeTable();
    } catch (error) {
        console.error('❌ Failed to load age data:', error);
        const tbody = document.getElementById('ageTable');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="px-4 py-8 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                        <p>Gagal memuat data: ${error.message}</p>
                        <button onclick="loadAgeData()" class="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            <i class="fas fa-sync-alt mr-2"></i>Coba Lagi
                        </button>
                    </td>
                </tr>
            `;
        }
    }
}

async function populateLokasiFilter() {
    try {
        const response = await fetch('/api/dropdown-values');
        const data = await response.json();
        
        const select = document.getElementById('filterLokasi');
        data.units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load lokasi:', error);
    }
}

function setupFilters() {
    document.getElementById('filterLokasi').addEventListener('change', filterData);
    document.getElementById('filterMaterial').addEventListener('input', filterData);
    document.getElementById('filterSN').addEventListener('input', filterData);
}

async function filterData() {
    const lokasi = document.getElementById('filterLokasi').value;
    const material = document.getElementById('filterMaterial').value;
    const sn = document.getElementById('filterSN').value;
    
    try {
        let url = '/api/dashboard/umur-material?';
        if (lokasi) url += `lokasi=${encodeURIComponent(lokasi)}&`;
        if (material) url += `material=${encodeURIComponent(material)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        ageData = data.ageData;
        
        // Filter by S/N locally
        if (sn) {
            ageData = ageData.filter(item => 
                item.snMesin && item.snMesin.toLowerCase().includes(sn.toLowerCase())
            );
        }
        
        renderAgeTable();
    } catch (error) {
        console.error('Failed to filter age data:', error);
    }
}

function renderAgeTable() {
    const tbody = document.getElementById('ageTable');
    
    if (ageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="px-4 py-8 text-center text-gray-500">
                    Tidak ada data material terpasang
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = ageData.map(item => {
        // Determine status badge color
        let statusClass = 'bg-green-100 text-green-800';
        let statusIcon = 'check-circle';
        let statusText = item.status;
        
        if (item.statusClass === 'red' || item.status === 'Perlu Diganti') {
            statusClass = 'bg-red-100 text-red-800';
            statusIcon = 'times-circle';
        } else if (item.statusClass === 'yellow' || item.status === 'Mendekati Batas') {
            statusClass = 'bg-yellow-100 text-yellow-800';
            statusIcon = 'exclamation-triangle';
        }
        
        // Format sisa hari
        const sisaHari = item.sisaHari || 0;
        const sisaClass = sisaHari <= 0 ? 'text-red-600 font-bold' : sisaHari <= 20 ? 'text-yellow-600 font-bold' : 'text-green-600';
        
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold">${item.snMesin || '-'}</td>
                <td class="px-4 py-3">
                    <div>${item.partNumber}</div>
                    <div class="text-xs text-gray-500">${item.jenisBarang || '-'}</div>
                </td>
                <td class="px-4 py-3">
                    <div>${item.material}</div>
                    <div class="text-xs text-gray-500">${item.mesin}</div>
                </td>
                <td class="px-4 py-3">${formatDate(item.tanggalPasang)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="font-semibold text-blue-600">${item.umurHari} hari</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="editTargetUmur('${item.partNumber}', ${item.targetUmurHari}, '${item.jenisBarang}', '${item.material}', '${item.mesin}')" 
                        class="text-blue-600 hover:text-blue-800 font-semibold">
                        ${item.targetUmurHari} hari
                        <i class="fas fa-edit ml-1 text-sm"></i>
                    </button>
                </td>
                <td class="px-4 py-3 text-center ${sisaClass}">
                    ${sisaHari >= 0 ? `${sisaHari} hari` : `Lewat ${Math.abs(sisaHari)} hari`}
                </td>
                <td class="px-4 py-3">${item.lokasi}</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                        ${item.totalPenggantian || 0} kali
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block ${statusClass} px-3 py-1 rounded-full text-sm">
                        <i class="fas fa-${statusIcon} mr-1"></i>
                        ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="viewHistory('${item.snMesin}', '${item.partNumber}')" 
                        class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">
                        <i class="fas fa-history mr-1"></i>
                        History (${item.totalPenggantian || 0})
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Edit Target Umur Modal
function editTargetUmur(partNumber, currentTarget, jenisBarang, material, mesin) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">Set Target Umur Material</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Part Number</label>
                    <input type="text" value="${partNumber}" readonly 
                        class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Jenis Barang</label>
                    <input type="text" value="${jenisBarang || '-'}" readonly 
                        class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Material</label>
                    <input type="text" value="${material}" readonly 
                        class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Target Umur (Hari)</label>
                    <input type="number" id="targetUmurInput" value="${currentTarget}" 
                        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="1" required>
                    <p class="text-xs text-gray-500 mt-1">
                        <i class="fas fa-info-circle"></i>
                        Alert kuning akan muncul 20 hari sebelum target
                    </p>
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button onclick="saveTargetUmur('${partNumber}', '${jenisBarang}', '${material}', '${mesin}')" 
                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    <i class="fas fa-save mr-2"></i>Simpan
                </button>
                <button onclick="this.closest('.fixed').remove()" 
                    class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                    Batal
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Save Target Umur
async function saveTargetUmur(partNumber, jenisBarang, material, mesin) {
    const targetUmur = document.getElementById('targetUmurInput').value;
    
    if (!targetUmur || targetUmur < 1) {
        alert('Target umur harus lebih dari 0 hari');
        return;
    }
    
    try {
        const response = await fetch('/api/target-umur', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                partNumber,
                targetUmurHari: parseInt(targetUmur),
                jenisBarang,
                material,
                mesin
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Target umur ${targetUmur} hari berhasil disimpan untuk Part Number ${partNumber}`);
            
            // Close modal
            document.querySelector('.fixed').remove();
            
            // Reload data
            await loadAgeData();
        } else {
            alert('❌ Gagal menyimpan target umur');
        }
    } catch (error) {
        console.error('Failed to save target umur:', error);
        alert('❌ Terjadi kesalahan saat menyimpan');
    }
}

// View History Modal
async function viewHistory(snMesin, partNumber) {
    try {
        const response = await fetch(`/api/material-history/${snMesin}/${partNumber}`);
        const data = await response.json();
        
        showHistoryModal(data);
    } catch (error) {
        console.error('Failed to load history:', error);
        alert('Gagal memuat history');
    }
}

function showHistoryModal(data) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full m-4 p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">History Penggantian Material</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                <div class="flex items-center">
                    <i class="fas fa-info-circle text-blue-500 mr-3 text-xl"></i>
                    <div>
                        <p class="font-semibold">S/N Mesin: ${data.snMesin}</p>
                        <p class="text-sm">Part Number: ${data.partNumber}</p>
                        <p class="text-sm">Total Penggantian: <strong>${data.totalPenggantian} kali</strong></p>
                    </div>
                </div>
            </div>
            
            ${data.history.length === 0 ? `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-3"></i>
                    <p>Belum ada history penggantian</p>
                </div>
            ` : `
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-4 py-3 text-left">Penggantian Ke</th>
                                <th class="px-4 py-3 text-left">Tanggal</th>
                                <th class="px-4 py-3 text-left">Nomor BA</th>
                                <th class="px-4 py-3 text-left">Dasar Pengeluaran</th>
                                <th class="px-4 py-3 text-left">Unit Tujuan</th>
                                <th class="px-4 py-3 text-center">Jumlah</th>
                                <th class="px-4 py-3 text-left">Pemeriksa</th>
                                <th class="px-4 py-3 text-left">Penerima</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.history.map((h, index) => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="px-4 py-3">
                                        <span class="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                                            #${data.totalPenggantian - index}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3">${formatDate(h.tanggal)}</td>
                                    <td class="px-4 py-3">
                                        <span class="text-blue-600 font-semibold">
                                            ${h.nomorBA}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3">
                                        <span class="text-sm ${h.dasarPengeluaran && h.dasarPengeluaran.includes('LH05') ? 'bg-green-100 text-green-800 px-2 py-1 rounded' : ''}">
                                            ${h.dasarPengeluaran || 'Pengeluaran Gudang'}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3">${h.lokasiTujuan || '-'}</td>
                                    <td class="px-4 py-3 text-center font-semibold">${h.jumlah}</td>
                                    <td class="px-4 py-3">${h.pemeriksa || '-'}</td>
                                    <td class="px-4 py-3">${h.penerima || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
            
            <div class="mt-6 flex justify-end">
                <button onclick="this.closest('.fixed').remove()" class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg">
                    Tutup
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
            
            <div class="flex justify-end mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                    class="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300">
                    Tutup
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// View BA (redirect to mutasi dashboard)
async function viewBA(nomorBA) {
    window.location.href = `/dashboard/mutasi?ba=${nomorBA}`;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID');
}
