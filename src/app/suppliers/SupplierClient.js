'use client';

import { useState } from 'react';
import { verifySupplierAction } from '@/app/actions/master';

export default function SupplierClient({ suppliers }) {
  const [msg, setMsg] = useState('');

  async function handleAction(id, status) {
    const res = await verifySupplierAction(id, status);
    setMsg(res.error || res.success);
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#2c3036] pb-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
          SECURITY CLEARANCE // ADMIN ONLY
        </span>
        <h1 className="text-2xl font-black uppercase tracking-wide text-[#e8e6e1] mt-1">
          VERIFIKASI MITRA SUPPLIER
        </h1>
      </div>

      {msg && (
        <div className="p-3 bg-[#1b222c] border-l-4 border-[#d49b27] text-[#f3d078] text-xs font-mono">
          {msg}
        </div>
      )}

      <div className="bg-[#141619] border-2 border-[#2c3036] overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#1b1e22] text-[#9a9d9e] font-mono text-xs uppercase border-b-2 border-[#2c3036]">
            <tr>
              <th className="p-3.5">PERUSAHAAN</th>
              <th className="p-3.5">PIC</th>
              <th className="p-3.5">EMAIL</th>
              <th className="p-3.5">STATUS</th>
              <th className="p-3.5 text-right">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2c3036]">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center font-mono text-xs text-[#7c7f85]">
                  NO SUPPLIER RECORDS FOUND.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-[#191c20]">
                  <td className="p-3.5 font-bold uppercase text-[#e8e6e1]">{s.company_name || '-'}</td>
                  <td className="p-3.5 text-[#d6d3cd]">{s.username}</td>
                  <td className="p-3.5 font-mono text-xs text-[#8b8e94]">{s.email}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase border ${
                        s.status === 'approved'
                          ? 'bg-[#1e2b18] text-[#a3e635] border-[#6c804b]'
                          : s.status === 'rejected'
                          ? 'bg-[#451416] text-[#fca5a5] border-[#dc2626]'
                          : 'bg-[#3b290e] text-[#facc15] border-[#d49b27]'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    {s.status !== 'approved' && (
                      <button
                        onClick={() => handleAction(s.id, 'approved')}
                        className="px-3 py-1 bg-[#4d6332] hover:bg-[#5e783d] text-[#e8e6e1] font-mono text-xs font-bold uppercase"
                      >
                        APPROVE
                      </button>
                    )}
                    {s.status !== 'rejected' && (
                      <button
                        onClick={() => handleAction(s.id, 'rejected')}
                        className="px-3 py-1 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] font-mono text-xs font-bold uppercase"
                      >
                        REJECT
                      </button>
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
