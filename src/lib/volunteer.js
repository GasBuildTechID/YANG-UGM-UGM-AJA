// Unggah & buka bukti kualifikasi relawan.
//
// Relawan wajib melampirkan SATU bukti (STR / ijazah psikologi / sertifikat /
// surat keterangan kampus). Berkas masuk ke bucket privat `volunteer-proofs`
// pada folder milik user sendiri, dan admin membukanya lewat signed URL.
// Nama bucket & aturan RLS-nya ada di supabase/schema.sql.

export const PROOF_BUCKET = 'volunteer-proofs';
export const PROOF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PROOF_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

// Hanya menerima gambar & PDF — supaya admin bisa melihat langsung di browser.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export function validateProofFile(file) {
  if (!file) return { ok: false, reason: 'Pilih dulu satu berkas bukti.' };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, reason: 'Format harus JPG, PNG, WEBP, atau PDF.' };
  }
  if (file.size > PROOF_MAX_BYTES) {
    return { ok: false, reason: 'Ukuran berkas maksimal 5 MB.' };
  }
  return { ok: true };
}

// Buang karakter yang tidak aman untuk nama objek di Storage.
function safeName(name) {
  return String(name || 'bukti')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80);
}

export function proofPathFor(userId, file) {
  return `${userId}/${Date.now()}-${safeName(file.name)}`;
}

// Mengembalikan { path } kalau berhasil, atau { error } berisi sebab yang
// bisa ditampilkan ke pengguna (bucket belum dibuat, dsb).
export async function uploadProof(supabase, userId, file) {
  const check = validateProofFile(file);
  if (!check.ok) return { error: check.reason };

  const path = proofPathFor(userId, file);
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error('Gagal mengunggah bukti relawan:', error);
    return { error: 'Bukti gagal diunggah. Coba lagi sebentar lagi.' };
  }
  return { path };
}

// Signed URL berumur pendek untuk admin/pemilik. Mengembalikan URL, atau null.
export async function proofSignedUrl(supabase, path, seconds = 300) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, seconds);
  if (error) return null;
  const signed = data?.signedUrl || data?.signedURL;
  if (!signed) return null;
  // Klien mengembalikan jalur relatif pada sebagian versi.
  if (signed.startsWith('http')) return signed;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`;
}
