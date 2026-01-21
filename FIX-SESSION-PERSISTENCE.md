# FIX: Data "Hilang" - ROOT CAUSE: Session Tidak Persistent! ✅

## 📋 Masalah Sebenarnya

**User Report**: "data tetep ilang bagaimana solusinya?"

**TEMUAN SETELAH INVESTIGASI MENDALAM**:
- ✅ Data gangguan **TIDAK HILANG** di database (3 items tetap ada)
- ✅ Data bisa diakses via API: `/api/gangguan-transactions`
- ❌ Masalahnya: **SESSION LOGIN HILANG setelah restart**!

---

## 🔍 Root Cause Analysis (Updated)

### Masalah Sebenarnya
1. **Session disimpan di `activeSessions` (in-memory Map)** - line 110 di `src/index.tsx`
2. Setelah **restart aplikasi**, `activeSessions` **HILANG**!
3. User masih punya `sessionToken` di browser (`localStorage`)
4. User refresh page → frontend call `/api/check-session`
5. Server: "Session not found!" → return `{ valid: false }`
6. Frontend (`auth-check.js` line 26-31): **redirect ke `/login`**!
7. **User logout paksa** → harus login ulang
8. User berpikir **"data hilang"** padahal data tetap ada, hanya perlu login ulang!

### Flow yang Terjadi (Sebelum Fix)
```
1. User login → sessionToken saved to localStorage (browser)
2. sessionToken saved to activeSessions (in-memory, server)
3. ✅ Dashboard terlihat normal

--- SERVER RESTART ---

4. activeSessions Map = {} (EMPTY!)
5. User refresh page
6. Frontend: check session via /api/check-session
7. Server: "sessionToken not found in activeSessions" → 401
8. Frontend: redirectToLogin()
9. ❌ User logout paksa → dashboard "hilang"
```

---

## ✅ Solusi: Persistent Session di D1 Database

### 1. Buat Tabel Sessions
**File**: `migrations/0003_add_sessions_table.sql`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

**Apply Migration**:
```bash
npx wrangler d1 migrations apply amc-material-db --local
# ✅ 4 commands executed successfully
```

### 2. Tambahkan Fungsi Session Management
**File**: `src/db.ts` (line 398+)

```typescript
export async function saveSession(
  db: D1Database, 
  sessionToken: string, 
  username: string, 
  role: string, 
  expiresAt: string
) {
  await db.prepare(`
    INSERT INTO sessions (session_token, username, role, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionToken, username, role, expiresAt).run()
  
  return { success: true }
}

export async function getSession(db: D1Database, sessionToken: string) {
  const { results } = await db.prepare(`
    SELECT * FROM sessions 
    WHERE session_token = ? AND expires_at > datetime('now')
  `).bind(sessionToken).all()

  return results.length > 0 ? results[0] : null
}

export async function deleteSession(db: D1Database, sessionToken: string) {
  await db.prepare(`
    DELETE FROM sessions WHERE session_token = ?
  `).bind(sessionToken).run()
  
  return { success: true }
}
```

### 3. Update API Login
**File**: `src/index.tsx` (line 812-848)

**Sebelum**:
```typescript
// Session hanya disimpan di in-memory
activeSessions.set(sessionToken, { ... })
```

**Sesudah**:
```typescript
const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Save session to D1 Database (PERSISTENT)
await DB.saveSession(env.DB, sessionToken, user.username, user.role, expiresAt)

// Also keep in-memory for backward compatibility
activeSessions.set(sessionToken, { username, role, loginTime, expiresAt })

console.log('✅ Session saved to D1:', sessionToken.substring(0, 20) + '...')
```

### 4. Update API Check-Session
**File**: `src/index.tsx` (line 884-933)

**Sebelum**: Hanya cek `activeSessions.has(sessionToken)`

**Sesudah**:
```typescript
app.get('/api/check-session', async (c) => {
  const { env } = c
  const sessionToken = authHeader?.replace('Bearer ', '')
  
  // First try D1 Database (PERSISTENT)
  const dbSession = await DB.getSession(env.DB, sessionToken)
  
  if (dbSession) {
    console.log('✅ Session found in D1')
    return c.json({ 
      valid: true, 
      username: dbSession.username,
      role: dbSession.role,
      expiresAt: dbSession.expires_at
    })
  }
  
  // Fallback: Check in-memory (backward compatibility)
  if (activeSessions.has(sessionToken)) {
    // ...
  }
  
  return c.json({ valid: false }, 401)
})
```

### 5. Update API Logout
**File**: `src/index.tsx` (line 851-881)

```typescript
app.post('/api/logout', async (c) => {
  const { env } = c
  const sessionToken = authHeader?.replace('Bearer ', '')
  
  if (sessionToken) {
    // Delete from D1 Database
    await DB.deleteSession(env.DB, sessionToken)
    
    // Also delete from in-memory
    activeSessions.delete(sessionToken)
    
    console.log('✅ Session deleted from D1')
  }
  
  return c.json({ success: true })
})
```

---

## 🧪 Testing & Verification

### Test 1: Login dan Simpan Session
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"AMC@12345","password":"12345@AMC"}'

# Response:
{
  "success": true,
  "sessionToken": "session_1768986088806_cw216c",
  "role": "user",
  "username": "AMC@12345"
}

# Verify in D1:
npx wrangler d1 execute amc-material-db --local \
  --command="SELECT * FROM sessions"

# Result: ✅ 1 session tersimpan
```

### Test 2: Check Session Before Restart
```bash
curl http://localhost:3000/api/check-session \
  -H "Authorization: Bearer session_1768986088806_cw216c"

# Response:
{
  "valid": true,
  "username": "AMC@12345",
  "role": "user",
  "expiresAt": "2026-01-21T17:01:28.806Z"
}

# ✅ Session valid!
```

### Test 3: **RESTART APLIKASI**
```bash
pm2 restart webapp
sleep 3
```

### Test 4: Check Session **AFTER RESTART** (CRITICAL!)
```bash
curl http://localhost:3000/api/check-session \
  -H "Authorization: Bearer session_1768986088806_cw216c"

# Response:
{
  "valid": true,  ✅ TETAP VALID!
  "username": "AMC@12345",
  "role": "user",
  "expiresAt": "2026-01-21T17:01:28.806Z"
}

# 🎉 SESSION TETAP VALID SETELAH RESTART!
```

### Test 5: Access Gangguan Data
```bash
curl http://localhost:3000/api/gangguan-transactions \
  -H "Authorization: Bearer session_1768986088806_cw216c"

# Response: 3 items (data TIDAK HILANG!)
{
  "gangguanTransactions": [
    { "nomor_lh05": "0002/ND KAL 2/LH05/2025", ... },
    { "nomor_lh05": "0001/ND KAL 2/LH05/2025", ... },
    { "nomor_lh05": "LH05-2025-001", ... }
  ]
}

# ✅ Data gangguan TETAP ADA!
```

---

## 📊 Hasil Akhir

### Sebelum Perbaikan
| Aspek | Status |
|-------|--------|
| Session Storage | In-memory (Map) ❌ |
| Setelah Restart | Session hilang ❌ |
| User Experience | Logout paksa → login ulang ❌ |
| Dashboard | "Hilang" (perlu login ulang) ❌ |
| Data Gangguan | Tetap ada di DB ✅ (tapi tidak terlihat) |

### Setelah Perbaikan
| Aspek | Status |
|-------|--------|
| Session Storage | D1 Database (Persistent) ✅ |
| Setelah Restart | Session TETAP VALID ✅ |
| User Experience | Tidak perlu login ulang ✅ |
| Dashboard | Tetap terlihat ✅ |
| Data Gangguan | Tetap ada & accessible ✅ |

---

## 🔧 Files Modified

1. **migrations/0003_add_sessions_table.sql** (NEW)
   - Tabel `sessions` dengan kolom: session_token, username, role, expires_at
   - Index untuk performance

2. **src/db.ts**
   - +60 lines: Session management functions
   - `saveSession()`, `getSession()`, `deleteSession()`, `cleanExpiredSessions()`

3. **src/index.tsx**
   - Line 812-848: Update `/api/login` - save to D1
   - Line 851-881: Update `/api/logout` - delete from D1
   - Line 884-933: Update `/api/check-session` - read from D1 first

---

## ✅ Penjelasan untuk User

**MASALAH YANG DIALAMI**:
- User login → bisa akses dashboard
- Beberapa menit kemudian (atau setelah restart server)
- Dashboard "hilang" → harus login ulang

**PENYEBAB**:
- Bukan data yang hilang!
- Session login yang hilang!
- Session disimpan di memori server (temporary)
- Restart server → session hilang → logout otomatis

**SOLUSI**:
- Session sekarang disimpan di **DATABASE** (permanent)
- Restart server → session TETAP VALID
- User **TIDAK perlu login ulang**
- Dashboard **TETAP TERLIHAT**

**BENEFIT**:
- ✅ Session persistent selama 8 jam
- ✅ Tidak logout otomatis setelah restart
- ✅ User experience lebih baik
- ✅ Data gangguan selalu accessible

---

## 🎯 Kesimpulan

**Problem Statement**: Data "hilang" setelah beberapa menit

**Root Cause**: Bukan data yang hilang, tapi **SESSION LOGIN TIDAK PERSISTENT**!

**Solution**: Simpan session ke **Cloudflare D1 Database** (persistent storage)

**Result**: 
- ✅ Session TETAP VALID setelah restart
- ✅ User TIDAK logout paksa
- ✅ Data gangguan SELALU accessible
- ✅ Dashboard SELALU terlihat

**User sekarang bisa input dan akses data gangguan tanpa khawatir "hilang"!** 🎉

---

**Date**: 2026-01-21  
**Status**: ✅ SELESAI dan VERIFIED  
**Build**: 135.09 kB (dist/_worker.js)  
**PM2**: Running (PID 12666)  
**Session**: Persistent di D1 Database ✅
