# 🔐 **Cara Mendapatkan Akses Google Sheets Asli - Quick Guide**

## 🎯 **3 Cara Mendapatkan Akses:**

### **Option 1: Hubungi Owner/Developer Sebelumnya** ⭐ **RECOMMENDED**

**Ini cara TERCEPAT!**

1. **Tanya kepada:**
   - Tim IT PLN Kalimantan Selatan & Tengah
   - Developer yang bikin aplikasi ini
   - Project Manager
   - Admin Google Workspace organisasi

2. **Minta:**
   - Link Google Sheets langsung
   - Access sebagai Editor/Viewer
   - Dokumentasi struktur data (jika ada)

3. **Informasi URL yang ada:**
   ```
   Material Master:
   https://script.googleusercontent.com/macros/echo?user_content_key=AehSKL...
   
   Data Pengadaan:
   https://script.google.com/macros/s/AKfycbynUyVr.../exec
   ```

---

### **Option 2: Buat Google Sheets Baru** 🆕

**Jika tidak bisa akses yang lama, buat sendiri:**

1. **Baca Panduan Lengkap:**
   ```bash
   cat /home/user/AMC-KAL-2-GUDANG-fix/docs/GOOGLE_SHEETS_SETUP.md
   ```
   
   Atau buka di browser:
   ```
   /home/user/AMC-KAL-2-GUDANG-fix/docs/GOOGLE_SHEETS_SETUP.md
   ```

2. **Files yang dibutuhkan:**
   - `docs/GOOGLE_SHEETS_SETUP.md` - Complete guide
   - `docs/google-apps-script-material-master.js` - Script untuk Material
   - `docs/google-apps-script-pengadaan.js` - Script untuk Pengadaan

3. **Estimasi waktu:** 30-60 menit

---

### **Option 3: Export Data dari URL Existing** 💾

**Backup data yang ada sekarang:**

```bash
# Export Material Master
curl -sL "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLgIOFG1fLbjU_hBye86rPyTSJVSulXqCHlMw0sZwtZF8_nolEs11-zQhoZRe5c6w7wtbJw6mpdvKj2eCYaTGjHNrSyikvMKzjxLpYViD0RUnHENi_x2IfD9_yOUwQI_BrBfJRKnu-N48Fr5AP7fQJYf22-v2zMV_SERF4SBUcciAcJVuPB7QaWtd5G2vOFMjmYTexNBC1z7YlnllCRSkoGbO3Axnat70P3mcKT4KpDjhBaH3_mDQgzn7BZKaANTLEx-QD-yGp0zbkMBoUMLsBIZqcFbfHe1vfe-bn68&lib=MRb65GHGTxo8fAtO2JZr8dy1qv6vbq6ko" > material_backup.json

# Export Pengadaan
curl -sL "https://script.google.com/macros/s/AKfycbynUyVrOfSXn-X6V4HFE6YbanXJZo2tBGWEvBbTMie1DyK2wL0RM9UOvVpfoWDmuxhm/exec" > pengadaan_backup.json
```

**Lalu import ke Google Sheets baru atau database D1**

---

## 📊 **Data Structure Overview:**

### **Material Master:**
```
Headers: Part Number | Material | JENIS BARANG | Mesin | Spesifikasi | ...
Example: 1180277 | SEAL OIL COOLER | MATERIAL HANDAL | MAN 250 | O-SEAL | ...
```

### **Data Pengadaan (Sheet: "data KR"):**
```
Columns: Kolom_0 to Kolom_12+
Key Fields:
- Kolom_1: No. RAB
- Kolom_2: No. TOR
- Kolom_3: Bidang (MUST be "PEMBANGKITAN")
- Kolom_11: Keterangan (contains TOR info)
- Kolom_12: Status

Total: 259 rows (as of last check)
```

---

## 🚀 **Quick Start (Jika Buat Baru):**

1. **Create 2 Google Sheets:**
   - Material Master PLN Kalselteng
   - Data Pengadaan PLN Kalselteng

2. **Setup struktur sesuai guide:**
   - See: `docs/GOOGLE_SHEETS_SETUP.md`

3. **Deploy Apps Script:**
   - Copy dari: `docs/google-apps-script-*.js`
   - Deploy as Web App
   - Get URL

4. **Update aplikasi:**
   - Edit: `src/index.tsx` line 38 (Material URL)
   - Edit: `src/index.tsx` line 7840 (Pengadaan URL)
   - Edit: `public/static/dashboard-list-rab.js` line 49 (Pengadaan URL)

5. **Build & Deploy:**
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name amc-kal-2-gudang
   ```

---

## 📞 **Need Help?**

**Contact:**
- IT PLN Kalimantan: [Contact Info]
- Developer: [Your Info]

**Resources:**
- Setup Guide: `docs/GOOGLE_SHEETS_SETUP.md`
- Apps Script Code: `docs/google-apps-script-*.js`
- Google Apps Script Docs: https://developers.google.com/apps-script

---

## ⚠️ **Important Notes:**

1. **URL saat ini masih ACTIVE ✅** - aplikasi berjalan normal
2. **Data dari developer sebelumnya** - perlu koordinasi untuk akses
3. **Backup data** sebelum migrasi
4. **Test thoroughly** setelah ganti URL
5. **Document ownership** untuk maintainability

---

**Last Updated:** April 2026
**Document Version:** 1.0
