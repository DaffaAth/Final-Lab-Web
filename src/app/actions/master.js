'use server';

import pool from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

// ==================== SUPPLIER VERIFICATION (ADMIN) ====================
export async function getSuppliers() {
  const res = await pool.query(`
    SELECT id, username, company_name, email, status, created_at
    FROM users
    WHERE role = 'supplier'
    ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, created_at DESC
  `);
  return res.rows;
}

export async function getApprovedSuppliers() {
  const res = await pool.query(`
    SELECT id, username, company_name, email
    FROM users
    WHERE role = 'supplier' AND status = 'approved'
    ORDER BY company_name ASC, username ASC
  `);
  return res.rows;
}

export async function verifySupplierAction(supplierId, status) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'ACCESS DENIED: Hanya Admin yang dapat memverifikasi Supplier.' };
  }
  if (!['approved', 'rejected'].includes(status)) {
    return { error: 'INVALID STATUS: Status verifikasi tidak valid.' };
  }

  await pool.query(
    `UPDATE users SET status = $1 WHERE id = $2 AND role = 'supplier'`,
    [status, supplierId]
  );
  revalidatePath('/suppliers');
  revalidatePath('/dashboard');
  return { success: `STATUS UPDATED: Clearance Supplier diubah menjadi ${status.toUpperCase()}.` };
}

// ==================== CATEGORIES (ADMIN & MANAGER) ====================
export async function getCategories() {
  const res = await pool.query(`
    SELECT c.*, COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return res.rows;
}

export async function saveCategoryAction(prevState, formData) {
  const session = await getSession();
  if (!session || !['admin', 'warehouse_manager'].includes(session.role)) {
    return { error: 'ACCESS DENIED.' };
  }

  const id = formData.get('id');
  const name = formData.get('name')?.trim();
  const description = formData.get('description')?.trim() || '';
  const image_url = formData.get('image_url')?.trim() || '';

  if (!name) return { error: 'Nama kategori wajib diisi.' };

  try {
    if (id) {
      const dup = await pool.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name, id]
      );
      if (dup.rows.length > 0) return { error: 'Nama kategori sudah digunakan.' };

      await pool.query(
        'UPDATE categories SET name = $1, description = $2, image_url = $3 WHERE id = $4',
        [name, description, image_url, id]
      );
      revalidatePath('/categories');
      return { success: 'RECORD UPDATED: Kategori berhasil diperbarui.' };
    } else {
      const dup = await pool.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
        [name]
      );
      if (dup.rows.length > 0) return { error: 'Nama kategori sudah digunakan.' };

      await pool.query(
        'INSERT INTO categories (name, description, image_url) VALUES ($1, $2, $3)',
        [name, description, image_url]
      );
      revalidatePath('/categories');
      return { success: 'RECORD LOGGED: Kategori berhasil ditambahkan.' };
    }
  } catch {
    return { error: 'DATABASE ERROR: Gagal menyimpan data kategori.' };
  }
}

export async function deleteCategoryAction(id) {
  const session = await getSession();
  if (!session || !['admin', 'warehouse_manager'].includes(session.role)) {
    return { error: 'ACCESS DENIED.' };
  }

  const check = await pool.query(
    'SELECT COUNT(*)::int AS total FROM products WHERE category_id = $1',
    [id]
  );
  if (check.rows[0].total > 0) {
    return { error: 'LOCKED: Kategori tidak dapat dihapus karena masih memiliki produk terkait.' };
  }

  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  revalidatePath('/categories');
  return { success: 'PURGED: Kategori berhasil dihapus.' };
}

// ==================== PRODUCTS (ADMIN & MANAGER CRUD; ALL VIEW) ====================
export async function getProducts({ search = '', categoryId = '', stockStatus = '', sortBy = 'created_at' } = {}) {
  const conditions = [];
  const params = [];

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (categoryId) {
    params.push(Number(categoryId));
    conditions.push(`p.category_id = $${params.length}`);
  }

  const statusSql = `
    CASE
      WHEN p.current_stock = 0 THEN 'Out of Stock'
      WHEN p.current_stock <= p.min_stock THEN 'Severe'
      WHEN p.current_stock <= p.low_stock THEN 'Low'
      ELSE 'Normal'
    END
  `;

  if (stockStatus) {
    params.push(stockStatus);
    conditions.push(`(${statusSql}) = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orders = {
    name: 'p.name ASC',
    stock_asc: 'p.current_stock ASC',
    stock_desc: 'p.current_stock DESC',
    created_at: 'p.created_at DESC',
  };

  const res = await pool.query(
    `SELECT p.*, c.name AS category_name, ${statusSql} AS stock_status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY ${orders[sortBy] || 'p.created_at DESC'}`,
    params
  );
  return res.rows;
}

export async function getProductDetail(id) {
  const prodRes = await pool.query(
    `SELECT p.*, c.name AS category_name,
      CASE
        WHEN p.current_stock = 0 THEN 'Out of Stock'
        WHEN p.current_stock <= p.min_stock THEN 'Severe'
        WHEN p.current_stock <= p.low_stock THEN 'Low'
        ELSE 'Normal'
      END AS stock_status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  if (!prodRes.rows.length) return null;

  const txRes = await pool.query(
    `SELECT t.id, t.transaction_number, t.type, t.transaction_date, t.status, ti.quantity, u.username AS created_by_name
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN users u ON u.id = t.created_by
     WHERE ti.product_id = $1
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT 5`,
    [id]
  );

  return {
    ...prodRes.rows[0],
    recent_transactions: txRes.rows,
  };
}

export async function saveProductAction(prevState, formData) {
  const session = await getSession();
  if (!session || !['admin', 'warehouse_manager'].includes(session.role)) {
    return { error: 'ACCESS DENIED.' };
  }

  const id = formData.get('id');
  const sku = formData.get('sku')?.trim().toUpperCase();
  const name = formData.get('name')?.trim();
  const category_id = Number(formData.get('category_id'));
  const description = formData.get('description')?.trim() || '';
  const buy_price = Number(formData.get('buy_price'));
  const sell_price = Number(formData.get('sell_price'));
  const min_stock = Number(formData.get('min_stock'));
  const low_stock = Number(formData.get('low_stock'));
  const current_stock = Number(formData.get('current_stock'));
  const unit = formData.get('unit')?.trim();
  const rack_location = formData.get('rack_location')?.trim();
  const image_url = formData.get('image_url')?.trim() || '';

  if (!name || !category_id || !unit || !rack_location || (!id && !sku)) {
    return { error: 'INCOMPLETE MANIFEST: Semua field wajib diisi lengkap.' };
  }
  if (buy_price < 0 || sell_price < 0 || min_stock < 0 || current_stock < 0) {
    return { error: 'INVALID VALUE: Harga dan jumlah stok tidak boleh negatif.' };
  }
  if (low_stock <= min_stock) {
    return { error: 'THRESHOLD ERROR: Batas Stok Low harus lebih besar dari Stok Minimum (Severe).' };
  }

  try {
    if (id) {
      await pool.query(
        `UPDATE products SET name = $1, category_id = $2, description = $3, buy_price = $4, sell_price = $5,
         min_stock = $6, low_stock = $7, current_stock = $8, unit = $9, rack_location = $10, image_url = $11
         WHERE id = $12`,
        [name, category_id, description, buy_price, sell_price, min_stock, low_stock, current_stock, unit, rack_location, image_url, id]
      );
      revalidatePath('/products');
      revalidatePath(`/products/${id}`);
      revalidatePath('/dashboard');
      return { success: 'MANIFEST UPDATED: Produk diperbarui (SKU terkunci).' };
    } else {
      const dup = await pool.query('SELECT id FROM products WHERE UPPER(sku) = $1', [sku]);
      if (dup.rows.length > 0) return { error: 'DUPLICATE SKU: SKU sudah terdaftar pada produk lain.' };

      await pool.query(
        `INSERT INTO products (sku, name, category_id, description, buy_price, sell_price, min_stock, low_stock, current_stock, unit, rack_location, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [sku, name, category_id, description, buy_price, sell_price, min_stock, low_stock, current_stock, unit, rack_location, image_url]
      );
      revalidatePath('/products');
      revalidatePath('/dashboard');
      return { success: 'CARGO REGISTERED: Produk baru berhasil ditambahkan.' };
    }
  } catch {
    return { error: 'DATABASE ERROR: Gagal menyimpan produk.' };
  }
}

export async function deleteProductAction(id) {
  const session = await getSession();
  if (!session || !['admin', 'warehouse_manager'].includes(session.role)) {
    return { error: 'ACCESS DENIED.' };
  }

  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: 'CARGO PURGED: Produk berhasil dihapus.' };
  } catch {
    return { error: 'LOCKED RECORD: Produk tidak bisa dihapus karena tercatat dalam riwayat transaksi/PO.' };
  }
}
