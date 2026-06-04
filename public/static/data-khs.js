// DATA KHS - Kontrak Harga Satuan
console.log('✅ Data KHS Script Loaded v3')

let allKHSData = []
let currentUsername = ''
let currentRole = ''
let sessionToken = ''
let krListCache = []   // daftar KR Pembangkitan dari /api/kr-list

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing DATA KHS v3...')
  sessionToken = localStorage.getItem('sessionToken') || ''
  await loadCurrentUser()
  await loadKRList()   // load daftar KR dulu sebelum render tabel
  await loadKHSData()
})

// ─── Load daftar KR Pembangkitan dari API ──────────────────────────────────
async function loadKRList() {
  try {
    const res = await fetch('/api/kr-list')
    if (res.ok) {
      const data = await res.json()
      krListCache = data.data || []
      console.log(`📋 Loaded ${krListCache.length} KR Pembangkitan`)
    }
  } catch (e) {
    console.warn('Could not load KR list:', e)
    krListCache = []
  }
}

// ─── Load current session user ─────────────────────────────────────────────
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/check-session', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.valid) {
        currentUsername = data.username || ''
        currentRole = data.role || 'user'
        console.log(`👤 Logged in as: ${currentUsername} (${currentRole})`)
      }
    }
  } catch (e) {
    console.warn('Could not load session info:', e)
  }
}

// ─── Load KHS data from API ────────────────────────────────────────────────
async function loadKHSData() {
  const container = document.getElementById('khsListContainer')
  container.innerHTML = `
    <tr>
      <td colspan="6" class="px-4 py-8 text-center text-gray-500">
        <i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>
        Memuat data KHS...
      </td>
    </tr>`

  try {
    const response = await fetch('/api/rab', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })

    if (!response.ok) throw new Error('Failed to load KHS data')

    const data = await response.json()
    const allRAB = Array.isArray(data) ? data : (data.data || [])
    allKHSData = allRAB.filter(r => r.jenis_rab === 'KHS')

    console.log(`✅ Found ${allKHSData.length} KHS records`)

    renderKHSTable()
    updateDataInfo()
  } catch (error) {
    console.error('❌ Failed to load KHS data:', error)
    container.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-3xl mb-2 block"></i>
          Gagal memuat data KHS
          <br/>
          <button onclick="loadKHSData()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            <i class="fas fa-redo mr-1"></i>Coba Lagi
          </button>
        </td>
      </tr>`
  }
}

// ─── Render tabel KHS ──────────────────────────────────────────────────────
function renderKHSTable() {
  const container = document.getElementById('khsListContainer')

  if (allKHSData.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-12 text-center text-gray-400">
          <i class="fas fa-inbox text-5xl mb-3 block"></i>
          <p class="text-lg">Belum ada data KHS</p>
          <a href="/dashboard/create-khs" class="mt-4 inline-block px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            <i class="fas fa-plus mr-1"></i>Buat KHS Baru
          </a>
        </td>
      </tr>`
    return
  }

  // Sort newest first
  const sorted = [...allKHSData].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  )

  const isAdmin = currentRole === 'admin'

  container.innerHTML = sorted.map((khs, idx) => {
    const hasKR = khs.nomor_kr && khs.nomor_kr.trim() !== ''
    const isLocked = hasKR && !isAdmin  // user biasa → terkunci
    const canEdit = isAdmin || !hasKR   // admin bisa selalu, user hanya jika belum ada

    // Status badge
    const statusBadge = getStatusBadge(khs.status)

    // Vendor: ambil dari krListCache berdasarkan nomor_kr, fallback ke set_by
    let vendorName = '-'
    if (khs.nomor_kr) {
      const krData = krListCache.find(k => k.nomor_kr === khs.nomor_kr)
      vendorName = krData ? krData.vendor : (khs.nomor_kr_set_by || '-')
    }

    return `
      <tr class="hover:bg-gray-50 border-b border-gray-100" id="row-${khs.id}">
        <!-- NOMOR RAB → klik = data CREATE KHS (DB) -->
        <td class="px-4 py-3 text-sm font-semibold text-blue-600 cursor-pointer hover:underline"
            onclick="viewKHSFromDB(${idx})" title="Lihat items inputan CREATE KHS">
          ${khs.nomor_rab || '-'}
        </td>

        <!-- NOMOR KHS / KR -->
        <td class="px-4 py-3 text-sm">
          ${renderKRInput(khs, idx, canEdit, isLocked)}
        </td>

        <!-- VENDOR -->
        <td class="px-4 py-3 text-sm">
          ${khs.nomor_kr
            ? `<span class="text-xs font-medium text-gray-700">${escapeHtml(vendorName)}</span>`
            : '<span class="text-gray-300 italic text-xs">—</span>'}
        </td>

        <!-- STATUS -->
        <td class="px-4 py-3 text-sm">
          ${statusBadge}
        </td>

        <!-- ACTION -->
        <td class="px-4 py-3 text-sm">
          <!-- VIEW → data dari JSON KR (harga, vendor) -->
          <button onclick="viewKHSFromKR(${idx})"
                  title="Lihat detail KR dari kontrak"
                  class="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition shadow-sm">
            <i class="fas fa-eye mr-1.5"></i>VIEW
          </button>
          ${isAdmin && hasKR ? `
          <button onclick="clearKR(${idx})"
                  title="Hapus Nomor KR (Admin only)"
                  class="ml-1 inline-flex items-center px-2 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition shadow-sm">
            <i class="fas fa-times"></i>
          </button>` : ''}
        </td>
      </tr>
    `
  }).join('')
}

// ─── Render KR input cell ──────────────────────────────────────────────────
function renderKRInput(khs, idx, canEdit, isLocked) {
  if (isLocked) {
    // User biasa & sudah ada KR → tampilkan read-only
    return `
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-gray-800">${escapeHtml(khs.nomor_kr)}</span>
        <i class="fas fa-lock text-gray-400 text-xs" title="Terkunci — hanya admin yang bisa mengubah"></i>
      </div>`
  }

  if (canEdit) {
    // Editable: dropdown KR Pembangkitan + tombol simpan
    const val = khs.nomor_kr || ''
    // Build option list dari krListCache
    const options = krListCache.map(kr => {
      const selected = kr.nomor_kr === val ? 'selected' : ''
      // Tampilkan nomor KR singkat (potong setelah KR/)
      const label = kr.nomor_kr.length > 50
        ? kr.nomor_kr.substring(0, 50) + '…'
        : kr.nomor_kr
      return `<option value="${escapeHtml(kr.nomor_kr)}" ${selected} title="${escapeHtml(kr.nomor_kr)}">${escapeHtml(label)}</option>`
    }).join('')

    const adminNote = isAdmin && val
      ? `<span class="ml-1 text-xs text-amber-600" title="Admin: dapat mengubah KR"><i class="fas fa-shield-alt"></i></span>`
      : ''

    return `
      <div class="flex items-center gap-1" id="kr-edit-${khs.id}">
        <select
          id="kr-input-${khs.id}"
          class="border border-gray-300 rounded px-2 py-1 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          title="Pilih Nomor KR Pembangkitan"
        >
          <option value="">-- Pilih Nomor KR --</option>
          ${options}
        </select>
        ${adminNote}
        <button onclick="saveKR(${idx})"
                class="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition whitespace-nowrap"
                title="Simpan Nomor KR (permanen)">
          <i class="fas fa-save mr-1"></i>Simpan
        </button>
      </div>`
  }

  return '<span class="text-gray-300 italic text-xs">--</span>'
}

// ─── Save KR ke DB ─────────────────────────────────────────────────────────
async function saveKR(idx) {
  const khs = allKHSData[idx]
  const select = document.getElementById(`kr-input-${khs.id}`)
  if (!select) return

  const nomorKR = select.value.trim()
  if (!nomorKR) {
    showToast('warning', 'Pilih Nomor KR terlebih dahulu dari dropdown.')
    return
  }

  // Konfirmasi sebelum menyimpan (permanen untuk user biasa)
  const isAdmin = currentRole === 'admin'
  const confirmMsg = isAdmin
    ? `Simpan Nomor KR:\n"${nomorKR}"\n\n(Admin dapat mengubah kembali jika diperlukan)`
    : `Simpan Nomor KR:\n"${nomorKR}"\n\n⚠️ PERMANEN — setelah disimpan tidak dapat diubah kecuali oleh Admin.\n\nLanjutkan?`
  if (!confirm(confirmMsg)) return

  // Cari tombol simpan (bisa ada adminNote span di tengah)
  const btn = select.parentElement.querySelector('button[onclick*="saveKR"]')
  const originalText = btn ? btn.innerHTML : ''
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>' }

  // UI loading
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'

  try {
    const res = await fetch(`/api/rab/${khs.id}/nomor-kr`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ nomor_kr: nomorKR })
    })

    const data = await res.json()

    if (res.status === 403) {
      showToast('error', data.message || 'Nomor KR terkunci. Hanya admin yang bisa mengubah.')
      if (btn) { btn.disabled = false; btn.innerHTML = originalText }
      return
    }

    if (!res.ok) {
      showToast('error', data.message || 'Gagal menyimpan Nomor KR')
      if (btn) { btn.disabled = false; btn.innerHTML = originalText }
      return
    }

    // Update local data
    khs.nomor_kr = nomorKR || null
    khs.nomor_kr_set_by = currentUsername

    showToast('success', `✅ Nomor KR berhasil disimpan secara permanen!`)

    // Re-render tabel untuk update tampilan (lock/unlock)
    renderKHSTable()

  } catch (e) {
    console.error('Save KR error:', e)
    showToast('error', 'Gagal menyimpan. Periksa koneksi.')
    if (btn) { btn.disabled = false; btn.innerHTML = originalText }
  }
}

// ─── Clear KR (admin only) ─────────────────────────────────────────────────
async function clearKR(idx) {
  const khs = allKHSData[idx]
  if (!confirm(`Hapus Nomor KR "${khs.nomor_kr}" dari ${khs.nomor_rab}?`)) return

  try {
    const res = await fetch(`/api/rab/${khs.id}/nomor-kr`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ nomor_kr: '' })
    })

    if (res.ok) {
      khs.nomor_kr = null
      khs.nomor_kr_set_by = null
      showToast('success', 'Nomor KR berhasil dihapus')
      renderKHSTable()
    } else {
      const d = await res.json()
      showToast('error', d.message || 'Gagal menghapus')
    }
  } catch (e) {
    showToast('error', 'Gagal menghapus. Periksa koneksi.')
  }
}

// ─── Cache untuk Detail Item KR dari GitHub JSON ──────────────────────────
let krDetailCache = null  // { data: [...], ts: number }
const KR_DETAIL_JSON_URL = 'https://raw.githubusercontent.com/ipanrifan-create/DATA-KR/refs/heads/main/data_scm.json'
const KR_DETAIL_CACHE_TTL = 60 * 60 * 1000  // 1 jam

async function fetchKRDetailItems(nomorKR) {
  // Gunakan cache jika masih valid
  const now = Date.now()
  if (!krDetailCache || now - krDetailCache.ts > KR_DETAIL_CACHE_TTL) {
    console.log('🔄 Fetching KR detail JSON from GitHub...')
    const resp = await fetch(KR_DETAIL_JSON_URL)
    if (!resp.ok) throw new Error(`Failed to fetch KR JSON: ${resp.status}`)
    const json = await resp.json()
    krDetailCache = { data: json['Detail Item KR'] || [], ts: now }
    console.log(`✅ KR detail cache loaded: ${krDetailCache.data.length} rows`)
  }

  const allRows = krDetailCache.data
  // Header row adalah row[0] = 'No', skip it
  // Cari semua baris yang cocok dengan nomor_kr (bisa row penuh atau continuation)
  const items = []
  let currentKR = null

  for (const row of allRows) {
    if (!Array.isArray(row)) continue
    // Row dengan nomor KR penuh
    if (row[1] && String(row[1]).trim() === nomorKR.trim()) {
      currentKR = nomorKR
    }
    // Jika row[1] kosong tapi currentKR aktif, ini continuation item
    if (currentKR === nomorKR && (row[10] || row[11])) {
      const kodeMaterial = String(row[10] || '-').trim()
      const namaMaterial = String(row[11] || '-').trim()
      const satuan = String(row[12] || '-').trim()
      const jumlah = parseInt(row[13]) || 0
      const hargaSatuanStr = String(row[14] || '0').replace(/[^0-9]/g, '')
      const totalHargaStr = String(row[15] || '0').replace(/[^0-9]/g, '')
      const hargaSatuan = parseInt(hargaSatuanStr) || 0
      const totalHarga = parseInt(totalHargaStr) || 0

      if (kodeMaterial !== '-' || namaMaterial !== '-') {
        items.push({
          part_number: kodeMaterial,
          material: namaMaterial,
          satuan,
          jumlah,
          harga_satuan: hargaSatuan,
          subtotal: totalHarga,
          _source: 'kr_json'
        })
      }
    }
    // Jika sudah ketemu KR lain setelah yang kita cari, berhenti
    if (row[1] && String(row[1]).trim() !== '' && String(row[1]).trim() !== nomorKR.trim() && currentKR === nomorKR) {
      // Hanya break jika ini adalah baris baru dengan nomor KR berbeda
      if (typeof row[0] === 'number' || (typeof row[0] === 'string' && row[0].trim() !== '')) {
        break
      }
    }
  }

  console.log(`📋 Found ${items.length} items for KR: ${nomorKR}`)
  return items
}

// ─── 🟡 Klik NOMOR RAB → data CREATE KHS dari DB ───────────────────────────
async function viewKHSFromDB(idx) {
  const khs = allKHSData[idx]
  showModalDB(khs, null)
  try {
    const res = await fetch(`/api/rab/${khs.id}`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    if (!res.ok) throw new Error('Failed to load')
    const data = await res.json()
    showModalDB(khs, data.items || [])
  } catch (e) {
    console.error('viewKHSFromDB error:', e)
    showModalDB(khs, 'error')
  }
}

// ─── 🔵 Tombol VIEW → data dari GitHub JSON KR (harga) ──────────────────────
async function viewKHSFromKR(idx) {
  const khs = allKHSData[idx]
  showModalKR(khs, null)
  try {
    if (!khs.nomor_kr || khs.nomor_kr.trim() === '') {
      showModalKR(khs, 'no_kr')
      return
    }
    const krItems = await fetchKRDetailItems(khs.nomor_kr)
    showModalKR(khs, krItems)
  } catch (e) {
    console.error('viewKHSFromKR error:', e)
    showModalKR(khs, 'error')
  }
}

function showModalDB(khs, items) {
  const existing = document.getElementById('khs-modal')
  if (existing) existing.remove()

  const COLS = 8
  let bodyHTML = ''
  if (items === null) {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-10 text-center text-gray-400"><i class="fas fa-spinner fa-spin text-2xl block mb-2"></i>Memuat data...</td></tr>`
  } else if (items === 'error') {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-2xl block mb-2"></i>Gagal memuat data</td></tr>`
  } else if (items.length === 0) {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-8 text-center text-gray-400"><i class="fas fa-inbox text-2xl block mb-2"></i>Belum ada material</td></tr>`
  } else {
    bodyHTML = items.map((item, i) => {
      const qty   = item.jumlah || 0
      const unit  = item.unit_uld || '-'
      const jenis = item.jenis_barang || item.jenis || '-'
      return `
        <tr class="border-b border-gray-100 hover:bg-yellow-50 transition">
          <td class="px-3 py-2.5 text-sm text-center text-gray-400">${i + 1}</td>
          <td class="px-3 py-2.5 text-sm font-mono text-gray-700">${escapeHtml(item.nomor_lh05 || '-')}</td>
          <td class="px-3 py-2.5 text-sm font-mono text-blue-700 font-semibold">${escapeHtml(item.part_number || '-')}</td>
          <td class="px-3 py-2.5 text-sm">${escapeHtml(item.material || '-')}</td>
          <td class="px-3 py-2.5 text-sm text-center">${escapeHtml(item.mesin || '-')}</td>
          <td class="px-3 py-2.5 text-sm text-center font-semibold">${qty}</td>
          <td class="px-3 py-2.5 text-sm text-center">${escapeHtml(unit)}</td>
          <td class="px-3 py-2.5 text-sm text-center">
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">${escapeHtml(jenis)}</span>
          </td>
        </tr>`
    }).join('')
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div id="khs-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onclick="if(event.target===this)closeModal()">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold mb-1"><i class="fas fa-database mr-2"></i>Items CREATE KHS: ${escapeHtml(khs.nomor_rab || '-')}</h2>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90 mt-1">
              <span><i class="fas fa-calendar mr-1"></i>${formatDate(khs.tanggal_rab)}</span>
              <span><i class="fas fa-boxes mr-1"></i>${Array.isArray(items) ? items.length : (khs.item_count || 0)} item</span>
              <span>${getStatusBadge(khs.status)}</span>
            </div>
          </div>
          <button onclick="closeModal()" class="ml-4 text-white hover:text-yellow-200 text-2xl font-bold leading-none">&times;</button>
        </div>
        <div class="overflow-auto flex-1 p-4">
          <div class="mb-3 flex justify-between items-center">
            <h3 class="text-sm font-semibold text-gray-700"><i class="fas fa-list text-yellow-600 mr-1"></i>Daftar Material (inputan CREATE KHS)</h3>
            <button onclick="exportModalDBToExcel(${JSON.stringify(khs.id)})" class="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition">
              <i class="fas fa-file-excel mr-1"></i>Export Excel
            </button>
          </div>
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <table class="min-w-full text-sm">
              <thead class="bg-red-600 text-white sticky top-0 z-10">
                <tr>
                  <th class="px-3 py-2.5 text-center w-10">No</th>
                  <th class="px-3 py-2.5 text-left">Nomor LH05</th>
                  <th class="px-3 py-2.5 text-left">Part Number</th>
                  <th class="px-3 py-2.5 text-left">Material</th>
                  <th class="px-3 py-2.5 text-center">Mesin</th>
                  <th class="px-3 py-2.5 text-center w-20">Jumlah</th>
                  <th class="px-3 py-2.5 text-center w-24">Unit</th>
                  <th class="px-3 py-2.5 text-center w-28">Jenis</th>
                </tr>
              </thead>
              <tbody>${bodyHTML}</tbody>
            </table>
          </div>
        </div>
        <div class="px-6 py-3 bg-gray-50 rounded-b-xl flex justify-end border-t">
          <button onclick="closeModal()" class="px-5 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"><i class="fas fa-times mr-1"></i>Tutup</button>
        </div>
      </div>
    </div>`)
}

// ─── Modal 🔵 VIEW dari JSON KR: Kode Material|Nama Material|Satuan|Jumlah|Harga Satuan|Total Harga ───
function showModalKR(khs, items) {
  const existing = document.getElementById('khs-modal')
  if (existing) existing.remove()

  const COLS = 7
  let bodyHTML = ''
  if (items === null) {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-10 text-center text-gray-400"><i class="fas fa-spinner fa-spin text-2xl block mb-2"></i>Memuat data KR...</td></tr>`
  } else if (items === 'error') {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-2xl block mb-2"></i>Gagal memuat data KR</td></tr>`
  } else if (items === 'no_kr') {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-8 text-center text-gray-400"><i class="fas fa-file-slash text-2xl block mb-2"></i>Nomor KR belum diset untuk KHS ini</td></tr>`
  } else if (items.length === 0) {
    bodyHTML = `<tr><td colspan="${COLS}" class="px-4 py-8 text-center text-gray-400"><i class="fas fa-inbox text-2xl block mb-2"></i>Tidak ada data di JSON KR untuk nomor ini</td></tr>`
  } else {
    let grandTotal = 0
    bodyHTML = items.map((item, i) => {
      const qty   = item.jumlah || 0
      const harga = item.harga_satuan || 0
      const total = item.subtotal || qty * harga
      grandTotal += total
      return `
        <tr class="border-b border-gray-100 hover:bg-blue-50 transition">
          <td class="px-3 py-2.5 text-sm text-center text-gray-400">${i + 1}</td>
          <td class="px-3 py-2.5 text-sm font-mono text-blue-700 font-semibold">${escapeHtml(item.part_number || '-')}</td>
          <td class="px-3 py-2.5 text-sm">${escapeHtml(item.material || '-')}</td>
          <td class="px-3 py-2.5 text-sm text-center">${escapeHtml(item.satuan || '-')}</td>
          <td class="px-3 py-2.5 text-sm text-center font-semibold">${qty}</td>
          <td class="px-3 py-2.5 text-sm text-right">${formatRupiah(harga)}</td>
          <td class="px-3 py-2.5 text-sm text-right font-semibold text-green-700">${formatRupiah(total)}</td>
        </tr>`
    }).join('') + `
      <tr class="bg-gray-100 font-bold border-t-2 border-gray-300">
        <td colspan="6" class="px-3 py-2.5 text-sm text-right">TOTAL KESELURUHAN:</td>
        <td class="px-3 py-2.5 text-sm text-right text-green-700">${formatRupiah(grandTotal)}</td>
      </tr>`
  }

  const krData = krListCache.find(k => k.nomor_kr === khs.nomor_kr)
  const vendorName = krData ? krData.vendor : ''

  document.body.insertAdjacentHTML('beforeend', `
    <div id="khs-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onclick="if(event.target===this)closeModal()">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        <div class="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold mb-1"><i class="fas fa-file-contract mr-2"></i>Detail KR: ${escapeHtml(khs.nomor_rab || '-')}</h2>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90 mt-1">
              <span><i class="fas fa-calendar mr-1"></i>${formatDate(khs.tanggal_rab)}</span>
              ${khs.nomor_kr ? `<span><i class="fas fa-file-signature mr-1"></i>KR: <strong>${escapeHtml(khs.nomor_kr)}</strong></span>` : ''}
              <span><i class="fas fa-boxes mr-1"></i>${Array.isArray(items) ? items.length : 0} item</span>
              <span>${getStatusBadge(khs.status)}</span>
            </div>
            ${vendorName ? `<div class="mt-1 text-xs opacity-80"><i class="fas fa-building mr-1"></i>Vendor: <strong>${escapeHtml(vendorName)}</strong></div>` : ''}
          </div>
          <button onclick="closeModal()" class="ml-4 text-white hover:text-gray-200 text-2xl font-bold leading-none">&times;</button>
        </div>
        <div class="overflow-auto flex-1 p-4">
          <div class="mb-3 flex justify-between items-center">
            <h3 class="text-sm font-semibold text-gray-700"><i class="fas fa-wifi text-blue-600 mr-1"></i>Data KR dari Kontrak (JSON)</h3>
            <button onclick="exportModalKRToExcel(${JSON.stringify(khs.id)})" class="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition">
              <i class="fas fa-file-excel mr-1"></i>Export Excel
            </button>
          </div>
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <table class="min-w-full text-sm">
              <thead class="bg-red-600 text-white sticky top-0 z-10">
                <tr>
                  <th class="px-3 py-2.5 text-center w-10">No</th>
                  <th class="px-3 py-2.5 text-left">Kode Material</th>
                  <th class="px-3 py-2.5 text-left">Nama Material</th>
                  <th class="px-3 py-2.5 text-center w-20">Satuan</th>
                  <th class="px-3 py-2.5 text-center w-20">Jumlah</th>
                  <th class="px-3 py-2.5 text-right w-36">Harga Satuan</th>
                  <th class="px-3 py-2.5 text-right w-36">Total Harga</th>
                </tr>
              </thead>
              <tbody>${bodyHTML}</tbody>
            </table>
          </div>
        </div>
        <div class="px-6 py-3 bg-gray-50 rounded-b-xl flex justify-end border-t">
          <button onclick="closeModal()" class="px-5 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"><i class="fas fa-times mr-1"></i>Tutup</button>
        </div>
      </div>
    </div>`)
}
function closeModal() {
  const modal = document.getElementById('khs-modal')
  if (modal) modal.remove()
}

// ─── Export all KHS to Excel ───────────────────────────────────────────────
function exportToExcel() {
  if (allKHSData.length === 0) {
    showToast('error', 'Tidak ada data untuk di-export!')
    return
  }
  if (typeof XLSX === 'undefined') {
    showToast('error', 'Library Excel belum siap')
    return
  }

  const rows = allKHSData.map((khs, i) => ({
    'No': i + 1,
    'Nomor KHS': khs.nomor_rab || '-',
    'Nomor KR': khs.nomor_kr || '-',
    'Tanggal': formatDate(khs.tanggal_rab),
    'Total Item': khs.item_count || 0,
    'Status': khs.status || 'Draft',
    'KR Diset Oleh': khs.nomor_kr_set_by || '-'
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data KHS')
  XLSX.writeFile(wb, `DATA_KHS_${dateNow()}.xlsx`)
  showToast('success', `Export ${allKHSData.length} KHS berhasil!`)
}

// ─── Update info text ──────────────────────────────────────────────────────
function updateDataInfo() {
  const info = document.getElementById('dataInfo')
  if (info) {
    info.textContent = `Total: ${allKHSData.length} KHS | Terakhir dimuat: ${new Date().toLocaleString('id-ID')}`
  }
}

async function refreshData() {
  await loadKHSData()
  showToast('success', 'Data berhasil di-refresh!')
}

// ─── Toast notification ────────────────────────────────────────────────────
function showToast(type, message) {
  const existing = document.getElementById('khs-toast')
  if (existing) existing.remove()

  const color = type === 'success' ? 'bg-green-600' : 'bg-red-600'
  const icon  = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'

  document.body.insertAdjacentHTML('beforeend', `
    <div id="khs-toast" class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-lg shadow-xl text-white ${color} transition">
      <i class="fas ${icon}"></i>
      <span class="text-sm font-medium">${message}</span>
    </div>`)

  setTimeout(() => {
    const t = document.getElementById('khs-toast')
    if (t) t.remove()
  }, 3500)
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatRupiah(n) {
  if (!n && n !== 0) return '-'
  return 'Rp ' + Number(n).toLocaleString('id-ID')
}

function dateNow() {
  return new Date().toISOString().split('T')[0]
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function getStatusBadge(status) {
  const s = (status || 'Draft').toLowerCase()
  let cls = 'bg-gray-100 text-gray-700'
  if (s === 'approved' || s === 'disetujui') cls = 'bg-green-100 text-green-700'
  else if (s === 'acc vendor') cls = 'bg-emerald-100 text-emerald-700'
  else if (s === 'pending' || s === 'menunggu') cls = 'bg-yellow-100 text-yellow-800'
  else if (s === 'rejected' || s === 'ditolak') cls = 'bg-red-100 text-red-700'
  else if (s === 'draft') cls = 'bg-blue-100 text-blue-700'
  return `<span class="px-2 py-0.5 rounded text-xs font-semibold ${cls}">${status || 'Draft'}</span>`
}

function logout() {
  localStorage.removeItem('sessionToken')
  window.location.href = '/login'
}
