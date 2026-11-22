import './globals.css';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata = {
  title: 'Sistem Manajemen Gudang',
  description: 'Warehouse Management System - Next.js & PostgreSQL',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
