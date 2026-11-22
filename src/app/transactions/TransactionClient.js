'use client';

import { useActionState, useState } from 'react';
import {
  createTransactionAction,
  editPendingTransactionAction,
  deletePendingTransactionAction,
  reviewTransactionAction,
  markTransactionShippedAction,
} from '@/app/actions/workflow';

export default function TransactionClient({ session, transactions, suppliers, products, receivedPOs }) {
  const isStaff = session.role === 'staff_gudang';
  const isManager = session.role === 'warehouse_manager';

  const [state, formAction, isPending] = useActionState(createTransactionAction, null);
  const [trxType, setTrxType] = useState('incoming');
  const [selectedPO, setSelectedPO] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [msg, setMsg] = useState('');

  const [editingTrx, setEditingTrx] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState([]);

  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const today = new Date().toISOString().split('T')[0];

  function handlePOChange(poId) {
    setSelectedPO(poId);
    if (!poId) return;
    const found = receivedPOs.find((p) => String(p.id) === String(poId));
    if (found) {
      setSelectedSupplier(String(found.supplier_id));
      if (found.items && found.items.length > 0) {
        setItems(
          found.items.map((it) => ({
            product_id: String(it.product_id),
            quantity: it.quantity,
          }))
        );
      }
    }
  }

  function addRow() {
    setItems([...items, { product_id: '', quantity: 1 }]);
  }

  function updateRow(idx, field, val) {
    const copy = [...items];
    copy[idx][field] = val;
    setItems(copy);
  }

  function removeRow(idx) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  function startEdit(trx) {
    setEditingTrx(trx);
    setEditNotes(trx.notes || '');
    setEditItems(
      (trx.items || []).map((it) => ({
        product_id: String(it.product_id),
        quantity: it.quantity,
      }))
    );
  }

  async function saveEdit() {
    const res = await editPendingTransactionAction(editingTrx.id, editNotes, editItems);
    setMsg(res.error || res.success);
    if (res.success) setEditingTrx(null);
  }

  async function handleDelete(id) {
    if (!confirm('Hapus transaksi Pending ini?')) return;
    const res = await deletePendingTransactionAction(id);
    setMsg(res.error || res.success);
  }

  async function handleReview(id, decision, reason = '') {
    const res = await reviewTransactionAction(id, decision, reason);
    setMsg(res.error || res.success);
    if (res.success) {
      setRejectId(null);
      setRejectReason('');
    }
  }

  async function handleShipped(id) {
    const res = await markTransactionShippedAction(id);
    setMsg(res.error || res.success);
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#2c3036] pb-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
          DOCK GATEWAY // INCOMING &amp; OUTGOING LOGS
        </span>
        <h1 className="text-2xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
          TRANSAKSI BARANG MASUK &amp; KELUAR
        </h1>
      </div>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 text-xs font-mono border-l-4 ${
            state?.error || msg.includes('ERROR') || msg.includes('DENIED') || msg.includes('LOCKED') || msg.includes('INSUFFICIENT') || msg.includes('REQUIRED')
              ? 'bg-[#3b1214] border-[#dc2626] text-[#fca5a5]'
              : 'bg-[#1e2b18] border-[#6c804b] text-[#bef264]'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      {/* Form Catat Transaksi (Staff Gudang) */}
      {isStaff && (
        <form action={formAction} className="bg-[#141619] p-6 border-2 border-[#2c3036] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2c3036] pb-3">
            <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1]">
              LOG NEW MOVEMENT
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrxType('incoming');
                  setSelectedPO('');
                  setItems([{ product_id: '', quantity: 1 }]);
                }}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border ${
                  trxType === 'incoming'
                    ? 'bg-[#4d6332] text-[#e8e6e1] border-[#84a955]'
                    : 'bg-[#1b1e22] text-[#8b8e94] border-[#3a3f47]'
                }`}
              >
                + INCOMING CARGO
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrxType('outgoing');
                  setSelectedPO('');
                  setItems([{ product_id: '', quantity: 1 }]);
                }}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border ${
                  trxType === 'outgoing'
                    ? 'bg-[#d49b27] text-[#0c0d0f] border-[#facc15]'
                    : 'bg-[#1b1e22] text-[#8b8e94] border-[#3a3f47]'
                }`}
              >
                - OUTGOING DISPATCH
              </button>
            </div>
          </div>

          <input type="hidden" name="type" value={trxType} />
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">TANGGAL *</label>
              <input
                type="date"
                name="transaction_date"
                defaultValue={today}
                required
                className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              />
            </div>

            {trxType === 'incoming' ? (
              <>
                <div>
                  <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">
                    REF PO RECEIVED (OPSIONAL)
                  </label>
                  <select
                    name="restock_order_id"
                    value={selectedPO}
                    onChange={(e) => handlePOChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                  >
                    <option value="">-- MANUAL ENTRY (NO PO) --</option>
                    {receivedPOs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} - {po.supplier_company}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">SUPPLIER *</label>
                  <select
                    name="supplier_id"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                  >
                    <option value="">-- SELECT SUPPLIER --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name} ({s.username})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">
                  CUSTOMER / DESTINATION *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  required
                  placeholder="PT Retail Sejahtera / Algonquin Hub"
                  className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">NOTES / WAYBILL</label>
            <input
              type="text"
              name="notes"
              placeholder="Nomor surat jalan / keterangan"
              className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase text-[#a1a1aa]">CARGO LIST *</label>
              <button type="button" onClick={addRow} className="text-xs font-mono font-bold text-[#d49b27] hover:underline">
                [ + ADD CARGO ]
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={item.product_id}
                  onChange={(e) => updateRow(idx, 'product_id', e.target.value)}
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
                  onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                  required
                  className="w-28 px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
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
            {isPending ? 'RECORDING...' : '[ SUBMIT LOG (PENDING) ]'}
          </button>
        </form>
      )}

      {/* Edit Transaksi Pending (Staff) */}
      {isStaff && editingTrx && (
        <div className="bg-[#1e1b14] p-5 border-2 border-[#d49b27] space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-mono font-bold text-sm text-[#d49b27]">
              MODIFY PENDING LOG // {editingTrx.transaction_number}
            </h3>
            <button onClick={() => setEditingTrx(null)} className="text-xs font-mono text-[#8b8e94]">
              [ CANCEL X ]
            </button>
          </div>
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Catatan"
            className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
          />
          {editItems.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <select
                value={it.product_id}
                onChange={(e) => {
                  const copy = [...editItems];
                  copy[idx].product_id = e.target.value;
                  setEditItems(copy);
                }}
                className="flex-1 px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (STOCK: {p.current_stock})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={it.quantity}
                onChange={(e) => {
                  const copy = [...editItems];
                  copy[idx].quantity = e.target.value;
                  setEditItems(copy);
                }}
                className="w-28 px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
              />
            </div>
          ))}
          <button
            onClick={saveEdit}
            className="px-4 py-2 bg-[#d49b27] text-[#0c0d0f] font-mono font-black text-xs uppercase"
          >
            [ SAVE CHANGES ]
          </button>
        </div>
      )}

      {/* Daftar Transaksi */}
      <div className="space-y-4">
        {transactions.length === 0 ? (
          <div className="bg-[#141619] p-6 border-2 border-[#2c3036] text-center font-mono text-xs text-[#7c7f85]">
            NO TRANSACTION LOGS FOUND.
          </div>
        ) : (
          transactions.map((trx) => (
            <div key={trx.id} className="bg-[#141619] p-5 border-2 border-[#2c3036] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#2c3036] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-[#e8e6e1]">{trx.transaction_number}</span>
                    <span
                      className={`px-2 py-0.5 font-mono text-xs font-bold uppercase border ${
                        trx.type === 'incoming'
                          ? 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]'
                          : 'bg-[#3b290e] text-[#facc15] border-[#d49b27]'
                      }`}
                    >
                      {trx.type === 'incoming' ? 'INCOMING' : 'OUTGOING'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#8b8e94] mt-1">
                    {trx.type === 'incoming'
                      ? `VENDOR: ${trx.supplier_company || '-'}${trx.po_number ? ` (PO: ${trx.po_number})` : ''}`
                      : `DEST: ${trx.customer_name || '-'}`}{' '}
                    // BY: {trx.created_by_name}
                  </p>
                </div>

                <span
                  className={`self-start px-3 py-1 font-mono text-xs font-bold uppercase border ${
                    trx.status === 'Approved'
                      ? 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]'
                      : trx.status === 'Shipped'
                      ? 'bg-[#172554] text-[#93c5fd] border-[#3b82f6]'
                      : trx.status === 'Rejected'
                      ? 'bg-[#451416] text-[#fca5a5] border-[#dc2626]'
                      : 'bg-[#3b290e] text-[#facc15] border-[#d49b27]'
                  }`}
                >
                  {trx.status}
                </span>
              </div>

              <div className="text-xs font-mono text-[#a1a1aa] space-y-1">
                <ul className="list-disc pl-5">
                  {(trx.items || []).map((it, idx) => (
                    <li key={idx}>
                      [{it.sku}] {it.product_name} — <strong className="text-[#e8e6e1]">{it.quantity} {it.unit}</strong>
                    </li>
                  ))}
                </ul>
                {trx.notes && <p className="pt-1 text-[#8b8e94]">NOTES: {trx.notes}</p>}
                {trx.reject_reason && (
                  <p className="text-[#fca5a5] font-bold">REJECTION REASON: {trx.reject_reason}</p>
                )}
              </div>

              {/* Aksi Staff */}
              {isStaff && trx.status === 'Pending' && (
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => startEdit(trx)}
                    className="px-3 py-1.5 bg-[#3b290e] text-[#facc15] border border-[#d49b27]/40 font-mono text-xs font-bold uppercase"
                  >
                    EDIT
                  </button>
                  {trx.created_by === session.id && (
                    <button
                      onClick={() => handleDelete(trx.id)}
                      className="px-3 py-1.5 bg-[#451416] text-[#fca5a5] border border-[#dc2626]/40 font-mono text-xs font-bold uppercase"
                    >
                      DELETE
                    </button>
                  )}
                </div>
              )}

              {isStaff && trx.type === 'outgoing' && trx.status === 'Approved' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleShipped(trx.id)}
                    className="px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-mono text-xs font-bold uppercase"
                  >
                    [ DISPATCH / MARK SHIPPED ]
                  </button>
                </div>
              )}

              {/* Aksi Manager */}
              {isManager && trx.status === 'Pending' && (
                <div className="pt-2 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(trx.id, 'Approved')}
                      className="px-3.5 py-1.5 bg-[#4d6332] hover:bg-[#5e783d] text-[#e8e6e1] font-mono text-xs font-bold uppercase"
                    >
                      [ APPROVE &amp; UPDATE STOCK ]
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === trx.id ? null : trx.id)}
                      className="px-3.5 py-1.5 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] font-mono text-xs font-bold uppercase"
                    >
                      [ REJECT ]
                    </button>
                  </div>

                  {rejectId === trx.id && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Alasan penolakan wajib diisi..."
                        className="flex-1 px-3 py-1.5 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-xs font-mono"
                      />
                      <button
                        onClick={() => handleReview(trx.id, 'Rejected', rejectReason)}
                        className="px-3 py-1.5 bg-[#991b1b] text-white font-mono text-xs font-bold uppercase"
                      >
                        CONFIRM REJECT
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
