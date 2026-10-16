'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import GenerativeArt from '@/components/GenerativeArt';
import Logo from '@/components/Logo';
import { useSession } from '@/components/SessionProvider';
import AuthModal from '@/components/AuthModal';
import { getTimeGreeting } from '@/lib/time';

// ===== Halaman depan: hero malam + bagian "cara kerja" editorial =====
// Tata letak mengikuti referensi editorial: nav tiga zona (merek / tautan / aksi),
// hero di tengah yang mengisi satu layar penuh, satu bagian bernomor (juga satu
// layar penuh) dengan grid tiga kolom bergaris rambut, lalu penutup ringkas.
// Animasi memakai motion (Framer Motion): entrance berjenjang + reveal saat gulir.
// MotionConfig reducedMotion="user" — pengguna yang memilih reduced motion
// otomatis kehilangan animasi gerak tanpa konten yang sempat tersembunyi.

const EASE = [0.22, 1, 0.36, 1];

const STEPS = [
  {
    label: 'Cerita & gema',
    title: 'Tulis atau ucapkan harimu',
    body: 'Tarik napas, lalu ceritakan apa adanya. Kata-katamu tumbuh menjadi gema — karya visual abstrak yang hanya milikmu.',
  },
  {
    label: 'Teman bicara',
    title: 'Lingkaran kecil, atau berdua',
    body: 'Tiga sampai empat mahasiswa yang saling menjaga, atau berdua dengan relawan terverifikasi. Kamu yang memilih.',
  },
  {
    label: 'Kendali',
    title: 'Diam dan keluar selalu boleh',
    body: 'Tanpa transkrip rekaman suara. Yang tersimpan hanya ringkasan yang kamu setujui. Ruang terlindungi moderasi otomatis.',
  },
];

// entrance: fade + naik 14px, berjenjang dari atas halaman
const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
});

// reveal: fade + naik 16px saat masuk viewport (sekali saja)
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.65, delay, ease: EASE },
});

export default function LandingPage() {
  const { user, profile } = useSession();
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' });
  const [greeting, setGreeting] = useState('Malam');

  useEffect(() => {
    setGreeting(getTimeGreeting());
  }, []);

  const startHref = user ? (profile?.role === 'admin' ? '/app/admin' : '/app/voice') : '#';
  const startLabel = user ? 'Buka ruangmu' : 'Mulai bercerita';

  function scrollToCara(e) {
    e?.preventDefault();
    document.getElementById('cara')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh">
        {/* ===== Hero: malam ===== */}
        <section className="relative isolate overflow-hidden bg-night text-on-dark">
          <motion.div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          >
            <GenerativeArt text="malam yang tenang" height={1200} bare className="opacity-70" />
          </motion.div>
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                'linear-gradient(180deg, rgba(22,20,15,0.55) 0%, rgba(22,20,15,0.25) 40%, rgba(22,20,15,0.9) 100%)',
            }}
          />

          <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6">
            <motion.header className="flex items-center justify-between py-6" {...rise(0)}>
              <Link
                href="/"
                className="flex items-center gap-2.5 font-semibold text-lg tracking-tight text-on-dark transition hover:opacity-90"
              >
                <Logo size={34} />
                <span>hearme</span>
              </Link>
              <nav className="flex items-center gap-6 text-sm text-on-dark-body">
                <button
                  type="button"
                  onClick={scrollToCara}
                  className="cursor-pointer transition hover:text-on-dark"
                >
                  Cara kerja
                </button>
                {user ? (
                  <Link
                    href={startHref}
                    className="rounded-full bg-on-dark/15 px-4 py-1.5 text-xs font-medium text-on-dark transition hover:bg-on-dark/25"
                  >
                    Buka ruang
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'login' })}
                    className="cursor-pointer transition hover:text-on-dark"
                  >
                    Masuk
                  </button>
                )}
              </nav>
            </motion.header>

            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <motion.h1
                className="max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.06] tracking-tight text-balance"
                suppressHydrationWarning
                {...rise(0.08)}
              >
                {greeting} ini terasa berat?
                <br />
                <span className="italic">Titipkan sebentar di sini.</span>
              </motion.h1>
              <motion.p className="mt-6 max-w-xl text-on-dark-body" {...rise(0.18)}>
                Dukungan sebaya untuk mahasiswa — tanpa nama asli, tanpa terburu-buru.
              </motion.p>
              <motion.div className="mt-9 flex items-center justify-center" {...rise(0.28)}>
                {user ? (
                  <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href={startHref}
                      className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-on-dark px-7 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-[#f2efe9]"
                    >
                      {startLabel}
                      <ArrowRight className="size-4" />
                    </Link>
                  </motion.div>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'register' })}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-on-dark px-7 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-[#f2efe9] cursor-pointer"
                  >
                    {startLabel}
                    <ArrowRight className="size-4" />
                  </motion.button>
                )}
              </motion.div>
            </div>

            <motion.div className="flex justify-center pb-10" {...rise(0.38)}>
              <button
                type="button"
                onClick={scrollToCara}
                className="group flex cursor-pointer items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-on-dark-body/60 transition hover:text-on-dark"
              >
                Gulir untuk membaca
                <motion.span
                  aria-hidden="true"
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowDown className="size-3.5 transition group-hover:translate-y-0.5" />
                </motion.span>
              </button>
            </motion.div>
          </div>
        </section>

        {/* ===== 01 — Cara kerja ===== */}
        <section id="cara" className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center px-6 py-16 md:py-20">
          <motion.div
            className="flex items-baseline justify-between gap-4 text-[11px] font-medium uppercase tracking-[0.22em] text-faint"
            {...reveal(0)}
          >
            <span>01 — Cara kerja</span>
            <span className="hidden sm:inline">Privat &amp; tanpa nama asli</span>
          </motion.div>

          <div className="mt-12 max-w-2xl">
            <motion.h2
              className="font-display text-[clamp(1.7rem,3.4vw,2.5rem)] leading-tight text-balance"
              {...reveal(0.06)}
            >
              Di sini, kamu berhenti memikul semuanya sendirian.
            </motion.h2>
            <motion.p className="mt-7 leading-relaxed text-body" {...reveal(0.12)}>
              hearme menemani mahasiswa melewati malam yang berat. Privat, tanpa terburu-buru, dan selalu
              berangkat dari apa yang benar-benar kamu bawa masuk.
            </motion.p>
          </div>

          <div className="mt-18 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-hairline">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                className="md:px-8 md:first:pl-0 md:last:pr-0"
                {...reveal(0.1 * i)}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-faint">{step.label}</p>
                <h3 className="mt-4 font-display text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== Penutup ===== */}
        <section className="relative overflow-hidden bg-night text-on-dark">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <motion.h2
              className="font-display text-[clamp(1.7rem,3.6vw,2.6rem)] leading-tight text-balance"
              {...reveal(0)}
            >
              Malam ini, mulailah dari satu cerita.
            </motion.h2>
            <motion.p className="mx-auto mt-4 max-w-md text-on-dark-body" {...reveal(0.08)}>
              Tanpa nama asli. Kamu bisa berhenti kapan saja.
            </motion.p>
            <motion.div className="mt-8 flex flex-col items-center justify-center gap-4" {...reveal(0.16)}>
              {user ? (
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href={startHref}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-on-dark px-7 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-[#f2efe9]"
                  >
                    {startLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </motion.div>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setAuthModal({ open: true, mode: 'register' })}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-on-dark px-7 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-[#f2efe9] cursor-pointer"
                >
                  {startLabel}
                  <ArrowRight className="size-4" />
                </motion.button>
              )}
              {!user && (
                <p className="text-xs text-on-dark-body/75">
                  Sudah punya ruang?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'login' })}
                    className="cursor-pointer font-medium text-on-dark underline underline-offset-4 transition hover:text-white"
                  >
                    Masuk
                  </button>
                </p>
              )}
            </motion.div>
          </div>
        </section>

        {/* Modal Auth di dalam halaman (Mencegah kebocoran URL /login atau /register di address bar) */}
        <AuthModal
          isOpen={authModal.open}
          initialMode={authModal.mode}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
        />
      </div>
    </MotionConfig>
  );
}
