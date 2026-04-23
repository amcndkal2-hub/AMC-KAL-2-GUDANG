let stockData = [];
let currentFilter = { namaMaterial: '', jenis: '', mesin: '' };
let tempJenisFilter = ''; // Temporary storage for jenis filter until Apply is clicked

document.addEventListener('DOMContentLoaded', async () => {
    await loadStockData();
    setupFilters();
});

async function loadStockData() {
    try {
        const response = await fetch('/api/dashboard/stock');
        const data = await response.json();
        stockData = data.stock;
        renderStockTable();
        populateMesinFilter();
    } catch (error) {
        console.error('Failed to load stock data:', error);
    }
}

function populateMesinFilter() {
    const mesinSet = new Set(stockData.map(s => s.mesin).filter(Boolean));
    const select = document.getElementById('filterMesin');
    
    mesinSet.forEach(mesin => {
        const option = document.createElement('option');
        option.value = mesin;
        option.textContent = mesin;
        select.appendChild(option);
    });
}

function setupFilters() {
    document.getElementById('searchPart').addEventListener('input', (e) => {
        renderStockTable(e.target.value);
    });
    
    // Remove auto-apply for mesin filter - will apply on button click
    // document.getElementById('filterMesin').addEventListener('change', async (e) => {
    //     currentFilter.mesin = e.target.value;
    //     await loadStockDataWithFilter();
    // });
}

// Store jenis filter selection (don't apply immediately)
function setJenisFilter(jenis) {
    tempJenisFilter = jenis;
    console.log('Jenis filter set to:', jenis);
}

// Apply all filters when button is clicked
function applyFilters() {
    const namaMaterialInput = document.getElementById('filterNamaMaterial').value.trim();
    const mesinSelect = document.getElementById('filterMesin').value;
    
    currentFilter.namaMaterial = namaMaterialInput;
    currentFilter.jenis = tempJenisFilter;
    currentFilter.mesin = mesinSelect;
    
    console.log('Applying filters:', currentFilter);
    loadStockDataWithFilter();
}

// Reset all filters
function resetFilters() {
    document.getElementById('filterNamaMaterial').value = '';
    document.getElementById('filterMesin').value = '';
    document.getElementById('searchPart').value = '';
    
    currentFilter = { namaMaterial: '', jenis: '', mesin: '' };
    tempJenisFilter = '';
    
    loadStockData();
}

async function loadStockDataWithFilter() {
    try {
        let url = '/api/dashboard/stock?';
        if (currentFilter.jenis) url += `jenis=${encodeURIComponent(currentFilter.jenis)}&`;
        if (currentFilter.mesin) url += `mesin=${encodeURIComponent(currentFilter.mesin)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        stockData = data.stock;
        
        // Apply client-side Nama Material filter
        if (currentFilter.namaMaterial) {
            const searchTerm = currentFilter.namaMaterial.toUpperCase();
            stockData = stockData.filter(item => {
                const material = (item.material || '').toUpperCase();
                return material.includes(searchTerm);
            });
        }
        
        renderStockTable();
    } catch (error) {
        console.error('Failed to load filtered stock data:', error);
    }
}

// Deprecated: replaced by setJenisFilter + applyFilters
function filterJenis(jenis) {
    currentFilter.jenis = jenis;
    loadStockDataWithFilter();
}

function renderStockTable(searchQuery = '') {
    const tbody = document.getElementById('stockTable');
    
    let filtered = stockData;
    
    if (searchQuery) {
        filtered = filtered.filter(item =>
            String(item.partNumber).toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                    Tidak ada data
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filtered.map(item => {
        let statusClass = 'bg-green-100 text-green-800';
        let statusIcon = 'check-circle';
        
        if (item.status === 'Habis') {
            statusClass = 'bg-red-100 text-red-800';
            statusIcon = 'times-circle';
        } else if (item.status === 'Hampir Habis') {
            statusClass = 'bg-yellow-100 text-yellow-800';
            statusIcon = 'exclamation-circle';
        }
        
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold">${item.partNumber}</td>
                <td class="px-4 py-3">${item.jenisBarang || '-'}</td>
                <td class="px-4 py-3">${item.material}</td>
                <td class="px-4 py-3">${item.mesin}</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                        ${item.stokMasuk}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                        ${item.stokKeluar}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block ${statusClass} px-3 py-1 rounded-full text-sm font-semibold">
                        <i class="fas fa-${statusIcon} mr-1"></i>
                        ${item.stokAkhir}
                    </span>
                </td>
                <td class="px-4 py-3">${item.unit}</td>
            </tr>
        `;
    }).join('');
}

function exportPDF() {
    alert('Export PDF - Fitur akan segera tersedia');
}

function exportExcel() {
    if (stockData.length === 0) {
        alert('Tidak ada data untuk di-export');
        return;
    }
    
    // Simple CSV export
    let csv = 'Part Number,Jenis Barang,Material,Mesin,Stok Masuk,Stok Keluar,Stok Akhir,Status,Unit\n';
    
    stockData.forEach(item => {
        csv += `"${item.partNumber}","${item.jenisBarang || ''}","${item.material}","${item.mesin}",${item.stokMasuk},${item.stokKeluar},${item.stokAkhir},"${item.status}","${item.unit}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stok-material-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}
