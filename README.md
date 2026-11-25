# Sistem Manajemen Gudang (Warehouse Management System)

Aplikasi web manajemen gudang untuk mengelola produk, pengadaan barang (Restock Order / PO), serta transaksi barang masuk dan keluar dengan persetujuan berjenjang. Dibuat sebagai **Tugas Final Praktikum Pemrograman Web 2026** dan mengikuti dokumen *Ketentuan Final Sistem Manajemen Gudang (revisi final)*.

Tampilan bertema minimalis dengan mode terang dan gelap.

---

## Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Teknologi](#teknologi)
3. [Peran dan Hak Akses](#peran-dan-hak-akses)
4. [Alur Barang Masuk (PO dan Incoming)](#alur-barang-masuk-po-dan-incoming)
5. [Alur Barang Keluar (Outgoing)](#alur-barang-keluar-outgoing)
6. [Aturan Teknis dan Validasi](#aturan-teknis-dan-validasi)
7. [Struktur Proyek](#struktur-proyek)
8. [Skema Database](#skema-database)
9. [Instalasi dan Menjalankan](#instalasi-dan-menjalankan)
10. [Akun Demo](#akun-demo)
11. [Panduan Pengujian](#panduan-pengujian)
12. [Riwayat Pembaruan](#riwayat-pembaruan)
13. [Catatan Keamanan dan Batasan](#catatan-keamanan-dan-batasan)
14. [Pemecahan Masalah](#pemecahan-masalah)
15. [Pembuat](#pembuat)

---

## Fitur Utama

- **Empat peran pengguna** dengan hak akses terpisah: Admin, Warehouse Manager, Staff Gudang, dan Supplier.
- **Registrasi Supplier mandiri** dengan verifikasi Admin (Approved / Rejected, alasan penolakan wajib).
- **Master data** produk dan kategori (CRUD, SKU dan nama kategori unik).
- **Restock Order (PO)** dari Manager ke Supplier dengan siklus status lengkap, bukti foto kedatangan, laporan pemeriksaan fisik oleh Staff, pengembalian barang (Returned), dan klaim refund.
- **Transaksi barang masuk** berdasarkan PO yang sudah diperiksa dan **barang keluar** dengan persetujuan Manager.
- **Perubahan stok yang ketat**: stok hanya bertambah saat Incoming di-*Approve* dan hanya berkurang saat Outgoing di-*Shipped*, dilakukan dalam satu transaksi database.
- **Badge status stok otomatis**: Out of Stock, Severe, Low, Normal.
- **Dashboard per peran** dengan ringkasan stok, nilai inventori, status PO, dan antrean pekerjaan.
- **Pencarian, filter, dan pengurutan** pada produk dan transaksi.
- **Mode terang dan gelap** (tersimpan di browser) dengan tema.

---

## Teknologi

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, JSX) |
| Antarmuka | React, Tailwind CSS v4, CSS kustom (`globals.css`) |
| Database | PostgreSQL dengan driver `pg` (raw SQL, tanpa ORM) |
| Autentikasi | Sesi berbasis cookie `httpOnly` (berlaku 24 jam) |

---

## Peran dan Hak Akses

| Peran | Pembuatan akun | Hak akses dan tanggung jawab |
|---|---|---|
| **Admin** | Data awal `.sql` | Verifikasi Supplier (Approved/Rejected + alasan), CRUD Produk dan Kategori, monitoring seluruh aktivitas (PO, transaksi, nilai inventori, stok kritis) |
| **Warehouse Manager** | Data awal `.sql` | CRUD Produk dan Kategori, membuat PO, memulai pemeriksaan setelah bukti foto diterima, menolak penerimaan (Returned), mengajukan klaim refund, Approve/Reject transaksi masuk dan keluar |
| **Staff Gudang** | Data awal `.sql` | Membuat laporan pemeriksaan fisik, membuat Incoming dari PO, membuat Outgoing, packing dan menekan *Kirim Barang (Shipped)* |
| **Supplier** | Registrasi mandiri (`/register`) | Melihat PO miliknya, Confirmed/Rejected (alasan wajib), mengubah status ke In Transit, menyerahkan bukti foto kedatangan |

Menu yang tampil di sidebar menyesuaikan peran:

| Peran | Menu |
|---|---|
| Admin | Dashboard, Verifikasi Supplier, Kategori Produk, Manajemen Produk, Monitor Restock (PO), Monitor Transaksi |
| Warehouse Manager | Dashboard, Kategori Produk, Manajemen Produk, Restock Order (PO), Approval Transaksi |
| Staff Gudang | Dashboard, Katalog dan Stok Produk, Pemeriksaan Barang (PO), Barang Masuk dan Keluar |
| Supplier | Dashboard, Pesanan Restock (PO) |

---

## Alur Barang Masuk (PO dan Incoming)

### Siklus status PO

```
Pending -> Confirmed / Rejected -> In Transit -> Inspecting -> Received / Returned
```

### Langkah demi langkah

| No | Langkah | Pelaku | Hasil |
|---|---|---|---|
| 1 | Membuat PO (nomor otomatis, supplier, tanggal order, perkiraan tiba, produk, kuantitas, catatan) | Manager | Status **Pending** |
| 2 | Menyanggupi atau menolak (alasan wajib bila menolak) | Supplier | **Confirmed** atau **Rejected** (proses berhenti) |
| 3 | Barang dikirim | Supplier | **In Transit** |
| 4 | Menyerahkan URL bukti foto kedatangan barang | Supplier | Bukti foto tersimpan di PO |
| 5 | Menerima bukti foto dan memulai pemeriksaan | Manager | **Inspecting** (hanya bila bukti foto sudah ada) |
| 6 | Mengecek fisik barang (jumlah dan kondisi Baik/Rusak) dan membuat laporan pemeriksaan | Staff | Laporan **Sesuai** atau **Tidak Sesuai** (dihitung otomatis oleh server) |

### Keputusan hasil pemeriksaan

**Skenario 1: barang sesuai**
1. Staff membuat transaksi **Incoming** dari PO (nomor transaksi otomatis, produk dan kuantitas terisi otomatis dari PO, status awal Pending). Satu PO hanya dapat dipakai satu Incoming yang tidak berstatus Rejected.
2. Manager meninjau dan men-*Approve* Incoming.
3. Sistem, dalam **satu transaksi database**: PO menjadi **Received** dan stok produk bertambah.

**Skenario 2: barang tidak sesuai atau rusak**
1. Staff mencatat ketidaksesuaian pada laporan pemeriksaan.
2. Manager menolak penerimaan, baik lewat tombol **Tolak Penerimaan (Returned)** pada PO maupun **Reject** pada transaksi Incoming (alasan wajib). PO menjadi **Returned** dan stok **tidak** bertambah.
3. Manager dapat **mengajukan klaim refund** kepada Supplier (sekali per PO, catatan wajib) dan membuat PO baru bila stok masih dibutuhkan.

---

## Alur Barang Keluar (Outgoing)

### Siklus status

```
Pending -> Approved / Rejected -> Shipped
```

| No | Langkah | Pelaku | Hasil |
|---|---|---|---|
| 1 | Membuat Outgoing (nomor otomatis, tanggal pengiriman, customer/tujuan, produk, kuantitas, catatan). Kuantitas tidak boleh melebihi stok tersedia. Selama Pending, Staff dapat mengedit atau menghapus transaksi **miliknya sendiri** | Staff | **Pending**, stok belum berubah |
| 2 | Meninjau pengajuan. Bila menolak, alasan wajib | Manager | **Approved** atau **Rejected** (stok tetap) |
| 3 | Mengambil barang dari rak, packing, lalu menekan **Kirim Barang (Shipped)** | Staff | **Shipped**: stok langsung berkurang dan alur selesai |

Saat Approved stok **belum** berkurang. Pada tahap Shipped, sistem memeriksa ulang stok dan membatalkan proses bila stok tidak mencukupi.

---

## Aturan Teknis dan Validasi

### Perubahan stok (mutlak)

- Stok **bertambah** hanya saat status Incoming berubah menjadi **Approved** oleh Manager.
- Stok **berkurang** hanya saat status Outgoing berubah menjadi **Shipped** oleh Staff.
- Stok awal produk baru selalu **0**. Kolom stok pada form produk bersifat read-only, baik saat tambah maupun edit.

### Produk dan kategori

- SKU produk dan nama kategori harus **unik**. Saat mengedit produk, semua kolom dapat diubah kecuali SKU.
- Kategori hanya dapat dihapus bila tidak memiliki produk.
- Menghapus produk yang masih memiliki stok menampilkan peringatan konfirmasi.

### Status stok otomatis

| Badge | Kondisi |
|---|---|
| Out of Stock (abu-abu) | Stok = 0 |
| Severe (merah) | 0 < Stok <= Stok Minimum |
| Low (kuning) | Stok Minimum < Stok <= Stok Low |
| Normal (hijau) | Stok > Stok Low |

Validasi: **Stok Low harus lebih besar dari Stok Minimum**.

### Catatan wajib penolakan

Setiap aksi penolakan (**Rejected / Returned**) pada akun Supplier, PO, Incoming, maupun Outgoing **wajib** menyertakan teks alasan.

---

## Struktur Proyek

```
.
├── database.sql                 # Skema database, data awal, dan migrasi revisi final
├── .env.example                 # Contoh konfigurasi (salin menjadi .env.local)
├── src
│   ├── app
│   │   ├── actions
│   │   │   ├── auth.js          # Login, logout, registrasi Supplier
│   │   │   ├── master.js        # Produk, kategori, verifikasi Supplier
│   │   │   └── workflow.js      # PO, laporan pemeriksaan, transaksi, dashboard
│   │   ├── login/               # Halaman masuk
│   │   ├── register/            # Registrasi Supplier
│   │   ├── dashboard/           # Dashboard per peran
│   │   ├── products/            # Daftar produk dan detail produk ([id])
│   │   ├── categories/          # Manajemen kategori
│   │   ├── suppliers/           # Verifikasi Supplier (Admin)
│   │   ├── restock/             # PO, pemeriksaan, klaim refund
│   │   ├── transactions/        # Barang masuk dan keluar
│   │   ├── globals.css          # Tema minimalis (terang dan gelap)
│   │   └── layout.js
│   ├── components
│   │   ├── AppShell.js          # Sidebar dan kerangka halaman
│   │   └── ThemeToggle.js       # Tombol mode terang/gelap
│   └── lib
│       ├── db.js                # Koneksi PostgreSQL (membaca .env.local)
│       └── session.js           # Sesi berbasis cookie
└── ...
```

---

## Skema Database

| Tabel | Fungsi |
|---|---|
| `users` | Akun semua peran (`admin`, `warehouse_manager`, `staff_gudang`, `supplier`), status akun, alasan penolakan (`reject_reason`) |
| `categories` | Master kategori produk (nama unik) |
| `products` | Master produk, harga, stok minimum/low, stok saat ini, lokasi rak |
| `restock_orders` | PO: status, catatan status, URL bukti foto (`arrival_photo_url`), klaim refund (`refund_claimed_at`, `refund_notes`) |
| `restock_order_items` | Rincian produk per PO |
| `inspection_reports` | Laporan pemeriksaan per PO (hasil Sesuai/Tidak Sesuai, catatan) |
| `inspection_report_items` | Jumlah diterima dan kondisi (Baik/Rusak) per produk |
| `transactions` | Transaksi masuk dan keluar beserta status dan alasan penolakan |
| `transaction_items` | Rincian produk per transaksi |

Seluruh skema, data awal, dan migrasi revisi final ada di `database.sql`.

---

## Instalasi dan Menjalankan

### Prasyarat

- Node.js 20.9 atau lebih baru
- PostgreSQL (disarankan dengan pgAdmin)
- Git

### Langkah

**1. Clone dan pasang dependensi**

```bash
git clone https://github.com/DaffaAth/Final-Lab-Web.git
cd Final-Lab-Web
npm install
```

**2. Buat database**

Buat database kosong di PostgreSQL (misalnya lewat pgAdmin), lalu jalankan seluruh isi `database.sql` pada database tersebut (Query Tool, lalu F5). File ini sudah memuat tabel, tiga akun internal, dan migrasi revisi final.

> Bila database lama Anda dibuat dari skema sebelum revisi final, cukup jalankan blok **MIGRASI REVISI FINAL** di bagian bawah `database.sql`. Blok itu aman dijalankan berulang kali.

**3. Atur koneksi database**

Salin `.env.example` menjadi `.env.local` di folder yang sama dengan `package.json`, lalu isi nilainya:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=isi_password_postgresql
DB_NAME=nama_database
```

Alternatifnya, gunakan satu variabel:

```
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/NAMA_DATABASE
```

Aturan penulisan: satu nilai per baris, tanpa tanda kutip, tanpa spasi di sekitar `=`, dan file berformat **UTF-8**. Bila memakai `DATABASE_URL` dan password memiliki karakter khusus (`@`, `#`, `/`, `:`), gunakan format `DB_*` agar tidak perlu di-encode. File `.env.local` **tidak boleh di-commit**.

**4. Jalankan**

```bash
npm run dev
```

Buka `http://localhost:3000`. Setelah mengubah `.env.local`, hentikan server (Ctrl+C) dan jalankan ulang karena variabel env hanya dibaca saat server dimulai.

---

## Akun Demo

Akun internal dari data awal `database.sql`:

| Peran | Email | Password |
|---|---|---|
| Admin | `admin@gudang.com` | `admin123` |
| Warehouse Manager | `manager@gudang.com` | `manager123` |
| Staff Gudang | `staff@gudang.com` | `staff123` |

Akun Supplier tidak ada di data awal. Daftarkan lewat `/register`, lalu **setujui** dari akun Admin (menu Verifikasi Supplier atau kartu di dashboard Admin) sebelum Supplier dapat login.

---

## Panduan Pengujian

**Barang keluar**
1. Staff membuat Outgoing, Manager men-Approve. Stok produk **belum** berubah.
2. Staff menekan *Kirim Barang (Shipped)*. Stok **berkurang**.
3. Buat dua Outgoing yang total kuantitasnya melebihi stok, Approve keduanya, lalu Shipped keduanya. Yang kedua harus ditolak karena stok tidak cukup.

**Alur PO penuh (barang sesuai)**
1. Manager membuat PO untuk Supplier yang sudah Approved.
2. Supplier: Confirm, Kirim Barang (In Transit), lalu serahkan URL bukti foto.
3. Manager: Terima Bukti dan Mulai Pemeriksaan (Inspecting).
4. Staff: buat laporan pemeriksaan (semua sesuai dan Baik), lalu buat Incoming dari PO.
5. Manager: Approve. PO menjadi **Received** dan stok **bertambah**.

**Alur barang tidak sesuai**
1. Ulangi sampai Inspecting, lalu Staff membuat laporan dengan jumlah kurang atau kondisi Rusak.
2. Manager menekan *Tolak Penerimaan (Returned)* dengan alasan. PO menjadi **Returned**, stok tetap.
3. Manager mengajukan klaim refund. Supplier dapat melihat klaim tersebut.

**Validasi lain**
- Menolak Supplier atau PO tanpa alasan harus ditolak sistem.
- Menghapus kategori yang memiliki produk harus ditolak.
- Membuat kategori atau SKU dengan nama yang sama harus ditolak.
- Kolom stok pada form produk tidak dapat diubah.
- Staff tidak dapat mengedit atau menghapus transaksi milik Staff lain.

---

## Riwayat Pembaruan

Perubahan terhadap versi sebelumnya (penyesuaian ke ketentuan final):

**Barang keluar dan aturan stok**
- Stok Outgoing kini berkurang saat **Shipped**, bukan Approved, dengan validasi ulang stok secara atomik.
- Kolom stok pada form edit produk dikunci, dan stok awal produk baru dipaksa 0.
- Edit dan hapus transaksi Pending hanya oleh pembuatnya.

**Alur PO dan barang masuk**
- Status baru **Inspecting** dan **Returned**.
- Supplier yang mengubah PO ke **In Transit** (sebelumnya Manager) dan menyerahkan **URL bukti foto kedatangan**.
- **Laporan pemeriksaan** oleh Staff dengan hasil Sesuai/Tidak Sesuai yang dihitung otomatis.
- Incoming **wajib berdasarkan PO** berstatus Inspecting dengan laporan Sesuai. Produk dan kuantitas diambil dari PO.
- Approve Incoming mengubah PO menjadi **Received** sekaligus menambah stok. Reject Incoming atau penolakan oleh Manager mengubah PO menjadi **Returned**.
- **Klaim refund** pada PO Returned.
- Staff memperoleh menu **Pemeriksaan Barang (PO)**.

**Admin dan dashboard**
- Penolakan Supplier **wajib disertai alasan**, tampil di halaman Admin dan pada pesan login Supplier. Supplier yang ditolak dapat disetujui ulang.
- Kartu dashboard baru untuk status PO (berjalan, menunggu pemeriksaan, menunggu keputusan, Returned, klaim refund).

**Tampilan dan konfigurasi**
- Tema **Vice City (GTA 6)** untuk mode terang dan gelap.
- Halaman register disamakan dengan login dan ikut mode terang/gelap.
- Filter transaksi tidak lagi keluar dari kartu pada layar lebar.
- `db.js` membaca konfigurasi dari `.env.local` (`DB_*` atau `DATABASE_URL`).

---

## Catatan Keamanan dan Batasan

- **Password disimpan sebagai teks biasa** dan dibandingkan langsung (di luar cakupan ketentuan, belum di-hash). Untuk penggunaan sungguhan gunakan hashing (misalnya bcrypt).
- **Sesi berupa cookie JSON yang belum ditandatangani.** Untuk penggunaan sungguhan gunakan token bertanda tangan (misalnya JWT) atau sesi di sisi server.
- **Bukti foto kedatangan berupa URL gambar**, bukan unggahan file.
- Aplikasi dirancang untuk keperluan pembelajaran. Jangan gunakan akun demo di lingkungan produksi.
- Jangan pernah meng-commit `.env.local` atau password database.

---

## Pemecahan Masalah

| Gejala | Penyebab dan solusi |
|---|---|
| `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` | Password database tidak sampai ke aplikasi. Pastikan `.env.local` berada satu folder dengan `package.json`, nama variabelnya `DB_PASSWORD` dan `DB_NAME` (atau `DATABASE_URL`), formatnya UTF-8, lalu hentikan dan jalankan ulang `npm run dev`. Terminal akan menampilkan baris `[db] env terbaca -> DB_* lengkap: true` bila terbaca |
| `password authentication failed` | Password atau nama pengguna PostgreSQL salah |
| `database ... does not exist` | `DB_NAME` tidak sesuai dengan database yang dibuat |
| `relation "inspection_reports" does not exist` atau `column ... does not exist` | Migrasi di `database.sql` belum dijalankan pada database yang sedang dipakai |
| Perubahan kode tidak terlihat | Hentikan server, hapus folder `.next`, lalu jalankan ulang |
| Supplier baru tidak bisa login | Akun masih Pending. Setujui lewat akun Admin |

---

## Pembuat

- Nama: *(M Daffa Athaillah Inzaghi Sailu)*
- NIM: *(H071251077)*
- Repositori: https://github.com/DaffaAth/Final-Lab-Web