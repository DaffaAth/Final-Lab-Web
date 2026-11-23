'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  createTransactionAction,
  editPendingTransactionAction,
  deletePendingTransactionAction,
  reviewTransactionAction,
  markTransactionShippedAction,
} from '@/app/actions/workflow';

export default function TransactionClient({ session, transactions, suppliers, products, receivedPOs, filters }) {
  const isStaff = session.role === 'staff_gudang';
  const isManager = session.role === 'warehouse_manager';

  const [state, formAction, isPending] = useActionState(createTransactionAction, null);
  const [trxType, setTrxType] = useState('incoming');
  const [selectedPO, setSelectedPO] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [msg, setMsg] = useState('');

  // State Edit Pending Transaction
  const [editingTrx, setEditingTrx] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [expandedTrxId, setExpandedTrxId] = useState(null);

  // State Reject Transaction (Manager)
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const today = new Date().toISOString().split('T')[0];

  function handlePOChange(poId) {
    setSelectedPO(poId);
    if (!poId) {
      setSelectedSupplier('');
      setItems([{ product_id: '', quantity: 1 }]);
      return;
    }
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Transaksi Barang Masuk &amp; Keluar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pencatatan stok real-time dengan persetujuan transaksional Warehouse Manager
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Jenis transaksi">
        {[
          { value: '', label: 'Semua Transaksi' },
          { value: 'incoming', label: 'Barang Masuk' },
          { value: 'outgoing', label: 'Barang Keluar' },
        ].map((tab) => (
          <Link
            key={tab.value || 'all'}
            href={transactionFilterHref(filters, { type: tab.value })}
            role="tab"
            aria-selected={filters.type === tab.value}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              filters.type === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form method="GET" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <input type="hidden" name="type" value={filters.type} />
        <input
          type="text"
          name="party"
          defaultValue={filters.party}
          placeholder="Supplier / customer"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm lg:col-span-2"
        />
        <input
          type="date"
          name="dateFrom"
          aria-label="Tanggal mulai"
          defaultValue={filters.dateFrom}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <input
          type="date"
          name="dateTo"
          aria-label="Tanggal sampai"
          defaultValue={filters.dateTo}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <select
          name="status"
          defaultValue={filters.status}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Semua Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Shipped">Shipped</option>
        </select>
        <div className="flex gap-2">
          <select
            name="sortBy"
            defaultValue={filters.sortBy}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="date_desc">Tanggal terbaru</option>
            <option value="date_asc">Tanggal terlama</option>
            <option value="created_desc">Baru dicatat</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold">
            Filter
          </button>
        </div>
      </form>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            state?.error || msg.includes('Gagal') || msg.includes('tidak') || msg.includes('wajib') || msg.includes('Hanya')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      {/* Form Catat Transaksi (Staff Gudang) */}
      {isStaff && (
        <form action={formAction} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800">Catat Transaksi Baru</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrxType('incoming');
                  setSelectedPO('');
                  setSelectedSupplier('');
                  setItems([{ product_id: '', quantity: 1 }]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  trxType === 'incoming'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                + Barang Masuk (Incoming)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrxType('outgoing');
                  setSelectedPO('');
                  setSelectedSupplier('');
                  setItems([{ product_id: '', quantity: 1 }]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  trxType === 'outgoing'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                - Barang Keluar (Outgoing)
              </button>
            </div>
          </div>

          <input type="hidden" name="type" value={trxType} />
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Transaksi *</label>
              <input
                type="date"
                name="transaction_date"
                defaultValue={today}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            {trxType === 'incoming' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Referensi PO Inspecting (Laporan Sesuai) *
                  </label>
                  <select
                    name="restock_order_id"
                    value={selectedPO}
                    onChange={(e) => handlePOChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">
                      {receivedPOs.length === 0
                        ? '-- Belum ada PO dengan laporan pemeriksaan Sesuai --'
                        : '-- Pilih PO --'}
                    </option>
                    {receivedPOs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} - {po.supplier_company}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier (otomatis dari PO)</label>
                  {selectedPO && <input type="hidden" name="supplier_id" value={selectedSupplier} />}
                  <select
                    name={selectedPO ? undefined : 'supplier_id'}
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Pilih Supplier --</option>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Customer / Tujuan Pengiriman *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  required
                  placeholder="Contoh: PT Retail Sejahtera / Cabang Makassar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan *</label>
            <input
              type="text"
              name="notes"
              placeholder="Nomor surat jalan / keterangan tambahan"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">Daftar Barang *</label>
              {trxType === 'outgoing' && (
                <button type="button" onClick={addRow} className="text-xs font-semibold text-blue-600 hover:underline">
                  + Tambah Produk
                </button>
              )}
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={item.product_id}
                  onChange={(e) => updateRow(idx, 'product_id', e.target.value)}
                  required
                  disabled={trxType === 'incoming'}
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
                  onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                  required
                  readOnly={trxType === 'incoming'}
                  className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                {items.length > 1 && trxType === 'outgoing' && (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
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
            {isPending ? 'Menyimpan...' : 'Simpan Transaksi (Pending)'}
          </button>
        </form>
      )}

      {/* Modal Edit Transaksi Pending (Staff) */}
      {isStaff && editingTrx && (
        <div className="bg-amber-50 p-5 rounded-xl border border-amber-300 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Edit Transaksi {editingTrx.transaction_number}</h3>
            <button onClick={() => setEditingTrx(null)} className="text-xs text-slate-600">✕ Batal</button>
          </div>
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Catatan"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
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
                disabled={editingTrx.type === 'incoming'}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (Stok: {p.current_stock})
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
                readOnly={editingTrx.type === 'incoming'}
                className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </div>
          ))}
          <button
            onClick={saveEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
          >
            Simpan Perubahan
          </button>
        </div>
      )}

      {/* Daftar Transaksi */}
      <div className="space-y-4">
        {transactions.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
            Belum ada riwayat transaksi.
          </div>
        ) : (
          transactions.map((trx) => (
            <div key={trx.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{trx.transaction_number}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        trx.type === 'incoming'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {trx.type === 'incoming' ? 'Barang Masuk' : 'Barang Keluar'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Tanggal: {new Date(trx.transaction_date).toLocaleDateString('id-ID')} •{' '}
                    {trx.type === 'incoming'
                      ? `Supplier: ${trx.supplier_company || '-'}${trx.po_number ? ` (PO: ${trx.po_number})` : ''}`
                      : `Tujuan: ${trx.customer_name || '-'}`}{' '}
                    • Dicatat oleh: {trx.created_by_name}
                  </p>
                </div>

                <span
                  className={`self-start px-3 py-1 rounded-full text-xs font-bold ${
                    trx.status === 'Approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : trx.status === 'Shipped'
                      ? 'bg-blue-100 text-blue-700'
                      : trx.status === 'Rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {trx.status}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedTrxId(expandedTrxId === trx.id ? null : trx.id)}
                  aria-expanded={expandedTrxId === trx.id}
                  className="self-start px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {expandedTrxId === trx.id ? 'Tutup Detail' : 'Lihat Detail'}
                </button>
              </div>

              {expandedTrxId === trx.id && (
                <div className="text-xs text-slate-600 space-y-1">
                <ul className="list-disc pl-5">
                  {(trx.items || []).map((it, idx) => (
                    <li key={idx}>
                      [{it.sku}] {it.product_name} — <strong>{it.quantity} {it.unit}</strong>
                    </li>
                  ))}
                </ul>
                {trx.notes && <p className="pt-1">Catatan: {trx.notes}</p>}
                {trx.reject_reason && (
                  <p className="text-red-600 font-semibold">Alasan Penolakan: {trx.reject_reason}</p>
                )}
                </div>
              )}

              {/* Aksi Staff pada Transaksi Pending / Approved Outgoing */}
              {isStaff && trx.status === 'Pending' && (
                <div className="pt-2 flex gap-2">
                  {trx.created_by === session.id && (
                    <button
                      onClick={() => startEdit(trx)}
                      className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold"
                    >
                      Edit
                    </button>
                  )}
                  {trx.created_by === session.id && (
                    <button
                      onClick={() => handleDelete(trx.id)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              )}

              {isStaff && trx.type === 'outgoing' && trx.status === 'Approved' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleShipped(trx.id)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Kirim Barang (Shipped)
                  </button>
                </div>
              )}

              {/* Aksi Manager pada Transaksi Pending */}
              {isManager && trx.status === 'Pending' && (
                <div className="pt-2 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(trx.id, 'Approved')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                    >
                      {trx.type === 'incoming' ? 'Approve & Tambah Stok' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === trx.id ? null : trx.id)}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>

                  {rejectId === trx.id && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Alasan penolakan wajib diisi..."
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        onClick={() => handleReview(trx.id, 'Rejected', rejectReason)}
                        className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Konfirmasi Tolak
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

function transactionFilterHref(filters, overrides) {
  const query = new URLSearchParams();
  const nextFilters = { ...filters, ...overrides };
  for (const key of ['type', 'status', 'dateFrom', 'dateTo', 'party', 'sortBy']) {
    if (nextFilters[key]) query.set(key, nextFilters[key]);
  }
  const search = query.toString();
  return search ? `/transactions?${search}` : '/transactions';
}