import { cookies } from 'next/headers';

const COOKIE_NAME = 'gudang_session';

export async function createSession(user) {
  const cookieStore = await cookies();
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    company_name: user.company_name || null,
  });

  cookieStore.set(COOKIE_NAME, payload, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
