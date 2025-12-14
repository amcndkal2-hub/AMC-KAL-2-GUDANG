let ageData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadAgeData();
    setupFilters();
    populateLokasiFilter();
});

async function loadAgeData() {
    try {
        const response = await fetch('/api/dashboard/umur-material');
        const data = await response.json();
        ageData = data.ageData;
        renderAgeTable();
    } catch (error) {
        console.error('Failed to load age data:', error);
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
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    Tidak ada data material terpasang
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = ageData.map(item => {
        let statusClass = 'bg-green-100 text-green-800';
        let statusText = item.status;
        
        if (item.status === 'Perlu Diganti') {
            statusClass = 'bg-red-100 text-red-800';
        }
        
        // Calculate if urgent (>600 days)
        if (item.umurHari > 600) {
            statusClass = 'bg-red-100 text-red-800';
            statusText = 'Perlu Diganti';
        }
        
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold">${item.snMesin || '-'}</td>
                <td class="px-4 py-3">${item.partNumber}</td>
                <td class="px-4 py-3">${item.material}</td>
                <td class="px-4 py-3">${formatDate(item.tanggalPasang)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block ${statusClass} px-3 py-1 rounded-full text-sm font-semibold">
                        ${item.umurHari} hari
                    </span>
                </td>
                <td class="px-4 py-3">${item.lokasi}</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block ${statusClass} px-3 py-1 rounded-full text-sm">
                        ${statusText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID');
}
