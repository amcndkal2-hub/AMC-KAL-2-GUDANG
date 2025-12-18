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

    // Insert materials
    for (const material of data.materials) {
      await db.prepare(`
        INSERT INTO materials (transaction_id, part_number, jenis_barang, material, mesin, sn_mesin, jumlah)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        transactionId,
        material.partNumber,
        material.jenisBarang,
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
    // Insert gangguan
    const gangguanResult = await db.prepare(`
      INSERT INTO gangguan (nomor_lh05, tanggal_laporan, jenis_gangguan, lokasi_gangguan, user_laporan, status, catatan_tindakan, rencana_perbaikan, ttd_teknisi, ttd_supervisor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.nomorLH05,
      data.hariTanggal,
      data.komponenRusak,
      data.unitULD,
      data.namaPelapor,
      'Open',
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

export async function getNextBANumber(db: D1Database) {
  try {
    const { results } = await db.prepare(`
      SELECT nomor_ba FROM transactions ORDER BY created_at DESC LIMIT 1
    `).all()

    if (results.length === 0) {
      return 'BA-2025-0001'
    }

    const lastBA: any = results[0]
    const lastNumber = parseInt(lastBA.nomor_ba.split('-')[2])
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
    return `BA-2025-${nextNumber}`
  } catch (error) {
    return 'BA-2025-0001'
  }
}

export async function getNextLH05Number(db: D1Database) {
  try {
    const { results } = await db.prepare(`
      SELECT nomor_lh05 FROM gangguan ORDER BY created_at DESC LIMIT 1
    `).all()

    if (results.length === 0) {
      return '0001/ND KAL 2/LH05/2025'
    }

    const lastLH05: any = results[0]
    const lastNumber = parseInt(lastLH05.nomor_lh05.split('/')[0])
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
    return `${nextNumber}/ND KAL 2/LH05/2025`
  } catch (error) {
    return '0001/ND KAL 2/LH05/2025'
  }
}
