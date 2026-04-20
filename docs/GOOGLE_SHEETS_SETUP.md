# 📊 Panduan Setup Google Sheets untuk Aplikasi Gudang PLN

## 🎯 Overview

Aplikasi ini menggunakan 2 Google Sheets:
1. **Material Master Data** - Data part number, spesifikasi material
2. **Data Pengadaan** - Data RAB, TOR, status procurement

---

## 📋 **STEP 1: Buat Google Sheets**

### **A. Material Master Sheet**

1. **Buka Google Sheets:**
   - https://sheets.google.com
   - Klik "Blank" untuk sheet baru

2. **Rename Sheet:**
   - Nama file: `Material Master PLN Kalselteng`
   - Sheet name (tab): `Sheet1` atau `Material`

3. **Setup Headers (Row 1):**
   ```
   | Part Number | Material | JENIS BARANG | Mesin | Spesifikasi | Stock | Unit | Keterangan |
   ```

4. **Contoh Data (Row 2+):**
   ```
   | 1180277 | SEAL OIL COOLER | MATERIAL HANDAL | MAN 250, F10L, TCD 2013 | O-SEAL | 10 | PCS | Active |
   | 0118 3003 | FILTER UDARA | MATERIAL HANDAL | GENSET | AIR FILTER | 5 | PCS | Active |
   | N150 | ACCU 150Ah | MATERIAL HANDAL | MAN 250 | BATTERY 12V 150Ah | 2 | UNIT | Active |
   ```

5. **PENTING: Field "JENIS BARANG" harus ada spasi (bukan underscore)**

---

### **B. Data Pengadaan Sheet**

1. **Buat Sheet Baru:**
   - Nama file: `Data Pengadaan PLN Kalselteng`
   - Sheet name (tab): `data KR`

2. **Setup Headers (Row 1) - EXACT MATCH:**
   ```
   | Kolom_0 | Kolom_1 | Kolom_2 | Kolom_3 | Kolom_4 | Kolom_5 | Kolom_6 | Kolom_7 | Kolom_8 | Kolom_9 | Kolom_10 | Kolom_11 | Kolom_12 |
   ```

3. **Mapping Kolom:**
   - `Kolom_0`: ID / No urut
   - `Kolom_1`: No. RAB
   - `Kolom_2`: No. TOR
   - `Kolom_3`: Bidang (**PEMBANGKITAN**)
   - `Kolom_4`: Nomor Ijin Prinsip
   - `Kolom_5`: Jenis Item (MAT/JAS)
   - `Kolom_6`: Nilai + PPN
   - `Kolom_11`: **Keterangan (isi TOR info)**
   - `Kolom_12`: Status

4. **Contoh Data (Row 2+):**
   ```
   | 1 | RAB-2026-0073 | 0128/TOR/AMC/NPL2/LPKAL2/1/2026 | PEMBANGKITAN | 774.1P/MAT/KAL.2/2025 | MAT | Rp 250,790,625 | - | - | - | - | 0128/TOR/AMC/NPL2/LPKAL2/1/2026 - PENGADAAN FILTER MESIN | Menunggu Verifikasi Asisten Manager Region |
   ```

5. **CRITICAL: Kolom_3 HARUS isi "PEMBANGKITAN"** untuk muncul di aplikasi

---

## 🔧 **STEP 2: Setup Google Apps Script**

### **A. Material Master Script**

1. **Buka Apps Script:**
   - Di Google Sheets Material Master
   - Extensions → Apps Script

2. **Copy Code:**
   - Buka file: `/docs/google-apps-script-material-master.js`
   - Copy semua kode
   - Paste di Apps Script Editor

3. **Ganti Spreadsheet ID:**
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   ```
   
   **Cara dapat Spreadsheet ID:**
   - Lihat URL Google Sheets:
   ```
   https://docs.google.com/spreadsheets/d/1abc123XYZ456/edit
                                          ^^^^^^^^^^^^^^^^
                                          INI SPREADSHEET ID
   ```

4. **Deploy as Web App:**
   - Klik "Deploy" → "New deployment"
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik "Deploy"
   - Copy **Web app URL**

5. **Test:**
   - Run function `testDoGet()` di Script Editor
   - Check logs (Ctrl + Enter)

---

### **B. Data Pengadaan Script**

1. **Buka Apps Script:**
   - Di Google Sheets Data Pengadaan
   - Extensions → Apps Script

2. **Copy Code:**
   - Buka file: `/docs/google-apps-script-pengadaan.js`
   - Copy semua kode
   - Paste di Apps Script Editor

3. **Ganti Spreadsheet ID:**
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   ```

4. **Deploy as Web App:**
   - Klik "Deploy" → "New deployment"
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik "Deploy"
   - Copy **Web app URL**

5. **Test:**
   - Run function `testDoGet()` di Script Editor
   - Check logs - harus ada "data KR"

---

## 🔗 **STEP 3: Update URL di Aplikasi**

### **A. Update Material Master URL**

**File:** `src/index.tsx` line 38

```javascript
// GANTI URL INI dengan URL dari Deploy Apps Script Material Master
const GOOGLE_SHEETS_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=NEW_KEY_HERE&lib=NEW_LIB_HERE'
```

### **B. Update Pengadaan URL**

**File 1:** `src/index.tsx` line 7840
```javascript
const PENGADAAN_URL = 'https://script.google.com/macros/s/NEW_SCRIPT_ID_HERE/exec';
```

**File 2:** `public/static/dashboard-list-rab.js` line 49
```javascript
const PENGADAAN_URL = 'https://script.google.com/macros/s/NEW_SCRIPT_ID_HERE/exec';
```

---

## ✅ **STEP 4: Test & Verify**

### **Test Material Master URL:**
```bash
curl -s "YOUR_MATERIAL_URL" | jq '.[0]'
```

**Expected Response:**
```json
{
  "Part Number": "1180277",
  "Material": "SEAL OIL COOLER",
  "JENIS BARANG": "MATERIAL HANDAL",
  "Mesin": "MAN 250, F10L, TCD 2013",
  ...
}
```

### **Test Pengadaan URL:**
```bash
curl -s "YOUR_PENGADAAN_URL" | jq '.["data KR"][1]'
```

**Expected Response:**
```json
{
  "Kolom_0": "1",
  "Kolom_1": "RAB-2026-0073",
  "Kolom_2": "0128/TOR/AMC/...",
  "Kolom_3": "PEMBANGKITAN",
  ...
}
```

---

## 🚀 **STEP 5: Deploy Aplikasi**

```bash
# Build
cd /home/user/AMC-KAL-2-GUDANG-fix
npm run build

# Deploy
npx wrangler pages deploy dist --project-name amc-kal-2-gudang --branch main
```

---

## 📝 **Troubleshooting**

### **Issue: Apps Script error "Script not found"**
**Fix:** 
- Deploy ulang Apps Script
- Pastikan "Who has access" = **Anyone**

### **Issue: CORS error**
**Fix:**
- Apps Script harus deployed as **Web app**
- Bukan deployed as **API executable**

### **Issue: Empty data**
**Fix:**
- Check Sheet name di Apps Script
- Pastikan ada data di sheet (minimal 2 rows: header + data)

### **Issue: "JENIS BARANG" kosong**
**Fix:**
- Header HARUS ada spasi: `JENIS BARANG`
- Bukan underscore: `JENIS_BARANG`

### **Issue: Pengadaan tidak muncul**
**Fix:**
- `Kolom_3` (Bidang) HARUS isi **PEMBANGKITAN**
- Case-sensitive, harus UPPERCASE

---

## 🔐 **Security Notes**

1. **URL adalah public** - siapa saja bisa akses data
2. **Jangan simpan data sensitif** di Sheets
3. **Backup data** secara berkala
4. **Monitor access logs** di Google Cloud Console

---

## 📞 **Support**

Jika ada pertanyaan, hubungi:
- Developer: [Your Contact]
- IT Support PLN Kalselteng

---

## 📚 **Resources**

- Google Apps Script Docs: https://developers.google.com/apps-script
- Deploy Web Apps: https://developers.google.com/apps-script/guides/web
- Apps Script Best Practices: https://developers.google.com/apps-script/guides/support/best-practices
