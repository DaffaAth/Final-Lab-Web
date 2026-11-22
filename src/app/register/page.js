'use client';

import { useActionState } from 'react';
import { registerSupplierAction } from '@/app/actions/auth';
import Link from 'next/link';

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerSupplierAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0d0f] p-4">
      <div className="w-full max-w-md bg-[#141619] border-2 border-[#2c3036] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-8">
        <div className="border-b-2 border-[#2c3036] pb-5 mb-6">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d49b27]">
            VENDOR REGISTRATION DOSSIER
          </span>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#e8e6e1] mt-1">
            REGISTRASI SUPPLIER
          </h1>
          <p className="text-xs font-mono text-[#8b8e94] mt-1">
            Status awal PENDING hingga diverifikasi oleh Admin
          </p>
        </div>

        {state?.error && (
          <div className="mb-4 p-3 bg-[#3b1214] border-l-4 border-[#dc2626] text-[#fca5a5] text-xs font-mono">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="mb-4 p-3 bg-[#1e2b18] border-l-4 border-[#6c804b] text-[#bef264] text-xs font-mono">
            {state.success}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#a1a1aa] mb-1">
              NAMA PIC / PENANGGUNG JAWAB
            </label>
            <input
              type="text"
              name="username"
              required
              placeholder="Masukkan nama anda..."
              className="w-full px-3.5 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#a1a1aa] mb-1">
              NAMA PERUSAHAAN
            </label>
            <input
              type="text"
              name="company_name"
              required
              placeholder="Masukkan nama perusahaan..."
              className="w-full px-3.5 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#a1a1aa] mb-1">
              EMAIL PERUSAHAAN
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="kontak@perusahaan.com"
              className="w-full px-3.5 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#a1a1aa] mb-1">
              PASSCODE
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-[#d49b27] hover:bg-[#e0a934] text-[#0c0d0f] font-mono font-black text-xs uppercase tracking-widest transition disabled:opacity-50"
          >
            {isPending ? 'TRANSMITTING...' : '[ SUBMIT REGISTRATION ]'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#2c3036] text-center text-xs font-mono text-[#8b8e94]">
          SUDAH DISETUJUI ADMIN?{' '}
          <Link href="/login" className="text-[#d49b27] font-bold uppercase hover:underline">
            ← KEMBALI KE LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
}
