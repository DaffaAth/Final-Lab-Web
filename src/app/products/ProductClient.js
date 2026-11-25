'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { saveProductAction, deleteProductAction } from '@/app/actions/master';
import ConfirmDialog from '@/components/ConfirmDialog';

function StockBadge({ status }) {
  const styles = {
    'Out of Stock': 'bg-slate-200 text-slate-800',
    Severe: 'bg-red-100 text-red-700',
    Low: 'bg-amber-100 text-amber-800',
    Normal: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.Normal}`}>
      {status}
    </span>
  );
}

export default function ProductClient({ session, products, categories, filters, pagination }) {
  const canManage = ['admin', 'warehouse_manager'].includes(session.role);
  const [state, formAction, isPending] = useActionState(saveProductAction, null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(product) {
    setEditing(product);
    setShowForm(true);
  }

  function handleDelete(product) {
    setPendingDelete(product);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deleteProductAction(pendingDelete.id);
    setMsg(res.error || res.success);
    setDeleting(false);
    setPendingDelete(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Produk &amp; Stok</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemantauan stok real-time dan klasifikasi status otomatis
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold self-start"
          >
            + Tambah Produk
          </button>
        )}
      </div>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            state?.error || msg.includes('tidak')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      {/* Modal / Panel Form Create & Edit Produk */}
      {canManage && showForm && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              {editing ? `Edit Produk (${editing.sku})` : 'Tambah Produk Baru'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              ✕ Tutup
            </button>
          </div>

          <form action={formAction} key={editing?.id || 'create'} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                SKU {editing ? '(Terkunci)' : '*'}
              </label>
              <input
                name="sku"
                defaultValue={editing?.sku || ''}
                readOnly={!!editing}
                required
                placeholder="ELK-005"
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm ${
                  editing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Produk *</label>
              <input
                name="name"
                defaultValue={editing?.name || ''}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori *</label>
              <select
                name="category_id"
                defaultValue={editing?.category_id || ''}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Beli (Rp) *</label>
              <input
                type="number"
                min="0"
                name="buy_price"
                defaultValue={editing?.buy_price ?? 0}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Jual (Rp) *</label>
              <input
                type="number"
                min="0"
                name="sell_price"
                defaultValue={editing?.sell_price ?? 0}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Satuan (Unit) *</label>
              <input
                name="unit"
                defaultValue={editing?.unit || ''}
                required
                placeholder="Pcs / Box / Unit"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stok Minimum (Batas Severe) *</label>
              <input
                type="number"
                min="0"
                name="min_stock"
                defaultValue={editing?.min_stock ?? 5}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Batas Stok Low (&gt; Min) *</label>
              <input
                type="number"
                min="1"
                name="low_stock"
                defaultValue={editing?.low_stock ?? 15}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {editing
                  ? 'Stok Saat Ini (hanya berubah lewat transaksi)'
                  : 'Stok Awal (otomatis 0, bertambah lewat Barang Masuk)'}
              </label>
              <input
                type="number"
                min="0"
                name="current_stock"
                defaultValue={editing?.current_stock ?? 0}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lokasi Rak *</label>
              <input
                name="rack_location"
                defaultValue={editing?.rack_location || ''}
                required
                placeholder="RAK-A01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">URL Gambar *</label>
              <input
                name="image_url"
                defaultValue={editing?.image_url || ''}
                placeholder="https://..."
                type="url"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
              <input
                name="description"
                defaultValue={editing?.description || ''}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan Produk'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Bar */}
      <form method="GET" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          name="search"
          defaultValue={filters.search}
          placeholder="Cari nama produk atau SKU..."
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm lg:col-span-2"
        />
        <select
          name="categoryId"
          defaultValue={filters.categoryId}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="stockStatus"
          defaultValue={filters.stockStatus}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Semua Status Stok</option>
          <option value="Normal">Normal</option>
          <option value="Low">Low</option>
          <option value="Severe">Severe</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
        <div className="flex gap-2">
          <select
            name="sortBy"
            defaultValue={filters.sortBy}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="created_at">Terbaru</option>
            <option value="name">Nama (A-Z)</option>
            <option value="stock_asc">Stok Terendah</option>
            <option value="stock_desc">Stok Tertinggi</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Tabel Produk */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3.5">SKU</th>
              <th className="p-3.5">Produk</th>
              <th className="p-3.5">Kategori</th>
              <th className="p-3.5">Rak</th>
              <th className="p-3.5">Stok</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  Tidak ada produk yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-mono text-xs font-semibold text-slate-700">{p.sku}</td>
                  <td className="p-3.5">
                    <Link href={`/products/${p.id}`} className="font-semibold text-blue-600 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="p-3.5 text-slate-600">{p.category_name}</td>
                  <td className="p-3.5 text-slate-600">{p.rack_location}</td>
                  <td className="p-3.5 font-semibold text-slate-800">
                    {p.current_stock} {p.unit}
                  </td>
                  <td className="p-3.5">
                    <StockBadge status={p.stock_status} />
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <Link
                      href={`/products/${p.id}`}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200"
                    >
                      Detail
                    </Link>
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEdit(p)}
                          className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="px-2.5 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold"
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
        <p>
          {pagination.totalCount === 0
            ? 'Tidak ada produk'
            : `Menampilkan ${(pagination.page - 1) * 10 + 1}-${Math.min(
                pagination.page * 10,
                pagination.totalCount
              )} dari ${pagination.totalCount} produk`}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={productPageHref(filters, pagination.page - 1)}
            aria-disabled={pagination.page <= 1}
            className={`px-3 py-1.5 rounded-lg border ${
              pagination.page <= 1
                ? 'pointer-events-none border-slate-200 text-slate-400'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
          >
            Sebelumnya
          </Link>
          <span>
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <Link
            href={productPageHref(filters, pagination.page + 1)}
            aria-disabled={pagination.page >= pagination.totalPages}
            className={`px-3 py-1.5 rounded-lg border ${
              pagination.page >= pagination.totalPages
                ? 'pointer-events-none border-slate-200 text-slate-400'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
          >
            Berikutnya
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus produk?"
        message={pendingDelete ? `Produk "${pendingDelete.name}" akan dihapus.` : ''}
        note={
          pendingDelete && pendingDelete.current_stock > 0
            ? `PERINGATAN: produk ini masih memiliki stok ${pendingDelete.current_stock} ${pendingDelete.unit}.`
            : ''
        }
        confirmLabel={pendingDelete && pendingDelete.current_stock > 0 ? 'Tetap Hapus' : 'Hapus'}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function productPageHref(filters, page) {
  const query = new URLSearchParams();
  for (const key of ['search', 'categoryId', 'stockStatus', 'sortBy']) {
    if (filters[key]) query.set(key, filters[key]);
  }
  query.set('page', String(page));
  return `/products?${query.toString()}`;
}