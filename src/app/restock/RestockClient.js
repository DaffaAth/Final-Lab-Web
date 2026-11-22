'use client';

import { useActionState, useState } from 'react';
import { createRestockOrderAction, updateRestockStatusAction } from '@/app/actions/workflow';

export default function RestockClient({ session, orders, suppliers, products }) {
  const isManager = session.role === 'warehouse_manager';
  const isSupplier = session.role === 'supplier';

  const [state, formAction, isPending] = useActionState(createRestockOrderAction, null);
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
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
      <div className="border-b-2 border-[#2c3036] pb-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
          SUPPLY CHAIN DISPATCH // PURCHASE ORDERS
        </span>
        <h1 className="text-2xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
          RESTOCK ORDER (PO)
        </h1>
      </div>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 text-xs font-mono border-l-4 ${
            state?.error || msg.includes('REQUIRED') || msg.includes('ERROR')
              ? 'bg-[#3b1214] border-[#dc2626] text-[#fca5a5]'
              : 'bg-[#1e2b18] border-[#6c804b] text-[#bef264]'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      {/* Form Buat PO (Warehouse Manager) */}
      {isManager && (
        <form action={formAction} className="bg-[#141619] p-6 border-2 border-[#2c3036] space-y-4">
          <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1] border-b border-[#2c3036] pb-2">
            ISSUE NEW PURCHASE ORDER
          </h2>
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">SUPPLIER *</label>
              <select
                name="supplier_id"
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              >
                <option value="">-- APPROVED SUPPLIERS --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company_name} ({s.username})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">ORDER DATE *</label>
              <input
                type="date"
                name="order_date"
                defaultValue={today}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">ETA DELIVERY *</label>
              <input
                type="date"
                name="expected_delivery_date"
                defaultValue={today}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">NOTES</label>
              <input
                type="text"
                name="notes"
                placeholder="Priority / instructions"
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase text-[#a1a1aa]">CARGO ITEMS *</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-mono font-bold text-[#d49b27] hover:underline"
              >
                [ + ADD LINE ]
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={item.product_id}
                  onChange={(e) => updateItemRow(idx, 'product_id', e.target.value)}
                  required
                  className="flex-1 px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                >
                  <option value="">-- SELECT CARGO --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (STOCK: {p.current_stock} {p.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                  required
                  className="w-28 px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="px-3 py-2 bg-[#451416] text-[#fca5a5] font-mono text-xs uppercase"
                  >
                    DEL
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 bg-[#d49b27] hover:bg-[#e0a934] text-[#0c0d0f] font-mono font-black text-xs uppercase disabled:opacity-50"
          >
            {isPending ? 'DISPATCHING...' : '[ TRANSMIT PO ]'}
          </button>
        </form>
      )}

      {/* Daftar PO */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-[#141619] p-6 border-2 border-[#2c3036] text-center font-mono text-xs text-[#7c7f85]">
            NO PURCHASE ORDERS IN RECORD.
          </div>
        ) : (
          orders.map((po) => (
            <div key={po.id} className="bg-[#141619] p-5 border-2 border-[#2c3036] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#2c3036] pb-3">
                <div>
                  <span className="font-mono font-black text-[#d49b27] text-base">{po.po_number}</span>
                  <p className="text-xs font-mono text-[#8b8e94]">
                    VENDOR: <strong className="text-[#e8e6e1]">{po.supplier_company}</strong> // BY: {po.created_by_name}
                  </p>
                </div>
                <span className="self-start px-3 py-1 font-mono text-xs font-bold uppercase bg-[#1b1e22] text-[#d49b27] border border-[#d49b27]/50">
                  {po.status}
                </span>
              </div>

              <div className="text-xs font-mono text-[#a1a1aa] space-y-1">
                <p className="font-bold text-[#e8e6e1] uppercase">MANIFEST ITEMS:</p>
                <ul className="list-disc pl-5">
                  {(po.items || []).map((it, idx) => (
                    <li key={idx}>
                      [{it.sku}] {it.product_name} — <strong className="text-[#e8e6e1]">{it.quantity} {it.unit}</strong>
                    </li>
                  ))}
                </ul>
                {po.notes && <p className="pt-1 text-[#8b8e94]">MANAGER NOTES: {po.notes}</p>}
                {po.status_notes && (
                  <p className="text-[#fca5a5] font-bold">STATUS NOTES: {po.status_notes}</p>
                )}
              </div>

              {/* Aksi Supplier */}
              {isSupplier && po.status === 'Pending' && (
                <div className="pt-2 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange(po.id, 'Confirmed')}
                      className="px-3.5 py-1.5 bg-[#4d6332] hover:bg-[#5e783d] text-[#e8e6e1] font-mono text-xs font-bold uppercase"
                    >
                      [ CONFIRM PO ]
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === po.id ? null : po.id)}
                      className="px-3.5 py-1.5 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] font-mono text-xs font-bold uppercase"
                    >
                      [ REJECT PO ]
                    </button>
                  </div>
                  {rejectId === po.id && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Alasan penolakan wajib diisi..."
                        className="flex-1 px-3 py-1.5 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                      />
                      <button
                        onClick={() => handleStatusChange(po.id, 'Rejected', rejectNote)}
                        className="px-3 py-1.5 bg-[#991b1b] text-white font-mono text-xs font-bold uppercase"
                      >
                        SEND REJECTION
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
                    className="px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-mono text-xs font-bold uppercase"
                  >
                    [ SET: IN TRANSIT ]
                  </button>
                </div>
              )}
              {isManager && po.status === 'In Transit' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleStatusChange(po.id, 'Received')}
                    className="px-3.5 py-1.5 bg-[#4d6332] hover:bg-[#5e783d] text-[#e8e6e1] font-mono text-xs font-bold uppercase"
                  >
                    [ SET: RECEIVED AT DOCK ]
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
