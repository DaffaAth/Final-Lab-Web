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

  async function handleVerify(id, status) {
    const res = await verifySupplierAction(id, status);
    setFeedback(res.error || res.success);
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#2c3036] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
            OPERATIONAL TELEMETRY // LIVE FEED
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
            OPERATOR: {session.username}
          </h1>
        </div>
        <span className="text-xs font-mono text-[#7c7f85]">
          SECTOR: BROKER-IND-06
        </span>
      </div>

      {feedback && (
        <div className="p-3 bg-[#1b222c] border-l-4 border-[#d49b27] text-[#f3d078] text-xs font-mono">
          {feedback}
        </div>
      )}

      {/* ==================== DASHBOARD ADMIN ==================== */}
      {session.role === 'admin' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">TOTAL CARGO SKUs</p>
              <p className="text-3xl font-black font-mono text-[#e8e6e1] mt-1">{data.stats.total_products}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">MONTHLY LOGS</p>
              <p className="text-3xl font-black font-mono text-[#d49b27] mt-1">{data.stats.monthly_transactions}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">ASSET VALUATION</p>
              <p className="text-xl font-black font-mono text-[#84a955] mt-2">
                {formatRupiah(data.stats.inventory_value)}
              </p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">PENDING VENDORS</p>
              <p className="text-3xl font-black font-mono text-[#ef4444] mt-1">
                {data.stats.pending_suppliers_count}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/products" className="px-4 py-2 bg-[#d49b27] text-[#0c0d0f] font-mono font-black text-xs uppercase tracking-wider hover:bg-[#e0a934]">
              [ + MANAGE CARGO ]
            </Link>
            <Link href="/categories" className="px-4 py-2 bg-[#1b1e22] border border-[#3a3f47] text-[#d6d3cd] font-mono text-xs uppercase tracking-wider hover:border-[#d49b27]">
              CLASSES
            </Link>
            <Link href="/suppliers" className="px-4 py-2 bg-[#1b1e22] border border-[#3a3f47] text-[#d6d3cd] font-mono text-xs uppercase tracking-wider hover:border-[#d49b27]">
              VENDORS
            </Link>
            <Link href="/transactions" className="px-4 py-2 bg-[#1b1e22] border border-[#3a3f47] text-[#d6d3cd] font-mono text-xs uppercase tracking-wider hover:border-[#d49b27]">
              AUDIT LOGS
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#141619] border-2 border-[#2c3036] p-5">
              <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1] border-b border-[#2c3036] pb-3 mb-3">
                VENDOR CLEARANCE QUEUE ({data.pendingSuppliers.length})
              </h2>
              {data.pendingSuppliers.length === 0 ? (
                <p className="text-xs font-mono text-[#7c7f85]">NO PENDING VENDOR DOSSIERS.</p>
              ) : (
                <div className="space-y-3">
                  {data.pendingSuppliers.map((s) => (
                    <div key={s.id} className="p-3 bg-[#1b1e22] border border-[#2c3036] flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm text-[#e8e6e1] uppercase">{s.company_name}</p>
                        <p className="text-xs font-mono text-[#8b8e94]">{s.username} // {s.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerify(s.id, 'approved')}
                          className="px-3 py-1 bg-[#4d6332] hover:bg-[#5e783d] text-[#e8e6e1] font-mono text-xs font-bold uppercase"
                        >
                          APPROVE
                        </button>
                        <button
                          onClick={() => handleVerify(s.id, 'rejected')}
                          className="px-3 py-1 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] font-mono text-xs font-bold uppercase"
                        >
                          REJECT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#141619] border-2 border-[#2c3036] p-5">
              <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#ef4444] border-b border-[#2c3036] pb-3 mb-3">
                CRITICAL STOCK ALERTS (SEVERE / DEPLETED)
              </h2>
              {data.alertProducts.length === 0 ? (
                <p className="text-xs font-mono text-[#84a955]">ALL STOCK LEVELS NOMINAL.</p>
              ) : (
                <div className="divide-y divide-[#2c3036]">
                  {data.alertProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link href={`/products/${p.id}`} className="font-bold text-sm text-[#e8e6e1] hover:text-[#d49b27]">
                          {p.name}
                        </Link>
                        <p className="text-xs font-mono text-[#8b8e94]">SKU: {p.sku} // REM: {p.current_stock} {p.unit}</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase border ${
                          p.stock_status === 'Out of Stock'
                            ? 'bg-[#26292e] text-[#a1a1aa] border-[#52525b]'
                            : 'bg-[#451416] text-[#fca5a5] border-[#dc2626]'
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">RESTOCK NEEDED</p>
              <p className="text-3xl font-black font-mono text-[#ef4444] mt-1">{data.stats.low_or_worse_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">PENDING APPROVAL</p>
              <p className="text-3xl font-black font-mono text-[#d49b27] mt-1">{data.stats.pending_transactions_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">ACTIVE POs</p>
              <p className="text-3xl font-black font-mono text-[#60a5fa] mt-1">{data.stats.active_po_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">ASSET VALUATION</p>
              <p className="text-xl font-black font-mono text-[#84a955] mt-2">
                {formatRupiah(data.stats.inventory_value)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#141619] border-2 border-[#2c3036] p-5">
              <div className="flex items-center justify-between border-b border-[#2c3036] pb-3 mb-3">
                <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1]">
                  TRANSACTIONS AWAITING CLEARANCE
                </h2>
                <Link href="/transactions" className="text-xs font-mono text-[#d49b27] hover:underline">
                  ALL LOGS →
                </Link>
              </div>
              {data.pendingTransactions.length === 0 ? (
                <p className="text-xs font-mono text-[#7c7f85]">QUEUE EMPTY.</p>
              ) : (
                <div className="divide-y divide-[#2c3036]">
                  {data.pendingTransactions.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-mono font-bold text-sm text-[#e8e6e1]">{t.transaction_number}</p>
                        <p className="text-xs font-mono text-[#8b8e94]">LOGGED BY: {t.created_by_name}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 font-mono text-xs font-bold uppercase border ${
                        t.type === 'incoming'
                          ? 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]'
                          : 'bg-[#3b290e] text-[#facc15] border-[#d49b27]'
                      }`}>
                        {t.type === 'incoming' ? 'INCOMING' : 'OUTGOING'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#141619] border-2 border-[#2c3036] p-5">
              <div className="flex items-center justify-between border-b border-[#2c3036] pb-3 mb-3">
                <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1]">
                  LOW STOCK WARNINGS
                </h2>
                <Link href="/restock" className="text-xs font-mono text-[#d49b27] hover:underline">
                  ISSUE PO →
                </Link>
              </div>
              {data.alertProducts.length === 0 ? (
                <p className="text-xs font-mono text-[#84a955]">ALL STOCK LEVELS NOMINAL.</p>
              ) : (
                <div className="divide-y divide-[#2c3036]">
                  {data.alertProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-[#e8e6e1]">{p.name}</p>
                        <p className="text-xs font-mono text-[#8b8e94]">STOCK: {p.current_stock} {p.unit} (MIN: {p.min_stock})</p>
                      </div>
                      <span className={`px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase border ${
                        p.stock_status === 'Out of Stock'
                          ? 'bg-[#26292e] text-[#a1a1aa] border-[#52525b]'
                          : p.stock_status === 'Severe'
                          ? 'bg-[#451416] text-[#fca5a5] border-[#dc2626]'
                          : 'bg-[#3b290e] text-[#facc15] border-[#d49b27]'
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
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">TODAY LOGS</p>
              <p className="text-3xl font-black font-mono text-[#e8e6e1] mt-1">{data.stats.today_transactions}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">AWAITING MANAGER</p>
              <p className="text-3xl font-black font-mono text-[#d49b27] mt-1">{data.stats.pending_approval_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">READY FOR DISPATCH</p>
              <p className="text-3xl font-black font-mono text-[#60a5fa] mt-1">{data.stats.ready_to_ship_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">PO RECEIVED AT DOCK</p>
              <p className="text-3xl font-black font-mono text-[#84a955] mt-1">{data.stats.received_po_count}</p>
            </div>
          </div>

          <div className="bg-[#141619] border-2 border-[#2c3036] p-5">
            <div className="flex items-center justify-between border-b border-[#2c3036] pb-3 mb-3">
              <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1]">
                RECENT DOCK MOVEMENTS
              </h2>
              <Link href="/transactions" className="px-3.5 py-1.5 bg-[#d49b27] text-[#0c0d0f] font-mono font-black text-xs uppercase">
                [ + NEW ENTRY ]
              </Link>
            </div>
            <div className="divide-y divide-[#2c3036]">
              {data.recentTransactions.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-sm text-[#e8e6e1]">{t.transaction_number}</p>
                    <p className="text-xs font-mono text-[#8b8e94]">
                      {t.type === 'incoming' ? 'INCOMING' : 'OUTGOING'} // BY {t.created_by_name}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-[#1b1e22] border border-[#3a3f47] text-[#d6d3cd] font-mono text-xs uppercase">
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ==================== DASHBOARD SUPPLIER ==================== */}
      {session.role === 'supplier' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">PENDING POs</p>
              <p className="text-3xl font-black font-mono text-[#d49b27] mt-1">{data.stats.pending_po_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">IN TRANSIT / CONFIRMED</p>
              <p className="text-3xl font-black font-mono text-[#60a5fa] mt-1">{data.stats.ongoing_po_count}</p>
            </div>
            <div className="bg-[#141619] p-5 border-2 border-[#2c3036]">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#7c7f85]">DELIVERED TO DOCK</p>
              <p className="text-3xl font-black font-mono text-[#84a955] mt-1">{data.stats.completed_po_count}</p>
            </div>
          </div>

          <div className="bg-[#141619] border-2 border-[#2c3036] p-5">
            <div className="flex items-center justify-between border-b border-[#2c3036] pb-3 mb-3">
              <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1]">
                PURCHASE ORDERS AWAITING CONFIRMATION
              </h2>
              <Link href="/restock" className="text-xs font-mono text-[#d49b27] hover:underline">
                MANAGE POs →
              </Link>
            </div>
            {data.pendingOrders.length === 0 ? (
              <p className="text-xs font-mono text-[#7c7f85]">NO NEW PURCHASE ORDERS.</p>
            ) : (
              <div className="divide-y divide-[#2c3036]">
                {data.pendingOrders.map((po) => (
                  <div key={po.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm text-[#e8e6e1]">{po.po_number}</p>
                      <p className="text-xs font-mono text-[#8b8e94]">NOTES: {po.notes || '-'}</p>
                    </div>
                    <Link href="/restock" className="px-3.5 py-1.5 bg-[#d49b27] text-[#0c0d0f] font-mono font-black text-xs uppercase">
                      [ INSPECT PO ]
                    </Link>
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
