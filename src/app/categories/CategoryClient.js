'use client';

import { useActionState, useState } from 'react';
import { saveCategoryAction, deleteCategoryAction } from '@/app/actions/master';
import ConfirmDialog from '@/components/ConfirmDialog';

// Gambar kecil kategori. Bila URL kosong/tidak valid/gagal dimuat, tampil huruf awal nama kategori.
function CategoryThumb({ url, name }) {
  const [failed, setFailed] = useState(false);
  const cleanUrl = typeof url === 'string' ? url.trim() : '';
  const valid = /^(https?:\/\/|\/api\/uploads\/)/i.test(cleanUrl);

  if (!valid || failed) {
    return (
      <div
        aria-hidden="true"
        className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500"
      >
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={cleanUrl}
      alt={`Gambar kategori ${name}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-lg object-cover border border-slate-200"
    />
  );
}

export default function CategoryClient({ categories }) {
  const [editing, setEditing] = useState(null);

  // Setelah simpan berhasil, kembali ke mode "Tambah" agar form tidak menyimpan data lama
  async function handleSave(prevState, formData) {
    const res = await saveCategoryAction(prevState, formData);
    if (res?.success) setEditing(null);
    return res;
  }

  const [state, formAction, isPending] = useActionState(handleSave, null);
  const [msg, setMsg] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deleteCategoryAction(pendingDelete.id);
    setMsg(res.error || res.success);
    setDeleting(false);
    setPendingDelete(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Manajemen Kategori Produk</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tambah, ubah, atau hapus kategori (kategori yang masih memiliki produk tidak dapat dihapus)
        </p>
      </div>

      {(state?.error || state?.success || msg) && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            state?.error || msg.includes('tidak')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {state?.error || state?.success || msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          action={formAction}
          key={editing?.id || 'new'}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit"
        >
          <h2 className="font-bold text-slate-800">
            {editing ? 'Edit Kategori' : 'Tambah Kategori Baru'}
          </h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kategori *</label>
            <input
              name="name"
              defaultValue={editing?.name || ''}
              required
              placeholder="Contoh: Elektronik"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
            <textarea
              name="description"
              defaultValue={editing?.description || ''}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Gambar (Opsional)</label>
            <input
              name="image_url"
              defaultValue={editing?.image_url || ''}
              placeholder="https://... (URL gambar dari web)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              name="image_file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold hover:file:bg-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Isi URL <em>atau</em> pilih file (PNG/JPG/WEBP, maks 5 MB). Bila keduanya diisi, file yang dipakai.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : editing ? 'Update' : 'Simpan'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-24"></th>
                <th className="p-3.5">Nama Kategori</th>
                <th className="p-3.5">Deskripsi</th>
                <th className="p-3.5">Jumlah Produk</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="p-3.5">
                    <CategoryThumb url={c.image_url} name={c.name} />
                  </td>
                  <td className="p-3.5 font-semibold text-slate-800">{c.name}</td>
                  <td className="p-3.5 text-slate-600">{c.description || '-'}</td>
                  <td className="p-3.5">{c.product_count} produk</td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => setEditing(c)}
                      className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPendingDelete(c)}
                      className="px-2.5 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus kategori?"
        message={pendingDelete ? `Kategori "${pendingDelete.name}" akan dihapus.` : ''}
        note={
          pendingDelete && pendingDelete.product_count > 0
            ? `Kategori ini masih memiliki ${pendingDelete.product_count} produk sehingga tidak dapat dihapus.`
            : ''
        }
        confirmLabel="Hapus"
        loading={deleting}
        confirmDisabled={Boolean(pendingDelete && pendingDelete.product_count > 0)}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}