// Sumber tunggal untuk kredensial Supabase publik.
//
// Supabase mengganti nama kuncinya: dashboard lama menyebutnya "anon key"
// (eyJ...), dashboard baru "publishable key" (sb_publishable_...). Keduanya
// dipakai dengan cara yang sama, jadi di sini diterima dua-duanya.
//
// Catatan: process.env.NEXT_PUBLIC_* harus ditulis lengkap seperti ini supaya
// Next.js menyalin nilainya ke bundle browser saat build.

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function supabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  );
}

export function isSupabaseConfigured() {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return false;
  // Periksa apakah URL atau Key masih berupa placeholder bawaan template
  if (url.includes('xxxxxxxxxxxx') || url.includes('your-project-id')) return false;
  if (key.includes('xxxxxxxxxxxx') || key.includes('your_') || key.endsWith('...')) return false;
  return true;
}
