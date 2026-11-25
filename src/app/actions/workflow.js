'use server';

import pool from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const quantities = new Map();
  for (const item of items) {
    const productId = Number(item?.product_id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      return null;
    }
    const total = (quantities.get(productId) || 0) + quantity;
    if (!Number.isSafeInteger(total)) return null;
    quantities.set(productId, total);
  }
  return [...quantities]
    .sort(([firstId], [secondId]) => firstId - secondId)
    .map(([product_id, quantity]) => ({ product_id, quantity }));
}

// ==================== RESTOCK ORDERS / PO ====================
export async function getRestockOrders() {
  const session = await getSession();
  if (!session) return [];

  let query = `
    SELECT ro.*,
      s.company_name AS supplier_company,
      s.username AS supplier_name,
      u.username AS created_by_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'product_id', roi.product_id,
          'product_name', p.name,
          'sku', p.sku,
          'unit', p.unit,
          'quantity', roi.quantity
        ))
        FROM restock_order_items roi
        JOIN products p ON p.id = roi.product_id
        WHERE roi.restock_order_id = ro.id), '[]'::json
      ) AS items,
      (SELECT json_build_object(
          'id', r.id,
          'result', r.result,
          'notes', r.notes,
          'created_at', r.created_at,
          'created_by_name', ru.username,
          'items', COALESCE((
            SELECT json_agg(json_build_object(
              'product_id', ri.product_id,
              'product_name', rp.name,
              'sku', rp.sku,
              'unit', rp.unit,
              'quantity_received', ri.quantity_received,
              'item_condition', ri.item_condition
            ) ORDER BY ri.id)
            FROM inspection_report_items ri
            JOIN products rp ON rp.id = ri.product_id
            WHERE ri.report_id = r.id
          ), '[]'::json)
        )
        FROM inspection_reports r
        JOIN users ru ON ru.id = r.created_by
        WHERE r.restock_order_id = ro.id) AS report,
      EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.restock_order_id = ro.id AND t.status != 'Rejected'
      ) AS has_active_incoming
    FROM restock_orders ro
    JOIN users s ON s.id = ro.supplier_id
    JOIN users u ON u.id = ro.created_by
  `;
  const params = [];

  if (session.role === 'supplier') {
    params.push(session.id);
    query += ` WHERE ro.supplier_id = $1`;
  } else if (session.role === 'staff_gudang') {
    // Staff hanya melihat PO yang sudah tiba (diperiksa / selesai / dikembalikan)
    query += ` WHERE ro.status IN ('Inspecting', 'Received', 'Returned')`;
  } else if (!['admin', 'warehouse_manager'].includes(session.role)) {
    return [];
  }

  query += ` ORDER BY ro.created_at DESC`;
  const res = await pool.query(query, params);
  return res.rows;
}

export async function getAvailableReceivedPOs() {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') return [];

  // PO Inspecting dengan laporan pemeriksaan 'Sesuai' yang belum dipakai transaksi Incoming aktif (selain Rejected)
  const res = await pool.query(`
    SELECT ro.id, ro.po_number, ro.supplier_id, s.company_name AS supplier_company, s.username AS supplier_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'product_id', roi.product_id,
          'product_name', p.name,
          'sku', p.sku,
          'unit', p.unit,
          'quantity', roi.quantity
        ))
        FROM restock_order_items roi
        JOIN products p ON p.id = roi.product_id
        WHERE roi.restock_order_id = ro.id), '[]'::json
      ) AS items
    FROM restock_orders ro
    JOIN users s ON s.id = ro.supplier_id
    WHERE ro.status = 'Inspecting'
      AND EXISTS (
        SELECT 1 FROM inspection_reports r
        WHERE r.restock_order_id = ro.id AND r.result = 'Sesuai'
      )
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.restock_order_id = ro.id AND t.status != 'Rejected'
      )
    ORDER BY ro.created_at DESC
  `);
  return res.rows;
}

export async function createRestockOrderAction(prevState, formData) {
  const session = await getSession();
  if (!session || session.role !== 'warehouse_manager') {
    return { error: 'Hanya Warehouse Manager yang dapat membuat Restock Order.' };
  }

  const supplier_id = Number(formData.get('supplier_id'));
  const order_date = formData.get('order_date');
  const expected_delivery_date = formData.get('expected_delivery_date');
  const notes = formData.get('notes')?.trim() || '';
  const itemsRaw = formData.get('items_json');

  let items = [];
  try {
    items = JSON.parse(itemsRaw || '[]');
  } catch {
    items = [];
  }

  items = normalizeItems(items);
  if (
    !Number.isInteger(supplier_id) ||
    supplier_id <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(order_date || '') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expected_delivery_date || '') ||
    !notes ||
    !items
  ) {
    return { error: 'Supplier, tanggal, catatan, dan minimal 1 produk wajib diisi.' };
  }
  if (expected_delivery_date < order_date) {
    return { error: 'Tanggal perkiraan tiba tidak boleh sebelum tanggal order.' };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const supplierResult = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'supplier' AND status = 'approved'`,
      [supplier_id]
    );
    if (supplierResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Supplier tidak ditemukan atau belum disetujui.' };
    }

    const idResult = await client.query(
      `SELECT nextval(pg_get_serial_sequence('restock_orders', 'id')) AS id`
    );
    const poId = Number(idResult.rows[0].id);
    const poNumber = `PO-${String(poId).padStart(6, '0')}`;

    await client.query(
      `INSERT INTO restock_orders (id, po_number, supplier_id, created_by, order_date, expected_delivery_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')`,
      [poId, poNumber, supplier_id, session.id, order_date, expected_delivery_date, notes]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO restock_order_items (restock_order_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [poId, Number(item.product_id), Number(item.quantity)]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/restock');
    revalidatePath('/dashboard');
    return { success: `Restock Order ${poNumber} berhasil dibuat.` };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal membuat Restock Order:', error);
    return { error: 'Gagal membuat Restock Order.' };
  } finally {
    client.release();
  }
}

export async function updateRestockStatusAction(orderId, newStatus, statusNotes = '') {
  const session = await getSession();
  if (!session) return { error: 'Sesi habis.' };
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Restock Order tidak valid.' };
  const note = typeof statusNotes === 'string' ? statusNotes.trim() : '';

  const orderRes = await pool.query('SELECT * FROM restock_orders WHERE id = $1', [id]);
  const order = orderRes.rows[0];
  if (!order) return { error: 'Restock Order tidak ditemukan.' };

  // Validasi hak akses & transisi status
  // Siklus: Pending -> Confirmed/Rejected -> In Transit -> Inspecting -> Received/Returned
  if (session.role === 'supplier') {
    if (order.supplier_id !== session.id) return { error: 'Akses ditolak.' };
    const supplierTransitions = {
      Pending: ['Confirmed', 'Rejected'],
      Confirmed: ['In Transit'],
    };
    if (!(supplierTransitions[order.status] || []).includes(newStatus)) {
      return { error: `Supplier tidak dapat mengubah status dari ${order.status} ke ${newStatus}.` };
    }
    if (newStatus === 'Rejected' && !note) {
      return { error: 'Catatan penolakan wajib diisi.' };
    }
  } else if (session.role === 'warehouse_manager') {
    if (order.status === 'In Transit' && newStatus === 'Inspecting') {
      // Manager memulai pemeriksaan setelah menerima bukti foto kedatangan dari Supplier
      if (!order.arrival_photo_url) {
        return { error: 'Bukti foto kedatangan belum diserahkan Supplier.' };
      }
    } else if (order.status === 'Inspecting' && newStatus === 'Returned') {
      // Barang tidak sesuai / rusak: Manager menolak penerimaan, stok tetap
      if (!note) return { error: 'Alasan pengembalian (Returned) wajib diisi.' };
      const reportRes = await pool.query(
        'SELECT result FROM inspection_reports WHERE restock_order_id = $1',
        [id]
      );
      if (!reportRes.rows[0]) {
        return { error: 'Laporan pemeriksaan dari Staff Gudang belum dibuat.' };
      }
      if (reportRes.rows[0].result !== 'Tidak Sesuai') {
        return {
          error:
            'Laporan pemeriksaan menyatakan barang sesuai. Untuk menolak penerimaan, gunakan Reject pada transaksi Barang Masuk (Incoming).',
        };
      }
    } else {
      return { error: `Perubahan status dari ${order.status} ke ${newStatus} tidak diizinkan.` };
    }
  } else {
    return { error: 'Anda tidak memiliki hak mengubah status PO.' };
  }

  const updateResult = await pool.query(
    `UPDATE restock_orders
     SET status = $1, status_notes = COALESCE(NULLIF($2, ''), status_notes)
     WHERE id = $3 AND status = $4`,
    [newStatus, note, id, order.status]
  );
  if (updateResult.rowCount === 0) return { error: 'Status PO sudah berubah. Muat ulang halaman dan coba lagi.' };

  revalidatePath('/restock');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: `Status PO ${order.po_number} diperbarui menjadi ${newStatus}.` };
}

export async function createInspectionReportAction(orderId, items, notes) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'Hanya Staff Gudang yang dapat membuat laporan pemeriksaan.' };
  }
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Restock Order tidak valid.' };
  const reportNotes = typeof notes === 'string' ? notes.trim() : '';
  if (!reportNotes) return { error: 'Catatan pemeriksaan wajib diisi.' };
  if (!Array.isArray(items) || items.length === 0) return { error: 'Data pemeriksaan produk wajib diisi.' };

  const received = new Map();
  for (const it of items) {
    const productId = Number(it?.product_id);
    const qty = Number(it?.quantity_received);
    const condition = it?.item_condition;
    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(qty) ||
      qty < 0 ||
      !['Baik', 'Rusak'].includes(condition) ||
      received.has(productId)
    ) {
      return { error: 'Data pemeriksaan tidak valid. Isi jumlah (>= 0) dan kondisi tiap produk.' };
    }
    received.set(productId, { qty, condition });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const poRes = await client.query('SELECT id, status FROM restock_orders WHERE id = $1 FOR UPDATE', [id]);
    const po = poRes.rows[0];
    if (!po || po.status !== 'Inspecting') {
      await client.query('ROLLBACK');
      return { error: 'Laporan hanya dapat dibuat untuk PO berstatus Inspecting.' };
    }
    const active = await client.query(
      `SELECT 1 FROM transactions WHERE restock_order_id = $1 AND status != 'Rejected' LIMIT 1`,
      [id]
    );
    if (active.rows.length > 0) {
      await client.query('ROLLBACK');
      return { error: 'PO ini sudah dipakai transaksi Barang Masuk aktif, laporan tidak dapat diubah.' };
    }

    const poItems = await client.query(
      'SELECT product_id, quantity FROM restock_order_items WHERE restock_order_id = $1',
      [id]
    );
    if (poItems.rows.length !== received.size) {
      await client.query('ROLLBACK');
      return { error: 'Laporan harus mencakup semua produk pada PO.' };
    }

    // Hasil dihitung otomatis: Sesuai hanya bila semua jumlah sama dan semua kondisi Baik
    let result = 'Sesuai';
    for (const row of poItems.rows) {
      const entry = received.get(row.product_id);
      if (!entry) {
        await client.query('ROLLBACK');
        return { error: 'Laporan harus mencakup semua produk pada PO.' };
      }
      if (entry.qty !== row.quantity || entry.condition !== 'Baik') result = 'Tidak Sesuai';
    }

    await client.query('DELETE FROM inspection_reports WHERE restock_order_id = $1', [id]);
    const reportRes = await client.query(
      `INSERT INTO inspection_reports (restock_order_id, created_by, result, notes)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [id, session.id, result, reportNotes]
    );
    const reportId = reportRes.rows[0].id;
    for (const [productId, entry] of received) {
      await client.query(
        `INSERT INTO inspection_report_items (report_id, product_id, quantity_received, item_condition)
         VALUES ($1, $2, $3, $4)`,
        [reportId, productId, entry.qty, entry.condition]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/restock');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return {
      success:
        result === 'Sesuai'
          ? 'Laporan pemeriksaan disimpan: barang SESUAI. Lanjutkan dengan membuat transaksi Barang Masuk.'
          : 'Laporan pemeriksaan disimpan: barang TIDAK SESUAI. Menunggu keputusan Manager.',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal menyimpan laporan pemeriksaan:', error);
    return { error: 'Gagal menyimpan laporan pemeriksaan.' };
  } finally {
    client.release();
  }
}

export async function requestRefundAction(orderId, notes) {
  const session = await getSession();
  if (!session || session.role !== 'warehouse_manager') {
    return { error: 'Hanya Warehouse Manager yang dapat mengajukan klaim refund.' };
  }
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Restock Order tidak valid.' };
  const refundNotes = typeof notes === 'string' ? notes.trim() : '';
  if (!refundNotes) return { error: 'Catatan klaim refund wajib diisi.' };

  const result = await pool.query(
    `UPDATE restock_orders
     SET refund_claimed_at = NOW(), refund_notes = $1
     WHERE id = $2 AND status = 'Returned' AND refund_claimed_at IS NULL`,
    [refundNotes, id]
  );
  if (result.rowCount === 0) {
    return { error: 'Klaim refund hanya dapat diajukan sekali untuk PO berstatus Returned.' };
  }

  revalidatePath('/restock');
  return { success: 'Klaim refund berhasil diajukan kepada Supplier.' };
}

export async function submitArrivalProofAction(orderId, photoUrl) {
  const session = await getSession();
  if (!session || session.role !== 'supplier') {
    return { error: 'Hanya Supplier yang dapat menyerahkan bukti foto kedatangan.' };
  }
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Restock Order tidak valid.' };

  const url = typeof photoUrl === 'string' ? photoUrl.trim() : '';
  if (!url) return { error: 'URL bukti foto wajib diisi.' };
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
  } catch {
    return { error: 'URL bukti foto tidak valid (harus diawali http:// atau https://).' };
  }

  const result = await pool.query(
    `UPDATE restock_orders
     SET arrival_photo_url = $1
     WHERE id = $2 AND supplier_id = $3 AND status = 'In Transit'`,
    [url, id, session.id]
  );
  if (result.rowCount === 0) {
    return { error: 'Bukti foto hanya dapat diserahkan untuk PO milik Anda yang berstatus In Transit.' };
  }

  revalidatePath('/restock');
  return { success: 'Bukti foto kedatangan berhasil diserahkan kepada Manager.' };
}

// ==================== TRANSACTIONS (INCOMING & OUTGOING) ====================
export async function getTransactions(filters = {}) {
  const session = await getSession();
  if (!session || !['admin', 'warehouse_manager', 'staff_gudang'].includes(session.role)) return [];

  const clauses = [];
  const values = [];
  if (['incoming', 'outgoing'].includes(filters.type)) {
    values.push(filters.type);
    clauses.push(`t.type = $${values.length}`);
  }
  if (['Pending', 'Approved', 'Rejected', 'Shipped'].includes(filters.status)) {
    values.push(filters.status);
    clauses.push(`t.status = $${values.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom || '')) {
    values.push(filters.dateFrom);
    clauses.push(`t.transaction_date >= $${values.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo || '')) {
    values.push(filters.dateTo);
    clauses.push(`t.transaction_date <= $${values.length}::date`);
  }
  if (filters.party?.trim()) {
    values.push(`%${filters.party.trim()}%`);
    clauses.push(
      `(s.company_name ILIKE $${values.length} OR s.username ILIKE $${values.length} OR t.customer_name ILIKE $${values.length})`
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy =
    filters.sortBy === 'date_asc'
      ? 't.transaction_date ASC, t.id ASC'
      : filters.sortBy === 'created_desc'
        ? 't.created_at DESC, t.id DESC'
        : 't.transaction_date DESC, t.id DESC';

  const res = await pool.query(`
    SELECT t.*,
      ro.po_number,
      s.company_name AS supplier_company,
      s.username AS supplier_name,
      u.username AS created_by_name,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'product_id', ti.product_id,
          'product_name', p.name,
          'sku', p.sku,
          'unit', p.unit,
          'current_stock', p.current_stock,
          'quantity', ti.quantity
        ))
        FROM transaction_items ti
        JOIN products p ON p.id = ti.product_id
        WHERE ti.transaction_id = t.id), '[]'::json
      ) AS items
    FROM transactions t
    LEFT JOIN restock_orders ro ON ro.id = t.restock_order_id
    LEFT JOIN users s ON s.id = t.supplier_id
    JOIN users u ON u.id = t.created_by
    ${where}
    ORDER BY ${orderBy}
  `, values);
  return res.rows;
}

export async function createTransactionAction(prevState, formData) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'Hanya Staff Gudang yang dapat mencatat transaksi baru.' };
  }

  const type = formData.get('type');
  const transaction_date = formData.get('transaction_date');
  const restockOrderValue = formData.get('restock_order_id');
  const restock_order_id = restockOrderValue ? Number(restockOrderValue) : null;
  let supplier_id = formData.get('supplier_id') ? Number(formData.get('supplier_id')) : null;
  const customer_name = formData.get('customer_name')?.trim() || null;
  const notes = formData.get('notes')?.trim() || '';
  const itemsRaw = formData.get('items_json');

  let items = [];
  try {
    items = JSON.parse(itemsRaw || '[]');
  } catch {
    items = [];
  }
  items = normalizeItems(items);

  if (
    !['incoming', 'outgoing'].includes(type) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date || '') ||
    !notes ||
    (type === 'outgoing' && !items) ||
    (restock_order_id !== null && (!Number.isInteger(restock_order_id) || restock_order_id <= 0))
  ) {
    return { error: 'Jenis transaksi, tanggal, catatan, dan minimal 1 produk wajib diisi.' };
  }
  if (type === 'outgoing' && restock_order_id) {
    return { error: 'Restock Order hanya dapat dipakai untuk transaksi Barang Masuk.' };
  }
  if (type === 'incoming' && !restock_order_id) {
    return { error: 'Barang Masuk wajib berdasarkan Restock Order (PO) berstatus Inspecting.' };
  }
  if (type === 'outgoing' && !customer_name) {
    return { error: 'Nama customer/tujuan wajib diisi untuk transaksi Barang Keluar.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'incoming' && restock_order_id) {
      const poResult = await client.query(
        `SELECT id, supplier_id, status
         FROM restock_orders
         WHERE id = $1
         FOR UPDATE`,
        [restock_order_id]
      );
      const order = poResult.rows[0];
      if (!order || order.status !== 'Inspecting') {
        await client.query('ROLLBACK');
        return { error: 'Restock Order harus berstatus Inspecting (sedang diperiksa).' };
      }

      const usedOrder = await client.query(
        `SELECT id
         FROM transactions
         WHERE restock_order_id = $1 AND status != 'Rejected'
         LIMIT 1`,
        [restock_order_id]
      );
      if (usedOrder.rows.length > 0) {
        await client.query('ROLLBACK');
        return { error: 'Restock Order ini sudah dipakai pada transaksi aktif lain.' };
      }
      supplier_id = order.supplier_id;

      // Laporan pemeriksaan wajib ada dan menyatakan barang Sesuai
      const reportRes = await client.query(
        'SELECT result FROM inspection_reports WHERE restock_order_id = $1',
        [restock_order_id]
      );
      if (!reportRes.rows[0]) {
        await client.query('ROLLBACK');
        return { error: 'Laporan pemeriksaan untuk PO ini belum dibuat.' };
      }
      if (reportRes.rows[0].result !== 'Sesuai') {
        await client.query('ROLLBACK');
        return {
          error:
            'Laporan pemeriksaan menyatakan barang tidak sesuai/rusak. Transaksi Barang Masuk tidak dapat dibuat; Manager akan memproses pengembalian.',
        };
      }

      // Daftar produk & kuantitas diambil otomatis dari PO (bukan dari input form)
      const poItemsRes = await client.query(
        'SELECT product_id, quantity FROM restock_order_items WHERE restock_order_id = $1 ORDER BY product_id ASC',
        [restock_order_id]
      );
      items = poItemsRes.rows.map((r) => ({ product_id: r.product_id, quantity: r.quantity }));
    }

    if (type === 'incoming') {
      const supplierResult = await client.query(
        `SELECT id
         FROM users
         WHERE id = $1 AND role = 'supplier' AND status = 'approved'`,
        [supplier_id]
      );
      if (supplierResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: 'Supplier tidak ditemukan atau belum disetujui.' };
      }
    }

    if (type === 'outgoing') {
      for (const item of items) {
        const prodRes = await client.query(
          'SELECT name, current_stock FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
        const prod = prodRes.rows[0];
        if (!prod || item.quantity > Number(prod.current_stock)) {
          await client.query('ROLLBACK');
          return { error: `Stok "${prod?.name || 'Produk'}" tidak mencukupi (tersedia: ${prod?.current_stock ?? 0}).` };
        }
      }
    }

    // Nomor transaksi otomatis & singkat, mengikuti urutan id (sama seperti nomor PO)
    // Contoh: TRX-IN-000012 / TRX-OUT-000013
    const idResult = await client.query(
      `SELECT nextval(pg_get_serial_sequence('transactions', 'id')) AS id`
    );
    const trxId = Number(idResult.rows[0].id);
    const prefix = type === 'incoming' ? 'TRX-IN' : 'TRX-OUT';
    const trxNumber = `${prefix}-${String(trxId).padStart(6, '0')}`;

    await client.query(
      `INSERT INTO transactions (id, transaction_number, type, transaction_date, restock_order_id, supplier_id, customer_name, created_by, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')`,
      [trxId, trxNumber, type, transaction_date, restock_order_id, supplier_id, customer_name, session.id, notes]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [trxId, Number(item.product_id), Number(item.quantity)]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: `Transaksi ${trxNumber} berhasil dicatat dan menunggu persetujuan Manager.` };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal menyimpan transaksi:', error);
    return { error: 'Gagal menyimpan transaksi.' };
  } finally {
    client.release();
  }
}

export async function editPendingTransactionAction(transactionId, notes, items) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'Akses ditolak.' };
  }
  const id = Number(transactionId);
  items = normalizeItems(items);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Transaksi tidak valid.' };
  if (!items) return { error: 'Minimal 1 produk dengan quantity bilangan bulat lebih dari 0 wajib diisi.' };
  const updatedNotes = typeof notes === 'string' ? notes.trim() : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trxRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    const trx = trxRes.rows[0];

    if (!trx || trx.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { error: 'Hanya transaksi berstatus Pending yang dapat diedit.' };
    }
    if (trx.created_by !== session.id) {
      await client.query('ROLLBACK');
      return { error: 'Staff hanya dapat mengedit transaksi yang dibuatnya sendiri.' };
    }

    // Barang Masuk: daftar produk & kuantitas mengikuti PO, hanya catatan yang dapat diubah
    if (trx.type === 'incoming') {
      if (!updatedNotes) {
        await client.query('ROLLBACK');
        return { error: 'Catatan wajib diisi.' };
      }
      await client.query('UPDATE transactions SET notes = $1 WHERE id = $2', [updatedNotes, id]);
      await client.query('COMMIT');
      revalidatePath('/transactions');
      return { success: 'Catatan transaksi berhasil diperbarui (produk mengikuti PO).' };
    }

    if (trx.type === 'outgoing') {
      for (const item of items) {
        const prodRes = await client.query(
          'SELECT name, current_stock FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
        const prod = prodRes.rows[0];
        if (!prod || item.quantity > Number(prod.current_stock)) {
          await client.query('ROLLBACK');
          return { error: `Stok "${prod?.name}" tidak mencukupi (tersedia: ${prod?.current_stock ?? 0}).` };
        }
      }
    }

    await client.query('UPDATE transactions SET notes = $1 WHERE id = $2', [updatedNotes, id]);
    await client.query('DELETE FROM transaction_items WHERE transaction_id = $1', [id]);

    for (const item of items) {
      await client.query(
        'INSERT INTO transaction_items (transaction_id, product_id, quantity) VALUES ($1, $2, $3)',
        [id, item.product_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/transactions');
    return { success: 'Transaksi Pending berhasil diperbarui.' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal mengedit transaksi:', error);
    return { error: 'Gagal mengedit transaksi.' };
  } finally {
    client.release();
  }
}

export async function deletePendingTransactionAction(transactionId) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'Akses ditolak.' };
  }
  const id = Number(transactionId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Transaksi tidak valid.' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trxRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    const trx = trxRes.rows[0];
    if (!trx) {
      await client.query('ROLLBACK');
      return { error: 'Transaksi tidak ditemukan.' };
    }
    if (trx.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { error: 'Hanya transaksi berstatus Pending yang dapat dihapus.' };
    }
    if (trx.created_by !== session.id) {
      await client.query('ROLLBACK');
      return { error: 'Staff hanya dapat menghapus transaksi yang dibuatnya sendiri.' };
    }

    await client.query('DELETE FROM transactions WHERE id = $1', [id]);
    await client.query('COMMIT');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: `Transaksi ${trx.transaction_number} berhasil dihapus.` };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal menghapus transaksi:', error);
    return { error: 'Gagal menghapus transaksi.' };
  } finally {
    client.release();
  }
}

export async function reviewTransactionAction(transactionId, decision, rejectReason = '') {
  const session = await getSession();
  if (!session || session.role !== 'warehouse_manager') {
    return { error: 'Hanya Warehouse Manager yang dapat menyetujui/menolak transaksi.' };
  }
  const id = Number(transactionId);
  const reason = typeof rejectReason === 'string' ? rejectReason.trim() : '';
  if (!Number.isInteger(id) || id <= 0) return { error: 'Transaksi tidak valid.' };

  if (!['Approved', 'Rejected'].includes(decision)) {
    return { error: 'Keputusan tidak valid.' };
  }
  if (decision === 'Rejected' && !reason) {
    return { error: 'Alasan penolakan wajib diisi.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const trxRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    const trx = trxRes.rows[0];
    if (!trx || trx.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { error: 'Transaksi tidak ditemukan atau sudah diproses.' };
    }

    if (decision === 'Approved') {
      const itemsRes = await client.query(
        'SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1 ORDER BY product_id ASC',
        [id]
      );
      if (itemsRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: 'Transaksi tidak memiliki produk.' };
      }

      // Stok bertambah HANYA untuk Incoming yang di-Approve.
      // Outgoing: stok belum berubah saat Approved (baru berkurang saat Shipped).
      if (trx.type === 'incoming') {
        if (trx.restock_order_id) {
          const poUpdate = await client.query(
            `UPDATE restock_orders SET status = 'Received' WHERE id = $1 AND status = 'Inspecting'`,
            [trx.restock_order_id]
          );
          if (poUpdate.rowCount === 0) {
            await client.query('ROLLBACK');
            return { error: 'Gagal Approve: PO terkait tidak berstatus Inspecting.' };
          }
        }
        for (const item of itemsRes.rows) {
          await client.query(
            'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }

      await client.query(`UPDATE transactions SET status = 'Approved' WHERE id = $1`, [id]);
    } else {
      await client.query(
        `UPDATE transactions SET status = 'Rejected', reject_reason = $1 WHERE id = $2`,
        [reason, id]
      );
      // Penerimaan ditolak: PO menjadi Returned, stok tetap
      if (trx.type === 'incoming' && trx.restock_order_id) {
        await client.query(
          `UPDATE restock_orders SET status = 'Returned', status_notes = $1
           WHERE id = $2 AND status = 'Inspecting'`,
          [reason, trx.restock_order_id]
        );
      }
    }

    await client.query('COMMIT');
    revalidatePath('/transactions');
    revalidatePath('/restock');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return {
      success:
        decision === 'Approved'
          ? trx.type === 'incoming'
            ? `Transaksi ${trx.transaction_number} disetujui & stok otomatis bertambah.`
            : `Transaksi ${trx.transaction_number} disetujui. Stok baru berkurang setelah barang dikirim (Shipped).`
          : trx.type === 'incoming'
            ? `Transaksi ${trx.transaction_number} ditolak. PO dikembalikan (Returned), stok tetap.`
            : `Transaksi ${trx.transaction_number} ditolak.`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal memproses transaksi:', error);
    return { error: 'Gagal memproses transaksi database.' };
  } finally {
    client.release();
  }
}

export async function markTransactionShippedAction(transactionId) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'Hanya Staff Gudang yang dapat menandai pengiriman (Shipped).' };
  }

  const id = Number(transactionId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Transaksi tidak valid.' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trxRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    const trx = trxRes.rows[0];
    if (!trx || trx.type !== 'outgoing' || trx.status !== 'Approved') {
      await client.query('ROLLBACK');
      return { error: 'Hanya transaksi Outgoing berstatus Approved yang dapat diubah menjadi Shipped.' };
    }

    const itemsRes = await client.query(
      'SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1 ORDER BY product_id ASC',
      [id]
    );
    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Transaksi tidak memiliki produk.' };
    }

    // Validasi ulang stok, lalu kurangi stok saat Shipped (aturan stok mutlak)
    for (const item of itemsRes.rows) {
      const prodRes = await client.query(
        'SELECT name, current_stock FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );
      const prod = prodRes.rows[0];
      if (!prod || Number(prod.current_stock) < item.quantity) {
        await client.query('ROLLBACK');
        return {
          error: `Gagal Shipped: stok "${prod?.name || 'Produk'}" tidak mencukupi (tersedia: ${prod?.current_stock ?? 0}).`,
        };
      }
      await client.query(
        'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query(`UPDATE transactions SET status = 'Shipped' WHERE id = $1`, [id]);
    await client.query('COMMIT');

    revalidatePath('/transactions');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: `Transaksi ${trx.transaction_number} dikirim (Shipped) & stok otomatis berkurang.` };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Gagal menandai Shipped:', error);
    return { error: 'Gagal memproses pengiriman.' };
  } finally {
    client.release();
  }
}

// ==================== DASHBOARD AGGREGATION ====================
export async function getDashboardData() {
  const session = await getSession();
  if (!session) return null;

  if (session.role === 'admin') {
    const [statsRes, pendingSupRes, alertProdRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM products) AS total_products,
          (SELECT COUNT(*)::int FROM transactions WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)) AS monthly_transactions,
          (SELECT COALESCE(SUM(buy_price * current_stock), 0)::numeric FROM products) AS inventory_value,
          (SELECT COUNT(*)::int FROM users WHERE role = 'supplier' AND status = 'pending') AS pending_suppliers_count,
          (SELECT COUNT(*)::int FROM restock_orders WHERE status IN ('Pending', 'Confirmed', 'In Transit', 'Inspecting')) AS po_active_count,
          (SELECT COUNT(*)::int FROM restock_orders WHERE status = 'Returned') AS po_returned_count
      `),
      pool.query(`
        SELECT id, username, company_name, email, created_at
        FROM users WHERE role = 'supplier' AND status = 'pending'
        ORDER BY created_at DESC
      `),
      pool.query(`
        SELECT p.id, p.sku, p.name, p.current_stock, p.min_stock, p.unit, c.name AS category_name,
          CASE WHEN p.current_stock = 0 THEN 'Out of Stock' ELSE 'Severe' END AS stock_status
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.current_stock = 0 OR p.current_stock <= p.min_stock
        ORDER BY p.current_stock ASC
      `),
    ]);

    return {
      stats: statsRes.rows[0],
      pendingSuppliers: pendingSupRes.rows,
      alertProducts: alertProdRes.rows,
    };
  }

  if (session.role === 'warehouse_manager') {
    const [statsRes, pendingTrxRes, alertProdRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM products WHERE current_stock <= low_stock) AS low_or_worse_count,
          (SELECT COALESCE(SUM(current_stock), 0)::int FROM products) AS total_stock_units,
          (SELECT COUNT(*)::int FROM transactions WHERE status = 'Pending') AS pending_transactions_count,
          (SELECT COUNT(*)::int FROM restock_orders WHERE status IN ('Pending', 'Confirmed', 'In Transit', 'Inspecting')) AS active_po_count,
          (SELECT COALESCE(SUM(buy_price * current_stock), 0)::numeric FROM products) AS inventory_value,
          (SELECT COUNT(*)::int
           FROM restock_orders ro
           JOIN inspection_reports r ON r.restock_order_id = ro.id
           WHERE ro.status = 'Inspecting' AND r.result = 'Tidak Sesuai') AS po_awaiting_decision_count,
          (SELECT COUNT(*)::int FROM restock_orders WHERE status = 'Returned' AND refund_claimed_at IS NULL) AS po_refund_pending_count
      `),
      pool.query(`
        SELECT t.id, t.transaction_number, t.type, t.transaction_date, u.username AS created_by_name
        FROM transactions t
        JOIN users u ON u.id = t.created_by
        WHERE t.status = 'Pending'
        ORDER BY t.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT p.id, p.sku, p.name, p.current_stock, p.min_stock, p.low_stock, p.unit,
          CASE
            WHEN p.current_stock = 0 THEN 'Out of Stock'
            WHEN p.current_stock <= p.min_stock THEN 'Severe'
            ELSE 'Low'
          END AS stock_status
        FROM products p
        WHERE p.current_stock <= p.low_stock
        ORDER BY p.current_stock ASC
        LIMIT 8
      `),
    ]);

    return {
      stats: statsRes.rows[0],
      pendingTransactions: pendingTrxRes.rows,
      alertProducts: alertProdRes.rows,
    };
  }

  if (session.role === 'staff_gudang') {
    const [statsRes, recentTrxRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM transactions WHERE transaction_date = CURRENT_DATE) AS today_transactions,
          (SELECT COUNT(*)::int FROM transactions WHERE status = 'Pending') AS pending_approval_count,
          (SELECT COUNT(*)::int FROM transactions WHERE type = 'outgoing' AND status = 'Approved') AS ready_to_ship_count,
          (SELECT COUNT(*)::int
           FROM restock_orders ro
           WHERE ro.status = 'Inspecting'
             AND EXISTS (
               SELECT 1 FROM inspection_reports r
               WHERE r.restock_order_id = ro.id AND r.result = 'Sesuai'
             )
             AND NOT EXISTS (
               SELECT 1
               FROM transactions t
               WHERE t.restock_order_id = ro.id AND t.status != 'Rejected'
             )) AS received_po_count,
          (SELECT COUNT(*)::int
           FROM restock_orders ro
           WHERE ro.status = 'Inspecting'
             AND NOT EXISTS (
               SELECT 1 FROM inspection_reports r WHERE r.restock_order_id = ro.id
             )) AS awaiting_inspection_count
      `),
      pool.query(`
        SELECT t.id, t.transaction_number, t.type, t.transaction_date, t.status, u.username AS created_by_name
        FROM transactions t
        JOIN users u ON u.id = t.created_by
        WHERE t.transaction_date = CURRENT_DATE
        ORDER BY t.created_at DESC
        LIMIT 6
      `),
    ]);

    return {
      stats: statsRes.rows[0],
      recentTransactions: recentTrxRes.rows,
    };
  }

  if (session.role !== 'supplier' || session.status !== 'approved') return null;

  // Supplier
  const [statsRes, pendingPoRes] = await Promise.all([
    pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status = 'Pending') AS pending_po_count,
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status IN ('Confirmed', 'In Transit', 'Inspecting')) AS ongoing_po_count,
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status = 'Received') AS completed_po_count,
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status = 'Returned') AS returned_po_count,
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status = 'Returned' AND refund_claimed_at IS NOT NULL) AS refund_claim_count`,
      [session.id]
    ),
    pool.query(
      `SELECT id, po_number, order_date, expected_delivery_date, status, notes
       FROM restock_orders
       WHERE supplier_id = $1 AND status = 'Pending'
       ORDER BY created_at DESC`,
      [session.id]
    ),
  ]);
  const deliveriesRes = await pool.query(
    `SELECT t.id, t.transaction_number, t.transaction_date, t.status, ro.po_number
     FROM transactions t
     LEFT JOIN restock_orders ro ON ro.id = t.restock_order_id
     WHERE t.supplier_id = $1 AND t.type = 'incoming'
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT 6`,
    [session.id]
  );

  return {
    stats: statsRes.rows[0],
    pendingOrders: pendingPoRes.rows,
    recentDeliveries: deliveriesRes.rows,
  };
}