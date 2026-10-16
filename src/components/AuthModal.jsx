'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, HeartHandshake, MoonStar, Sparkles, X } from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';

export default function AuthModal({ isOpen, initialMode = 'login', onClose }) {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consent, setConsent] = useState(false);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError('');
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) {
      setBusy(false);
      setError(err.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : err.message);
      return;
    }

    // Arahkan ke ruang yang tepat
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (prof?.role === 'admin') {
        router.push('/app/admin');
        router.refresh();
        onClose();
        return;
      }

      const { data: vol } = await supabase
        .from('volunteer_applications')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vol?.status === 'approved') {
        router.push('/app/lobby');
        router.refresh();
        onClose();
        return;
      }
      if (vol?.status === 'pending') {
        router.push('/app/volunteer');
        router.refresh();
        onClose();
        return;
      }
    }

    // Pengguna biasa langsung ke ruang suara untuk bercerita
    router.push('/app/voice');
    router.refresh();
    onClose();
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!consent) {
      setError('Kamu perlu menyetujui aturan ruang dulu ya.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName,
          roleIntent: isVolunteer ? 'volunteer' : 'user',
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || 'Gagal mendaftarkan akun.');
      }

      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginErr) {
        setMode('login');
        setError('Akun berhasil dibuat. Silakan masukkan kata sandi untuk masuk.');
        setBusy(false);
        return;
      }

      if (isVolunteer) {
        router.push('/app/volunteer');
      } else {
        router.push('/app/voice');
      }
      router.refresh();
      onClose();
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        setError('Batas pengiriman email tercapai. Silakan coba lagi beberapa saat.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-night/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="card relative z-10 w-full max-w-md border-white/15 bg-void/95 p-6 shadow-2xl transition-all sm:p-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-fog transition hover:bg-white/10 hover:text-frost"
          aria-label="Tutup"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2.5 font-bold text-frost">
          <Logo size={28} />
          <span>hearme</span>
        </div>

        {mode === 'login' ? (
          <div>
            <h1 className="mt-4 font-display text-2xl font-light">
              Selamat datang kembali <span className="text-gradient italic">di ruangmu.</span>
            </h1>
            <p className="mt-1 text-xs text-fog">
              <MoonStar className="mr-1 inline size-3.5" />
              Malam ini tidak harus dijalani sendirian.
            </p>

            <form onSubmit={handleLogin} className="mt-5 space-y-3.5">
              <div>
                <label className="label text-xs" htmlFor="modal-login-email">
                  Email
                </label>
                <input
                  id="modal-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kampus.ac.id"
                />
              </div>

              <div>
                <label className="label text-xs" htmlFor="modal-login-password">
                  Kata sandi
                </label>
                <input
                  id="modal-login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="rounded-xl bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}

              <button type="submit" className="btn-primary w-full justify-center gap-2" disabled={busy}>
                {busy ? (
                  <>
                    <span>Membuka ruang</span>
                    <WaveDots size="xs" />
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-fog">
              Belum punya ruang?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('register');
                }}
                className="font-medium text-frost underline underline-offset-4 hover:text-aurora-teal"
              >
                Buat ruangmu
              </button>
            </p>
          </div>
        ) : (
          <div>
            <h1 className="mt-4 font-display text-2xl font-light">
              Buat ruangmu <span className="text-gradient italic">malam ini.</span>
            </h1>
            <p className="mt-1 text-xs text-fog">Nama samaran boleh.</p>

            <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
              <div>
                <label className="label text-xs" htmlFor="modal-reg-displayName">
                  Nama panggilan (boleh samaran)
                </label>
                <input
                  id="modal-reg-displayName"
                  required
                  className="input text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="mis. Bunga Malam"
                />
              </div>

              <div>
                <label className="label text-xs" htmlFor="modal-reg-email">
                  Email kampus
                </label>
                <input
                  id="modal-reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kampus.ac.id"
                />
              </div>

              <div>
                <label className="label text-xs" htmlFor="modal-reg-password">
                  Kata sandi (minimal 6 karakter)
                </label>
                <input
                  id="modal-reg-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2 text-xs text-fog cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 accent-indigo-400"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>Aku menyetujui aturan ruang.</span>
                </label>

                <label
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs transition cursor-pointer ${
                    isVolunteer
                      ? 'border-indigo-300/40 bg-indigo-300/10 text-frost'
                      : 'border-white/10 bg-white/4 text-fog hover:border-white/20 hover:bg-white/6'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 accent-indigo-400"
                    checked={isVolunteer}
                    onChange={(e) => setIsVolunteer(e.target.checked)}
                  />
                  <div className="leading-snug">
                    <span className="flex items-center gap-1.5 font-medium text-frost">
                      <HeartHandshake className="size-3.5 text-aurora-indigo" />
                      Daftar sebagai Relawan Pendamping
                    </span>
                    <p className="mt-1 text-[11px] text-fog">
                      Centang jika kamu ingin menjadi relawan. Setelah akun dibuat, kamu langsung mengisi formulir &amp; dokumen pendukung.
                    </p>
                  </div>
                </label>
              </div>

              {error && <p className="rounded-xl bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}

              <button type="submit" className="btn-primary w-full justify-center gap-2" disabled={busy}>
                {busy ? (
                  <>
                    <span>Menyiapkan ruang</span>
                    <WaveDots size="xs" />
                  </>
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

            <p className="mt-5 text-center text-xs text-fog">
              Sudah punya ruang?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('login');
                }}
                className="font-medium text-frost underline underline-offset-4 hover:text-aurora-teal"
              >
                Masuk
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

