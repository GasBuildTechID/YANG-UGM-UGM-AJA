'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, HeartHandshake, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/register')) {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!consent) {
      setError('Kamu perlu menyetujui aturan ruang dulu ya.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      // 1. Coba daftarkan melalui API server (bypass email rate limit Supabase)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName,
          roleIntent: isVolunteer ? 'volunteer' : 'user',
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.error || 'Gagal mendaftarkan akun.');
      }

      // 2. Login otomatis setelah akun berhasil dibuat
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) {
        setError('Akun berhasil dibuat. Silakan gunakan formulir masuk.');
        setBusy(false);
        return;
      }

      // 3. Arahkan sesuai peran yang dipilih (URL bersih tanpa query params)
      if (isVolunteer) {
        router.push('/app/volunteer');
      } else {
        router.push('/app/voice');
      }
      router.refresh();
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        setError('Batas pengiriman email Supabase tercapai. Silakan coba lagi beberapa saat atau masuk langsung jika akun sudah terdaftar.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
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
        <div className="flex items-center gap-2.5 font-bold text-frost">
          <Logo size={28} />
          <span>hearme</span>
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
                placeholder="nama@email.com"
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
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2 text-sm text-fog cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-indigo-400"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>Aku menyetujui aturan ruang.</span>
              </label>

              <label
                className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm transition cursor-pointer ${
                  isVolunteer
                    ? 'border-indigo-300/40 bg-indigo-300/10 text-frost'
                    : 'border-white/10 bg-white/4 text-fog hover:border-white/20 hover:bg-white/6'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-indigo-400"
                  checked={isVolunteer}
                  onChange={(e) => setIsVolunteer(e.target.checked)}
                />
                <div className="leading-snug">
                  <span className="flex items-center gap-1.5 font-medium text-frost">
                    <HeartHandshake className="size-4 text-aurora-indigo" />
                    Daftar sebagai Relawan Pendamping
                  </span>
                  <p className="mt-1 text-xs text-fog">
                    Centang jika kamu ingin menjadi relawan. Setelah akun dibuat, kamu langsung mengisi formulir &amp; dokumen pendukung.
                  </p>
                </div>
              </label>
            </div>

            {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? (
                'Menyiapkan ruang…'
              ) : isVolunteer ? (
                <>
                  <Sparkles className="size-4" />
                  Buat ruang &amp; isi berkas relawan
                  <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Buat ruangku
                </>
              )}
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
