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
    let transactionId
    
    // Try inserting with from_lh05 column first
    try {
      const txResult = await db.prepare(`
        INSERT INTO transactions (nomor_ba, tanggal, jenis_transaksi, lokasi_asal, lokasi_tujuan, pemeriksa, penerima, ttd_pemeriksa, ttd_penerima, from_lh05)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.nomorBA,
        data.tanggal,
        data.jenisTransaksi,
        data.lokasiAsal,
        data.lokasiTujuan,
        data.pemeriksa,
        data.penerima,
        data.ttdPemeriksa,
        data.ttdPenerima,
        data.fromLH05 || null
      ).run()
      
      transactionId = txResult.meta.last_row_id
      console.log('✅ Transaction saved with from_lh05 column')
    } catch (columnError: any) {
      // Fallback: Insert without from_lh05 if column doesn't exist
      if (columnError.message && columnError.message.includes('from_lh05')) {
        console.log('⚠️ from_lh05 column not found, using fallback insert')
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
        
        transactionId = txResult.meta.last_row_id
        console.log('✅ Transaction saved without from_lh05 column (fallback)')
      } else {
        throw columnError
      }
    }

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
      
      // Try inserting with status column first
      try {
        await db.prepare(`
          INSERT INTO materials (transaction_id, part_number, jenis_barang, material, mesin, status, jumlah)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          transactionId,
          material.partNumber,
          jenisBarang,  // Use auto-filled value
          material.material,
          material.mesin,
          material.status || material.snMesin || '',  // Use status (renamed from snMesin)
          material.jumlah
        ).run()
      } catch (insertError: any) {
        // Fallback to sn_mesin if status column doesn't exist
        const errorMsg = insertError.message || insertError.toString() || ''
        if (errorMsg.includes('no column') || errorMsg.includes('no such column') || errorMsg.includes('status')) {
          console.log('⚠️ status column not found, using sn_mesin fallback for insert')
          await db.prepare(`
            INSERT INTO materials (transaction_id, part_number, jenis_barang, material, mesin, sn_mesin, jumlah)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            transactionId,
            material.partNumber,
            jenisBarang,
            material.material,
            material.mesin,
            material.status || material.snMesin || '',
            material.jumlah
          ).run()
        } else {
          throw insertError
        }
      }
    }

    return { success: true, id: transactionId, nomorBA: data.nomorBA }
  } catch (error: any) {
    console.error('Failed to save transaction:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

export async function getAllTransactions(db: D1Database) {
  try {
    // Try with status column first (after migration)
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
              'status', m.status,
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
    } catch (statusError) {
      // Fallback to sn_mesin if status column doesn't exist
      console.log('⚠️ status column not found, using sn_mesin fallback')
      const { results } = await db.prepare(`
        SELECT 
          t.*,
          json_group_array(
            json_object(
              'partNumber', m.part_number,
              'jenisBarang', m.jenis_barang,
              'material', m.material,
              'mesin', m.mesin,
              'status', m.sn_mesin,
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
    }
  } catch (error: any) {
    console.error('Failed to get transactions:', error)
    return []
  }
}

export async function getTransactionByBA(db: D1Database, nomorBA: string) {
  try {
    // Try with status column first (after migration)
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
              'status', m.status,
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
    } catch (statusError) {
      // Fallback to sn_mesin if status column doesn't exist
      console.log('⚠️ status column not found in getTransactionByBA, using sn_mesin fallback')
      const { results } = await db.prepare(`
        SELECT 
          t.*,
          json_group_array(
            json_object(
              'partNumber', m.part_number,
              'jenisBarang', m.jenis_barang,
              'material', m.material,
              'mesin', m.mesin,
              'status', m.sn_mesin,
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
        INSERT INTO material_gangguan (gangguan_id, part_number, material, mesin, jumlah, status, unit_uld, lokasi_tujuan, sn_mesin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        gangguanId,
        material.partNumber,
        material.material,
        material.mesin,
        material.jumlah,
        material.status || 'N/A',
        data.unitULD,
        data.unitULD,
        material.snMesin || material.sn_mesin || ''
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
            'id', mg.id,
            'partNumber', mg.part_number,
            'material', mg.material,
            'mesin', mg.mesin,
            'jumlah', mg.jumlah,
            'status', mg.status,
            'unitULD', mg.unit_uld,
            'lokasiTujuan', mg.lokasi_tujuan,
            'snMesin', mg.sn_mesin
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
    // Get transaction with materials
    const tx = await getTransactionByBA(db, nomorBA)
    if (!tx) {
      throw new Error('Transaction not found')
    }

    console.log('🗑️ Deleting transaction:', nomorBA)
    
    // Check if any material has RAB number in status field
    const materials = tx.materials || []
    const rabNumbers = new Set<string>()
    
    for (const mat of materials) {
      // Status field contains RAB number (e.g., "RAB-2026-0005")
      const status = mat.status || mat.sn_mesin || mat.snMesin
      if (status && status.startsWith('RAB-')) {
        rabNumbers.add(status)
        console.log('📋 Found RAB reference:', status)
      }
    }

    // If transaction was from RAB, revert RAB status to "Tersedia"
    if (rabNumbers.size > 0) {
      for (const nomorRAB of rabNumbers) {
        console.log('🔄 Reverting RAB status to Tersedia:', nomorRAB)
        
        // Check if tanggal_masuk_gudang column exists
        let hasTimestampColumn = false
        try {
          const checkResult = await db.prepare(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='rab'
          `).first()
          
          if (checkResult && checkResult.sql) {
            hasTimestampColumn = (checkResult.sql as string).includes('tanggal_masuk_gudang')
          }
        } catch (e) {
          console.log('⚠️ Could not check table structure, assuming no timestamp column')
        }
        
        // Update RAB status back to "Tersedia"
        if (hasTimestampColumn) {
          console.log('✅ Using UPDATE with tanggal_masuk_gudang')
          await db.prepare(`
            UPDATE rab 
            SET status = 'Tersedia',
                tanggal_masuk_gudang = NULL
            WHERE nomor_rab = ?
          `).bind(nomorRAB).run()
        } else {
          console.log('⚠️ Using UPDATE without tanggal_masuk_gudang (column not found)')
          await db.prepare(`
            UPDATE rab 
            SET status = 'Tersedia'
            WHERE nomor_rab = ?
          `).bind(nomorRAB).run()
        }

        // Also revert material_gangguan status if exists (if table exists)
        try {
          await db.prepare(`
            UPDATE material_gangguan
            SET status = 'Tersedia'
            WHERE rab_id IN (
              SELECT id FROM rab WHERE nomor_rab = ?
            )
          `).bind(nomorRAB).run()
          console.log('✅ Material gangguan status also reverted')
        } catch (mgError: any) {
          // material_gangguan table might not exist or have different structure
          console.log('⚠️ Could not update material_gangguan (table may not exist):', mgError.message)
        }
        
        console.log('✅ RAB status reverted:', nomorRAB)
      }
    }

    // Delete materials first (foreign key constraint)
    await db.prepare(`
      DELETE FROM materials WHERE transaction_id = ?
    `).bind(tx.id).run()

    // Delete transaction
    await db.prepare(`
      DELETE FROM transactions WHERE nomor_ba = ?
    `).bind(nomorBA).run()

    console.log('✅ Transaction deleted:', nomorBA)

    return { 
      success: true, 
      message: 'Transaction deleted successfully',
      revertedRAB: Array.from(rabNumbers)
    }
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

// ====================================
// RAB (Rencana Anggaran Biaya) TABLE
// ====================================

export async function getNextRABNumber(db: D1Database, tanggal?: string): Promise<string> {
  try {
    const date = tanggal ? new Date(tanggal) : new Date()
    const year = date.getFullYear()
    
    // Get last RAB number for current year
    const result = await db.prepare(`
      SELECT nomor_rab 
      FROM rab 
      WHERE nomor_rab LIKE 'RAB-${year}-%'
      ORDER BY created_at DESC 
      LIMIT 1
    `).first()
    
    if (!result || !result.nomor_rab) {
      return `RAB-${year}-0001`
    }
    
    // Extract number from RAB-YYYY-NNNN
    const parts = (result.nomor_rab as string).split('-')
    const lastNumber = parseInt(parts[2] || '0')
    const nextNumber = lastNumber + 1
    
    return `RAB-${year}-${nextNumber.toString().padStart(4, '0')}`
  } catch (error) {
    console.error('Error generating RAB number:', error)
    const year = tanggal ? new Date(tanggal).getFullYear() : new Date().getFullYear()
    return `RAB-${year}-0001`
  }
}

export async function saveRAB(db: D1Database, data: any) {
  try {
    console.log('💾 Saving RAB:', data)
    
    // Generate nomor RAB
    const nomorRAB = await getNextRABNumber(db, data.tanggal_rab)
    
    // Calculate total harga from items
    const totalHarga = data.items.reduce((sum: number, item: any) => sum + item.subtotal, 0)
    
    // Insert RAB header
    const rabResult = await db.prepare(`
      INSERT INTO rab (nomor_rab, tanggal_rab, total_harga, status, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      nomorRAB,
      data.tanggal_rab,
      totalHarga,
      data.status || 'Draft',
      data.created_by || 'System'
    ).run()
    
    const rabId = rabResult.meta.last_row_id
    console.log('✅ RAB header saved with ID:', rabId, 'Nomor:', nomorRAB)
    
    // Insert RAB items and mark material as RAB created
    for (const item of data.items) {
      // Insert RAB item
      await db.prepare(`
        INSERT INTO rab_items (
          rab_id, nomor_lh05, part_number, material, mesin, jumlah, unit_uld, harga_satuan, subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        rabId,
        item.nomor_lh05,
        item.part_number,
        item.material,
        item.mesin || '',
        item.jumlah,
        item.unit_uld || '',
        item.harga_satuan,
        item.subtotal
      ).run()
      
      // Mark material_gangguan as RAB created (using material_gangguan_id if available, or find by part_number + nomor_lh05)
      if (item.material_gangguan_id) {
        await db.prepare(`
          UPDATE material_gangguan 
          SET is_rab_created = 1 
          WHERE id = ?
        `).bind(item.material_gangguan_id).run()
      } else {
        // Fallback: find by nomor_lh05 and part_number
        await db.prepare(`
          UPDATE material_gangguan 
          SET is_rab_created = 1 
          WHERE part_number = ? 
          AND gangguan_id IN (SELECT id FROM gangguan WHERE nomor_lh05 = ?)
        `).bind(item.part_number, item.nomor_lh05).run()
      }
    }
    
    console.log(`✅ ${data.items.length} RAB items saved and materials marked as RAB created`)
    
    return {
      success: true,
      id: rabId,
      nomor_rab: nomorRAB,
      total_harga: totalHarga
    }
  } catch (error: any) {
    console.error('Failed to save RAB:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

export async function getAllRAB(db: D1Database) {
  try {
    const result = await db.prepare(`
      SELECT 
        r.id,
        r.nomor_rab,
        r.tanggal_rab,
        r.total_harga,
        r.status,
        r.created_by,
        r.created_at,
        COUNT(ri.id) as item_count
      FROM rab r
      LEFT JOIN rab_items ri ON r.id = ri.rab_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `).all()
    
    return result.results || []
  } catch (error) {
    console.error('Failed to get RAB list:', error)
    return []
  }
}

export async function getRABById(db: D1Database, rabId: number) {
  try {
    // Get RAB header
    const rab = await db.prepare(`
      SELECT * FROM rab WHERE id = ?
    `).bind(rabId).first()
    
    if (!rab) {
      return null
    }
    
    // Get RAB items
    const items = await db.prepare(`
      SELECT * FROM rab_items WHERE rab_id = ? ORDER BY id
    `).bind(rabId).all()
    
    return {
      ...rab,
      items: items.results || []
    }
  } catch (error) {
    console.error('Failed to get RAB by ID:', error)
    return null
  }
}

export async function getMaterialPengadaan(db: D1Database) {
  try {
    const result = await db.prepare(`
      SELECT 
        mg.id,
        mg.gangguan_id,
        g.nomor_lh05,
        mg.part_number,
        mg.material,
        mg.mesin,
        mg.jumlah,
        mg.unit_uld as lokasi_tujuan,
        mg.status,
        mg.is_rab_created,
        mg.sn_mesin
      FROM material_gangguan mg
      JOIN gangguan g ON mg.gangguan_id = g.id
      WHERE UPPER(mg.status) = 'PENGADAAN'
      AND (mg.is_rab_created IS NULL OR mg.is_rab_created = 0)
      ORDER BY g.created_at DESC
    `).all()
    
    return result.results || []
  } catch (error) {
    console.error('Failed to get material pengadaan:', error)
    return []
  }
}
