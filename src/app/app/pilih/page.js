'use client';

// "pilihan" — pintu pertama setelah login (diagram alur baru):
// LOGIN/BIKIN AKUN -> pilihan Pengguna | Relawan.
//   Pengguna -> langsung layar suara (voice AI)
//   Relawan  -> langsung formulir pendaftaran (lampirkan 1 bukti kualifikasi)
// Admin tidak melewati halaman ini: langsung dialihkan ke dashboard-nya.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Feather, HeartHandshake } from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import { APPLICATION_LABELS } from '@/lib/labels';

export default function PilihPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const [application, setApplication] = useState(undefined); // undefined = memuat, null = belum daftar
  const [loadingApp, setLoadingApp] = useState(true);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('volunteer_applications')
        .select('id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(data || null);
      setLoadingApp(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Alihkan otomatis sesuai peran tanpa menampilkan opsi ganda
  useEffect(() => {
    if (!user || loading || loadingApp) return;
    if (isAdmin) {
      router.replace('/app/admin');
      return;
    }
    if (application?.status === 'approved') {
      router.replace('/app/lobby');
      return;
    }
    if (application?.status === 'pending') {
      router.replace('/app/volunteer');
      return;
    }
    // Pengguna biasa langsung ke ruang suara untuk bercerita
    router.replace('/app/voice');
  }, [user, loading, loadingApp, isAdmin, application, router]);

  if (loading || isAdmin || (user && loadingApp)) {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Mengarahkan ruangmu..." className="text-aurora-teal" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-lg font-bold text-frost">Masuk dulu ya</h1>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Masuk
        </Link>
      </div>
    );
  }

  const isVolunteerApproved = application?.status === 'approved';
  // Relawan langsung dibawa ke formulir; kalau sudah disetujui, ke lobby.
  const volunteerHref = isVolunteerApproved ? '/app/lobby' : '/app/volunteer';
  const volunteerDesc = !application
    ? 'Isi formulir dan lampirkan 1 bukti kualifikasi (STR, ijazah psikologi, atau sertifikat). Setelah diverifikasi admin, kamu bisa menemani.'
    : isVolunteerApproved
      ? 'Kamu relawan terverifikasi. Buka lobby dan jawab panggilan dari pengguna.'
      : application.status === 'pending'
        ? 'Pendaftaranmu sedang menunggu verifikasi admin. Sambil menunggu, kamu tetap bisa bercerita.'
        : 'Lihat status pendaftaran relawanmu di halaman relawan.';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="reveal text-center">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-light leading-tight text-balance">
          Kamu di sini sebagai <span className="text-gradient italic">siapa?</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-fog">
          Pilih dulu supaya kami mengarahkanmu ke tempat yang tepat. Kamu bisa berpindah kapan saja.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/app/voice"
          className="group rounded-3xl border border-white/10 bg-white/4 p-6 transition hover:-translate-y-0.5 hover:border-teal-300/35 hover:bg-teal-300/10"
        >
          <span className="chip-teal">
            <Feather className="size-3.5" /> Pengguna
          </span>
          <h2 className="mt-4 font-display text-xl font-light text-frost">Aku mau bercerita</h2>
          <p className="mt-2 text-sm leading-relaxed text-fog">
            Langsung masuk ke ruang suara yang menemanimu pelan. Kata-katamu tumbuh jadi{' '}
            <strong className="text-frost">gema</strong>, lalu kami carikan teman bicara untukmu.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-aurora-teal">
            Mulai bercerita <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href={volunteerHref}
          className="group rounded-3xl border border-white/10 bg-white/4 p-6 transition hover:-translate-y-0.5 hover:border-indigo-300/35 hover:bg-indigo-300/10"
        >
          <span className="chip">
            <HeartHandshake className="size-3.5" /> Relawan
            {application && <span className="ml-1.5 opacity-80">· {APPLICATION_LABELS[application.status]}</span>}
          </span>
          <h2 className="mt-4 font-display text-xl font-light text-frost">Aku mau menemani</h2>
          <p className="mt-2 text-sm leading-relaxed text-fog">{volunteerDesc}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-aurora-indigo">
            {isVolunteerApproved ? 'Buka lobby' : application ? 'Lihat status pendaftaran' : 'Isi formulir relawan'}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
