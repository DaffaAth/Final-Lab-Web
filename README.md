# Sistem Manajemen Gudang — Liberty City Logistics Edition (GTA IV Gritty UI)

Proyek Final Praktikum Pemrograman Web — Individual Project 6: **Manajemen Gudang**.
Dibangun menggunakan **Next.js (App Router, JSX)**, **Tailwind CSS (GTA IV Gritty Dark HUD Styling)**, dan **PostgreSQL (`pg` Raw SQL tanpa ORM)**.

## Cara Instalasi & Menjalankan

1. **Siapkan Database PostgreSQL**
   - Buka **pgAdmin**, buat database baru bernama `db_gudang`.
   - Buka **Query Tool** pada `db_gudang`, lalu jalankan seluruh isi file `database.sql`.
2. **Konfigurasi Environment**
   - Sesuaikan kredensial PostgreSQL pada file `.env.local`:
     ```env
     DATABASE_URL=postgresql://postgres:password_anda@localhost:5432/db_gudang
     ```
3. **Install Dependensi & Jalankan Server**
   ```bash
   npm install
   npm run dev
   ```
4. Buka `http://localhost:3000` di browser.

## Akun Bawaan (Seeding)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@gudang.com` | `admin123` |
| **Warehouse Manager** | `manager@gudang.com` | `manager123` |
| **Staff Gudang** | `staff@gudang.com` | `staff123` |
| **Supplier (Approved)** | `supplier@nusantara.com` | `supplier123` |
