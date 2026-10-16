'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  HeartHandshake,
  MessageCircle,
  Send,
  ShieldAlert,
  Timer,
  UserPlus,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import { useRealtimeBroadcast, useCountdown, useElapsed } from '@/lib/hooks';
import { PHASE_LABELS, SESSION_GUIDE, formatClock, MOOD_LABELS } from '@/lib/labels';
import SafetyActions from '@/components/SafetyActions';
import GenerativeArt from '@/components/GenerativeArt';
import WaveDots from '@/components/WaveDots';
import { checkModeration, censorProfanity } from '@/lib/moderation';

const PHASE_ORDER = ['opening', 'sharing', 'closing'];

export default function SessionRoomPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId;
  const { user, profile, loading } = useSession();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phaseBusy, setPhaseBusy] = useState(false);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [typingNames, setTypingNames] = useState([]);
  const [modNotice, setModNotice] = useState('');
  const scrollRef = useRef(null);

  const [checkinDone, setCheckinDone] = useState(false);
  const [mood, setMood] = useState('lebih_baik');
  const [moodNote, setMoodNote] = useState('');

  const myRole = useMemo(
    () =>
      participants.find((p) => p.user_id === user?.id)?.participant_role ||
      (session?.facilitator_id === user?.id ? 'facilitator' : null),
    [participants, user, session]
  );
  const myConsent = useMemo(
    () => participants.find((p) => p.user_id === user?.id)?.consent_to_joined_volunteer_at || null,
    [participants, user]
  );
  const volunteerConsent = useMemo(
    () =>
      session?.volunteer_consent_approved ||
      Boolean(
        participants.find((p) => p.participant_role === 'volunteer' || p.participant_role === 'facilitator')
          ?.consent_to_joined_volunteer_at
      ),
    [participants, session]
  );
  const memberConsent = useMemo(
    () => participants.find((p) => p.participant_role === 'member')?.consent_to_joined_volunteer_at || null,
    [participants]
  );
  const bothConsent = Boolean(memberConsent && volunteerConsent);
  const isMember = myRole === 'member';
  const isVolunteerSide =
    myRole === 'volunteer' || myRole === 'facilitator' || session?.facilitator_id === user?.id;
  const isGroup = session?.mode === 'group';
  const isOneToOne = session?.mode === 'one_to_one';

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
      supabase.from('session_participants').select('*').eq('session_id', sessionId),
    ]);
    setSession(s || null);
    if (s && p) {
      let participantList = [...p];
      // Jika relawan sudah disetujui (volunteer_consent_approved) atau memiliki facilitator_id
      // namun belum terdaftar di session_participants, sertakan relawan ke dalam daftar peserta
      if (
        s.facilitator_id &&
        s.volunteer_consent_approved &&
        !participantList.some((row) => row.user_id === s.facilitator_id)
      ) {
        participantList.push({
          session_id: sessionId,
          user_id: s.facilitator_id,
          participant_role: 'facilitator',
          consent_to_joined_volunteer_at: s.phase_started_at || new Date().toISOString(),
          joined_at: s.phase_started_at || new Date().toISOString(),
          left_at: null,
        });
      }
      const withNames = await Promise.all(
        participantList.map(async (row) => {
          const { data: u } = await supabase.from('users').select('display_name').eq('id', row.user_id).maybeSingle();
          return {
            ...row,
            display_name: u?.display_name || (row.user_id === s.facilitator_id ? 'Relawan' : 'Peserta'),
          };
        })
      );
      setParticipants(withNames);
    }
    setLoadingRoom(false);
  }, [sessionId, supabase]);

  useEffect(() => {
    if (loading || !user) return undefined;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, sessionId]);

  // Polling ringan untuk status sesi/peserta (tanpa websocket DB)
  useEffect(() => {
    if (loading || !user) return undefined;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, sessionId, load]);

  const sendTyping = useCallback(
    (name) => {
      supabase.channel(`session:${sessionId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { name, ts: Date.now() },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId]
  );

  const broadcast = useRealtimeBroadcast(`session:${sessionId}`, 'msg', (payload) => {
    if (!payload) return;
    // Sensor otomatis pada pesan masuk agar ruang obrolan terlindungi
    const sanitizedMsg = {
      ...payload,
      text: censorProfanity(payload.text || ''),
    };
    setMessages((prev) => [...prev.slice(-199), sanitizedMsg]);
  });

  useRealtimeBroadcast(`session:${sessionId}`, 'typing', (payload) => {
    if (!payload?.name) return;
    setTypingNames((prev) => (prev.includes(payload.name) ? prev : [...prev, payload.name]));
    setTimeout(() => setTypingNames((prev) => prev.filter((n) => n !== payload.name)), 2500);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e?.preventDefault();
    const rawText = draft.trim();
    if (!rawText) return;

    // Filter moderasi kata tidak pantas secara otomatis
    const mod = checkModeration(rawText);
    if (!mod.isClean) {
      setModNotice('Pesanmu disensor otomatis agar ruang obrolan tetap aman dan nyaman bagi semua teman.');
      setTimeout(() => setModNotice(''), 5000);
    }

    const cleanText = mod.cleanText;

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: user.id,
      name: profile?.display_name || 'Aku',
      text: cleanText.slice(0, 1000),
      ts: Date.now(),
      censored: !mod.isClean,
    };
    setMessages((prev) => [...prev.slice(-199), msg]);
    setDraft('');
    // broadcast adalah supabase client; kirim via channel yang sudah subscribe
    const ch = broadcast.channel(`session:${sessionId}`);
    await ch.send({ type: 'broadcast', event: 'msg', payload: msg });
  }

  // ---- aksi relawan pada tawaran 1-on-1 ----
  async function respondOffer(accept) {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('respond_to_session', { p_session_id: sessionId, p_accept: accept });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!accept) {
      router.replace('/app/lobby');
      return;
    }
    load();
  }

  // ---- aksi peserta 1-on-1: konfirmasi sebelum sesi dimulai ----
  async function confirmConsent() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('confirm_member_consent', { p_session_id: sessionId });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    load();
  }

  // ---- aksi peserta pada relawan yang mau gabung grup ----
  async function approveVolunteer() {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('approve_volunteer_join', { p_session_id: sessionId });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else if (data?.approved) {
      setSession((prev) => (prev ? { ...prev, volunteer_consent_approved: true } : prev));
    }
    load();
  }

  async function declineVolunteer() {
    setBusy(true);
    const { error: err } = await supabase.rpc('decline_volunteer_join', { p_session_id: sessionId });
    setBusy(false);
    if (err) setError(err.message);
    load();
  }

  async function nextPhase() {
    const idx = PHASE_ORDER.indexOf(session.phase);
    const next = PHASE_ORDER[idx + 1];
    if (!next) return;
    setPhaseBusy(true);
    const { error: err } = await supabase.rpc('set_session_phase', { p_session_id: sessionId, p_phase: next });
    setPhaseBusy(false);
    if (err) setError(err.message);
    load();
  }

  async function endSession() {
    setBusy(true);
    const { error: err } = await supabase.rpc('end_session', { p_session_id: sessionId });
    setBusy(false);
    if (err) setError(err.message);
    load();
  }

  async function submitCheckin(e) {
    e.preventDefault();
    setBusy(true);
    const { error: err } = await supabase.rpc('submit_checkin', {
      p_session_id: sessionId,
      p_mood: mood,
      p_note: moodNote,
    });
    setBusy(false);
    if (err) setError(err.message);
    setCheckinDone(true);
  }

  // Timer consent untuk relawan gabung grup (dokumen §4)
  const consentDeadline = useMemo(() => {
    if (session?.volunteer_joined && !session?.volunteer_consent_approved && session?.phase_started_at) {
      return new Date(new Date(session.phase_started_at).getTime() + 60 * 1000).toISOString();
    }
    return null;
  }, [session?.volunteer_joined, session?.volunteer_consent_approved, session?.phase_started_at]);

  const consentRemaining = useCountdown(consentDeadline, {
    onExpire: () => {
      if (session?.volunteer_joined && !session?.volunteer_consent_approved) load();
    },
  });

  // Timer ring untuk tawaran 1-on-1 ke relawan
  const [ringSeconds, setRingSeconds] = useState(30);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'one_to_one_ring_seconds').maybeSingle();
      const v = Number(data?.value);
      if (v > 0) setRingSeconds(v);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offerDeadline =
    isOneToOne && isVolunteerSide && !myConsent && session?.status === 'active' && session?.started_at
      ? new Date(new Date(session.started_at).getTime() + ringSeconds * 1000).toISOString()
      : null;
  const offerRemaining = useCountdown(offerDeadline, {
    onExpire: () => {
      // relawan tidak merespons -> backend melepas reservasi
      supabase.rpc('release_stale_reservations').then(() => load());
    },
  });

  const elapsed = useElapsed(session?.started_at);
  const guide = SESSION_GUIDE[session?.phase] || null;

  if (loading || loadingRoom) {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Membuka ruang sesi..." className="text-aurora-teal" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-lg font-bold">Sesi tidak ditemukan</h1>
        <p className="mt-1 text-sm text-fog">Mungkin sudah berakhir atau tautannya tidak berlaku lagi.</p>
        <Link href="/app" className="btn-primary mt-4 inline-flex">
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  const isEnded = ['completed', 'ended_early', 'reported'].includes(session.status);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header sesi */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="chip-teal">{isGroup ? 'Lingkaran kecil' : 'Berdua dengan relawan'}</span>
              {isEnded ? (
                <span className="chip">{session.status === 'completed' ? 'Selesai' : 'Berakhir'}</span>
              ) : (
                <span className="chip-amber">{PHASE_LABELS[session.phase]}</span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-frost">
              {isGroup ? 'Ruang grup' : 'Ruang ngobrol berdua'}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fog">
              <Timer className="size-4" /> Berjalan {formatClock(elapsed)}
              {!isEnded && ` · ${PHASE_LABELS[session.phase]}`}
            </p>
          </div>
          {!isEnded && (
            <SafetyActions
              sessionId={sessionId}
              participants={participants}
              compact={isGroup}
              onLeft={() => router.replace('/app')}
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {participants
            .filter((p) => !p.left_at)
            .map((p) => (
              <span key={p.user_id} className="chip">
                {p.display_name}
                {p.participant_role !== 'member' && ' · relawan'}
                {p.user_id === user.id && ' (kamu)'}
              </span>
            ))}
        </div>
      </div>

      {/* Pengingat batas layanan */}
      {!isEnded && (
        <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-fog">
          Boleh diam, melewati giliran, atau keluar kapan saja.
        </div>
      )}

      {/* Tawaran 1-on-1 untuk relawan */}
      {offerDeadline && !isEnded && (
        <div className="card border-teal-300/40 bg-teal-300/10">
          <h2 className="flex items-center gap-2 font-bold text-teal-100">
            <HeartHandshake className="size-5" /> Seseorang menunggu — mau menemaninya?
          </h2>
          <p className="mt-1 text-sm text-teal-100">
            {session.support_category} · {session.language === 'en' ? 'Inggris' : 'Indonesia'}
          </p>
          {session.needs_summary && (
            <p className="mt-2 rounded-xl bg-white/10 p-3 text-sm text-teal-100">
              {session.needs_summary}
            </p>
          )}
          <p className="mt-2 text-sm text-teal-100">
            Jawab dalam <strong>{formatClock(offerRemaining)}</strong> — atau kami carikan yang lain.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" onClick={() => respondOffer(true)} disabled={busy}>
              <Check className="size-4" /> Ya, dampingi
            </button>
            <button type="button" className="btn-secondary" onClick={() => respondOffer(false)} disabled={busy}>
              <X className="size-4" /> Maaf, tidak bisa
            </button>
          </div>
        </div>
      )}

      {/* Relawan sudah menerima / memanggil — menunggu peserta mengonfirmasi */}
      {isOneToOne && isVolunteerSide && volunteerConsent && !memberConsent && !isEnded && (
        <div className="card text-center">
          <WaveDots size="md" className="mx-auto text-aurora-teal" />
          <p className="mt-2 text-sm text-fog">
            Kamu siap menemaninya. Menunggu peserta mengonfirmasi sebelum ruang bicara terbuka…
          </p>
        </div>
      )}

      {/* Menunggu relawan menerima (sisi pengguna) / konfirmasi peserta setelah dipanggil */}
      {isOneToOne && isMember && !isEnded && (
        <div className="card text-center">
          {myConsent ? null : (
            <>
              {volunteerConsent ? (
                <>
                  <HeartHandshake className="mx-auto size-6 text-aurora-teal" />
                  <h2 className="mt-2 font-display text-lg font-light text-frost">
                    Relawan siap menemanimu.
                  </h2>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-fog">
                    Seorang relawan terverifikasi siap mendengarkan. Mulai ngobrol berdua?
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" className="btn-primary" onClick={confirmConsent} disabled={busy}>
                      <Check className="size-4" /> Ya, mulai ngobrol
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-mist">
                    Kamu yang memutuskan. Belum siap? Kamu bisa keluar lewat tombol di atas.
                  </p>
                </>
              ) : (
                <>
                  <WaveDots size="md" className="mx-auto text-aurora-teal" />
                  <p className="mt-2 text-sm text-fog">
                    Menunggu jawaban relawan… kalau tak ada, kamu dapat pilihan lain.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Relawan bergabung ke grup: butuh persetujuan peserta */}
      {isGroup && session.volunteer_joined && !session.volunteer_consent_approved && !isEnded && (
        <div className="card border-amber-300/40 bg-amber-400/10">
          {isMember ? (
            myConsent ? (
              <div className="py-2 text-center">
                <Check className="mx-auto size-6 text-aurora-teal" />
                <h2 className="mt-2 font-bold text-amber-100">Persetujuanmu sudah tersimpan</h2>
                <p className="mt-1 text-sm text-amber-200">
                  Menunggu konfirmasi anggota lain atau relawan memasuki ruangan…
                </p>
              </div>
            ) : (
              <>
                <h2 className="flex items-center gap-2 font-bold text-amber-100">
                  <UserPlus className="size-5" /> Seorang relawan ingin bergabung
                </h2>
                <p className="mt-1 text-sm text-amber-200">
                  Kalau semua peserta setuju, seorang relawan akan mendampingi sesi ini. Kalau salah satu
                  menolak, sesi tetap berjalan seperti sekarang.
                </p>
                {consentRemaining > 0 && (
                  <p className="mt-1 text-sm text-amber-200">
                    Waktu memilih: <strong>{formatClock(consentRemaining)}</strong>
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-primary" onClick={approveVolunteer} disabled={busy}>
                    <Check className="size-4" /> Aku setuju
                  </button>
                  <button type="button" className="btn-secondary" onClick={declineVolunteer} disabled={busy}>
                    <X className="size-4" /> Tidak, lanjut tanpa relawan
                  </button>
                </div>
              </>
            )
          ) : (
            <div className="py-2 text-center">
              <WaveDots size="sm" className="mx-auto text-amber-200" />
              <h2 className="mt-2 font-bold text-amber-100">Menunggu persetujuan peserta…</h2>
              <p className="mt-1 text-sm text-amber-200">
                Permintaan bergabungmu sedang ditinjau peserta lingkaran. Kamu akan otomatis masuk begitu disetujui.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Panduan sesi grup */}
      {isGroup && !isEnded && guide && (
        <div className="card">
          <h2 className="font-bold text-frost">{guide.title}</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-fog">
            {guide.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            {PHASE_ORDER.indexOf(session.phase) < PHASE_ORDER.length - 1 && (
              <button type="button" className="btn-secondary" onClick={nextPhase} disabled={phaseBusy}>
                Lanjut ke bagian berikutnya →
              </button>
            )}
            {isVolunteerSide && (
              <button type="button" className="btn-danger" onClick={endSession} disabled={busy}>
                Akhiri sesi
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat — 1-on-1 hanya terbuka setelah kedua sisi setuju */}
      {!isEnded && (isGroup || (isOneToOne && bothConsent)) && (
        <div className="card flex flex-col p-0">
          <div className="border-b border-white/8 px-4 py-3">
            <h2 className="flex items-center gap-2 font-bold text-frost">
              <MessageCircle className="size-4" /> Ruang bicara
            </h2>
            <p className="text-xs text-mist">
              Tanpa transkrip. Semua di ruang ini mendengarkan dengan hormat.
            </p>
          </div>

          <div ref={scrollRef} className="max-h-80 min-h-48 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-mist">
                Belum ada pesan. Sapa dengan nama samaranmu.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.user_id === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bubble-mine' : 'bubble-theirs'
                    }`}
                  >
                    {!mine && <p className="text-[11px] font-semibold opacity-70">{m.name}</p>}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {typingNames.length > 0 && (
            <p className="flex items-center gap-2 px-4 pb-1 text-xs text-mist">
              <span>{typingNames.join(', ')} sedang menulis</span>
              <WaveDots size="xs" className="text-mist" />
            </p>
          )}

          {modNotice && (
            <div className="border-t border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">
              {modNotice}
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-white/8 p-3">
            <input
              className="input flex-1"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.length > 0 && e.target.value.length % 12 === 0) {
                  sendTyping(profile?.display_name || 'Seseorang');
                }
              }}
              placeholder="Tulis dengan hormat… (boleh juga diam)"
              maxLength={1000}
            />
            <button type="submit" className="btn-primary" disabled={!draft.trim()}>
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}

      {/* Sesi selesai -> gema + check-in opsional */}
      {isEnded && (
        <div className="card">
          <h2 className="font-display text-xl font-light text-frost">
            Sesi selesai. <span className="text-gradient italic">Terima kasih sudah hadir.</span>
          </h2>
          <p className="mt-1 text-sm text-fog">
            Kamu baru saja melakukan hal yang berat: bercerita. Gema ini tumbuh dari kata-katamu — hanya milikmu,
            tidak kami simpan.
          </p>

          <div className="mt-4">
            <GenerativeArt text={session.needs_summary || 'malam yang tenang'} height={200} />
          </div>

          <p className="mt-4 text-sm text-fog">
            Check-in ini opsional — hanya untukmu. Admin hanya melihat angka, bukan jawabanmu.
          </p>

          {checkinDone ? (
            <div className="mt-4 rounded-xl bg-teal-300/10 p-4 text-sm text-teal-100">
              Terima kasih. Kalau masih berat, jalur bantuan ada di Akun → Sumber bantuan.
            </div>
          ) : (
            <form onSubmit={submitCheckin} className="mt-4 space-y-3">
              <div>
                <span className="label">Setelah sesi ini, bagaimana perasaanmu?</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MOOD_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMood(value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                        mood === value
                          ? 'border-indigo-300/50 bg-teal-300/10 text-teal-100'
                          : 'border-white/10 bg-white/6 text-fog hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="moodNote">
                  Catatan (opsional)
                </label>
                <textarea
                  id="moodNote"
                  className="input min-h-16"
                  value={moodNote}
                  onChange={(e) => setMoodNote(e.target.value)}
                  placeholder="Satu langkah kecil untukmu…"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                Kirim check-in
              </button>
            </form>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/app" className="btn-secondary">
              Kembali ke beranda
            </Link>
            <Link href="/app/account" className="btn-secondary">
              <ShieldAlert className="size-4" /> Lihat sumber bantuan
            </Link>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-200">{error}</p>}
    </div>
  );
}
