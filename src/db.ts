// Database Helper Functions for D1
// This file contains all database operations for Material Management System

export type Bindings = {
  DB: D1Database;
}

// ====================================
// TRANSACTIONS TABLE
// ====================================

export async function saveTransaction(db: D1Database, data: any) {
  try {
    // Insert transaction
    const txResult = await db.prepare(`
      INSERT INTO transactions (nomor_ba, tanggal, jenis_transaksi, lokasi_asal, lokasi_tujuan, pemeriksa, penerima, ttd_pemeriksa, ttd_penerima)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.nomorBA,
      data.tanggal,
      data.jenisTransaksi,
      data.lokasiAsal,
      data.lokasiTujuan,
      data.pemeriksa,
      data.penerima,
      data.ttdPemeriksa,
      data.ttdPenerima
    ).run()

    const transactionId = txResult.meta.last_row_id

    // Insert materials with auto-fill jenisBarang
    for (const material of data.materials) {
      // Auto-fill jenisBarang jika kosong atau "-"
      let jenisBarang = material.jenisBarang
      if (!jenisBarang || jenisBarang === '-' || jenisBarang.trim() === '') {
        // Coba ambil dari master_material berdasarkan partNumber
        const masterResult = await db.prepare(`
          SELECT JENIS_BARANG FROM master_material 
          WHERE PART_NUMBER = ? LIMIT 1
        `).bind(material.partNumber).first()
        
        jenisBarang = masterResult?.JENIS_BARANG || 'MATERIAL HANDAL'
        console.log(`🔄 Auto-filled jenisBarang for ${material.partNumber}: ${jenisBarang}`)
      }
      
      await db.prepare(`
        INSERT INTO materials (transaction_id, part_number, jenis_barang, material, mesin, sn_mesin, jumlah)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        transactionId,
        material.partNumber,
        jenisBarang,  // Use auto-filled value
        material.material,
        material.mesin,
        material.snMesin,
        material.jumlah
      ).run()
    }

    return { success: true, id: transactionId, nomorBA: data.nomorBA }
  } catch (error: any) {
    console.error('Failed to save transaction:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

export async function getAllTransactions(db: D1Database) {
  try {
    const { results } = await db.prepare(`
      SELECT 
        t.*,
        json_group_array(
          json_object(
            'partNumber', m.part_number,
            'jenisBarang', m.jenis_barang,
            'material', m.material,
            'mesin', m.mesin,
            'snMesin', m.sn_mesin,
            'jumlah', m.jumlah
          )
        ) as materials
      FROM transactions t
      LEFT JOIN materials m ON t.id = m.transaction_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all()

    return results.map((tx: any) => ({
      ...tx,
      materials: JSON.parse(tx.materials)
    }))
  } catch (error: any) {
    console.error('Failed to get transactions:', error)
    return []
  }
}

export async function getTransactionByBA(db: D1Database, nomorBA: string) {
  try {
    const { results } = await db.prepare(`
      SELECT 
        t.*,
        json_group_array(
          json_object(
            'partNumber', m.part_number,
            'jenisBarang', m.jenis_barang,
            'material', m.material,
            'mesin', m.mesin,
            'snMesin', m.sn_mesin,
            'jumlah', m.jumlah
          )
        ) as materials
      FROM transactions t
      LEFT JOIN materials m ON t.id = m.transaction_id
      WHERE t.nomor_ba = ?
      GROUP BY t.id
    `).bind(nomorBA).all()

    if (results.length === 0) return null

    const tx: any = results[0]
    return {
      ...tx,
      materials: JSON.parse(tx.materials)
    }
  } catch (error: any) {
    console.error('Failed to get transaction by BA:', error)
    return null
  }
}

// ====================================
// GANGGUAN TABLE
// ====================================

export async function saveGangguan(db: D1Database, data: any) {
  try {
    // Insert gangguan dengan semua kolom
    const gangguanResult = await db.prepare(`
      INSERT INTO gangguan (
        nomor_lh05, tanggal_laporan, jenis_gangguan, lokasi_gangguan, user_laporan, status,
        komponen_rusak, gejala, uraian_kejadian, analisa_penyebab, kesimpulan,
        beban_puncak, daya_mampu, pemadaman, kelompok_spd,
        catatan_tindakan, rencana_perbaikan, ttd_teknisi, ttd_supervisor
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.nomorLH05,
      data.hariTanggal,
      data.kelompokSPD || 'MEKANIK',
      data.unitULD,
      data.namaPelapor,
      'Open',
      data.komponenRusak,
      data.gejala,
      data.uraianKejadian,
      data.analisaPenyebab,
      data.kesimpulan,
      data.bebanPuncak ? parseFloat(data.bebanPuncak) : null,
      data.dayaMampu ? parseFloat(data.dayaMampu) : null,
      data.pemadaman,
      data.kelompokSPD || 'MEKANIK',
      data.tindakanPenanggulangan,
      data.rencanaPerbaikan,
      data.ttdPelapor,
      ''
    ).run()

    const gangguanId = gangguanResult.meta.last_row_id

    // Insert materials for gangguan
    for (const material of data.materials) {
      await db.prepare(`
        INSERT INTO material_gangguan (gangguan_id, part_number, material, mesin, jumlah, status, unit_uld, lokasi_tujuan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        gangguanId,
        material.partNumber,
        material.material,
        material.mesin,
        material.jumlah,
        material.status || 'Pengadaan',
        data.unitULD,
        data.unitULD
      ).run()
    }

    return { success: true, id: gangguanId, nomorLH05: data.nomorLH05 }
  } catch (error: any) {
    console.error('Failed to save gangguan:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

export async function getAllGangguan(db: D1Database) {
  try {
    const { results } = await db.prepare(`
      SELECT 
        g.*,
        json_group_array(
          json_object(
            'partNumber', mg.part_number,
            'material', mg.material,
            'mesin', mg.mesin,
            'jumlah', mg.jumlah,
            'status', mg.status,
            'unitULD', mg.unit_uld,
            'lokasiTujuan', mg.lokasi_tujuan
          )
        ) as materials
      FROM gangguan g
      LEFT JOIN material_gangguan mg ON g.id = mg.gangguan_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `).all()

    return results.map((g: any) => ({
      ...g,
      materials: JSON.parse(g.materials)
    }))
  } catch (error: any) {
    console.error('Failed to get gangguan:', error)
    return []
  }
}

export async function getGangguanByLH05(db: D1Database, nomorLH05: string) {
  try {
    const { results } = await db.prepare(`
      SELECT 
        g.*,
        json_group_array(
          json_object(
            'partNumber', mg.part_number,
            'material', mg.material,
            'mesin', mg.mesin,
            'jumlah', mg.jumlah,
            'status', mg.status,
            'unitULD', mg.unit_uld,
            'lokasiTujuan', mg.lokasi_tujuan
          )
        ) as materials
      FROM gangguan g
      LEFT JOIN material_gangguan mg ON g.id = mg.gangguan_id
      WHERE g.nomor_lh05 = ?
      GROUP BY g.id
    `).bind(nomorLH05).all()

    if (results.length === 0) return null

    const g: any = results[0]
    return {
      ...g,
      materials: JSON.parse(g.materials)
    }
  } catch (error: any) {
    console.error('Failed to get gangguan by LH05:', error)
    return null
  }
}

export async function updateMaterialGangguanStatus(db: D1Database, gangguanId: number, materialId: number, newStatus: string) {
  try {
    await db.prepare(`
      UPDATE material_gangguan
      SET status = ?
      WHERE gangguan_id = ? AND id = ?
    `).bind(newStatus, gangguanId, materialId).run()

    return { success: true }
  } catch (error: any) {
    console.error('Failed to update material status:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

// ====================================
// MATERIAL KEBUTUHAN (Dashboard)
// ====================================

export async function getAllMaterialKebutuhan(db: D1Database) {
  try {
    const { results } = await db.prepare(`
      SELECT 
        mg.*,
        g.nomor_lh05,
        g.tanggal_laporan,
        g.lokasi_gangguan,
        g.status as gangguan_status
      FROM material_gangguan mg
      JOIN gangguan g ON mg.gangguan_id = g.id
      ORDER BY mg.created_at DESC
    `).all()

    return results
  } catch (error: any) {
    console.error('Failed to get material kebutuhan:', error)
    return []
  }
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

export async function getNextBANumber(db: D1Database, tanggal?: string) {
  try {
    // Extract year from tanggal, default to current year
    let year = new Date().getFullYear()
    if (tanggal) {
      const dateObj = new Date(tanggal)
      if (!isNaN(dateObj.getTime())) {
        year = dateObj.getFullYear()
      }
    }
    
    // Get last BA number for the specific year
    const { results } = await db.prepare(`
      SELECT nomor_ba FROM transactions 
      WHERE nomor_ba LIKE ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(`BA-${year}-%`).all()

    if (results.length === 0) {
      return `BA-${year}-0001`
    }

    const lastBA: any = results[0]
    const lastNumber = parseInt(lastBA.nomor_ba.split('-')[2])
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
    return `BA-${year}-${nextNumber}`
  } catch (error) {
    // Default to current year if error
    const year = new Date().getFullYear()
    return `BA-${year}-0001`
  }
}

export async function getNextLH05Number(db: D1Database, tanggal?: string) {
  try {
    // Extract year from tanggal, default to current year
    let year = new Date().getFullYear()
    if (tanggal) {
      const dateObj = new Date(tanggal)
      if (!isNaN(dateObj.getTime())) {
        year = dateObj.getFullYear()
      }
    }
    
    // Get only LH05 numbers that match pattern for the specific year: XXXX/ND KAL 2/LH05/YYYY
    const { results } = await db.prepare(`
      SELECT nomor_lh05 FROM gangguan 
      WHERE nomor_lh05 LIKE ?
      ORDER BY id DESC LIMIT 1
    `).bind(`%/ND KAL 2/LH05/${year}`).all()

    if (results.length === 0) {
      return `0001/ND KAL 2/LH05/${year}`
    }

    const lastLH05: any = results[0]
    const parts = lastLH05.nomor_lh05.split('/')
    
    // Extract number from first part (remove non-digits)
    const numberPart = parts[0].replace(/\D/g, '')
    const lastNumber = parseInt(numberPart)
    
    // Validate number is valid
    if (isNaN(lastNumber) || lastNumber === 0) {
      console.warn('Invalid LH05 number format:', lastLH05.nomor_lh05, '- using 0001')
      return `0001/ND KAL 2/LH05/${year}`
    }
    
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
    return `${nextNumber}/ND KAL 2/LH05/${year}`
  } catch (error) {
    console.error('Error generating LH05 number:', error)
    const year = new Date().getFullYear()
    return `0001/ND KAL 2/LH05/${year}`
  }
}

// ====================================
// DELETE OPERATIONS (ADMIN ONLY)
// ====================================

export async function deleteTransaction(db: D1Database, nomorBA: string) {
  try {
    // Get transaction ID first
    const tx = await getTransactionByBA(db, nomorBA)
    if (!tx) {
      throw new Error('Transaction not found')
    }

    // Delete materials first (foreign key constraint)
    await db.prepare(`
      DELETE FROM materials WHERE transaction_id = ?
    `).bind(tx.id).run()

    // Delete transaction
    await db.prepare(`
      DELETE FROM transactions WHERE nomor_ba = ?
    `).bind(nomorBA).run()

    return { success: true, message: 'Transaction deleted successfully' }
  } catch (error: any) {
    console.error('Failed to delete transaction:', error)
    throw new Error(`Delete failed: ${error.message}`)
  }
}

export async function deleteGangguan(db: D1Database, nomorLH05: string) {
  try {
    // Get gangguan ID first
    const gangguan = await getGangguanByLH05(db, nomorLH05)
    if (!gangguan) {
      throw new Error('Gangguan not found')
    }

    // Delete materials first (foreign key constraint)
    await db.prepare(`
      DELETE FROM material_gangguan WHERE gangguan_id = ?
    `).bind(gangguan.id).run()

    // Delete gangguan
    await db.prepare(`
      DELETE FROM gangguan WHERE nomor_lh05 = ?
    `).bind(nomorLH05).run()

    return { success: true, message: 'Gangguan deleted successfully' }
  } catch (error: any) {
    console.error('Failed to delete gangguan:', error)
    throw new Error(`Delete failed: ${error.message}`)
  }
}

// ====================================
// SESSION MANAGEMENT (PERSISTENT)
// ====================================

export async function saveSession(db: D1Database, sessionToken: string, username: string, role: string, expiresAt: string) {
  try {
    await db.prepare(`
      INSERT INTO sessions (session_token, username, role, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(sessionToken, username, role, expiresAt).run()

    return { success: true }
  } catch (error: any) {
    console.error('Failed to save session:', error)
    throw new Error(`Save session failed: ${error.message}`)
  }
}

export async function getSession(db: D1Database, sessionToken: string) {
  try {
    const { results } = await db.prepare(`
      SELECT * FROM sessions WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(sessionToken).all()

    return results.length > 0 ? results[0] : null
  } catch (error: any) {
    console.error('Failed to get session:', error)
    return null
  }
}

export async function deleteSession(db: D1Database, sessionToken: string) {
  try {
    await db.prepare(`
      DELETE FROM sessions WHERE session_token = ?
    `).bind(sessionToken).run()

    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete session:', error)
    throw new Error(`Delete session failed: ${error.message}`)
  }
}

export async function cleanExpiredSessions(db: D1Database) {
  try {
    await db.prepare(`
      DELETE FROM sessions WHERE expires_at < datetime('now')
    `).run()

    return { success: true }
  } catch (error: any) {
    console.error('Failed to clean expired sessions:', error)
    return { success: false }
  }
}
