'use client';

import { useActionState } from 'react';
import { registerSupplierAction } from '@/app/actions/auth';
import Link from 'next/link';

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerSupplierAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-200 p-8">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
            Warehouse Management System
          </span>
          <h1 className="text-2xl font-bold text-slate-800">Registrasi Supplier</h1>
          <p className="text-sm text-slate-500 mt-1">
            Status awal Pending hingga diverifikasi oleh Admin
          </p>
        </div>

        {state?.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {state.success}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama PIC / Penanggung Jawab
            </label>
            <input
              type="text"
              name="username"
              required
              placeholder="Masukkan nama Anda..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Perusahaan</label>
            <input
              type="text"
              name="company_name"
              required
              placeholder="Masukkan nama perusahaan..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Perusahaan</label>
            <input
              type="email"
              name="email"
              required
              placeholder="kontak@perusahaan.com"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            {isPending ? 'Memproses...' : 'Daftar sebagai Supplier'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-600">
          Sudah disetujui Admin?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}