import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getProductDetail } from '@/app/actions/master';
import AppShell from '@/components/AppShell';

export default async function ProductDetailPage({ params }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'supplier') redirect('/dashboard');

  const { id } = await params;
  const product = await getProductDetail(Number(id));
  if (!product) notFound();

  const badgeColors = {
    'Out of Stock': 'bg-[#26292e] text-[#a1a1aa] border-[#52525b]',
    Severe: 'bg-[#451416] text-[#fca5a5] border-[#dc2626]',
    Low: 'bg-[#3b290e] text-[#facc15] border-[#d49b27]',
    Normal: 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]',
  };

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        <div className="border-b-2 border-[#2c3036] pb-4 flex items-center justify-between">
          <div>
            <Link href="/products" className="text-xs font-mono text-[#d49b27] hover:underline">
              ← RETURN TO INVENTORY LEDGER
            </Link>
            <h1 className="text-2xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
              {product.name}
            </h1>
          </div>
          <span className={`px-3 py-1 font-mono text-xs font-bold uppercase border ${badgeColors[product.stock_status]}`}>
            {product.stock_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#141619] p-6 border-2 border-[#2c3036]">
          <div className="space-y-3 text-sm font-mono">
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">SKU CODE</span>
              <span className="font-bold text-[#d49b27]">{product.sku}</span>
            </div>
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">CARGO CLASS</span>
              <span className="text-[#e8e6e1]">{product.category_name}</span>
            </div>
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">RACK SECTOR</span>
              <span className="text-[#e8e6e1]">{product.rack_location}</span>
            </div>
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">BUY PRICE</span>
              <span className="text-[#e8e6e1]">
                Rp {Number(product.buy_price).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7c7f85]">SELL PRICE</span>
              <span className="text-[#e8e6e1]">
                Rp {Number(product.sell_price).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm font-mono">
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">AVAILABLE STOCK</span>
              <span className="font-black text-lg text-[#84a955]">
                {product.current_stock} {product.unit}
              </span>
            </div>
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">SEVERE THRESHOLD</span>
              <span className="text-[#ef4444]">{product.min_stock} {product.unit}</span>
            </div>
            <div className="flex justify-between border-b border-[#2c3036] pb-2">
              <span className="text-[#7c7f85]">LOW THRESHOLD</span>
              <span className="text-[#d49b27]">{product.low_stock} {product.unit}</span>
            </div>
            <div>
              <span className="text-[#7c7f85] block mb-1">MANIFEST NOTES</span>
              <p className="text-xs text-[#d6d3cd] bg-[#0e1012] border border-[#2c3036] p-3">
                {product.description || 'NO ADDITIONAL NOTES.'}
              </p>
            </div>
          </div>
        </div>

        {/* 5 Riwayat Transaksi Terakhir */}
        <div className="bg-[#141619] border-2 border-[#2c3036] overflow-x-auto">
          <div className="p-4 border-b-2 border-[#2c3036] bg-[#1b1e22]">
            <h2 className="font-mono font-bold uppercase tracking-wider text-xs text-[#e8e6e1]">
              LAST 5 MOVEMENT RECORDS
            </h2>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-[#181a1e] text-[#9a9d9e] font-mono text-xs uppercase border-b border-[#2c3036]">
              <tr>
                <th className="p-3.5">TRX ID</th>
                <th className="p-3.5">TYPE</th>
                <th className="p-3.5">QTY</th>
                <th className="p-3.5">STATUS</th>
                <th className="p-3.5">OPERATOR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2c3036]">
              {product.recent_transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center font-mono text-xs text-[#7c7f85]">
                    NO MOVEMENT HISTORY RECORDED.
                  </td>
                </tr>
              ) : (
                product.recent_transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="p-3.5 font-mono font-bold text-[#e8e6e1]">
                      {tx.transaction_number}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 font-mono text-xs font-bold uppercase border ${
                          tx.type === 'incoming'
                            ? 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]'
                            : 'bg-[#3b290e] text-[#facc15] border-[#d49b27]'
                        }`}
                      >
                        {tx.type === 'incoming' ? 'INCOMING' : 'OUTGOING'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-[#e8e6e1]">
                      {tx.type === 'incoming' ? '+' : '-'}{tx.quantity} {product.unit}
                    </td>
                    <td className="p-3.5 font-mono text-xs uppercase">{tx.status}</td>
                    <td className="p-3.5 font-mono text-xs text-[#8b8e94]">{tx.created_by_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
