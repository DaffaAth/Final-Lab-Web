'use client';

import { useActionState, useState } from 'react';
import { saveCategoryAction, deleteCategoryAction } from '@/app/actions/master';

export default function CategoryClient({ categories }) {
  const [state, formAction, isPending] = useActionState(saveCategoryAction, null);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  async function handleDelete(id) {
    if (!confirm('Hapus kategori ini dari sistem?')) return;
    const res = await deleteCategoryAction(id);
    setMsg(res.error || res.success);
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#2c3036] pb-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
          CLASSIFICATION INDEX
        </span>
        <h1 className="text-2xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
          MANAJEMEN KATEGORI PRODUK
        </h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          action={formAction}
          key={editing?.id || 'new'}
          className="bg-[#141619] p-5 border-2 border-[#2c3036] space-y-4 h-fit"
        >
          <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-[#e8e6e1] border-b border-[#2c3036] pb-2">
            {editing ? 'EDIT CARGO CLASS' : 'NEW CARGO CLASS'}
          </h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">NAMA KATEGORI *</label>
            <input
              name="name"
              defaultValue={editing?.name || ''}
              required
              placeholder="Elektronik & Perangkat"
              className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">DESKRIPSI</label>
            <textarea
              name="description"
              defaultValue={editing?.description || ''}
              rows={3}
              className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-[#a1a1aa] mb-1">URL GAMBAR (OPSIONAL)</label>
            <input
              name="image_url"
              defaultValue={editing?.image_url || ''}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-[#d49b27] hover:bg-[#e0a934] text-[#0c0d0f] font-mono font-black text-xs uppercase disabled:opacity-50"
            >
              {isPending ? 'SAVING...' : editing ? '[ UPDATE ]' : '[ SAVE ]'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-2 bg-[#26292e] text-[#d6d3cd] font-mono text-xs uppercase"
              >
                CANCEL
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 bg-[#141619] border-2 border-[#2c3036] overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1b1e22] text-[#9a9d9e] font-mono text-xs uppercase border-b-2 border-[#2c3036]">
              <tr>
                <th className="p-3.5">KATEGORI</th>
                <th className="p-3.5">DESKRIPSI</th>
                <th className="p-3.5">ITEM</th>
                <th className="p-3.5 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2c3036]">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-[#191c20]">
                  <td className="p-3.5 font-bold uppercase text-[#e8e6e1]">{c.name}</td>
                  <td className="p-3.5 text-xs text-[#8b8e94]">{c.description || '-'}</td>
                  <td className="p-3.5 font-mono text-xs text-[#d49b27]">{c.product_count} SKU</td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => setEditing(c)}
                      className="px-2.5 py-1 bg-[#3b290e] text-[#facc15] border border-[#d49b27]/40 font-mono text-xs font-bold uppercase"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="px-2.5 py-1 bg-[#451416] text-[#fca5a5] border border-[#dc2626]/40 font-mono text-xs font-bold uppercase"
                    >
                      DEL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
