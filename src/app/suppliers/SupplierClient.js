'use client';

import { useState } from 'react';
import { verifySupplierAction } from '@/app/actions/master';

export default function SupplierClient({ suppliers }) {
  const [msg, setMsg] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  async function handleAction(id, status, reason = '') {
    const res = await verifySupplierAction(id, status, reason);
    setMsg(res.error || res.success);
    if (res.success) {
      setRejectId(null);
      setRejectReason('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Verifikasi Mitra Supplier</h1>
        <p className="text-sm text-slate-500 mt-1">
          Setujui atau tolak pendaftaran akun Supplier baru sebelum mereka dapat mengakses sistem
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          {msg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3.5">Perusahaan</th>
              <th className="p-3.5">Nama PIC</th>
              <th className="p-3.5">Email</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Belum ada Supplier yang mendaftar.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="p-3.5 font-semibold text-slate-800">{s.company_name || '-'}</td>
                  <td className="p-3.5 text-slate-700">{s.username}</td>
                  <td className="p-3.5 text-slate-600">{s.email}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        s.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.status === 'rejected' && s.reject_reason && (
                      <p className="text-xs text-red-600 mt-1">Alasan: {s.reject_reason}</p>
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    {s.status !== 'approved' && (
                      <button
                        onClick={() => handleAction(s.id, 'approved')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                      >
                        Approve
                      </button>
                    )}
                    {s.status === 'pending' && (
                      <button
                        onClick={() => {
                          setRejectId(rejectId === s.id ? null : s.id);
                          setRejectReason('');
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                      >
                        Reject
                      </button>
                    )}
                    {rejectId === s.id && (
                      <div className="mt-2 flex gap-2 justify-end">
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Alasan penolakan (wajib)"
                          className="px-2 py-1 border border-slate-300 rounded text-xs w-56"
                        />
                        <button
                          onClick={() => handleAction(s.id, 'rejected', rejectReason)}
                          className="px-3 py-1 bg-red-700 text-white rounded text-xs font-semibold"
                        >
                          Kirim
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}