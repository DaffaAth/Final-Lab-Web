import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Folder penyimpanan di luar /public agar file yang diunggah saat runtime tetap bisa disajikan
// (disajikan lewat route /api/uploads/[name]).
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const UPLOAD_URL_PREFIX = '/api/uploads/';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const IMAGE_CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

// Deteksi tipe asli dari byte awal file (tidak percaya pada file.type dari browser).
function detectImageExt(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

// True bila nilai adalah path gambar hasil upload lokal (bukan URL web).
export function isLocalUploadUrl(value) {
  return (
    typeof value === 'string' &&
    /^\/api\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value)
  );
}

/**
 * Simpan file gambar dari <input type="file"> ke folder uploads.
 * - Mengembalikan null bila tidak ada file yang dipilih (field kosong).
 * - Mengembalikan path publik "/api/uploads/<uuid>.<ext>" bila berhasil.
 * - Melempar Error (pesan siap tampil) bila file tidak valid.
 */
export async function saveUploadedImage(file) {
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || file.size === 0) {
    return null;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ukuran gambar maksimal 5 MB.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) {
    throw new Error('Format gambar harus PNG, JPG, atau WEBP.');
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `${UPLOAD_URL_PREFIX}${name}`;
}

// Hapus file hasil upload (best-effort, dipakai saat penyimpanan ke database gagal).
export async function removeUploadedImage(urlPath) {
  if (!isLocalUploadUrl(urlPath)) return;
  try {
    await unlink(path.join(UPLOAD_DIR, urlPath.slice(UPLOAD_URL_PREFIX.length)));
  } catch {
    // abaikan: file mungkin sudah tidak ada
  }
}