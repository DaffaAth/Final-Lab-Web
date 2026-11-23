'use client';

import { useState } from 'react';
import Link from 'next/link';
import { verifySupplierAction } from '@/app/actions/master';

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(val || 0));
}

export default function DashboardClient({ session, data }) {
  const [feedback, setFeedback] = useState('');

  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  async function handleVerify(id, status, reason = '') {
    const res = await verifySupplierAction(id, status, reason);
    setFeedback(res.error || res.success);
    if (res.success) {
      setRejectId(null);
      setRejectReason('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Selamat Datang, {session.username}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Ringkasan operasional gudang real-time
        </p>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          {feedback}
        </div>
      )}

      {/* ==================== DASHBOARD ADMIN ==================== */}
      {session.role === 'admin' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Produk</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{data.stats.total_products}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Transaksi Bulan Ini</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{data.stats.monthly_transactions}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Nilai Inventori</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                {formatRupiah(data.stats.inventory_value)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Supplier Pending</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {data.stats.pending_suppliers_count}
              </p>
            </div>
          </div>

          {/* Quick Access */}
          <div className="flex flex-wrap gap-2">
            <Link href="/products" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
              + Kelola Produk
            </Link>
            <Link href="/categories" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              Kelola Kategori
            </Link>
            <Link href="/suppliers" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              Semua Supplier
            </Link>
            <Link href="/transactions" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              Log Transaksi
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Suppliers Approval */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-bold text-slate-800 mb-3">
                Persetujuan Supplier Pending ({data.pendingSuppliers.length})
              </h2>
              {data.pendingSuppliers.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada pendaftaran Supplier yang menunggu.</p>
              ) : (
                <div className="space-y-3">
                  {data.pendingSuppliers.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg border border-slate-200 space-y-2">
                     <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{s.company_name}</p>
                        <p className="text-xs text-slate-500">{s.username} • {s.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerify(s.id, 'approved')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectId(rejectId === s.id ? null : s.id);
                            setRejectReason('');
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                     </div>
                     {rejectId === s.id && (
                       <div className="flex gap-2">
                         <input
                           value={rejectReason}
                           onChange={(e) => setRejectReason(e.target.value)}
                           placeholder="Alasan penolakan (wajib)"
                           className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
                         />
                         <button
                           onClick={() => handleVerify(s.id, 'rejected', rejectReason)}
                           className="px-3 py-1 bg-red-700 text-white rounded text-xs font-semibold"
                         >
                           Kirim
                         </button>
                       </div>
                     )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alert Produk Severe / Out of Stock */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-bold text-slate-800 mb-3">
                Alert Stok Kritis (Severe &amp; Out of Stock)
              </h2>
              {data.alertProducts.length === 0 ? (
                <p className="text-sm text-emerald-600">Seluruh stok produk dalam kondisi aman.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.alertProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link href={`/products/${p.id}`} className="font-semibold text-sm text-slate-800 hover:text-blue-600">
                          {p.name}
                        </Link>
                        <p className="text-xs text-slate-500">SKU: {p.sku} • Sisa: {p.current_stock} {p.unit}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.stock_status === 'Out of Stock'
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {p.stock_status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== DASHBOARD WAREHOUSE MANAGER ==================== */}
      {session.role === 'warehouse_manager' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Perlu Restock (Low/Severe)</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{data.stats.low_or_worse_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Unit Stok</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {Number(data.stats.total_stock_units).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Transaksi Pending</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{data.stats.pending_transactions_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">PO Restock Berjalan</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{data.stats.active_po_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Nilai Inventori</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                {formatRupiah(data.stats.inventory_value)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-800">Transaksi Menunggu Approval</h2>
                <Link href="/transactions" className="text-xs text-blue-600 font-semibold hover:underline">
                  Lihat Semua →
                </Link>
              </div>
              {data.pendingTransactions.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada transaksi Pending.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.pendingTransactions.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{t.transaction_number}</p>
                        <p className="text-xs text-slate-500">Oleh: {t.created_by_name}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        t.type === 'incoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.type === 'incoming' ? 'Barang Masuk' : 'Barang Keluar'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-800">Peringatan Stok Minimum</h2>
                <Link href="/restock" className="text-xs text-blue-600 font-semibold hover:underline">
                  Buat Restock PO →
                </Link>
              </div>
              {data.alertProducts.length === 0 ? (
                <p className="text-sm text-emerald-600">Semua stok berada di atas batas Low.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.alertProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">Stok: {p.current_stock} {p.unit} (Min: {p.min_stock})</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        p.stock_status === 'Out of Stock'
                          ? 'bg-slate-200 text-slate-800'
                          : p.stock_status === 'Severe'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.stock_status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== DASHBOARD STAFF GUDANG ==================== */}
      {session.role === 'staff_gudang' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Transaksi Hari Ini</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{data.stats.today_transactions}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Menunggu Approval</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{data.stats.pending_approval_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Siap Dikirim (Approved)</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{data.stats.ready_to_ship_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">PO Received Siap Masuk</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{data.stats.received_po_count}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">Transaksi Hari Ini</h2>
              <Link href="/transactions" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
                + Catat Transaksi Baru
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentTransactions.length === 0 ? (
                <p className="py-2.5 text-sm text-slate-500">Belum ada transaksi hari ini.</p>
              ) : (
                data.recentTransactions.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{t.transaction_number}</p>
                      <p className="text-xs text-slate-500">
                        {t.type === 'incoming' ? 'Barang Masuk' : 'Barang Keluar'} • Oleh {t.created_by_name}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                      {t.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== DASHBOARD SUPPLIER ==================== */}
      {session.role === 'supplier' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">PO Perlu Konfirmasi</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{data.stats.pending_po_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">PO Diproses / Dikirim</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{data.stats.ongoing_po_count}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">PO Diterima Gudang</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{data.stats.completed_po_count}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">Purchase Order Menunggu Konfirmasi Anda</h2>
              <Link href="/restock" className="text-xs text-blue-600 font-semibold hover:underline">
                Kelola Semua PO →
              </Link>
            </div>
            {data.pendingOrders.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada pesanan restock baru yang menunggu konfirmasi.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.pendingOrders.map((po) => (
                  <div key={po.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{po.po_number}</p>
                      <p className="text-xs text-slate-500">Catatan: {po.notes || '-'}</p>
                    </div>
                    <Link href="/restock" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
                      Tinjau PO
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-3">Riwayat Pengiriman ke Gudang</h2>
            {data.recentDeliveries.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada transaksi pengiriman kepada gudang.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentDeliveries.map((delivery) => (
                  <div key={delivery.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{delivery.transaction_number}</p>
                      <p className="text-xs text-slate-500">
                        {delivery.po_number ? `PO ${delivery.po_number} • ` : ''}
                        {new Date(delivery.transaction_date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                      {delivery.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}