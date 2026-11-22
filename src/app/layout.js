import './globals.css';

export const metadata = {
  title: 'LIBERTY DOCKS // WMS Gudang Terminal',
  description: 'Warehouse Management System - Gritty Industrial Edition',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased min-h-screen bg-[#0c0d0f] text-[#d6d3cd] selection:bg-[#d49b27] selection:text-black">
        {children}
      </body>
    </html>
  );
}
