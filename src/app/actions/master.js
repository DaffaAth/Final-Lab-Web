'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/session';

const INTERNAL_ROLES = ['admin', 'warehouse_manager', 'staff_gudang'];
const MANAGEMENT_ROLES = ['admin', 'warehouse_manager'];

function stockStatusSql() {
  return `CASE
    WHEN p.current_stock = 0 THEN 'Out of Stock'
    WHEN p.current_stock <= p.min_stock THEN 'Severe'
    WHEN p.current_stock <= p.low_stock THEN 'Low'
    ELSE 'Normal'
  END`;
}

function productFilters(filters = {}) {
  const clauses = [];
  const values = [];

  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim()}%`);
    clauses.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length})`);
  }
  if (filters.categoryId && Number.isInteger(Number(filters.categoryId))) {
    values.push(Number(filters.categoryId));
    clauses.push(`p.category_id = $${values.length}`);
  }
  if (['Out of Stock', 'Severe', 'Low', 'Normal'].includes(filters.stockStatus)) {
    values.push(filters.stockStatus);
    clauses.push(`${stockStatusSql()} = $${values.length}`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

function productOrder(sortBy = 'created_at') {
  const ordering = {
    created_at: 'p.created_at DESC, p.id DESC',
    name: 'p.name ASC, p.id ASC',
    stock_asc: 'p.current_stock ASC, p.name ASC',
    stock_desc: 'p.current_stock DESC, p.name ASC',
  };
  return ordering[sortBy] || ordering.created_at;
}

async function canReadWarehouseData() {
  const session = await getSession();
  return session && INTERNAL_ROLES.includes(session.role);
}

export async function getProducts(filters = {}) {
  if (!(await canReadWarehouseData())) return [];

  const { where, values } = productFilters(filters);
  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, ${stockStatusSql()} AS stock_status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY ${productOrder(filters.sortBy)}`,
    values
  );
  return result.rows;
}

export async function getPaginatedProducts(filters = {}) {
  if (!(await canReadWarehouseData())) {
    return { products: [], page: 1, totalPages: 1, totalCount: 0 };
  }

  const { where, values } = productFilters(filters);
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total_count
     FROM products p
     ${where}`,
    values
  );
  const totalCount = countResult.rows[0].total_count;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requestedPage = Number.parseInt(filters.page, 10);
  const page = Math.min(Math.max(Number.isInteger(requestedPage) ? requestedPage : 1, 1), totalPages);
  const pageValues = [...values, pageSize, (page - 1) * pageSize];
  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, ${stockStatusSql()} AS stock_status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY ${productOrder(filters.sortBy)}
     LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues
  );

  return { products: result.rows, page, totalPages, totalCount };
}

export async function getCategories() {
  if (!(await canReadWarehouseData())) return [];

  const result = await pool.query(`
    SELECT c.*, COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return result.rows;
}

export async function getApprovedSuppliers() {
  const session = await getSession();
  if (!session || !['admin', 'warehouse_manager', 'staff_gudang'].includes(session.role)) return [];

  const result = await pool.query(
    `SELECT id, username, company_name, email
     FROM users
     WHERE role = 'supplier' AND status = 'approved'
     ORDER BY company_name ASC, username ASC`
  );
  return result.rows;
}

export async function getSuppliers() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return [];

  const result = await pool.query(`
    SELECT id, username, company_name, email, status, created_at
    FROM users
    WHERE role = 'supplier' AND status = 'pending'
    ORDER BY created_at DESC, id DESC
  `);
  return result.rows;
}

export async function getProductDetail(productId) {
  if (!(await canReadWarehouseData())) return null;
  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const productResult = await pool.query(
    `SELECT p.*, c.name AS category_name, ${stockStatusSql()} AS stock_status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  const product = productResult.rows[0];
  if (!product) return null;

  const transactionsResult = await pool.query(
    `SELECT t.id, t.transaction_number, t.type, t.status, t.transaction_date,
            u.username AS created_by_name, ti.quantity
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN users u ON u.id = t.created_by
     WHERE ti.product_id = $1
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT 5`,
    [id]
  );

  return { ...product, recent_transactions: transactionsResult.rows };
}

export async function saveProductAction(prevState, formData) {
  const session = await getSession();
  if (!session || !MANAGEMENT_ROLES.includes(session.role)) {
    return { error: 'Hanya Admin atau Warehouse Manager yang dapat mengelola produk.' };
  }

  const idValue = formData.get('id');
  const id = idValue ? Number(idValue) : null;
  const sku = formData.get('sku')?.trim();
  const name = formData.get('name')?.trim();
  const categoryId = Number(formData.get('category_id'));
  const description = formData.get('description')?.trim();
  const buyPrice = Number(formData.get('buy_price'));
  const sellPrice = Number(formData.get('sell_price'));
  const minStock = Number(formData.get('min_stock'));
  const lowStock = Number(formData.get('low_stock'));
  const currentStock = Number(formData.get('current_stock'));
  const unit = formData.get('unit')?.trim();
  const rackLocation = formData.get('rack_location')?.trim();
  const imageUrl = formData.get('image_url')?.trim();
  let image = null;
  if (imageUrl) {
    try {
      image = new URL(imageUrl);
    } catch {
      return { error: 'URL gambar produk tidak valid.' };
    }
  }

  if (idValue && (!Number.isInteger(id) || id <= 0)) return { error: 'Produk tidak valid.' };
  if (!idValue && !sku) return { error: 'SKU wajib diisi.' };
  if (
    !name ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0 ||
    !description ||
    !unit ||
    !rackLocation ||
    !imageUrl ||
    !image ||
    !['http:', 'https:'].includes(image.protocol)
  ) {
    return { error: 'Semua field produk wajib diisi dengan data yang valid.' };
  }
  if (
    !Number.isFinite(buyPrice) ||
    buyPrice < 0 ||
    !Number.isFinite(sellPrice) ||
    sellPrice < 0 ||
    !Number.isInteger(minStock) ||
    minStock < 0 ||
    !Number.isInteger(lowStock) ||
    lowStock <= minStock ||
    !Number.isInteger(currentStock) ||
    currentStock < 0
  ) {
    return { error: 'Harga dan batas stok tidak valid. Stok Low harus lebih besar dari stok minimum.' };
  }

  try {
    if (id) {
      if (!Number.isInteger(id) || id <= 0) return { error: 'Produk tidak valid.' };
      const result = await pool.query(
        `UPDATE products
         SET name = $1, category_id = $2, description = $3, buy_price = $4, sell_price = $5,
             min_stock = $6, low_stock = $7, current_stock = $8, unit = $9,
             rack_location = $10, image_url = $11
         WHERE id = $12`,
        [
          name,
          categoryId,
          description,
          buyPrice,
          sellPrice,
          minStock,
          lowStock,
          currentStock,
          unit,
          rackLocation,
          imageUrl,
          id,
        ]
      );
      if (result.rowCount === 0) return { error: 'Produk tidak ditemukan.' };
    } else {
      await pool.query(
        `INSERT INTO products
          (sku, name, category_id, description, buy_price, sell_price, min_stock, low_stock,
           current_stock, unit, rack_location, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          sku,
          name,
          categoryId,
          description,
          buyPrice,
          sellPrice,
          minStock,
          lowStock,
          currentStock,
          unit,
          rackLocation,
          imageUrl,
        ]
      );
    }
  } catch (error) {
    if (error.code === '23505') return { error: 'SKU tersebut sudah digunakan produk lain.' };
    if (error.code === '23503') return { error: 'Kategori yang dipilih tidak tersedia.' };
    console.error('Gagal menyimpan produk:', error);
    return { error: 'Gagal menyimpan produk.' };
  }

  revalidatePath('/products');
  revalidatePath('/restock');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: id ? 'Produk berhasil diperbarui.' : 'Produk berhasil ditambahkan.' };
}

export async function deleteProductAction(productId) {
  const session = await getSession();
  if (!session || !MANAGEMENT_ROLES.includes(session.role)) {
    return { error: 'Hanya Admin atau Warehouse Manager yang dapat menghapus produk.' };
  }
  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Produk tidak valid.' };

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    if (result.rowCount === 0) return { error: 'Produk tidak ditemukan.' };
  } catch (error) {
    if (error.code === '23503') {
      return { error: 'Produk yang memiliki riwayat transaksi atau Restock Order tidak dapat dihapus.' };
    }
    console.error('Gagal menghapus produk:', error);
    return { error: 'Gagal menghapus produk.' };
  }

  revalidatePath('/products');
  revalidatePath('/restock');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: 'Produk berhasil dihapus.' };
}

export async function saveCategoryAction(prevState, formData) {
  const session = await getSession();
  if (!session || !MANAGEMENT_ROLES.includes(session.role)) {
    return { error: 'Hanya Admin atau Warehouse Manager yang dapat mengelola kategori.' };
  }

  const idValue = formData.get('id');
  const id = idValue ? Number(idValue) : null;
  const name = formData.get('name')?.trim();
  const description = formData.get('description')?.trim() || null;
  const imageUrl = formData.get('image_url')?.trim() || null;
  if (!name) return { error: 'Nama kategori wajib diisi.' };
  if (idValue && (!Number.isInteger(id) || id <= 0)) return { error: 'Kategori tidak valid.' };
  if (imageUrl) {
    try {
      const image = new URL(imageUrl);
      if (!['http:', 'https:'].includes(image.protocol)) return { error: 'URL gambar kategori tidak valid.' };
    } catch {
      return { error: 'URL gambar kategori tidak valid.' };
    }
  }

  try {
    if (id) {
      if (!Number.isInteger(id) || id <= 0) return { error: 'Kategori tidak valid.' };
      const result = await pool.query(
        'UPDATE categories SET name = $1, description = $2, image_url = $3 WHERE id = $4',
        [name, description, imageUrl, id]
      );
      if (result.rowCount === 0) return { error: 'Kategori tidak ditemukan.' };
    } else {
      await pool.query(
        'INSERT INTO categories (name, description, image_url) VALUES ($1, $2, $3)',
        [name, description, imageUrl]
      );
    }
  } catch (error) {
    if (error.code === '23505') return { error: 'Nama kategori sudah digunakan.' };
    console.error('Gagal menyimpan kategori:', error);
    return { error: 'Gagal menyimpan kategori.' };
  }

  revalidatePath('/categories');
  revalidatePath('/products');
  return { success: id ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil ditambahkan.' };
}

export async function deleteCategoryAction(categoryId) {
  const session = await getSession();
  if (!session || !MANAGEMENT_ROLES.includes(session.role)) {
    return { error: 'Hanya Admin atau Warehouse Manager yang dapat menghapus kategori.' };
  }
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Kategori tidak valid.' };

  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    if (result.rowCount === 0) return { error: 'Kategori tidak ditemukan.' };
  } catch (error) {
    if (error.code === '23503') return { error: 'Kategori yang masih memiliki produk tidak dapat dihapus.' };
    console.error('Gagal menghapus kategori:', error);
    return { error: 'Gagal menghapus kategori.' };
  }

  revalidatePath('/categories');
  revalidatePath('/products');
  return { success: 'Kategori berhasil dihapus.' };
}

export async function verifySupplierAction(supplierId, status) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Hanya Admin yang dapat memverifikasi Supplier.' };
  }
  if (!['approved', 'rejected'].includes(status)) return { error: 'Status Supplier tidak valid.' };

  const id = Number(supplierId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Supplier tidak valid.' };
  const result = await pool.query(
    `UPDATE users
     SET status = $1
     WHERE id = $2 AND role = 'supplier' AND status = 'pending'`,
    [status, id]
  );
  if (result.rowCount === 0) return { error: 'Supplier tidak ditemukan atau sudah diverifikasi.' };

  revalidatePath('/suppliers');
  revalidatePath('/restock');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: `Supplier berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}.` };
}
