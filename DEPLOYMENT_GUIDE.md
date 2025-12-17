# 🚀 Panduan Deployment Lengkap - Sistem Manajemen Material Spare Part

## 📋 Daftar Isi
1. [Persiapan Awal](#persiapan-awal)
2. [Setup GitHub Repository](#setup-github-repository)
3. [Setup Cloudflare Account](#setup-cloudflare-account)
4. [Deploy ke Cloudflare Pages](#deploy-ke-cloudflare-pages)
5. [Konfigurasi Environment Variables](#konfigurasi-environment-variables)
6. [Testing & Verifikasi](#testing--verifikasi)
7. [Maintenance & Update](#maintenance--update)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Persiapan Awal

### ✅ Checklist Sebelum Deploy:
- [ ] Aplikasi berjalan dengan baik di local/sandbox
- [ ] Semua perubahan sudah di-commit ke git
- [ ] File `.gitignore` sudah lengkap
- [ ] README.md sudah update
- [ ] Dependencies sudah terinstall

### 📦 Verifikasi File Penting:

```bash
# Cek struktur project
ls -la /home/user/webapp/

# Harus ada file berikut:
# - package.json
# - wrangler.jsonc
# - vite.config.ts
# - src/index.tsx
# - .gitignore
# - README.md
```

### 🔧 Test Build Local:

```bash
cd /home/user/webapp

# Clean old build
rm -rf dist node_modules

# Install dependencies
npm install

# Build project
npm run build

# Verifikasi hasil build
ls -la dist/
# Harus ada: _worker.js, _routes.json, static/
```

---

## 🐙 Setup GitHub Repository

### Langkah 1: Setup Git & GitHub Authentication

```bash
# 1. Pastikan sudah di dalam project directory
cd /home/user/webapp

# 2. Cek status git
git status

# 3. Setup GitHub Authentication menggunakan tool
# PENTING: Jalankan command ini terlebih dahulu
```

**Di Claude/AI Assistant, jalankan:**
```
setup_github_environment()
```

**Atau manual:**
- Buka tab **#github** di interface Genspark
- Authorize GitHub App dan OAuth
- Dapatkan token dari Genspark Deploy settings

### Langkah 2: Create GitHub Repository

**Option A: Via GitHub Web UI (Recommended)**

1. Login ke https://github.com
2. Klik tombol **"+"** → **"New repository"**
3. Isi form:
   - **Repository name**: `sistem-material-spare-part`
   - **Description**: `Sistem Manajemen Material Spare Part dengan Hono + Cloudflare Pages`
   - **Visibility**: Public atau Private (pilih sesuai kebutuhan)
   - **JANGAN centang**: "Add a README file" (kita sudah punya)
   - **JANGAN centang**: "Add .gitignore" (kita sudah punya)
4. Klik **"Create repository"**
5. **COPY URL repository**, contoh: `https://github.com/USERNAME/sistem-material-spare-part.git`

**Option B: Via GitHub CLI (gh)**

```bash
# Pastikan gh sudah authenticated
gh auth status

# Create new repository
gh repo create sistem-material-spare-part --public --source=. --remote=origin

# Push existing code
git push -u origin main
```

### Langkah 3: Push Code ke GitHub

```bash
cd /home/user/webapp

# Pastikan semua perubahan sudah di-commit
git add .
git commit -m "Prepare for deployment to Cloudflare Pages"

# Tambahkan remote (ganti USERNAME dengan username GitHub Anda)
git remote add origin https://github.com/USERNAME/sistem-material-spare-part.git

# Atau jika sudah ada remote, update URL-nya:
git remote set-url origin https://github.com/USERNAME/sistem-material-spare-part.git

# Push ke GitHub (force push untuk first time)
git push -u origin main --force

# Verifikasi
git remote -v
# Seharusnya muncul origin dengan URL GitHub Anda
```

**✅ Cek di GitHub Web:**
- Buka https://github.com/USERNAME/sistem-material-spare-part
- Pastikan semua file sudah terupload
- Cek file penting: `package.json`, `wrangler.jsonc`, `src/index.tsx`

---

## ☁️ Setup Cloudflare Account

### Langkah 1: Buat Akun Cloudflare

1. Buka https://dash.cloudflare.com/sign-up
2. Daftar dengan email Anda
3. Verifikasi email
4. Login ke Cloudflare Dashboard

### Langkah 2: Dapatkan Cloudflare API Token

1. Login ke Cloudflare Dashboard: https://dash.cloudflare.com/
2. Klik **Profile Icon** (kanan atas) → **My Profile**
3. Pilih tab **"API Tokens"**
4. Klik **"Create Token"**
5. Pilih template: **"Edit Cloudflare Workers"**
6. Atau buat Custom Token dengan permissions:
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **Account Settings** → **Read**
   - **Zone** → **Workers Routes** → **Edit**
7. Klik **"Continue to summary"**
8. Klik **"Create Token"**
9. **COPY TOKEN** dan simpan (token hanya muncul sekali!)

**Format token:** `ABC123xyz...` (panjang ~40 karakter)

### Langkah 3: Setup Token di Sandbox/Local

**Di Claude/AI Assistant:**
```
setup_cloudflare_api_key()
```

**Atau manual:**

```bash
# Setup environment variable
echo 'export CLOUDFLARE_API_TOKEN="YOUR_TOKEN_HERE"' >> ~/.bashrc
source ~/.bashrc

# Verifikasi
echo $CLOUDFLARE_API_TOKEN

# Test authentication
npx wrangler whoami
# Output: You are logged in as your-email@example.com
```

---

## 🚀 Deploy ke Cloudflare Pages

### Metode 1: Deploy via Wrangler CLI (Recommended)

#### Step 1: Verifikasi Authentication

```bash
cd /home/user/webapp

# Test wrangler authentication
npx wrangler whoami

# Output contoh:
# Getting User settings...
# 👋 You are logged in with an API Token, associated with the email 'your-email@example.com'!
# ┌──────────────────────────────┬──────────────────────────────────┐
# │ Account Name                 │ Account ID                       │
# ├──────────────────────────────┼──────────────────────────────────┤
# │ Your Account                 │ abc123def456...                  │
# └──────────────────────────────┴──────────────────────────────────┘
```

#### Step 2: Build Project

```bash
cd /home/user/webapp

# Clean build
rm -rf dist

# Build
npm run build

# Verifikasi build success
ls -la dist/
# Harus ada: _worker.js (ukuran ~100KB), _routes.json, static/
```

#### Step 3: Create Cloudflare Pages Project

```bash
# PENTING: Gunakan nama project yang unik (lowercase, no spaces)
# Format: nama-project (contoh: material-spare-part, sistem-inventaris, dll)

npx wrangler pages project create material-spare-part \
  --production-branch main

# Output:
# ✨ Successfully created the 'material-spare-part' project.
```

**Jika error "project already exists":**
```bash
# Gunakan nama berbeda dengan menambah nomor atau prefix
npx wrangler pages project create material-spare-part-2
# atau
npx wrangler pages project create my-material-system
```

#### Step 4: Deploy ke Cloudflare Pages

```bash
cd /home/user/webapp

# Deploy dengan project name yang sudah dibuat
npx wrangler pages deploy dist --project-name=material-spare-part

# Output:
# ✨ Compiled Worker successfully
# ✨ Uploading...
# ✨ Deployment complete! Take a peek over at https://abc123.material-spare-part.pages.dev
```

**📝 Simpan URL deployment Anda!**

Format URL:
- Production: `https://material-spare-part.pages.dev`
- Preview: `https://abc123.material-spare-part.pages.dev`

#### Step 5: Verifikasi Deployment

```bash
# Test API endpoint
curl https://material-spare-part.pages.dev/api/data

# Test main page
curl -I https://material-spare-part.pages.dev/
# Seharusnya return HTTP 200 OK
```

---

### Metode 2: Deploy via Cloudflare Dashboard (Git Integration)

#### Step 1: Connect GitHub Repository

1. Login ke Cloudflare Dashboard: https://dash.cloudflare.com/
2. Pilih account Anda
3. Sidebar kiri → **Workers & Pages**
4. Klik **"Create application"**
5. Tab **"Pages"** → **"Connect to Git"**
6. Klik **"Connect GitHub"**
7. Authorize Cloudflare Pages
8. Pilih repository: **sistem-material-spare-part**
9. Klik **"Begin setup"**

#### Step 2: Configure Build Settings

**Production branch:**
```
main
```

**Build settings:**
```yaml
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 18
```

**Environment variables (kosongkan dulu, akan diisi nanti)**

Klik **"Save and Deploy"**

#### Step 3: Wait for Build

- Status akan muncul: **Building** → **Deploying** → **Success**
- Durasi: 2-5 menit
- Jika error, cek build logs

#### Step 4: Get Deployment URL

Setelah success, akan muncul URL:
```
https://sistem-material-spare-part.pages.dev
```

---

## 🔧 Konfigurasi Environment Variables

### Step 1: Set Environment Variables via Wrangler

```bash
cd /home/user/webapp

# Jika ada API keys atau secrets (untuk future)
# Contoh: Firebase, Database credentials, dll

# Set secret
npx wrangler pages secret put API_KEY --project-name=material-spare-part
# Enter value: YOUR_SECRET_KEY

# Set multiple secrets
npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name=material-spare-part
npx wrangler pages secret put FIREBASE_API_KEY --project-name=material-spare-part

# List secrets
npx wrangler pages secret list --project-name=material-spare-part
```

### Step 2: Set Environment Variables via Dashboard

1. Cloudflare Dashboard → **Workers & Pages**
2. Pilih project: **material-spare-part**
3. Tab **"Settings"** → **"Environment variables"**
4. Klik **"Add variable"**
5. Isi:
   - **Variable name**: `API_KEY`
   - **Value**: `your-secret-value`
   - **Environment**: Production (atau Both)
6. Klik **"Save"**

**Untuk aplikasi ini (saat ini tidak butuh env vars):**
- Aplikasi menggunakan Google Sheets public URL (hardcoded)
- Authentication hardcoded di code
- Tidak ada database eksternal yet

**⚠️ NOTE:** Jika nanti menggunakan Firebase/Database, tambahkan env vars di sini.

---

## ✅ Testing & Verifikasi

### Test Checklist:

```bash
# 1. Test main page (Form Input)
curl -I https://material-spare-part.pages.dev/
# Expected: HTTP 200 OK

# 2. Test Login page
curl -I https://material-spare-part.pages.dev/login
# Expected: HTTP 200 OK

# 3. Test API endpoints
curl https://material-spare-part.pages.dev/api/data
# Expected: JSON array dari Google Sheets

# 4. Test static assets
curl -I https://material-spare-part.pages.dev/static/app.js
# Expected: HTTP 200 OK

# 5. Test dropdown values
curl https://material-spare-part.pages.dev/api/dropdown-values
# Expected: JSON dengan units, pemeriksa, penerima
```

### Test via Browser:

1. **Main Page (Form Input)**
   - URL: `https://material-spare-part.pages.dev/`
   - Expected: Form input material muncul dengan navigation menu
   - Test: Coba isi form (belum save, karena in-memory storage)

2. **Login Page**
   - URL: `https://material-spare-part.pages.dev/login`
   - Username: `AMC@12345`
   - Password: `12345@AMC`
   - Expected: Redirect ke main page setelah login

3. **Dashboard Stok**
   - URL: `https://material-spare-part.pages.dev/dashboard/stok`
   - Expected: Redirect ke login jika belum login
   - After login: Tampil dashboard dengan sidebar filter

4. **Dashboard Kebutuhan Material**
   - URL: `https://material-spare-part.pages.dev/dashboard/kebutuhan-material`
   - Expected: Tampil tabel dengan kolom "Unit/Lokasi Tujuan"
   - Test dropdown status: Pengadaan, Tunda, Reject, **Terkirim, Tersedia**

5. **Form Gangguan (Public - No Login Required)**
   - URL: `https://material-spare-part.pages.dev/form-gangguan`
   - Expected: Bisa diakses tanpa login
   - Test: Coba isi form gangguan

### Performance Check:

```bash
# Check response time
time curl -s https://material-spare-part.pages.dev/ > /dev/null

# Check with verbose
curl -w "\nTime: %{time_total}s\nStatus: %{http_code}\n" \
  https://material-spare-part.pages.dev/

# Expected:
# Time: < 1s (Cloudflare edge network)
# Status: 200
```

---

## 🔄 Maintenance & Update

### Update Aplikasi (Push Changes):

```bash
cd /home/user/webapp

# 1. Make changes di code
nano src/index.tsx

# 2. Test locally
npm run build
pm2 restart webapp

# 3. Commit changes
git add .
git commit -m "Update: deskripsi perubahan"

# 4. Push to GitHub
git push origin main

# 5. Deploy to Cloudflare
npm run build
npx wrangler pages deploy dist --project-name=material-spare-part
```

**Jika menggunakan Git Integration:**
- Push ke GitHub → Auto deploy otomatis
- Cek status deploy di Cloudflare Dashboard

### Rollback ke Versi Sebelumnya:

**Via Cloudflare Dashboard:**
1. Workers & Pages → Project → **Deployments**
2. Pilih deployment sebelumnya
3. Klik **"Rollback to this deployment"**

**Via Git:**
```bash
cd /home/user/webapp

# Lihat history
git log --oneline

# Rollback ke commit tertentu
git reset --hard COMMIT_HASH

# Force push
git push origin main --force

# Deploy ulang
npm run build
npx wrangler pages deploy dist --project-name=material-spare-part
```

### Monitor Deployment:

**Via Cloudflare Dashboard:**
- Workers & Pages → Project → **Analytics**
- Lihat: Requests, Errors, Response Time, Geographic distribution

**Via Wrangler:**
```bash
# List all deployments
npx wrangler pages deployment list --project-name=material-spare-part

# Get deployment details
npx wrangler pages deployment tail --project-name=material-spare-part
```

---

## 🐛 Troubleshooting

### Problem 1: Build Failed - "vite: not found"

**Solution:**
```bash
cd /home/user/webapp
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem 2: "Project already exists"

**Solution:**
```bash
# Gunakan nama project berbeda
npx wrangler pages project create material-spare-part-v2

# Atau hapus project lama
npx wrangler pages project delete material-spare-part
# Konfirmasi: yes
```

### Problem 3: Authentication Failed

**Solution:**
```bash
# Re-setup Cloudflare token
unset CLOUDFLARE_API_TOKEN

# Get new token dari Cloudflare Dashboard
# Setup ulang
export CLOUDFLARE_API_TOKEN="NEW_TOKEN"

# Test
npx wrangler whoami
```

### Problem 4: 404 Not Found di Static Files

**Cause:** File static tidak ter-copy ke dist/

**Solution:**
```bash
cd /home/user/webapp

# Manual copy static files
mkdir -p dist/static
cp -r public/static/* dist/static/

# Deploy ulang
npx wrangler pages deploy dist --project-name=material-spare-part
```

### Problem 5: 500 Internal Server Error

**Debug steps:**
```bash
# 1. Check wrangler logs
npx wrangler pages deployment tail --project-name=material-spare-part

# 2. Test locally
cd /home/user/webapp
npm run build
pm2 delete webapp
pm2 start ecosystem.config.cjs
pm2 logs webapp --nostream

# 3. Check API endpoints
curl -v https://material-spare-part.pages.dev/api/data
```

### Problem 6: CORS Errors

**Already handled in code:**
```typescript
app.use('/api/*', cors())
```

If still error, check:
```bash
# Test CORS headers
curl -I -H "Origin: https://your-domain.com" \
  https://material-spare-part.pages.dev/api/data
```

### Problem 7: Google Sheets Data Not Loading

**Check:**
1. Google Sheets URL di `src/index.tsx` line 14
2. Test URL directly:
```bash
curl "https://script.googleusercontent.com/macros/echo?user_content_key=..."
```
3. Pastikan Google Sheets script masih aktif & public

### Problem 8: Login Tidak Berhasil

**Check credentials:**
- Username: `AMC@12345`
- Password: `12345@AMC`

**Debug:**
```javascript
// Check di browser console
localStorage.getItem('sessionToken')

// Clear session
localStorage.removeItem('sessionToken')
```

---

## 📊 Post-Deployment Checklist

- [ ] ✅ Deployment berhasil (status: Success)
- [ ] ✅ URL production bisa diakses
- [ ] ✅ Login berhasil dengan credentials hardcoded
- [ ] ✅ Semua dashboard bisa diakses (Stok, Umur, Mutasi, Gangguan, Kebutuhan)
- [ ] ✅ Form Gangguan bisa diakses tanpa login
- [ ] ✅ Google Sheets data ter-load
- [ ] ✅ Dropdown values (Unit, Pemeriksa, Penerima) terisi
- [ ] ✅ Static files (JS, CSS) ter-load
- [ ] ✅ API endpoints berfungsi
- [ ] ✅ Navigation menu berfungsi di semua halaman
- [ ] ✅ Dashboard Kebutuhan menampilkan kolom "Unit/Lokasi Tujuan"
- [ ] ✅ Dropdown status punya 5 opsi: Pengadaan, Tunda, Reject, Terkirim, Tersedia
- [ ] ✅ Backup file project sudah dibuat
- [ ] ✅ Repository GitHub sudah update
- [ ] ✅ README.md sudah include production URL

---

## 🎯 Quick Reference Commands

```bash
# Build
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=material-spare-part

# Check deployment status
npx wrangler pages deployment list --project-name=material-spare-part

# Check logs (real-time)
npx wrangler pages deployment tail --project-name=material-spare-part

# Check who is logged in
npx wrangler whoami

# Git workflow
git add .
git commit -m "Your message"
git push origin main

# Local test (sandbox)
fuser -k 3000/tcp 2>/dev/null || true
npm run build
pm2 restart webapp
curl http://localhost:3000
```

---

## 🔗 Important URLs

**Cloudflare Dashboard:**
- Main: https://dash.cloudflare.com/
- Workers & Pages: https://dash.cloudflare.com/ (Workers & Pages section)
- API Tokens: https://dash.cloudflare.com/profile/api-tokens

**GitHub:**
- Repository: `https://github.com/USERNAME/sistem-material-spare-part`

**Production URLs (example):**
- Main: `https://material-spare-part.pages.dev/`
- Login: `https://material-spare-part.pages.dev/login`
- Dashboard Kebutuhan: `https://material-spare-part.pages.dev/dashboard/kebutuhan-material`

**Documentation:**
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- Hono Framework: https://hono.dev/

---

## 🆘 Need Help?

**Cloudflare Community:**
- Forum: https://community.cloudflare.com/
- Discord: https://discord.gg/cloudflaredev

**Documentation:**
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Hono: https://hono.dev/docs/

**GitHub Issues:**
- Create issue di repository Anda untuk tracking bugs/features

---

## 📝 Notes

⚠️ **PENTING - Data Storage:**
- Aplikasi ini menggunakan **in-memory storage**
- Data akan **HILANG** saat Cloudflare Worker restart
- Untuk production, **WAJIB** gunakan persistent storage:
  - Cloudflare D1 (SQLite)
  - Cloudflare KV (Key-Value)
  - Firebase Firestore
  - Supabase

⚠️ **Authentication:**
- Credentials hardcoded di code (tidak secure untuk production)
- Untuk production, gunakan proper authentication:
  - Cloudflare Access
  - Auth0
  - Firebase Auth
  - Custom JWT implementation

⚠️ **Google Sheets URL:**
- Hardcoded di `src/index.tsx`
- Pastikan script Google Sheets tetap public
- Consider migrate ke database untuk production

---

**✅ Deployment Guide Complete!**

Good luck dengan deployment! 🚀

Jika ada pertanyaan atau kendala saat deploy, feel free to ask!
