'use server';

import { randomUUID } from 'node:crypto';
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
      ) AS items
    FROM restock_orders ro
    JOIN users s ON s.id = ro.supplier_id
    JOIN users u ON u.id = ro.created_by
  `;
  const params = [];

  if (session.role === 'supplier') {
    params.push(session.id);
    query += ` WHERE ro.supplier_id = $1`;
  }

  query += ` ORDER BY ro.created_at DESC`;
  const res = await pool.query(query, params);
  return res.rows;
}

export async function getAvailableReceivedPOs() {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') return [];

  // PO berstatus Received yang belum dipakai transaksi Incoming aktif (selain Rejected)
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
    WHERE ro.status = 'Received'
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
  if (session.role === 'supplier') {
    if (order.supplier_id !== session.id) return { error: 'Akses ditolak.' };
    if (order.status !== 'Pending') return { error: 'PO ini sudah diproses sebelumnya.' };
    if (!['Confirmed', 'Rejected'].includes(newStatus)) return { error: 'Status tidak valid untuk Supplier.' };
    if (newStatus === 'Rejected' && !note) {
      return { error: 'Catatan penolakan wajib diisi.' };
    }
  } else if (session.role === 'warehouse_manager') {
    const validTransitions = {
      Confirmed: 'In Transit',
      'In Transit': 'Received',
    };
    if (validTransitions[order.status] !== newStatus) {
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
    !items ||
    (restock_order_id !== null && (!Number.isInteger(restock_order_id) || restock_order_id <= 0))
  ) {
    return { error: 'Jenis transaksi, tanggal, catatan, dan minimal 1 produk wajib diisi.' };
  }
  if (type === 'outgoing' && restock_order_id) {
    return { error: 'Restock Order hanya dapat dipakai untuk transaksi Barang Masuk.' };
  }
  if (type === 'incoming' && !restock_order_id && (!Number.isInteger(supplier_id) || supplier_id <= 0)) {
    return { error: 'Supplier wajib dipilih untuk transaksi Barang Masuk.' };
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
      if (!order || order.status !== 'Received') {
        await client.query('ROLLBACK');
        return { error: 'Restock Order harus berstatus Received.' };
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

    const prefix = type === 'incoming' ? 'TRX-IN' : 'TRX-OUT';
    const trxNumber = `${prefix}-${randomUUID()}`;

    const trxRes = await client.query(
      `INSERT INTO transactions (transaction_number, type, transaction_date, restock_order_id, supplier_id, customer_name, created_by, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending') RETURNING id`,
      [trxNumber, type, transaction_date, restock_order_id, supplier_id, customer_name, session.id, notes]
    );
    const trxId = trxRes.rows[0].id;

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

      for (const item of itemsRes.rows) {
        if (trx.type === 'incoming') {
          await client.query(
            'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        } else {
          const prodRes = await client.query(
            'SELECT name, current_stock FROM products WHERE id = $1 FOR UPDATE',
            [item.product_id]
          );
          const prod = prodRes.rows[0];
          if (!prod || prod.current_stock < item.quantity) {
            await client.query('ROLLBACK');
            return { error: `Gagal Approve: stok "${prod?.name}" tidak mencukupi.` };
          }
          await client.query(
            'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
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
    }

    await client.query('COMMIT');
    revalidatePath('/transactions');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return {
      success:
        decision === 'Approved'
          ? `Transaksi ${trx.transaction_number} disetujui & stok otomatis diperbarui.`
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
  const trxRes = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  const trx = trxRes.rows[0];
  if (!trx || trx.type !== 'outgoing' || trx.status !== 'Approved') {
    return { error: 'Hanya transaksi Outgoing berstatus Approved yang dapat diubah menjadi Shipped.' };
  }

  // Status Shipped tidak mengubah stok lagi karena stok sudah dipotong saat Approved
  const updateResult = await pool.query(
    `UPDATE transactions SET status = 'Shipped' WHERE id = $1 AND type = 'outgoing' AND status = 'Approved'`,
    [id]
  );
  if (updateResult.rowCount === 0) {
    return { error: 'Status transaksi sudah berubah. Muat ulang halaman dan coba lagi.' };
  }
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: `Transaksi ${trx.transaction_number} ditandai sebagai Shipped.` };
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
          (SELECT COUNT(*)::int FROM users WHERE role = 'supplier' AND status = 'pending') AS pending_suppliers_count
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
          (SELECT COUNT(*)::int FROM restock_orders WHERE status IN ('Pending', 'Confirmed', 'In Transit')) AS active_po_count,
          (SELECT COALESCE(SUM(buy_price * current_stock), 0)::numeric FROM products) AS inventory_value
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
           WHERE ro.status = 'Received'
             AND NOT EXISTS (
               SELECT 1
               FROM transactions t
               WHERE t.restock_order_id = ro.id AND t.status != 'Rejected'
             )) AS received_po_count
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
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status IN ('Confirmed', 'In Transit')) AS ongoing_po_count,
        (SELECT COUNT(*)::int FROM restock_orders WHERE supplier_id = $1 AND status = 'Received') AS completed_po_count`,
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
