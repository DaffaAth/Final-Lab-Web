'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

const ROLE_LABELS = {
  admin: 'Administrator',
  warehouse_manager: 'Warehouse Manager',
  staff_gudang: 'Staff Gudang',
  supplier: 'Mitra Supplier',
};

const NAV_BY_ROLE = {
  admin: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/suppliers', label: 'Verifikasi Supplier' },
    { href: '/categories', label: 'Kategori Produk' },
    { href: '/products', label: 'Manajemen Produk' },
    { href: '/restock', label: 'Monitor Restock (PO)' },
    { href: '/transactions', label: 'Monitor Transaksi' },
  ],
  warehouse_manager: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/categories', label: 'Kategori Produk' },
    { href: '/products', label: 'Manajemen Produk' },
    { href: '/restock', label: 'Restock Order (PO)' },
    { href: '/transactions', label: 'Approval Transaksi' },
  ],
  staff_gudang: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/products', label: 'Katalog & Stok Produk' },
    { href: '/restock', label: 'Pemeriksaan Barang (PO)' },
    { href: '/transactions', label: 'Barang Masuk & Keluar' },
  ],
  supplier: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/restock', label: 'Pesanan Restock (PO)' },
  ],
};

export default function AppShell({ session, children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = NAV_BY_ROLE[session.role] || [];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile Header */}
      <header className="app-mobile-header md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30">
        <div>
          <span className="font-bold tracking-tight text-base">WMS Gudang</span>
          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
            {ROLE_LABELS[session.role]}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="app-mobile-menu-button px-3 py-1.5 rounded-lg text-sm font-medium"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        >
          {mobileOpen ? 'Tutup' : 'Menu'}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`app-sidebar ${
          mobileOpen ? 'block' : 'hidden'
        } md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20`}
      >
        <div className="app-sidebar-brand p-6 border-b">
          <div className="app-sidebar-title text-lg font-bold tracking-tight">Manajemen Gudang</div>
          <div className="app-sidebar-role mt-2 inline-block text-xs font-medium px-2.5 py-1 rounded-md">
            {ROLE_LABELS[session.role]}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="app-nav-link block px-3.5 py-2.5 rounded-lg text-sm font-medium"
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer p-4 border-t">
          <div className="mb-3 px-2">
            <p className="app-sidebar-user text-sm font-semibold truncate">{session.username}</p>
            <p className="text-xs text-slate-400 truncate">
              {session.company_name || session.email}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold transition"
            >
              Keluar (Logout)
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 md:pl-64">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}