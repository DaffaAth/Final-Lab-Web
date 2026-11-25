import { readFile } from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR, IMAGE_CONTENT_TYPES } from '@/lib/upload';

// Menyajikan gambar hasil upload dari folder /uploads.
export async function GET(_request, { params }) {
  const { name } = await params;

  // Hanya nama file hasil generate (uuid.ext) yang diizinkan -> mencegah path traversal.
  const match = /^[a-f0-9-]+\.(png|jpg|webp)$/.exec(name || '');
  if (!match) return new Response('Not found', { status: 404 });

  try {
    const data = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(data, {
      headers: {
        'Content-Type': IMAGE_CONTENT_TYPES[match[1]],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}