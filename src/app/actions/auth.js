'use server';

import pool from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function loginAction(prevState, formData) {
  const email = formData.get('email')?.trim();
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'ACCESS DENIED: Email dan password wajib diisi.' };
  }

  let user;
  try {
    const res = await pool.query(
      'SELECT id, username, email, password, role, status, company_name FROM users WHERE email = $1',
      [email]
    );
    user = res.rows[0];
  } catch {
    return { error: 'SYSTEM OFFLINE: Gagal terhubung ke database PostgreSQL. Cek .env.local.' };
  }

  if (!user || user.password !== password) {
    return { error: 'INVALID CREDENTIALS: Email atau password salah.' };
  }

  if (user.role === 'supplier') {
    if (user.status === 'pending') {
      return { error: 'CLEARANCE PENDING: Akun Supplier Anda sedang ditinjau oleh Admin.' };
    }
    if (user.status === 'rejected') {
      return { error: 'CLEARANCE REVOKED: Pendaftaran akun Supplier Anda ditolak oleh Admin.' };
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
    return { error: 'INCOMPLETE DOSSIER: Semua field wajib diisi.' };
  }

  try {
    const dup = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (dup.rows.length > 0) {
      return { error: 'DUPLICATE RECORD: Email sudah terdaftar.' };
    }

    await pool.query(
      `INSERT INTO users (username, company_name, email, password, role, status)
       VALUES ($1, $2, $3, $4, 'supplier', 'pending')`,
      [username, company_name, email, password]
    );
    return {
      success: 'DOSSIER SUBMITTED: Registrasi berhasil! Status akun Pending, menunggu persetujuan Admin.',
    };
  } catch {
    return { error: 'SYSTEM ERROR: Gagal memproses pendaftaran Supplier.' };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
