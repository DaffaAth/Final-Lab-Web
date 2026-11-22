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
    'Out of Stock': 'bg-slate-200 text-slate-800',
    Severe: 'bg-red-100 text-red-700',
    Low: 'bg-amber-100 text-amber-800',
    Normal: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/products" className="text-sm text-blue-600 hover:underline">
              ← Kembali ke Daftar Produk
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 mt-1">{product.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {session.role === 'warehouse_manager' && product.current_stock <= product.low_stock && (
              <Link
                href={`/restock?productId=${product.id}`}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                Buat Restock Order
              </Link>
            )}
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${badgeColors[product.stock_status]}`}>
              {product.stock_status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          {product.image_url && (
            <div className="md:col-span-2">
              <img
                src={product.image_url}
                alt={product.name}
                className="max-h-64 w-full rounded-lg bg-slate-50 object-contain"
              />
            </div>
          )}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Kode SKU</span>
              <span className="font-mono font-bold text-slate-800">{product.sku}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Kategori</span>
              <span className="font-semibold text-slate-800">{product.category_name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Lokasi Rak</span>
              <span className="font-semibold text-slate-800">{product.rack_location}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Harga Beli</span>
              <span className="font-semibold text-slate-800">
                Rp {Number(product.buy_price).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Harga Jual</span>
              <span className="font-semibold text-slate-800">
                Rp {Number(product.sell_price).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Stok Tersedia</span>
              <span className="font-bold text-lg text-blue-600">
                {product.current_stock} {product.unit}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Batas Minimum (Severe)</span>
              <span className="font-semibold text-red-600">{product.min_stock} {product.unit}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Batas Low Stock</span>
              <span className="font-semibold text-amber-600">{product.low_stock} {product.unit}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Deskripsi Produk</span>
              <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">
                {product.description || 'Tidak ada deskripsi tambahan.'}
              </p>
            </div>
          </div>
        </div>

        {/* 5 Riwayat Transaksi Terakhir */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-bold text-slate-800">5 Riwayat Transaksi Terakhir</h2>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3.5">No. Transaksi</th>
                <th className="p-3.5">Jenis</th>
                <th className="p-3.5">Jumlah</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Dicatat Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {product.recent_transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    Belum ada riwayat transaksi untuk produk ini.
                  </td>
                </tr>
              ) : (
                product.recent_transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="p-3.5 font-mono font-semibold text-slate-800">
                      {tx.transaction_number}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          tx.type === 'incoming'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.type === 'incoming' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold">
                      {tx.type === 'incoming' ? '+' : '-'}{tx.quantity} {product.unit}
                    </td>
                    <td className="p-3.5">{tx.status}</td>
                    <td className="p-3.5 text-slate-600">{tx.created_by_name}</td>
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
