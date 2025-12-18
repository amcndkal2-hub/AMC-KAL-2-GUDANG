# 🚀 Deployment Information - AMC Material System

## 📅 Deployment Date
**Date**: December 18, 2025  
**Time**: 01:16 UTC  
**Version**: v4.2 Production

---

## 🌐 Production URLs

### **Main Application URL:**
```
https://amc-material-system.pages.dev
```

### **Deployment URL (Current):**
```
https://da562282.amc-material-system.pages.dev
```

### **Alternative URLs:**
- Branch URL: `https://main.amc-material-system.pages.dev`
- Custom domain: (not configured yet)

---

## 🔐 Credentials

### **Dashboard Login:**
- **Username**: `AMC@12345`
- **Password**: `12345@AMC`

### **Public Forms (No Login Required):**
- Form Gangguan: `/form-gangguan`

---

## 📦 Deployment Details

### **Platform:** Cloudflare Pages
- **Project Name**: `amc-material-system`
- **Account Email**: amc.ndkal2@gmail.com
- **Account ID**: ec39685348aacddfeadb29745d4b4e7b
- **Production Branch**: `main`

### **GitHub Repository:**
- **Owner**: amcndkal2-hub
- **Repo**: AMC-KAL-2-GUDANG
- **URL**: https://github.com/amcndkal2-hub/AMC-KAL-2-GUDANG
- **Branch**: main

---

## 📊 Build Information

### **Build Tool:** Vite v6.4.1
- **Output Directory**: `dist/`
- **Worker File**: `_worker.js` (114.08 KB)
- **Routes Config**: `_routes.json`
- **Static Assets**: `dist/static/` (9 files)

### **Files Deployed:**
```
dist/
├── _routes.json (54 bytes)
├── _worker.js (114.08 KB)
└── static/
    ├── app.js (18 KB)
    ├── auth-check.js (1.4 KB)
    ├── dashboard-gangguan.js (20 KB)
    ├── dashboard-kebutuhan.js (9.2 KB)
    ├── dashboard-mutasi.js (9.4 KB)
    ├── dashboard-stok.js (5.0 KB)
    ├── dashboard-umur.js (15 KB)
    ├── form-gangguan.js (13 KB)
    └── style.css (49 bytes)
```

---

## 🔧 Configuration Files

### **wrangler.jsonc:**
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "amc-material-system",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist"
}
```

### **package.json scripts:**
```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "wrangler pages dev dist",
  "deploy": "npm run build && wrangler pages deploy dist",
  "deploy:prod": "npm run build && wrangler pages deploy dist --project-name amc-material-system"
}
```

---

## 📱 Application Features

### **7 Main Features:**
1. ✅ **Form Input Transaksi Material** (`/`)
2. ✅ **Dashboard Stok Material** (`/dashboard/stok`)
3. ✅ **Dashboard Umur Material** (`/dashboard/umur`)
4. ✅ **Dashboard Mutasi Material** (`/dashboard/mutasi`)
5. ✅ **Form Gangguan (LH05)** (`/form-gangguan`) - PUBLIC
6. ✅ **Dashboard Gangguan** (`/dashboard/gangguan`)
7. ✅ **Dashboard Kebutuhan Material** (`/dashboard/kebutuhan-material`)

### **Authentication:**
- Protected routes: All dashboards except Form Gangguan
- Session duration: 8 hours
- Login page: `/login`
- Logout: Available in all protected pages

---

## ⚠️ Important Notes

### **1. Data Storage (CRITICAL):**
```
⚠️ WARNING: Data uses IN-MEMORY storage
⚠️ Data will be LOST on:
   - Application restart
   - Redeploy
   - Worker idle timeout

🔴 NOT SUITABLE FOR PRODUCTION USE
✅ RECOMMENDATION: Migrate to Cloudflare D1 Database
```

### **2. Google Sheets Integration:**
- Master data source: Google Sheets JSON API
- Cache duration: 5 minutes
- Auto-refresh for dropdown values

### **3. Current Limitations:**
- No persistent database
- No user management system
- Hardcoded credentials
- No backup/restore functionality
- No audit logs

---

## 🔄 Update & Redeploy

### **Quick Redeploy:**
```bash
cd /home/user/webapp

# 1. Update code (if needed)
# Edit files in src/ or public/static/

# 2. Commit changes
git add .
git commit -m "Update: description of changes"
git push origin main

# 3. Rebuild
npm run build

# 4. Deploy to production
export CLOUDFLARE_API_TOKEN="i4BT6fi0SFAW7V0XIUQso4Rwk2Xb3Qq3mc8BGGTk"
npx wrangler pages deploy dist --project-name amc-material-system

# Or use npm script
npm run deploy:prod
```

### **Deployment Time:**
- Build: ~5 seconds
- Upload: ~2 seconds
- Deploy: ~3 seconds
- Total: ~10 seconds ⚡

---

## 📈 Next Steps (Recommended)

### **Phase 1: Database Migration (HIGH PRIORITY)**
**Estimated Time:** 30-45 minutes

**Steps:**
1. Create Cloudflare D1 database
2. Create migration files (SQL schemas)
3. Update backend code to use D1
4. Apply migrations
5. Redeploy

**Benefits:**
- ✅ Persistent data storage
- ✅ Production-ready
- ✅ No data loss on restart
- ✅ Backup & restore capabilities

---

### **Phase 2: Security Improvements**
**Estimated Time:** 15-20 minutes

**Tasks:**
1. Replace hardcoded credentials
2. Implement proper user management
3. Add password hashing (bcrypt)
4. Setup rate limiting
5. Add CSRF protection

---

### **Phase 3: Custom Domain (Optional)**
**Estimated Time:** 10-60 minutes

**Steps:**
1. Purchase domain (or use existing)
2. Add custom domain in Cloudflare Pages
3. Configure DNS (CNAME record)
4. Wait for SSL provisioning (automatic)

**Example:**
- Before: `https://amc-material-system.pages.dev`
- After: `https://material.yourdomain.com`

---

## 🛠️ Maintenance Commands

### **View Deployment Logs:**
```bash
npx wrangler pages deployment tail --project-name amc-material-system
```

### **List All Deployments:**
```bash
npx wrangler pages deployment list --project-name amc-material-system
```

### **Rollback to Previous Deployment:**
```bash
npx wrangler pages deployment rollback --project-name amc-material-system
```

### **View Project Settings:**
```bash
npx wrangler pages project list
```

---

## 📊 Monitoring & Analytics

### **Cloudflare Dashboard:**
```
https://dash.cloudflare.com
→ Pages
→ amc-material-system
→ Analytics
```

**Available Metrics:**
- Page views
- Requests per second
- Bandwidth usage
- Error rates
- Cache hit ratio
- Geographic distribution

---

## 🆘 Troubleshooting

### **Issue 1: 404 Error on Production**
**Solution:** Wait 1-2 minutes for DNS propagation

### **Issue 2: Changes Not Reflected**
**Solution:** 
- Clear browser cache
- Try incognito mode
- Verify latest deployment

### **Issue 3: Data Lost After Restart**
**Solution:** Migrate to D1 database (see Phase 1 above)

### **Issue 4: Authentication Failed**
**Solution:** 
- Check credentials: `AMC@12345` / `12345@AMC`
- Clear cookies and login again

---

## 📞 Support & Resources

### **Documentation:**
- Main README: `/home/user/webapp/README.md`
- Cloudflare Docs: https://developers.cloudflare.com/pages
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler

### **Links:**
- **Production App**: https://amc-material-system.pages.dev
- **GitHub Repo**: https://github.com/amcndkal2-hub/AMC-KAL-2-GUDANG
- **Cloudflare Dashboard**: https://dash.cloudflare.com

---

## ✅ Deployment Checklist

- [x] Build project successfully
- [x] Create Cloudflare Pages project
- [x] Deploy to production
- [x] Verify URLs
- [x] Test login functionality
- [x] Push to GitHub
- [x] Update documentation
- [ ] Migrate to D1 Database (TODO)
- [ ] Setup custom domain (Optional)
- [ ] Configure monitoring (Recommended)

---

**Deployment Status:** ✅ **LIVE & ACTIVE**

**Last Updated:** December 18, 2025 01:16 UTC

---

**🎉 Congratulations! Your application is now LIVE on Cloudflare Pages! 🎉**
