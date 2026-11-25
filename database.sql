-- =====================================================================
-- SISTEM MANAJEMEN GUDANG (WMS) - SKEMA DATABASE LENGKAP (REVISI FINAL)
-- PostgreSQL
--
-- Cara pakai (database BARU / kosong):
--   1. Buat database kosong di PostgreSQL / pgAdmin.
--   2. Jalankan seluruh isi file ini pada database tersebut.
--

-- 1. Tabel Users (Admin, Manager, Staff di-seed; Supplier mendaftar lewat Register)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'warehouse_manager', 'staff_gudang', 'supplier')),
    status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    company_name VARCHAR(150), -- Khusus Supplier
    reject_reason TEXT, -- Alasan penolakan Supplier (wajib diisi saat Rejected)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Categories (Master Kategori Produk)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Products (Master Produk; Status Stok dihitung otomatis lewat query)
-- Catatan: stok hanya berubah lewat Incoming Approved (+) dan Outgoing Shipped (-)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    buy_price NUMERIC(12, 2) NOT NULL CHECK (buy_price >= 0),
    sell_price NUMERIC(12, 2) NOT NULL CHECK (sell_price >= 0),
    min_stock INT NOT NULL CHECK (min_stock >= 0), -- Batas Severe
    low_stock INT NOT NULL CHECK (low_stock > min_stock), -- Batas Low (wajib > min_stock)
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    unit VARCHAR(30) NOT NULL,
    rack_location VARCHAR(50) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Restock Orders / PO (Permintaan Restock dari Manager ke Supplier)
-- Siklus: Pending -> Confirmed/Rejected -> In Transit -> Inspecting -> Received/Returned
CREATE TABLE IF NOT EXISTS restock_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INT NOT NULL REFERENCES users(id),
    created_by INT NOT NULL REFERENCES users(id),
    order_date DATE NOT NULL,
    expected_delivery_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Confirmed', 'Rejected', 'In Transit', 'Inspecting', 'Received', 'Returned')),
    status_notes TEXT, -- Wajib diisi jika Rejected / Returned
    arrival_photo_url TEXT, -- URL bukti foto kedatangan barang (diserahkan Supplier)
    refund_claimed_at TIMESTAMP, -- Waktu klaim refund diajukan Manager (PO Returned)
    refund_notes TEXT, -- Catatan klaim refund
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabel Restock Order Items (Rincian Produk per PO)
CREATE TABLE IF NOT EXISTS restock_order_items (
    id SERIAL PRIMARY KEY,
    restock_order_id INT NOT NULL REFERENCES restock_orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- 6. Tabel Transactions (Transaksi Barang Masuk & Barang Keluar)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('incoming', 'outgoing')),
    transaction_date DATE NOT NULL,
    restock_order_id INT REFERENCES restock_orders(id), -- Barang masuk: wajib diisi oleh aplikasi
    supplier_id INT REFERENCES users(id), -- Untuk barang masuk (otomatis dari PO)
    customer_name VARCHAR(150), -- Untuk barang keluar
    created_by INT NOT NULL REFERENCES users(id),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Shipped')),
    reject_reason TEXT, -- Wajib diisi jika Rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabel Transaction Items (Rincian Produk per Transaksi)
CREATE TABLE IF NOT EXISTS transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- 8. Tabel Inspection Reports (Laporan pemeriksaan fisik barang oleh Staff Gudang)
CREATE TABLE IF NOT EXISTS inspection_reports (
    id SERIAL PRIMARY KEY,
    restock_order_id INT NOT NULL UNIQUE REFERENCES restock_orders(id) ON DELETE CASCADE,
    created_by INT NOT NULL REFERENCES users(id),
    result VARCHAR(20) NOT NULL CHECK (result IN ('Sesuai', 'Tidak Sesuai')),
    notes TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabel Inspection Report Items (Jumlah diterima dan kondisi per produk)
CREATE TABLE IF NOT EXISTS inspection_report_items (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity_received INT NOT NULL CHECK (quantity_received >= 0),
    item_condition VARCHAR(10) NOT NULL CHECK (item_condition IN ('Baik', 'Rusak'))
);

-- Seeding 3 Akun Internal Wajib (tidak ada form daftar untuk 3 role ini)
-- ON CONFLICT: aman bila file dijalankan ulang (tidak membuat akun ganda)
INSERT INTO users (username, email, password, role, status) VALUES
('Admin Gudang', 'admin@gudang.com', 'admin123', 'admin', 'approved'),
('Budi Manager', 'manager@gudang.com', 'manager123', 'warehouse_manager', 'approved'),
('Andi Staff', 'staff@gudang.com', 'staff123', 'staff_gudang', 'approved')
ON CONFLICT (email) DO NOTHING;