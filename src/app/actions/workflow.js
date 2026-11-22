'use server';

import pool from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

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
    return { error: 'ACCESS DENIED: Hanya Warehouse Manager yang dapat membuat Restock Order.' };
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

  if (!supplier_id || !order_date || !expected_delivery_date || items.length === 0) {
    return { error: 'INCOMPLETE PO: Supplier, tanggal, dan minimal 1 produk wajib diisi.' };
  }
  if (expected_delivery_date < order_date) {
    return { error: 'DATE ERROR: Tanggal perkiraan tiba tidak boleh sebelum tanggal order.' };
  }
  for (const item of items) {
    if (!item.product_id || Number(item.quantity) <= 0) {
      return { error: 'QUANTITY ERROR: Setiap produk wajib memiliki quantity > 0.' };
    }
  }

  const poNumber = `PO-${Date.now().toString().slice(-6)}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const poRes = await client.query(
      `INSERT INTO restock_orders (po_number, supplier_id, created_by, order_date, expected_delivery_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending') RETURNING id`,
      [poNumber, supplier_id, session.id, order_date, expected_delivery_date, notes]
    );
    const poId = poRes.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO restock_order_items (restock_order_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [poId, Number(item.product_id), Number(item.quantity)]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/restock');
    revalidatePath('/dashboard');
    return { success: `DISPATCHED: Restock Order ${poNumber} berhasil dibuat.` };
  } catch {
    await client.query('ROLLBACK');
    return { error: 'SYSTEM ERROR: Gagal membuat Restock Order.' };
  } finally {
    client.release();
  }
}

export async function updateRestockStatusAction(orderId, newStatus, statusNotes = '') {
  const session = await getSession();
  if (!session) return { error: 'SESSION EXPIRED.' };

  const orderRes = await pool.query('SELECT * FROM restock_orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) return { error: 'PO NOT FOUND.' };

  if (session.role === 'supplier') {
    if (order.supplier_id !== session.id) return { error: 'ACCESS DENIED.' };
    if (order.status !== 'Pending') return { error: 'PO sudah diproses sebelumnya.' };
    if (!['Confirmed', 'Rejected'].includes(newStatus)) return { error: 'Status tidak valid.' };
    if (newStatus === 'Rejected' && !statusNotes.trim()) {
      return { error: 'REASON REQUIRED: Catatan penolakan wajib diisi.' };
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
    return { error: 'ACCESS DENIED.' };
  }

  await pool.query(
    `UPDATE restock_orders SET status = $1, status_notes = COALESCE(NULLIF($2, ''), status_notes) WHERE id = $3`,
    [newStatus, statusNotes.trim(), orderId]
  );

  revalidatePath('/restock');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: `PO ${order.po_number} -> Status diperbarui menjadi ${newStatus.toUpperCase()}.` };
}

// ==================== TRANSACTIONS (INCOMING & OUTGOING) ====================
export async function getTransactions() {
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
    ORDER BY t.created_at DESC
  `);
  return res.rows;
}

export async function createTransactionAction(prevState, formData) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'ACCESS DENIED: Hanya Staff Gudang yang dapat mencatat transaksi baru.' };
  }

  const type = formData.get('type');
  const transaction_date = formData.get('transaction_date');
  const restock_order_id = formData.get('restock_order_id') ? Number(formData.get('restock_order_id')) : null;
  const supplier_id = formData.get('supplier_id') ? Number(formData.get('supplier_id')) : null;
  const customer_name = formData.get('customer_name')?.trim() || null;
  const notes = formData.get('notes')?.trim() || '';
  const itemsRaw = formData.get('items_json');

  let items = [];
  try {
    items = JSON.parse(itemsRaw || '[]');
  } catch {
    items = [];
  }

  if (!['incoming', 'outgoing'].includes(type) || !transaction_date || items.length === 0) {
    return { error: 'INCOMPLETE LOG: Jenis transaksi, tanggal, dan minimal 1 produk wajib diisi.' };
  }
  if (type === 'incoming' && !supplier_id) {
    return { error: 'SUPPLIER REQUIRED: Supplier wajib dipilih untuk transaksi Barang Masuk.' };
  }
  if (type === 'outgoing' && !customer_name) {
    return { error: 'DESTINATION REQUIRED: Nama customer/tujuan wajib diisi untuk Barang Keluar.' };
  }

  for (const item of items) {
    if (!item.product_id || Number(item.quantity) <= 0) {
      return { error: 'QUANTITY ERROR: Quantity setiap produk harus > 0.' };
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'incoming' && restock_order_id) {
      const poCheck = await client.query(
        `SELECT id FROM transactions WHERE restock_order_id = $1 AND status != 'Rejected'`,
        [restock_order_id]
      );
      if (poCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { error: 'DUPLICATE PO: Restock Order ini sudah dipakai pada transaksi aktif lain.' };
      }
    }

    if (type === 'outgoing') {
      for (const item of items) {
        const prodRes = await client.query('SELECT name, current_stock FROM products WHERE id = $1', [Number(item.product_id)]);
        const prod = prodRes.rows[0];
        if (!prod || Number(item.quantity) > prod.current_stock) {
          await client.query('ROLLBACK');
          return { error: `INSUFFICIENT STOCK: "${prod?.name || 'Produk'}" tidak mencukupi (tersedia: ${prod?.current_stock ?? 0}).` };
        }
      }
    }

    const prefix = type === 'incoming' ? 'TRX-IN' : 'TRX-OUT';
    const trxNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

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
    return { success: `LOGGED: Transaksi ${trxNumber} berhasil dicatat (Menunggu approval Manager).` };
  } catch {
    await client.query('ROLLBACK');
    return { error: 'SYSTEM ERROR: Gagal menyimpan transaksi.' };
  } finally {
    client.release();
  }
}

export async function editPendingTransactionAction(transactionId, notes, items) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'ACCESS DENIED.' };
  }

  if (!items || items.length === 0) {
    return { error: 'Minimal 1 produk wajib diisi.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trxRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [transactionId]);
    const trx = trxRes.rows[0];

    if (!trx || trx.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { error: 'LOCKED: Hanya transaksi berstatus Pending yang dapat diedit.' };
    }

    if (trx.type === 'outgoing') {
      for (const item of items) {
        const prodRes = await client.query('SELECT name, current_stock FROM products WHERE id = $1', [Number(item.product_id)]);
        const prod = prodRes.rows[0];
        if (!prod || Number(item.quantity) > prod.current_stock) {
          await client.query('ROLLBACK');
          return { error: `INSUFFICIENT STOCK: "${prod?.name}" tidak mencukupi (tersedia: ${prod?.current_stock ?? 0}).` };
        }
      }
    }

    await client.query('UPDATE transactions SET notes = $1 WHERE id = $2', [notes || '', transactionId]);
    await client.query('DELETE FROM transaction_items WHERE transaction_id = $1', [transactionId]);

    for (const item of items) {
      if (Number(item.quantity) <= 0) {
        await client.query('ROLLBACK');
        return { error: 'Quantity harus > 0.' };
      }
      await client.query(
        'INSERT INTO transaction_items (transaction_id, product_id, quantity) VALUES ($1, $2, $3)',
        [transactionId, Number(item.product_id), Number(item.quantity)]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/transactions');
    return { success: 'UPDATED: Transaksi Pending berhasil diperbarui.' };
  } catch {
    await client.query('ROLLBACK');
    return { error: 'SYSTEM ERROR: Gagal mengedit transaksi.' };
  } finally {
    client.release();
  }
}

export async function deletePendingTransactionAction(transactionId) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'ACCESS DENIED.' };
  }

  const trxRes = await pool.query('SELECT * FROM transactions WHERE id = $1', [transactionId]);
  const trx = trxRes.rows[0];
  if (!trx) return { error: 'Transaksi tidak ditemukan.' };
  if (trx.status !== 'Pending') return { error: 'LOCKED: Hanya transaksi berstatus Pending yang dapat dihapus.' };
  if (trx.created_by !== session.id) return { error: 'Staff hanya dapat menghapus transaksi yang dibuatnya sendiri.' };

  await pool.query('DELETE FROM transactions WHERE id = $1', [transactionId]);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: `PURGED: Transaksi ${trx.transaction_number} berhasil dihapus.` };
}

export async function reviewTransactionAction(transactionId, decision, rejectReason = '') {
  const session = await getSession();
  if (!session || session.role !== 'warehouse_manager') {
    return { error: 'ACCESS DENIED: Hanya Warehouse Manager yang dapat menyetujui/menolak transaksi.' };
  }

  if (!['Approved', 'Rejected'].includes(decision)) {
    return { error: 'Keputusan tidak valid.' };
  }
  if (decision === 'Rejected' && !rejectReason.trim()) {
    return { error: 'REASON REQUIRED: Alasan penolakan wajib diisi.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const trxRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [transactionId]);
    const trx = trxRes.rows[0];
    if (!trx || trx.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { error: 'Transaksi tidak ditemukan atau sudah diproses.' };
    }

    if (decision === 'Approved') {
      const itemsRes = await client.query(
        'SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1',
        [transactionId]
      );

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
            return { error: `INSUFFICIENT STOCK: Gagal Approve "${prod?.name}".` };
          }
          await client.query(
            'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }

      await client.query(`UPDATE transactions SET status = 'Approved' WHERE id = $1`, [transactionId]);
    } else {
      await client.query(
        `UPDATE transactions SET status = 'Rejected', reject_reason = $1 WHERE id = $2`,
        [rejectReason.trim(), transactionId]
      );
    }

    await client.query('COMMIT');
    revalidatePath('/transactions');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return {
      success:
        decision === 'Approved'
          ? `APPROVED: ${trx.transaction_number} disetujui & stok otomatis diperbarui.`
          : `REJECTED: ${trx.transaction_number} ditolak.`,
    };
  } catch {
    await client.query('ROLLBACK');
    return { error: 'SYSTEM ERROR: Gagal memproses transaksi database.' };
  } finally {
    client.release();
  }
}

export async function markTransactionShippedAction(transactionId) {
  const session = await getSession();
  if (!session || session.role !== 'staff_gudang') {
    return { error: 'ACCESS DENIED: Hanya Staff Gudang yang dapat menandai pengiriman (Shipped).' };
  }

  const trxRes = await pool.query('SELECT * FROM transactions WHERE id = $1', [transactionId]);
  const trx = trxRes.rows[0];
  if (!trx || trx.type !== 'outgoing' || trx.status !== 'Approved') {
    return { error: 'Hanya transaksi Outgoing berstatus Approved yang dapat diubah menjadi Shipped.' };
  }

  await pool.query(`UPDATE transactions SET status = 'Shipped' WHERE id = $1`, [transactionId]);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: `DISPATCHED: ${trx.transaction_number} ditandai sebagai SHIPPED.` };
}

// ==================== DASHBOARD AGGREGATION ====================
export async function getDashboardData(session) {
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
          (SELECT COUNT(*)::int FROM restock_orders WHERE status = 'Received') AS received_po_count
      `),
      pool.query(`
        SELECT t.id, t.transaction_number, t.type, t.transaction_date, t.status, u.username AS created_by_name
        FROM transactions t
        JOIN users u ON u.id = t.created_by
        ORDER BY t.created_at DESC
        LIMIT 6
      `),
    ]);

    return {
      stats: statsRes.rows[0],
      recentTransactions: recentTrxRes.rows,
    };
  }

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

  return {
    stats: statsRes.rows[0],
    pendingOrders: pendingPoRes.rows,
  };
}
