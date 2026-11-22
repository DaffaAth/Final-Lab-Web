'use server';

import pool from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function loginAction(prevState, formData) {
  const email = formData.get('email')?.trim();
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' };
  }

  let user;
  try {
    const res = await pool.query(
      'SELECT id, username, email, password, role, status, company_name FROM users WHERE email = $1',
      [email]
    );
    user = res.rows[0];
  } catch (err) {
    return { error: 'Gagal terhubung ke database PostgreSQL. Pastikan DATABASE_URL di .env.local benar.' };
  }

  if (!user || user.password !== password) {
    return { error: 'Email atau password salah.' };
  }

  if (user.role === 'supplier') {
    if (user.status === 'pending') {
      return { error: 'Akun Supplier Anda berstatus Pending dan sedang ditinjau oleh Admin.' };
    }
    if (user.status === 'rejected') {
      return { error: 'Pendaftaran akun Supplier Anda telah ditolak oleh Admin.' };
    }
  }

  await createSession(user);
  redirect('/dashboard');
}

export async function registerSupplierAction(prevState, formData) {
  const username = formData.get('username')?.trim();
  const company_name = formData.get('company_name')?.trim();
  const email = formData.get('email')?.trim();
  const password = formData.get('password');

  if (!username || !company_name || !email || !password) {
    return { error: 'Semua field wajib diisi.' };
  }

  try {
    const dup = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (dup.rows.length > 0) {
      return { error: 'Email sudah terdaftar.' };
    }

    await pool.query(
      `INSERT INTO users (username, company_name, email, password, role, status)
       VALUES ($1, $2, $3, $4, 'supplier', 'pending')`,
      [username, company_name, email, password]
    );
    return {
      success: 'Registrasi berhasil! Akun Anda berstatus Pending dan menunggu persetujuan Admin sebelum dapat login.',
    };
  } catch {
    return { error: 'Gagal memproses pendaftaran Supplier.' };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
