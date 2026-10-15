'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, MoonStar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : err.message);
      return;
    }
    router.push('/app/pilih');
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
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
          Selamat datang kembali <span className="text-gradient italic">di ruangmu.</span>
        </h1>
        <p className="mt-1 text-sm text-fog">
          <MoonStar className="mr-1 inline size-3.5" />
          Malam ini tidak harus dijalani sendirian.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
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
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Membuka pintu…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-fog">
          Belum punya ruang?{' '}
          <Link href="/register" className="font-semibold text-aurora-teal">
            Buat sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
