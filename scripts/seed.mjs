#!/usr/bin/env node
// Seed demo hearme — membuat 3 akun demo (user, relawan, admin) via service role,
// menyetujui relawan, dan menampilkan langkah selanjutnya.
//
// Pemakaian:
//   1) Isi .env.local dengan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
//   2) node scripts/seed.mjs
//
// Catatan: password demo hanya untuk lingkungan demo lokal. Ganti sebelum dipakai publik.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env.local opsional kalau env sudah diekspor
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_PASSWORD = 'DemoHearme123!';
const USERS = [
  { email: 'user@demo.local', display_name: 'Bunga Malam', role: 'user' },
  { email: 'relawan@demo.local', display_name: 'Relawan Senja', role: 'user' },
  { email: 'admin@demo.local', display_name: 'Admin Kampus', role: 'admin' },
];

async function ensureUser({ email, display_name }) {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      user_metadata: { display_name },
      email_confirm: true,
    });
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log('🌱 Seed hearme\n');

  const ids = {};
  for (const u of USERS) {
    ids[u.email] = await ensureUser(u);
    console.log(`✓ akun ${u.email}`);
  }

  // profil (trigger biasanya sudah membuat baris users; pastikan nama & role)
  for (const u of USERS) {
    await supabase.from('users').upsert({
      id: ids[u.email],
      display_name: u.display_name,
      email: u.email,
      role: u.role,
    });
  }
  console.log('✓ profil users disiapkan');

  // relawan: application approved + presence offline
  const volunteerId = ids['relawan@demo.local'];
  const { data: existingApp } = await supabase
    .from('volunteer_applications')
    .select('id')
    .eq('user_id', volunteerId)
    .maybeSingle();

  if (!existingApp) {
    const { error } = await supabase.from('volunteer_applications').insert({
      user_id: volunteerId,
      status: 'approved',
      motivation: 'Saya pernah merasakan beratnya semester awal dan ingin menemani teman-teman.',
      training_completed: true,
      code_of_conduct_accepted_at: new Date().toISOString(),
      reviewed_by: ids['admin@demo.local'],
      reviewed_at: new Date().toISOString(),
    });
    if (error) throw error;
  } else {
    await supabase
      .from('volunteer_applications')
      .update({ status: 'approved', training_completed: true })
      .eq('user_id', volunteerId);
  }

  await supabase
    .from('volunteer_presence')
    .upsert({ volunteer_id: volunteerId, status: 'offline', last_seen_at: new Date().toISOString() });
  console.log('✓ relawan demo: approved + presence siap');

  console.log('\n=== Akun demo (password sama untuk semua) ===');
  for (const u of USERS) {
    console.log(`  ${u.email.padEnd(24)} ${u.role === 'admin' ? '(admin)' : ''} ${u.display_name}`);
  }
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log('\nLangkah demo:');
  console.log('  1. Login sebagai relawan@demo.local → halaman Relawan → set “Siap menerima sesi”.');
  console.log('  2. Login sebagai user@demo.local di jendela lain → cerita → pilih 1-on-1.');
  console.log('  3. Relawan menerima tawaran → ngobrol sebentar → akhiri sesi → check-in.');
  console.log('  4. Demo grup: set group_target_members=2 di panel admin, lalu 2 akun masuk antrean grup.');
  console.log('  5. Demo keselamatan: tulis indikasi risiko → banner bantuan muncul; coba tombol Laporkan.\n');
}

main().catch((e) => {
  console.error('❌ Seed gagal:', e.message);
  process.exit(1);
});
