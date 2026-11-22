'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { saveProductAction, deleteProductAction } from '@/app/actions/master';

function StockBadge({ status }) {
  const styles = {
    'Out of Stock': 'bg-[#26292e] text-[#a1a1aa] border-[#52525b]',
    Severe: 'bg-[#451416] text-[#fca5a5] border-[#dc2626]',
    Low: 'bg-[#3b290e] text-[#facc15] border-[#d49b27]',
    Normal: 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]',
  };
  return (
    <span className={`px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase border ${styles[status] || styles.Normal}`}>
      {status}
    </span>
  );
}

export default function ProductClient({ session, products, categories, filters }) {
  const canManage = ['admin', 'warehouse_manager'].includes(session.role);
  const [state, formAction, isPending] = useActionState(saveProductAction, null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(product) {
    setEditing(product);
    setShowForm(true);
  }

  async function handleDelete(product) {
    const warning =
      product.current_stock > 0
        ? `WARNING: Produk "${product.name}" masih memiliki stok ${product.current_stock} ${product.unit}! Tetap hapus produk ini?`
        : `Hapus produk "${product.name}"?`;
    if (!confirm(warning)) return;
    const res = await deleteProductAction(product.id);
    setMsg(res.error || res.success);
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#2c3036] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
            CARGO MANIFEST // INVENTORY LEDGER
          </span>
          <h1 className="text-2xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
            MANAJEMEN PRODUK &amp; STOK
          </h1>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-[#d49b27] hover:bg-[#e0a934] text-[#0c0d0f] font-mono font-black text-xs uppercase tracking-wider self-start"
          >
            [ + REGISTER CARGO ]
          </button>
        )}
      </div>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 text-xs font-mono border-l-4 ${
            state?.error || msg.includes('LOCKED')
              ? 'bg-[#3b1214] border-[#dc2626] text-[#fca5a5]'
              : 'bg-[#1e2b18] border-[#6c804b] text-[#bef264]'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      {/* Form Create & Edit Produk */}
      {canManage && showForm && (
        <div className="bg-[#141619] p-6 border-2 border-[#d49b27]/60">
          <div className="flex items-center justify-between border-b border-[#2c3036] pb-3 mb-4">
            <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#d49b27]">
              {editing ? `EDIT MANIFEST // ${editing.sku}` : 'NEW CARGO ENTRY'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="text-xs font-mono text-[#8b8e94] hover:text-[#e8e6e1]"
            >
              [ CLOSE X ]
            </button>
          </div>

          <form action={formAction} key={editing?.id || 'create'} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">
                SKU {editing ? '(LOCKED)' : '*'}
              </label>
              <input
                name="sku"
                defaultValue={editing?.sku || ''}
                readOnly={!!editing}
                required
                placeholder="ELK-005"
                className={`w-full px-3 py-2 border border-[#3a3f47] text-sm font-mono ${
                  editing ? 'bg-[#1b1e22] text-[#7c7f85] cursor-not-allowed' : 'bg-[#0e1012] text-[#e8e6e1]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">NAMA PRODUK *</label>
              <input
                name="name"
                defaultValue={editing?.name || ''}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">KATEGORI *</label>
              <select
                name="category_id"
                defaultValue={editing?.category_id || ''}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              >
                <option value="">-- PILIH KATEGORI --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">HARGA BELI (RP) *</label>
              <input
                type="number"
                min="0"
                name="buy_price"
                defaultValue={editing?.buy_price ?? 0}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">HARGA JUAL (RP) *</label>
              <input
                type="number"
                min="0"
                name="sell_price"
                defaultValue={editing?.sell_price ?? 0}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">UNIT SATUAN *</label>
              <input
                name="unit"
                defaultValue={editing?.unit || ''}
                required
                placeholder="Pcs / Box / Unit"
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">MIN STOCK (SEVERE) *</label>
              <input
                type="number"
                min="0"
                name="min_stock"
                defaultValue={editing?.min_stock ?? 5}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">LOW STOCK (&gt; MIN) *</label>
              <input
                type="number"
                min="1"
                name="low_stock"
                defaultValue={editing?.low_stock ?? 15}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">CURRENT STOCK *</label>
              <input
                type="number"
                min="0"
                name="current_stock"
                defaultValue={editing?.current_stock ?? 0}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">LOKASI RAK *</label>
              <input
                name="rack_location"
                defaultValue={editing?.rack_location || ''}
                required
                placeholder="RAK-A01"
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">URL GAMBAR (OPSIONAL)</label>
              <input
                name="image_url"
                defaultValue={editing?.image_url || ''}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">DESKRIPSI</label>
              <input
                name="description"
                defaultValue={editing?.description || ''}
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono"
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 bg-[#26292e] text-[#d6d3cd] font-mono text-xs uppercase"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-[#d49b27] hover:bg-[#e0a934] text-[#0c0d0f] font-mono font-black text-xs uppercase disabled:opacity-50"
              >
                {isPending ? 'WRITING...' : editing ? '[ UPDATE MANIFEST ]' : '[ COMMIT CARGO ]'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Bar */}
      <form method="GET" className="bg-[#141619] p-4 border-2 border-[#2c3036] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          name="search"
          defaultValue={filters.search}
          placeholder="SEARCH NAME / SKU..."
          className="px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono lg:col-span-2 focus:outline-none focus:border-[#d49b27]"
        />
        <select
          name="categoryId"
          defaultValue={filters.categoryId}
          className="px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
        >
          <option value="">ALL CLASSES</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="stockStatus"
          defaultValue={filters.stockStatus}
          className="px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
        >
          <option value="">ALL STATUS</option>
          <option value="Normal">Normal</option>
          <option value="Low">Low</option>
          <option value="Severe">Severe</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
        <div className="flex gap-2">
          <select
            name="sortBy"
            defaultValue={filters.sortBy}
            className="flex-1 px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
          >
            <option value="created_at">LATEST</option>
            <option value="name">NAME (A-Z)</option>
            <option value="stock_asc">STOCK LOW-HIGH</option>
            <option value="stock_desc">STOCK HIGH-LOW</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-[#26292e] hover:bg-[#d49b27] hover:text-[#0c0d0f] border border-[#3a3f47] text-[#e8e6e1] font-mono text-xs font-bold uppercase transition"
          >
            SCAN
          </button>
        </div>
      </form>

      {/* Tabel Produk */}
      <div className="bg-[#141619] border-2 border-[#2c3036] overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#1b1e22] text-[#9a9d9e] font-mono text-xs uppercase border-b-2 border-[#2c3036]">
            <tr>
              <th className="p-3.5">SKU</th>
              <th className="p-3.5">CARGO NAME</th>
              <th className="p-3.5">CLASS</th>
              <th className="p-3.5">RACK</th>
              <th className="p-3.5">QTY</th>
              <th className="p-3.5">STATUS</th>
              <th className="p-3.5 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2c3036]">
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center font-mono text-xs text-[#7c7f85]">
                  NO MATCHING CARGO IN LEDGER.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-[#191c20]">
                  <td className="p-3.5 font-mono text-xs font-bold text-[#d49b27]">{p.sku}</td>
                  <td className="p-3.5">
                    <Link href={`/products/${p.id}`} className="font-bold text-[#e8e6e1] hover:text-[#d49b27]">
                      {p.name}
                    </Link>
                  </td>
                  <td className="p-3.5 text-xs text-[#8b8e94]">{p.category_name}</td>
                  <td className="p-3.5 font-mono text-xs text-[#a1a1aa]">{p.rack_location}</td>
                  <td className="p-3.5 font-mono font-bold text-[#e8e6e1]">
                    {p.current_stock} {p.unit}
                  </td>
                  <td className="p-3.5">
                    <StockBadge status={p.stock_status} />
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <Link
                      href={`/products/${p.id}`}
                      className="px-2.5 py-1 bg-[#1b1e22] border border-[#3a3f47] text-[#d6d3cd] font-mono text-xs uppercase hover:border-[#d49b27]"
                    >
                      INFO
                    </Link>
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEdit(p)}
                          className="px-2.5 py-1 bg-[#3b290e] text-[#facc15] border border-[#d49b27]/40 font-mono text-xs font-bold uppercase"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="px-2.5 py-1 bg-[#451416] text-[#fca5a5] border border-[#dc2626]/40 font-mono text-xs font-bold uppercase"
                        >
                          DEL
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
    </div>
  );
}
