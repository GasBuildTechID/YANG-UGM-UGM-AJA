'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!consent) {
      setError('Kamu perlu menyetujui aturan ruang dulu ya.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data.session) {
      setCheckEmail(true);
      return;
    }
    router.push('/app/pilih');
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="card reveal w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-fog transition hover:text-frost"
        >
          <ArrowLeft className="size-3.5" /> Kembali ke beranda
        </Link>
        <div className="flex items-center gap-2 font-bold text-frost">
          <span className="logo-mark">🌿</span>
          hearme
        </div>
        <h1 className="mt-5 font-display text-2xl font-light">
          Buat ruangmu <span className="text-gradient italic">malam ini.</span>
        </h1>
        <p className="mt-1 text-sm text-fog">Nama samaran boleh.</p>

        {checkEmail ? (
          <div className="mt-5 rounded-2xl border border-teal-300/25 bg-teal-300/10 p-4 text-sm text-teal-100">
            Cek emailmu untuk konfirmasi, lalu{' '}
            <Link href="/login" className="font-semibold underline">
              masuk di sini
            </Link>
            .
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="displayName">
                Nama panggilan (boleh samaran)
              </label>
              <input
                id="displayName"
                required
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="mis. Bunga Malam"
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email kampus
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@kampus.ac.id"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Kata sandi (minimal 6 karakter)
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-fog">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-indigo-400"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>Aku menyetujui aturan ruang.</span>
            </label>
            {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              <Sparkles className="size-4" />
              {busy ? 'Menyiapkan ruang…' : 'Buat ruangku'}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-fog">
          Sudah punya ruang?{' '}
          <Link href="/login" className="font-semibold text-aurora-teal">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
