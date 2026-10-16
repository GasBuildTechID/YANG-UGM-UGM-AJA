'use client';

// Lobby relawan (diagram alur baru):
// Relawan -> isi formulir & validasi -> menunggu verif admin -> LOBBY.
// Dari lobby: "muncul matchmaking dari user" -> panggil (Buat Manggil) -> USER VS RELAWAN.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BellRing, HeartHandshake, Loader2, PhoneCall, UserPlus, Users } from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import { APPLICATION_LABELS, CATEGORY_LABELS, PHASE_LABELS, PRESENCE_LABELS } from '@/lib/labels';

function menitLalu(iso) {
  if (!iso) return '-';
  const menit = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (menit < 1) return 'baru saja';
  return `${menit} menit lalu`;
}

export default function LobbyPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, loading } = useSession();

  const [application, setApplication] = useState(undefined);
  const [presence, setPresence] = useState(null);
  const [offers, setOffers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const { data: app } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setApplication(app || null);

    if (app?.status === 'approved') {
      const { data: pres } = await supabase
        .from('volunteer_presence')
        .select('*')
        .eq('volunteer_id', user.id)
        .maybeSingle();
      setPresence(pres || { volunteer_id: user.id, status: 'offline' });

      // Panggilan yang menunggu jawabanku (tawaran 1-on-1)
      const { data: offersData } = await supabase
        .from('sessions')
        .select('*, session_participants!inner(user_id, consent_to_joined_volunteer_at)')
        .eq('mode', 'one_to_one')
        .eq('status', 'active')
        .eq('facilitator_id', user.id)
        .is('session_participants.consent_to_joined_volunteer_at', null);
      setOffers(offersData || []);

      // Grup aktif yang belum punya pendamping
      const { data: groupsData } = await supabase
        .from('sessions')
        .select('id, mode, status, phase, support_category, language, needs_summary, created_at')
        .eq('mode', 'group')
        .eq('status', 'active')
        .eq('volunteer_joined', false);
      setGroups(groupsData || []);

      // "muncul matchmaking dari user" — permintaan yang sedang menunggu (tanpa identitas/ringkasan)
      const { data: feed } = await supabase.rpc('lobby_waiting_requests');
      setWaiting(Array.isArray(feed) ? feed : []);
    }
    setLoadingPage(false);
  }, [user, supabase]);

  useEffect(() => {
    if (loading || !user) return undefined;
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, load]);

  async function setPresenceStatus(status) {
    setBusy('presence');
    setError('');
    const { error: err } = await supabase
      .from('volunteer_presence')
      .upsert({ volunteer_id: user.id, status, last_seen_at: new Date().toISOString() });
    setBusy('');
    if (err) {
      setError(err.message);
      return;
    }
    setPresence({ volunteer_id: user.id, status });
  }

  async function claim(requestId) {
    setBusy(requestId);
    setError('');
    const { data, error: err } = await supabase.rpc('volunteer_claim_request', { p_request_id: requestId });
    setBusy('');
    if (err) {
      setError(err.message);
      return;
    }
    router.push(`/app/session/${data.session_id}`);
  }

  async function requestJoin(sessionId) {
    setBusy(sessionId);
    setError('');
    const { error: err } = await supabase.rpc('request_volunteer_join', { p_session_id: sessionId });
    setBusy('');
    if (err) {
      setError(err.message);
      return;
    }
    router.push(`/app/session/${sessionId}`);
  }

  if (loading || (user && loadingPage)) {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Memuat lobby relawan..." className="text-aurora-teal" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <HeartHandshake className="mx-auto size-8 text-aurora-indigo" />
        <h1 className="mt-3 text-lg font-bold text-frost">Masuk dulu ya</h1>
        <p className="mt-1 text-sm text-fog">Lobby relawan terbuka setelah kamu masuk.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Masuk
        </Link>
      </div>
    );
  }

  if (!application || application.status !== 'approved') {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <HeartHandshake className="mx-auto size-8 text-aurora-indigo" />
        <h1 className="mt-3 text-lg font-bold text-frost">Lobby khusus relawan</h1>
        <p className="mt-1 text-sm text-fog">
          {application
            ? `Status pendaftaranmu: ${APPLICATION_LABELS[application.status]}. Lobby terbuka setelah admin menyetujui.`
            : 'Kamu belum terdaftar sebagai relawan. Isi formulir dulu — admin akan memverifikasi.'}
        </p>
        <Link href="/app/volunteer" className="btn-primary mt-5 inline-flex">
          Ke halaman relawan
        </Link>
      </div>
    );
  }

  const isReady = presence?.status === 'available';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href="/app"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-fog hover:text-frost"
        >
          <ArrowLeft className="size-3.5" /> Kembali ke beranda
        </Link>
        <h1 className="text-2xl font-bold text-frost">Lobby relawan</h1>
        <p className="mt-1 text-sm text-fog">
          Ruang tunggu pendamping. Pengguna yang mencari teman bicara muncul di sini — panggil yang ingin
          kamu temani.
        </p>
      </div>

      {/* Status kesiapan */}
      <div className="card">
        <h2 className="font-bold text-frost">Status kesiapanmu</h2>
        <p className="mt-1 text-sm text-fog">
          Kamu hanya muncul di daftar pengguna saat berstatus <strong>siap</strong>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['available', 'offline'].map((status) => (
            <button
              key={status}
              type="button"
              className={presence?.status === status ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setPresenceStatus(status)}
              disabled={busy === 'presence'}
            >
              {PRESENCE_LABELS[status]}
            </button>
          ))}
          {presence?.status === 'busy' && <span className="chip-amber">Sedang sesi</span>}
        </div>
        <p className="mt-3 text-xs text-mist">
          {isReady
            ? 'Kamu ada di lobby. Panggilan dari pengguna bisa muncul kapan saja.'
            : 'Set “Siap menerima sesi” supaya kamu bisa memanggil dan dipanggil.'}
        </p>
      </div>

      {/* Panggilan untukmu */}
      {offers.length > 0 && (
        <div className="card border-teal-300/40 bg-teal-300/10">
          <h2 className="flex items-center gap-2 font-bold text-teal-100">
            <HeartHandshake className="size-5" /> {offers.length} orang menunggu jawabanmu
          </h2>
          <div className="mt-3 space-y-2">
            {offers.map((o) => (
              <div key={o.id} className="rounded-xl bg-white/6 p-3">
                <p className="text-sm font-semibold text-frost">
                  {CATEGORY_LABELS[o.support_category] || o.support_category} ·{' '}
                  {o.language === 'en' ? 'Inggris' : 'Indonesia'}
                </p>
                {o.needs_summary && <p className="mt-1 text-sm text-fog">{o.needs_summary}</p>}
                <Link href={`/app/session/${o.id}`} className="btn-primary mt-2 inline-flex">
                  Buka &amp; jawab
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Muncul matchmaking dari user */}
      <div className="card">
        <h2 className="flex items-center gap-2 font-bold text-frost">
          <BellRing className="size-5 text-aurora-teal" /> Pengguna yang sedang menunggu
        </h2>
        <p className="mt-1 text-sm text-fog">
          Mereka menunggu teman bicara.{' '}
          {isReady ? 'Panggil yang ingin kamu temani.' : 'Set dirimu “Siap” dulu untuk memanggil.'}
        </p>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-mist">
            Belum ada yang menunggu. Halaman ini menyegar sendiri — kamu bisa tetap di lobby.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {waiting.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-frost">
                    {CATEGORY_LABELS[r.support_category] || r.support_category}
                  </p>
                  <p className="text-xs text-fog">
                    {r.language === 'en' ? 'Inggris' : 'Indonesia'} · menunggu {menitLalu(r.created_at)}
                  </p>
                </div>
                {r.mode === 'one_to_one' ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy === r.id || !isReady}
                    onClick={() => claim(r.id)}
                  >
                    {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
                    Panggil
                  </button>
                ) : (
                  <span className="chip-amber">Lingkaran sedang terbentuk</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grup yang berjalan */}
      <div className="card">
        <h2 className="flex items-center gap-2 font-bold text-frost">
          <Users className="size-5" /> Lingkaran yang berjalan sekarang
        </h2>
        <p className="mt-1 text-sm text-fog">
          Kamu boleh mendampingi lingkaran — tapi <strong>tidak masuk otomatis</strong>. Peserta harus setuju dulu.
        </p>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Belum ada grup aktif yang membutuhkan pendamping.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-semibold text-frost">
                  {CATEGORY_LABELS[g.support_category] || g.support_category} ·{' '}
                  {g.language === 'en' ? 'Inggris' : 'Indonesia'} · {PHASE_LABELS[g.phase] || g.phase}
                </p>
                {g.needs_summary && <p className="mt-1 text-sm text-fog">{g.needs_summary}</p>}
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  onClick={() => requestJoin(g.id)}
                  disabled={busy === g.id}
                >
                  <UserPlus className="size-4" /> Tawarkan diri mendampingi
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-200">{error}</p>}
    </div>
  );
}
