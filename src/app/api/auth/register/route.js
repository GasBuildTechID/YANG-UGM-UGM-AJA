import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Proteksi rate-limiting sederhana berbasis IP / timestamp (maks 5 request per menit)
const attempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 5;

  // Bersihkan entri lama jika Map mulai menumpuk
  if (attempts.size > 200) {
    for (const [key, timestamps] of attempts.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) attempts.delete(key);
      else attempts.set(key, active);
    }
  }

  const userAttempts = attempts.get(ip) || [];
  const recent = userAttempts.filter((t) => now - t < windowMs);

  if (recent.length >= maxAttempts) {
    return true;
  }

  recent.push(now);
  attempts.set(ip, recent);
  return false;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan pendaftaran. Mohon tunggu 1 menit sebelum mencoba lagi.' },
        { status: 429 }
      );
    }

    const { email, password, displayName, roleIntent } = await request.json();

    if (!email || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Kata sandi minimal 6 karakter.' }, { status: 400 });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { error: 'Koneksi server database belum siap. Pastikan SUPABASE_SERVICE_ROLE_KEY tersedia.' },
        { status: 500 }
      );
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName?.trim() || '',
        role_intent: roleIntent || 'user',
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique')) {
        return NextResponse.json(
          { error: 'Email ini sudah terdaftar sebelumnya. Silakan langsung masuk melalui halaman login.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

