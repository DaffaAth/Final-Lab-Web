'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

const ROLE_LABELS = {
  admin: 'SYS // ADMIN',
  warehouse_manager: 'OPS // MANAGER',
  staff_gudang: 'DOCK // STAFF',
  supplier: 'VENDOR // SUPPLIER',
};

const NAV_BY_ROLE = {
  admin: [
    { href: '/dashboard', label: '01. OVERVIEW HUD' },
    { href: '/suppliers', label: '02. VENDOR CLEARANCE' },
    { href: '/categories', label: '03. CARGO CLASSES' },
    { href: '/products', label: '04. INVENTORY LEDGER' },
    { href: '/restock', label: '05. RESTOCK DISPATCH' },
    { href: '/transactions', label: '06. MOVEMENT LOGS' },
  ],
  warehouse_manager: [
    { href: '/dashboard', label: '01. OVERVIEW HUD' },
    { href: '/categories', label: '02. CARGO CLASSES' },
    { href: '/products', label: '03. INVENTORY LEDGER' },
    { href: '/restock', label: '04. RESTOCK DISPATCH' },
    { href: '/transactions', label: '05. APPROVAL QUEUE' },
  ],
  staff_gudang: [
    { href: '/dashboard', label: '01. DOCK TERMINAL' },
    { href: '/products', label: '02. STOCK MANIFEST' },
    { href: '/transactions', label: '03. IN / OUT GATEWAY' },
  ],
  supplier: [
    { href: '/dashboard', label: '01. VENDOR PORTAL' },
    { href: '/restock', label: '02. PURCHASE ORDERS' },
  ],
};

export default function AppShell({ session, children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = NAV_BY_ROLE[session.role] || [];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0c0d0f] text-[#d6d3cd]">
      {/* Mobile Tactical Topbar */}
      <header className="md:hidden flex items-center justify-between bg-[#141619] border-b-2 border-[#2c3036] px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="font-black tracking-widest uppercase text-sm text-[#e8e6e1]">
            LC // DOCKS
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider bg-[#22252a] text-[#d49b27] border border-[#d49b27]/40 px-2 py-0.5">
            {ROLE_LABELS[session.role]}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="px-3 py-1 bg-[#1b1e22] border border-[#3a3f47] text-xs font-mono uppercase tracking-wider text-[#e8e6e1]"
        >
          {mobileOpen ? '[ CLOSE ]' : '[ MENU ]'}
        </button>
      </header>

      {/* Gritty Industrial Sidebar */}
      <aside
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } fixed left-0 right-0 top-[56px] bottom-0 flex flex-col bg-[#121417] border-r-2 border-[#2c3036] z-20 md:flex md:w-64 md:top-0 md:bottom-auto md:fixed md:inset-y-0`}
      >
        <div className="p-5 border-b-2 border-[#2c3036] bg-[#16191d]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#7c7f85]">
              BROKER TERMINAL 04
            </span>
            <span className="h-2 w-2 rounded-full bg-[#6c804b] shadow-[0_0_8px_#6c804b]" />
          </div>
          <div className="text-xl font-black uppercase tracking-wider text-[#e8e6e1] mt-1">
            LIBERTY WAREHOUSE
          </div>
          <div className="mt-2.5 inline-block text-[11px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 bg-[#1f2227] text-[#d49b27] border border-[#d49b27]/50">
            {ROLE_LABELS[session.role]}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-l-4 transition ${
                  active
                    ? 'bg-[#1e2126] text-[#d49b27] border-[#d49b27]'
                    : 'text-[#9a9d9e] border-transparent hover:bg-[#191c20] hover:text-[#e8e6e1] hover:border-[#4b5059]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t-2 border-[#2c3036] bg-[#101215]">
          <div className="mb-3 px-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#7c7f85]">
              ACTIVE OPERATOR
            </p>
            <p className="text-sm font-bold uppercase tracking-wide text-[#e8e6e1] truncate mt-0.5">
              {session.username}
            </p>
            <p className="text-xs font-mono text-[#8b8e94] truncate">
              {session.company_name || session.email}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full py-2 px-3 bg-[#7f1d1d]/80 hover:bg-[#991b1b] border border-[#ef4444]/40 text-[#fca5a5] text-xs font-mono font-bold uppercase tracking-widest transition"
            >
              [ DISCONNECT / LOGOUT ]
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
