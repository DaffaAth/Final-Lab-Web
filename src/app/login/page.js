'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';
import Link from 'next/link';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0d0f] p-4">
      <div className="w-full max-w-md bg-[#141619] border-2 border-[#2c3036] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-8">
        <div className="border-b-2 border-[#2c3036] pb-5 mb-6">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[#7c7f85] mb-2">
            <span>Gudang Geram</span>
            <span className="text-[#d49b27]">SECURE GATEWAY</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#e8e6e1]">
            LIBERTY WAREHOUSE
          </h1>
          <p className="text-xs font-mono text-[#8b8e94] mt-1">
            Terminal Akses: Admin, Manager, Staff Gudang, &amp; Supplier
          </p>
        </div>

        {state?.error && (
          <div className="mb-5 p-3 bg-[#3b1214] border-l-4 border-[#dc2626] text-[#fca5a5] text-xs font-mono">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
              OPERATOR EMAIL
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="admin@gudang.com"
              className="w-full px-3.5 py-2.5 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
              PASSCODE
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#0e1012] border border-[#3a3f47] text-[#e8e6e1] text-sm font-mono focus:outline-none focus:border-[#d49b27]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-[#d49b27] hover:bg-[#e0a934] text-[#0c0d0f] font-mono font-black text-xs uppercase tracking-widest transition disabled:opacity-50"
          >
            {isPending ? 'AUTHENTICATING...' : '[ ACCESS TERMINAL ]'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#2c3036] text-center text-xs font-mono text-[#8b8e94]">
          MITRA SUPPLIER BARU?{' '}
          <Link href="/register" className="text-[#d49b27] font-bold uppercase hover:underline">
            AJUKAN CLEARANCE →
          </Link>
        </div>
      </div>
    </div>
  );
}
