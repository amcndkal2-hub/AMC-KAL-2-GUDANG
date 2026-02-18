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
    
    // Try inserting with BOTH jenis_pengeluaran AND from_lh05 columns
    try {
      const txResult = await db.prepare(`
        INSERT INTO transactions (nomor_ba, tanggal, jenis_transaksi, jenis_pengeluaran, lokasi_asal, lokasi_tujuan, pemeriksa, penerima, ttd_pemeriksa, ttd_penerima, from_lh05)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.nomorBA,
        data.tanggal,
        data.jenisTransaksi,
        data.jenisPengeluaran || null,
        data.lokasiAsal,
        data.lokasiTujuan,
        data.pemeriksa,
        data.penerima,
        data.ttdPemeriksa,
        data.ttdPenerima,
        data.fromLH05 || null
      ).run()
      
      transactionId = txResult.meta.last_row_id
      console.log('✅ Transaction saved with jenis_pengeluaran + from_lh05 columns')
    } catch (columnError: any) {
      console.log('⚠️ Column error, trying fallbacks...', columnError.message)
      
      // Fallback Level 1: Try with from_lh05 only (no jenis_pengeluaran)
      if (columnError.message && columnError.message.includes('jenis_pengeluaran')) {
        console.log('⚠️ jenis_pengeluaran column not found, trying with from_lh05 only')
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
          console.log('✅ Transaction saved with from_lh05 only (no jenis_pengeluaran)')
        } catch (secondError: any) {
          // Fallback Level 2: No jenis_pengeluaran, no from_lh05 (original schema)
          if (secondError.message && secondError.message.includes('from_lh05')) {
            console.log('⚠️ from_lh05 also not found, using original schema')
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
            console.log('✅ Transaction saved with original schema (no extra columns)')
          } else {
            throw secondError
          }
        }
      } 
      // Fallback for from_lh05 missing but jenis_pengeluaran exists
      else if (columnError.message && columnError.message.includes('from_lh05')) {
        console.log('⚠️ from_lh05 column not found, using jenis_pengeluaran only')
        const txResult = await db.prepare(`
          INSERT INTO transactions (nomor_ba, tanggal, jenis_transaksi, jenis_pengeluaran, lokasi_asal, lokasi_tujuan, pemeriksa, penerima, ttd_pemeriksa, ttd_penerima)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          data.nomorBA,
          data.tanggal,
          data.jenisTransaksi,
          data.jenisPengeluaran || null,
          data.lokasiAsal,
          data.lokasiTujuan,
          data.pemeriksa,
          data.penerima,
          data.ttdPemeriksa,
          data.ttdPenerima
        ).run()
        
        transactionId = txResult.meta.last_row_id
        console.log('✅ Transaction saved with jenis_pengeluaran only (no from_lh05)')
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
          material.status || material.snMesin || material.sn_mesin || 'N/A',  // Prioritize status field (renamed from snMesin)
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
            material.status || material.snMesin || material.sn_mesin || 'N/A',
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
    // Level 1: Try with jenis_pengeluaran + status columns (latest schema)
    try {
      console.log('🔍 Trying Level 1: WITH jenis_pengeluaran + status')
      const { results } = await db.prepare(`
        SELECT 
          t.id, t.nomor_ba, t.tanggal, t.jenis_transaksi, t.jenis_pengeluaran,
          t.lokasi_asal, t.lokasi_tujuan, t.pemeriksa, t.penerima,
          t.ttd_pemeriksa, t.ttd_penerima, t.from_lh05, t.created_at, t.updated_at,
          json_group_array(
            json_object(
              'partNumber', m.part_number,
              'jenisBarang', m.jenis_barang,
              'material', m.material,
              'mesin', m.mesin,
              'status', m.status,
              'snMesin', m.status,
              'sn_mesin', m.status,
              'jumlah', m.jumlah
            )
          ) as materials
        FROM transactions t
        LEFT JOIN materials m ON t.id = m.transaction_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `).all()

      console.log(`✅ Level 1 SUCCESS: Retrieved ${results.length} transactions`)
      return results.map((tx: any) => {
        let materials = []
        try {
          materials = JSON.parse(tx.materials || '[]')
          materials = materials.filter((m: any) => m.partNumber !== null)
        } catch (parseError) {
          console.error('Failed to parse materials for transaction:', tx.nomor_ba, parseError)
          materials = []
        }
        
        return { ...tx, materials }
      })
    } catch (level1Error: any) {
      const errorMsg = level1Error.message || level1Error.toString() || ''
      console.log('❌ Level 1 FAILED:', errorMsg)
      
      // Level 2: Try without jenis_pengeluaran (if column missing)
      if (errorMsg.includes('jenis_pengeluaran') || errorMsg.includes('no such column')) {
        try {
          console.log('🔍 Trying Level 2: WITHOUT jenis_pengeluaran')
          const { results } = await db.prepare(`
            SELECT 
              t.id, t.nomor_ba, t.tanggal, t.jenis_transaksi,
              t.lokasi_asal, t.lokasi_tujuan, t.pemeriksa, t.penerima,
              t.ttd_pemeriksa, t.ttd_penerima, t.from_lh05, t.created_at, t.updated_at,
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

          console.log(`✅ Level 2 SUCCESS: Retrieved ${results.length} transactions`)
          return results.map((tx: any) => {
            let materials = []
            try {
              materials = JSON.parse(tx.materials || '[]')
              materials = materials.filter((m: any) => m.partNumber !== null)
            } catch (parseError) {
              console.error('Failed to parse materials for transaction:', tx.nomor_ba, parseError)
              materials = []
            }
            
            return { ...tx, materials }
          })
        } catch (level2Error: any) {
          const level2ErrorMsg = level2Error.message || level2Error.toString() || ''
          console.log('❌ Level 2 FAILED:', level2ErrorMsg)
          
          // Level 3: Fallback to sn_mesin if status column also doesn't exist
          try {
            console.log('🔍 Trying Level 3: WITH sn_mesin instead of status')
            const { results } = await db.prepare(`
              SELECT 
                t.id, t.nomor_ba, t.tanggal, t.jenis_transaksi,
                t.lokasi_asal, t.lokasi_tujuan, t.pemeriksa, t.penerima,
                t.ttd_pemeriksa, t.ttd_penerima, t.from_lh05, t.created_at, t.updated_at,
                json_group_array(
                  json_object(
                    'partNumber', m.part_number,
                    'jenisBarang', m.jenis_barang,
                    'material', m.material,
                    'mesin', m.mesin,
                    'status', m.sn_mesin,
                    'snMesin', m.sn_mesin,
                    'sn_mesin', m.sn_mesin,
                    'jumlah', m.jumlah
                  )
                ) as materials
              FROM transactions t
              LEFT JOIN materials m ON t.id = m.transaction_id
              GROUP BY t.id
              ORDER BY t.created_at DESC
            `).all()

            console.log(`✅ Level 3 SUCCESS: Retrieved ${results.length} transactions`)
            return results.map((tx: any) => {
              let materials = []
              try {
                materials = JSON.parse(tx.materials || '[]')
                materials = materials.filter((m: any) => m.partNumber !== null)
              } catch (parseError) {
                console.error('Failed to parse materials for transaction:', tx.nomor_ba, parseError)
                materials = []
              }
              
              return { ...tx, materials }
            })
          } catch (level3Error: any) {
            const level3ErrorMsg = level3Error.message || level3Error.toString() || ''
            console.log('❌ Level 3 FAILED:', level3ErrorMsg)
            
            // Level 4: ORIGINAL SCHEMA (no from_lh05, no jenis_pengeluaran, use sn_mesin)
            try {
              console.log('🔍 Trying Level 4: ORIGINAL SCHEMA (no extra columns)')
              const { results } = await db.prepare(`
                SELECT 
                  t.id, t.nomor_ba, t.tanggal, t.jenis_transaksi,
                  t.lokasi_asal, t.lokasi_tujuan, t.pemeriksa, t.penerima,
                  t.ttd_pemeriksa, t.ttd_penerima, t.created_at, t.updated_at,
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

              console.log(`✅ Level 4 SUCCESS: Retrieved ${results.length} transactions`)             
              return results.map((tx: any) => {
                let materials = []
                try {
                  materials = JSON.parse(tx.materials || '[]')
                  materials = materials.filter((m: any) => m.partNumber !== null)
                } catch (parseError) {
                  console.error('Failed to parse materials for transaction:', tx.nomor_ba, parseError)
                  materials = []
                }
                
                return { ...tx, materials }
              })
            } catch (level4Error: any) {
              console.error('❌ ALL LEVELS FAILED! Level 4 error:', level4Error)
              throw level4Error
            }
          }
        }
      } else {
        // If error is not about jenis_pengeluaran, try Level 3 directly
        console.log('🔍 Error not about jenis_pengeluaran, trying Level 3 directly')
        try {
          const { results } = await db.prepare(`
            SELECT 
              t.id, t.nomor_ba, t.tanggal, t.jenis_transaksi,
              t.lokasi_asal, t.lokasi_tujuan, t.pemeriksa, t.penerima,
              t.ttd_pemeriksa, t.ttd_penerima, t.from_lh05, t.created_at, t.updated_at,
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

          console.log(`✅ Level 3 (direct) SUCCESS: Retrieved ${results.length} transactions`)
          return results.map((tx: any) => {
            let materials = []
            try {
              materials = JSON.parse(tx.materials || '[]')
              materials = materials.filter((m: any) => m.partNumber !== null)
            } catch (parseError) {
              console.error('Failed to parse materials for transaction:', tx.nomor_ba, parseError)
              materials = []
            }
            
            return { ...tx, materials }
          })
        } catch (directLevel3Error: any) {
          const directLevel3ErrorMsg = directLevel3Error.message || directLevel3Error.toString() || ''
          console.log('❌ Direct Level 3 FAILED:', directLevel3ErrorMsg)
          
          // Try Level 4: ORIGINAL SCHEMA (no from_lh05, no jenis_pengeluaran)
          try {
            console.log('🔍 Trying Level 4: ORIGINAL SCHEMA (final fallback)')
            const { results } = await db.prepare(`
              SELECT 
                t.id, t.nomor_ba, t.tanggal, t.jenis_transaksi,
                t.lokasi_asal, t.lokasi_tujuan, t.pemeriksa, t.penerima,
                t.ttd_pemeriksa, t.ttd_penerima, t.created_at, t.updated_at,
                json_group_array(
                  json_object(
                    'partNumber', m.part_number,
                    'jenisBarang', m.jenis_barang,
                    'material', m.material,
                    'mesin', m.mesin,
                    'status', m.sn_mesin,
                    'snMesin', m.sn_mesin,
                    'sn_mesin', m.sn_mesin,
                    'jumlah', m.jumlah
                  )
                ) as materials
              FROM transactions t
              LEFT JOIN materials m ON t.id = m.transaction_id
              GROUP BY t.id
              ORDER BY t.created_at DESC
            `).all()

            console.log(`✅ Level 4 (final) SUCCESS: Retrieved ${results.length} transactions`)
            return results.map((tx: any) => {
              let materials = []
              try {
                materials = JSON.parse(tx.materials || '[]')
                materials = materials.filter((m: any) => m.partNumber !== null)
              } catch (parseError) {
                console.error('Failed to parse materials for transaction:', tx.nomor_ba, parseError)
                materials = []
              }
              
              return { ...tx, materials }
            })
          } catch (finalError) {
            console.error('❌ Final fallback (Level 4) also failed:', finalError)
            throw level1Error
          }
        }
      }
    }
  } catch (error: any) {
    console.error('❌ getAllTransactions COMPLETE FAILURE:', error)
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
              'snMesin', m.status,
              'sn_mesin', m.status,
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
      try {
        // Try INSERT with sn_mesin column
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
      } catch (columnError: any) {
        // Fallback: INSERT without sn_mesin if column doesn't exist
        // Store S/N Mesin in status field with prefix "SN:" if provided
        console.log('⚠️ sn_mesin column not found in INSERT, using fallback with status field')
        const snMesin = material.snMesin || material.sn_mesin || ''
        const statusValue = snMesin ? `SN:${snMesin}` : (material.status || 'N/A')
        
        await db.prepare(`
          INSERT INTO material_gangguan (gangguan_id, part_number, material, mesin, jumlah, status, unit_uld, lokasi_tujuan)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          gangguanId,
          material.partNumber,
          material.material,
          material.mesin,
          material.jumlah,
          statusValue,
          data.unitULD,
          data.unitULD
        ).run()
      }
    }

    return { success: true, id: gangguanId, nomorLH05: data.nomorLH05 }
  } catch (error: any) {
    console.error('Failed to save gangguan:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

// RECOVERY FUNCTION: Get gangguan from material_gangguan (when gangguan table is empty/corrupted)
export async function getAllGangguanFromMaterials(db: D1Database) {
  try {
    // Get unique gangguan_id from material_gangguan
    const { results: gangguanIds } = await db.prepare(`
      SELECT DISTINCT gangguan_id
      FROM material_gangguan
      ORDER BY gangguan_id ASC
    `).all()
    
    console.log(`📦 Found ${gangguanIds.length} unique gangguan IDs in material_gangguan`)
    
    // For each gangguan_id, construct a gangguan record with materials
    const gangguanList: any[] = []
    
    for (const row of gangguanIds as any[]) {
      const gangguanId = row.gangguan_id
      
      // Get materials for this gangguan_id
      const { results: materials } = await db.prepare(`
        SELECT 
          mg.*,
          COALESCE(mm.JENIS_BARANG, 'Material Handal') as jenis_barang
        FROM material_gangguan mg
        LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
        WHERE mg.gangguan_id = ?
        ORDER BY mg.id ASC
      `).bind(gangguanId).all()
      
      // Get first material's metadata
      const firstMaterial = materials[0] as any
      
      // Construct gangguan record
      const gangguan = {
        id: gangguanId,
        nomor_lh05: `${String(gangguanId).padStart(4, '0')}/ND KAL 2/LH05/2026`,
        tanggal_laporan: firstMaterial?.created_at?.split(' ')[0] || new Date().toISOString().split('T')[0],
        jenis_gangguan: 'RECOVERED',
        lokasi_gangguan: firstMaterial?.unit_uld || firstMaterial?.lokasi_tujuan || 'UNKNOWN',
        user_laporan: 'Data Recovery',
        status: 'Open',
        catatan_tindakan: 'Recovered from material_gangguan',
        rencana_perbaikan: 'Data needs manual review',
        ttd_teknisi: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ttd_supervisor: '',
        created_at: firstMaterial?.created_at || new Date().toISOString(),
        updated_at: firstMaterial?.updated_at || firstMaterial?.created_at || new Date().toISOString(),
        // Recovery: Try to populate with real data if available
        komponen_rusak: firstMaterial?.komponen_rusak || null,
        gejala: firstMaterial?.gejala || null,
        uraian_kejadian: firstMaterial?.uraian_kejadian || null,
        analisa_penyebab: firstMaterial?.analisa_penyebab || null,
        kesimpulan: firstMaterial?.kesimpulan || null,
        beban_puncak: 0,
        daya_mampu: 0,
        pemadaman: 'NORMAL',
        kelompok_spd: 'MEKANIK',
        materials: materials.map((m: any) => {
          // Extract S/N from status field if sn_mesin is null
          let snMesinValue = m.sn_mesin
          if (!snMesinValue && m.status) {
            const snMatch = m.status.match(/^SN:(.+)$/)
            if (snMatch) {
              snMesinValue = snMatch[1]
            }
          }
          
          return {
            id: m.id,
            partNumber: m.part_number,
            material: m.material,
            mesin: m.mesin,
            jumlah: m.jumlah,
            status: m.status,
            snMesin: snMesinValue, // Clean S/N without "SN:" prefix
            unitULD: m.unit_uld,
            lokasiTujuan: m.lokasi_tujuan,
            jenisBarang: m.jenis_barang
          }
        })
      }
      
      gangguanList.push(gangguan)
    }
    
    console.log(`✅ Recovered ${gangguanList.length} gangguan records from materials`)
    return gangguanList
    
  } catch (error: any) {
    console.error('❌ Failed to recover gangguan from materials:', error)
    return []
  }
}

// RECOVERY FUNCTION: Get single gangguan by LH05 from material_gangguan
export async function getGangguanByLH05FromMaterials(db: D1Database, nomorLH05: string) {
  try {
    // Extract gangguan_id from nomor_lh05 format: "0143/ND KAL 2/LH05/2026" -> 143
    const match = nomorLH05.match(/^(\d+)\//)
    if (!match) {
      console.log(`❌ Invalid LH05 format: ${nomorLH05}`)
      return null
    }
    
    const gangguanId = parseInt(match[1])
    console.log(`🔍 Recovering gangguan ID ${gangguanId} from materials...`)
    
    // Get materials for this gangguan_id
    const { results: materials } = await db.prepare(`
      SELECT 
        mg.*,
        COALESCE(mm.JENIS_BARANG, 'Material Handal') as jenis_barang
      FROM material_gangguan mg
      LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
      WHERE mg.gangguan_id = ?
      ORDER BY mg.id ASC
    `).bind(gangguanId).all()
    
    if (materials.length === 0) {
      console.log(`❌ No materials found for gangguan ID ${gangguanId}`)
      return null
    }
    
    // Get first material's metadata
    const firstMaterial = materials[0] as any
    
    // Construct gangguan record
    const gangguan = {
      id: gangguanId,
      nomor_lh05: nomorLH05,
      tanggal_laporan: firstMaterial?.created_at?.split(' ')[0] || new Date().toISOString().split('T')[0],
      jenis_gangguan: 'RECOVERED',
      lokasi_gangguan: firstMaterial?.unit_uld || firstMaterial?.lokasi_tujuan || 'UNKNOWN',
      user_laporan: 'Data Recovery',
      status: 'Open',
      catatan_tindakan: 'Recovered from material_gangguan',
      rencana_perbaikan: 'Data needs manual review',
      ttd_teknisi: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      ttd_supervisor: '',
      created_at: firstMaterial?.created_at || new Date().toISOString(),
      updated_at: firstMaterial?.updated_at || firstMaterial?.created_at || new Date().toISOString(),
      // Recovery: Try to populate with real data if available
      komponen_rusak: firstMaterial?.komponen_rusak || null,
      gejala: firstMaterial?.gejala || null,
      uraian_kejadian: firstMaterial?.uraian_kejadian || null,
      analisa_penyebab: firstMaterial?.analisa_penyebab || null,
      kesimpulan: firstMaterial?.kesimpulan || null,
      beban_puncak: 0,
      daya_mampu: 0,
      pemadaman: 'NORMAL',
      kelompok_spd: 'MEKANIK',
      materials: materials.map((m: any) => {
        // Extract S/N from status field if sn_mesin is null
        let snMesinValue = m.sn_mesin
        if (!snMesinValue && m.status) {
          const snMatch = m.status.match(/^SN:(.+)$/)
          if (snMatch) {
            snMesinValue = snMatch[1]
          }
        }
        
        return {
          id: m.id,
          partNumber: m.part_number,
          material: m.material,
          mesin: m.mesin,
          jumlah: m.jumlah,
          status: m.status,
          snMesin: snMesinValue, // Clean S/N without "SN:" prefix
          unitULD: m.unit_uld,
          lokasiTujuan: m.lokasi_tujuan,
          jenisBarang: m.jenis_barang
        }
      })
    }
    
    console.log(`✅ Recovered gangguan ${nomorLH05} with ${materials.length} materials`)
    return gangguan
    
  } catch (error: any) {
    console.error(`❌ Failed to recover gangguan ${nomorLH05}:`, error)
    return null
  }
}

export async function getAllGangguan(db: D1Database) {
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
            'snMesin', mg.sn_mesin,
            'unitULD', mg.unit_uld,
            'lokasiTujuan', mg.lokasi_tujuan,
            'jenisBarang', COALESCE(mm.JENIS_BARANG, 'Material Handal')
          )
        ) as materials
      FROM gangguan g
      LEFT JOIN material_gangguan mg ON g.id = mg.gangguan_id
      LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `).all()

    return results.map((g: any) => {
      const rawMaterials = JSON.parse(g.materials).filter((m: any) => m.id !== null)
      
      // DEDUPLICATE: Remove duplicate materials based on part_number + snMesin
      // This allows same part number but different S/N to coexist
      // Keep the one with highest id (latest insert) only for exact duplicates
      const uniqueMaterialsMap = new Map()
      rawMaterials.forEach((mat: any) => {
        // Create unique key combining part_number and sn_mesin (or status as fallback)
        const uniqueKey = `${mat.partNumber || ''}_${mat.snMesin || mat.status || ''}`
        const existing = uniqueMaterialsMap.get(uniqueKey)
        if (!existing || mat.id > existing.id) {
          uniqueMaterialsMap.set(uniqueKey, mat)
        }
      })
      const materials = Array.from(uniqueMaterialsMap.values())
      
      return {
        ...g,
        materials: materials
      }
    })
  } catch (error: any) {
    console.error('Failed to get gangguan:', error)
    return []
  }
}

export async function getGangguanByLH05(db: D1Database, nomorLH05: string) {
  try {
    // Try with BOTH sn_mesin AND is_issued columns (if migration applied)
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
              'snMesin', mg.sn_mesin,
              'jenisBarang', COALESCE(mm.JENIS_BARANG, 'Material Handal')
            )
          ) as materials
        FROM gangguan g
        LEFT JOIN material_gangguan mg ON g.id = mg.gangguan_id 
          AND (mg.is_issued IS NULL OR mg.is_issued = 0)
        LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
        WHERE g.nomor_lh05 = ?
        GROUP BY g.id
      `).bind(nomorLH05).all()

      if (results.length === 0) return null

      const g: any = results[0]
      const rawMaterials = JSON.parse(g.materials).filter((m: any) => m.id !== null)
      
      // DEDUPLICATE: Remove duplicate materials based on part_number + snMesin
      // This allows same part number but different S/N to coexist
      // Keep the one with highest id (latest insert) only for exact duplicates
      const uniqueMaterialsMap = new Map()
      rawMaterials.forEach((mat: any) => {
        // Create unique key combining part_number and sn_mesin (or status as fallback)
        const uniqueKey = `${mat.partNumber || ''}_${mat.snMesin || mat.status || ''}`
        const existing = uniqueMaterialsMap.get(uniqueKey)
        if (!existing || mat.id > existing.id) {
          uniqueMaterialsMap.set(uniqueKey, mat)
        }
      })
      const materials = Array.from(uniqueMaterialsMap.values())
      
      return {
        ...g,
        materials: materials
      }
    } catch (columnError: any) {
      // Fallback 1: Try without is_issued but with sn_mesin
      console.log('⚠️ is_issued column not found, trying without it')
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
                'snMesin', mg.sn_mesin,
                'jenisBarang', COALESCE(mm.JENIS_BARANG, 'Material Handal')
              )
            ) as materials
          FROM gangguan g
          LEFT JOIN material_gangguan mg ON g.id = mg.gangguan_id
          LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
          WHERE g.nomor_lh05 = ?
          GROUP BY g.id
        `).bind(nomorLH05).all()

        if (results.length === 0) return null

        const g: any = results[0]
        const rawMaterials = JSON.parse(g.materials).filter((m: any) => m.id !== null)
        
        // DEDUPLICATE: Remove duplicate materials based on part_number
        // Keep the one with highest id (latest insert)
        const uniqueMaterialsMap = new Map()
        rawMaterials.forEach((mat: any) => {
          const existing = uniqueMaterialsMap.get(mat.partNumber)
          if (!existing || mat.id > existing.id) {
            uniqueMaterialsMap.set(mat.partNumber, mat)
          }
        })
        const materials = Array.from(uniqueMaterialsMap.values())
        
        return {
          ...g,
          materials: materials
        }
      } catch (snMesinError: any) {
        // Fallback 2: Query without BOTH sn_mesin AND is_issued
        console.log('⚠️ sn_mesin column also not found, using basic query')
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
              'jenisBarang', COALESCE(mm.JENIS_BARANG, 'Material Handal')
            )
          ) as materials
        FROM gangguan g
        LEFT JOIN material_gangguan mg ON g.id = mg.gangguan_id
        LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
        WHERE g.nomor_lh05 = ?
        GROUP BY g.id
      `).bind(nomorLH05).all()

      if (results.length === 0) return null

      const g: any = results[0]
      const rawMaterials = JSON.parse(g.materials).filter((m: any) => m.id !== null)
      
      // Parse S/N Mesin from status field (format: "SN:serial_number")
      // Only for backward compatibility with old data
      const parsedMaterials = rawMaterials.map((mat: any) => {
        // If status starts with "SN:", extract serial number and reset status to N/A
        if (mat.status && mat.status.startsWith('SN:')) {
          return {
            ...mat,
            snMesin: mat.status.substring(3), // Extract S/N after "SN:"
            status: 'N/A' // Reset status to default for old SN format
          }
        }
        // Keep valid status values unchanged (Pengadaan, Tersedia, Terkirim, Tunda, Reject, N/A)
        return { ...mat, snMesin: null }
      })
      
      // DEDUPLICATE: Remove duplicate materials based on part_number
      // Keep the one with highest id (latest insert)
      const uniqueMaterialsMap = new Map()
      parsedMaterials.forEach((mat: any) => {
        const existing = uniqueMaterialsMap.get(mat.partNumber)
        if (!existing || mat.id > existing.id) {
          uniqueMaterialsMap.set(mat.partNumber, mat)
        }
      })
      const materials = Array.from(uniqueMaterialsMap.values())
      
      return {
        ...g,
        materials: materials
      }
      }
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
        g.status as gangguan_status,
        COALESCE(mm.JENIS_BARANG, 'Material Handal') as jenis_barang
      FROM material_gangguan mg
      JOIN gangguan g ON mg.gangguan_id = g.id
      LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
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
    // Try with jenis_rab column first
    try {
      const rabResult = await db.prepare(`
        INSERT INTO rab (nomor_rab, tanggal_rab, jenis_rab, total_harga, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        nomorRAB,
        data.tanggal_rab,
        data.jenis_rab || null,
        totalHarga,
        data.status || 'Draft',
        data.created_by || 'System'
      ).run()
      
      const rabId = rabResult.meta.last_row_id
      console.log('✅ RAB header saved with ID:', rabId, 'Nomor:', nomorRAB, 'Jenis:', data.jenis_rab)
      
      return await insertRABItems(db, rabId, nomorRAB, totalHarga, data.items)
    } catch (columnError: any) {
      // Fallback: INSERT without jenis_rab if column doesn't exist
      console.log('⚠️ jenis_rab column not found, using fallback INSERT')
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
      
      return await insertRABItems(db, rabId, nomorRAB, totalHarga, data.items)
    }
  } catch (error: any) {
    console.error('Failed to save RAB:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

// Helper function to insert RAB items
async function insertRABItems(db: D1Database, rabId: number, nomorRAB: string, totalHarga: number, items: any[]) {
  try {
    
    // Insert RAB items and mark material as RAB created
    for (const item of items) {
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
    
    console.log(`✅ ${items.length} RAB items saved and materials marked as RAB created`)
    
    return {
      success: true,
      id: rabId,
      nomor_rab: nomorRAB,
      total_harga: totalHarga
    }
  } catch (error: any) {
    console.error('Failed to insert RAB items:', error)
    throw new Error(`Database error: ${error.message}`)
  }
}

export async function getAllRAB(db: D1Database) {
  try {
    // Try with jenis_rab column first
    try {
      const result = await db.prepare(`
        SELECT 
          r.id,
          r.nomor_rab,
          r.tanggal_rab,
          r.jenis_rab,
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
    } catch (columnError) {
      // Fallback: Query without jenis_rab
      console.log('⚠️ jenis_rab column not found, using fallback query')
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
    }
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
    // Try with all new columns (sn_mesin, no_po, no_grpo) and jenis_barang
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
          mg.sn_mesin,
          mg.no_po,
          mg.no_grpo,
          COALESCE(mm.JENIS_BARANG, 'Material Handal') as jenis_barang
        FROM material_gangguan mg
        JOIN gangguan g ON mg.gangguan_id = g.id
        LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
        WHERE UPPER(TRIM(mg.status)) = 'PENGADAAN'
        AND (mg.is_rab_created IS NULL OR mg.is_rab_created = 0)
        ORDER BY g.created_at DESC
      `).all()
      
      console.log('📦 getMaterialPengadaan: Found', result.results?.length || 0, 'materials')
      return result.results || []
    } catch (columnError) {
      // Fallback: Query without new columns
      console.log('⚠️ New columns not found in getMaterialPengadaan, using fallback')
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
          COALESCE(mm.JENIS_BARANG, 'Material Handal') as jenis_barang
        FROM material_gangguan mg
        JOIN gangguan g ON mg.gangguan_id = g.id
        LEFT JOIN master_material mm ON mg.part_number = mm.PART_NUMBER
        WHERE UPPER(TRIM(mg.status)) = 'PENGADAAN'
        AND (mg.is_rab_created IS NULL OR mg.is_rab_created = 0)
        ORDER BY g.created_at DESC
      `).all()
      
      console.log('📦 getMaterialPengadaan (fallback): Found', result.results?.length || 0, 'materials')
      return result.results || []
    }
  } catch (error) {
    console.error('Failed to get material pengadaan:', error)
    return []
  }
}
