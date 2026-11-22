'use client';

import { useActionState, useState } from 'react';
import { createRestockOrderAction, updateRestockStatusAction } from '@/app/actions/workflow';

const RESTOCK_STEPS = ['Pending', 'Confirmed', 'In Transit', 'Received'];

export default function RestockClient({ session, orders, suppliers, products, suggestedProductId }) {
  const isManager = session.role === 'warehouse_manager';
  const isSupplier = session.role === 'supplier';

  const [state, formAction, isPending] = useActionState(createRestockOrderAction, null);
  const [items, setItems] = useState([{ product_id: String(suggestedProductId || ''), quantity: 1 }]);
  const [msg, setMsg] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const today = new Date().toISOString().split('T')[0];

  function addItemRow() {
    setItems([...items, { product_id: '', quantity: 1 }]);
  }

  function updateItemRow(idx, field, value) {
    const copy = [...items];
    copy[idx][field] = value;
    setItems(copy);
  }

  function removeItemRow(idx) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  async function handleStatusChange(orderId, newStatus, note = '') {
    const res = await updateRestockStatusAction(orderId, newStatus, note);
    setMsg(res.error || res.success);
    if (res.success) {
      setRejectId(null);
      setRejectNote('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Restock Order (Purchase Order)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Alur pengadaan stok: Manager Buat PO → Supplier Konfirmasi → In Transit → Received
        </p>
      </div>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            state?.error || msg.includes('wajib') || msg.includes('tidak')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      {/* Form Buat PO (Khusus Warehouse Manager) */}
      {isManager && (
        <form action={formAction} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800">Buat Permintaan Restock Baru</h2>
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Supplier *</label>
              <select
                name="supplier_id"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="">-- Supplier Approved --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company_name} ({s.username})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Order *</label>
              <input
                type="date"
                name="order_date"
                defaultValue={today}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Estimasi Tiba *</label>
              <input
                type="date"
                name="expected_delivery_date"
                defaultValue={today}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan *</label>
              <input
                type="text"
                name="notes"
                placeholder="Urgensi / keterangan"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">Daftar Produk Dipesan *</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                + Tambah Baris Produk
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={item.product_id}
                  onChange={(e) => updateItemRow(idx, 'product_id', e.target.value)}
                  required
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (Stok: {p.current_stock} {p.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                  required
                  className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-semibold"
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? 'Mengirim PO...' : 'Kirim Purchase Order'}
          </button>
        </form>
      )}

      {/* Daftar PO */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
            Belum ada data Restock Order.
          </div>
        ) : (
          orders.map((po) => (
            <div key={po.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="font-mono font-bold text-slate-800 text-base">{po.po_number}</span>
                  <p className="text-xs text-slate-500">
                    Supplier: <strong>{po.supplier_company}</strong> • Dibuat oleh: {po.created_by_name}
                  </p>
                </div>
                <span className="self-start px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {po.status}
                </span>
              </div>

              {po.status !== 'Rejected' && (
                <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Progress Restock Order">
                  {RESTOCK_STEPS.map((step, index) => {
                    const complete = index <= RESTOCK_STEPS.indexOf(po.status);
                    return (
                      <li
                        key={step}
                        className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${
                          complete
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {index + 1}. {step}
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="text-xs text-slate-500">
                Tanggal order: {new Date(po.order_date).toLocaleDateString('id-ID')} • Estimasi tiba:{' '}
                {new Date(po.expected_delivery_date).toLocaleDateString('id-ID')}
              </p>
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Item Pesanan:</p>
                <ul className="list-disc pl-5">
                  {(po.items || []).map((it, idx) => (
                    <li key={idx}>
                      [{it.sku}] {it.product_name} — <strong>{it.quantity} {it.unit}</strong>
                    </li>
                  ))}
                </ul>
                {po.notes && <p className="pt-1">Catatan Manager: {po.notes}</p>}
                {po.status_notes && (
                  <p className="text-red-600 font-medium">Catatan Status: {po.status_notes}</p>
                )}
              </div>

              {/* Aksi Supplier */}
              {isSupplier && po.status === 'Pending' && (
                <div className="pt-2 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange(po.id, 'Confirmed')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Confirm PO
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === po.id ? null : po.id)}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Reject PO
                    </button>
                  </div>
                  {rejectId === po.id && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Alasan penolakan wajib diisi..."
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        onClick={() => handleStatusChange(po.id, 'Rejected', rejectNote)}
                        className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Kirim Penolakan
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Aksi Manager */}
              {isManager && po.status === 'Confirmed' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleStatusChange(po.id, 'In Transit')}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Tandai In Transit
                  </button>
                </div>
              )}
              {isManager && po.status === 'In Transit' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleStatusChange(po.id, 'Received')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Tandai Received (Barang Tiba)
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
