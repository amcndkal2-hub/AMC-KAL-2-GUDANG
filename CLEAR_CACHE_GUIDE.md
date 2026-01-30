# 🔄 Clear Cache API - Panduan Lengkap

## 🎯 Kapan Pakai Clear Cache API?

**Setelah upload JSON baru dan butuh data instant update!**

---

## 🚀 Cara 1: Browser Console (TERMUDAH!)

### Steps:
1. Buka aplikasi: https://78fe69ed.amc-kal-2-gudang.pages.dev
2. Tekan **F12** (DevTools)
3. Klik tab **Console**
4. Paste code ini:

```javascript
fetch('/api/clear-cache', { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    console.log('✅ SUCCESS:', data)
    alert('✅ Data berhasil di-refresh!\n\nItems: ' + data.itemsLoaded + '\nTime: ' + new Date(data.timestamp).toLocaleString())
    location.reload()
  })
  .catch(err => {
    console.error('❌ ERROR:', err)
    alert('❌ Gagal refresh data. Cek console.')
  })
```

5. Tekan **Enter**
6. Alert muncul → Click OK
7. Page reload → Data baru muncul! ✅

---

## 🖱️ Cara 2: Bookmarklet (1-CLICK!)

### Setup (Sekali Saja):
1. **Buat bookmark baru** di browser Anda
2. **Name:** `🔄 Clear Cache`
3. **URL:** Copy-paste ini:
```javascript
javascript:(function(){fetch('/api/clear-cache',{method:'POST'}).then(r=>r.json()).then(d=>{alert('✅ Cache cleared!\n\nItems: '+d.itemsLoaded+'\nTime: '+new Date(d.timestamp).toLocaleString());location.reload()}).catch(e=>alert('❌ Error: '+e))})()
```
4. **Save**

### Cara Pakai (Setiap Kali Butuh):
1. Buka aplikasi
2. Click bookmark `🔄 Clear Cache`
3. Done! ✅

---

## 💻 Cara 3: Terminal/CMD

### Windows CMD:
```cmd
curl -X POST https://78fe69ed.amc-kal-2-gudang.pages.dev/api/clear-cache
```

### Mac/Linux Terminal:
```bash
curl -X POST https://78fe69ed.amc-kal-2-gudang.pages.dev/api/clear-cache
```

### Expected Response:
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "itemsLoaded": 979,
  "timestamp": "2026-01-30T03:16:27.549Z"
}
```

---

## 🔧 Cara 4: Postman

1. **Method:** POST
2. **URL:** https://78fe69ed.amc-kal-2-gudang.pages.dev/api/clear-cache
3. **Click:** Send
4. **Check response:** success: true ✅

---

## 📱 Cara 5: Mobile Browser

1. Buka aplikasi di mobile browser
2. Akses Console:
   - Chrome Mobile: Menu → Desktop Site → F12 (di desktop)
   - Safari Mobile: Settings → Advanced → Web Inspector
3. Paste code dari **Cara 1**
4. Run

**ATAU**

Gunakan **bookmarklet** dari **Cara 2** (lebih praktis!)

---

## 🤖 Cara 6: Automation Script

### Python:
```python
import requests

response = requests.post('https://78fe69ed.amc-kal-2-gudang.pages.dev/api/clear-cache')
data = response.json()

if data['success']:
    print(f"✅ Cache cleared! Items: {data['itemsLoaded']}")
else:
    print(f"❌ Failed: {data.get('error')}")
```

### Node.js:
```javascript
const fetch = require('node-fetch');

fetch('https://78fe69ed.amc-kal-2-gudang.pages.dev/api/clear-cache', {
  method: 'POST'
})
.then(r => r.json())
.then(data => {
  if (data.success) {
    console.log(`✅ Cache cleared! Items: ${data.itemsLoaded}`);
  } else {
    console.log(`❌ Failed: ${data.error}`);
  }
});
```

---

## 📋 Complete Workflow

```
┌─────────────────────────────────────────┐
│ 1. Edit Google Sheets                   │
│    (Ubah MATERIAL BEKAS → HANDAL, dll)  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 2. Export to JSON                       │
│    File → Download → JSON               │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 3. Upload JSON baru                     │
│    (Replace old file)                   │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 4. Call Clear Cache API ⚡               │
│    (Pilih salah satu cara di atas)      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 5. Done! Data instant update ✅          │
│    (3-5 detik, tidak perlu tunggu 5min) │
└─────────────────────────────────────────┘
```

---

## ❓ FAQ

**Q: Apakah API ini wajib dipanggil setiap upload?**
**A:** TIDAK! Ini OPTIONAL. Kalau tidak dipanggil, data tetap update otomatis setelah 5 menit.

**Q: Berapa kali harus call API?**
**A:** 1x saja setelah upload JSON baru. Tidak perlu berulang-ulang.

**Q: API bisa dipanggil dari mana saja?**
**A:** YA! Browser, Terminal, Postman, Python, Node.js, Mobile, dll.

**Q: Ada batasan jumlah request?**
**A:** Tidak ada. Call sebanyak yang Anda butuhkan.

**Q: Apakah aman?**
**A:** YA! API ini public tapi hanya clear cache internal server. Tidak ada data yang diubah atau dihapus.

---

## 🎯 Recommendation

**PALING PRAKTIS:**
1. ⭐ **Bookmarklet** (1-click, no typing)
2. ⭐ **Browser Console** (F12 → Paste → Enter)
3. ⭐ **Terminal** (1 command)

**Pilih yang paling nyaman untuk Anda! 😊**

---

## 📞 Support

**Production URL:**
- Main App: https://78fe69ed.amc-kal-2-gudang.pages.dev
- Clear Cache API: POST https://78fe69ed.amc-kal-2-gudang.pages.dev/api/clear-cache

**Last Updated:** 2026-01-30
**Git Commit:** e5d5325
