'use client';

// Alur "voice ai" — percakapan mengalir seperti ChatGPT voice.
// Aturan main (permintaan pengguna):
//   1. Setelah login hanya ini yang muncul — tanpa kerangka aplikasi lain.
//   2. Pengguna menjawab dengan suara (tidak ada tombol opsi).
//   3. Orb beranimasi setiap kali AI berbicara (dan saat pengguna bicara).
//   4. Begitu pengguna selesai bicara, AI LANGSUNG menanggapi dan LANGSUNG
//      membacakan pertanyaan berikutnya — tanpa perlu menekan mikrofon lagi.
//   5. Setelah 3 pertanyaan, muncul tombol "Selanjutnya" dengan transisi beranimasi.
//
// Tiga hal yang membuat ini terasa seperti ChatGPT voice:
//   - endpointing: giliran dianggap selesai setelah hening ~1,4 detik;
//   - anti-gema: mikrofon TIDAK PERNAH terbuka selama AI bicara;
//   - tanggapan singkat: satu kalimat menanggapi, lalu pertanyaan berikutnya.
//
// Pelajaran suara yang sudah dibayar mahal (jangan diubah tanpa alasan):
//   - onend TTS sering tidak pernah dipanggil -> speak() wajib punya jaring pengaman;
//   - hasil pengenalan bisa hanya "interim" -> terima transkrip saat pengenalan berakhir;
//   - izin mikrofon diminta eksplisit supaya sebab kegagalan bisa ditampilkan;
//   - pengguna tidak boleh terjebak: setelah 2 kegagalan, muncul input teks.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  MicOff,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useSession } from '@/components/SessionProvider';
import CrisisBanner from '@/components/CrisisBanner';
import VoiceOrb from '@/components/VoiceOrb';
import WaveDots from '@/components/WaveDots';
import Logo from '@/components/Logo';
import {
  VOICE_QUESTIONS,
  VOICE_GREETING,
  VOICE_CLOSING,
  VOICE_REPROMPTS,
  acknowledgementFor,
  buildSummaryFromAnswers,
  matchOptionFromSpeech,
  processVoiceTurn,
  INTAKE_STORAGE_KEY,
} from '@/lib/intake';
import {
  createRecognizer,
  describeMicPermission,
  describeSpeechError,
  ensureMicPermission,
  speak,
  stopSpeaking,
  sttSupported,
  ttsSupported,
  warmUpVoices,
} from '@/lib/voice';

const CRISIS_RE =
  /(bunuh diri|mengakhiri hidup|menyakiti diri|self[- ]?harm|ingin mati|pengen mati|ga mau hidup|tidak ingin hidup)/i;

const SILENCE_MS = 2200; // jeda hening yang lebih ramah — memberi ruang berpikir & bernapas
const MAX_LISTEN_MS = 20000; // batas atas yang leluasa (20 detik) agar tidak memotong penjelasan
const MAX_FAILURES = 2; // setelah ini, input teks ditawarkan otomatis

function labelFor(question, value) {
  const opt = question?.options?.find((o) => o.value === value);
  return opt?.label || value;
}

export default function VoiceIntakePage() {
  const router = useRouter();
  const { profile, loading } = useSession();

  const [phase, setPhase] = useState('gate'); // gate | talk | done | leaving
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({ language: 'id' });
  const [orb, setOrb] = useState('idle'); // idle | speaking | listening | thinking
  const [aiLine, setAiLine] = useState(''); // kalimat AI yang sedang/terakhir diucapkan
  const [heard, setHeard] = useState(''); // ucapan pengguna yang sedang terbaca
  const [userLine, setUserLine] = useState(''); // ucapan pengguna yang sudah ditanggapi
  const [turns, setTurns] = useState([]); // riwayat percakapan (untuk scrollback)
  const [crisis, setCrisis] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [manualText, setManualText] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState('');
  const [speechReady, setSpeechReady] = useState(false);
  const [ttsReady, setTtsReady] = useState(false);
  const [micProblem, setMicProblem] = useState('');
  const [failures, setFailures] = useState(0);

  const recognizerRef = useRef(null);
  const timersRef = useRef([]);
  const silenceRef = useRef(null);
  const listenCapRef = useRef(null);
  const speakingRef = useRef(false); // anti-gema: true selama AI bicara
  const busyRef = useRef(false); // mencegah dua giliran berjalan bersamaan
  const listeningRef = useRef(false); // penjaga: hanya satu pengenal aktif
  const failuresRef = useRef(0); // penghitung kegagalan (ref, bukan state)
  const indexRef = useRef(0); // giliran aktif (ref: callback lintas-render harus baca nilai terbaru)
  const aliveRef = useRef(true); // false saat komponen dilepas / mulai ulang

  const question = VOICE_QUESTIONS[index] || null;
  const total = VOICE_QUESTIONS.length;

  // Dukungan browser diperiksa setelah mount (hindari beda render server/klien)
  useEffect(() => {
    setSpeechReady(sttSupported());
    setTtsReady(ttsSupported());
    warmUpVoices();
    return () => {
      aliveRef.current = false;
      timersRef.current.forEach((t) => window.clearTimeout(t));
      if (silenceRef.current) window.clearTimeout(silenceRef.current);
      if (listenCapRef.current) window.clearTimeout(listenCapRef.current);
      stopSpeaking();
      recognizerRef.current?.abort();
    };
  }, []);

  function later(fn, ms) {
    const id = window.setTimeout(() => {
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }

  function clearTurnTimers() {
    if (silenceRef.current) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
    if (listenCapRef.current) {
      window.clearTimeout(listenCapRef.current);
      listenCapRef.current = null;
    }
  }

  // ===== AI bicara =====
  // Mikrofon ditutup lebih dulu, dan speakingRef menjaga agar tidak ada pengenalan
  // yang berjalan selama AI bersuara — kalau tidak, AI mendengar suaranya sendiri.
  function say(text, onDone) {
    if (!aliveRef.current) return;
    setAiLine(text);
    setTurns((prev) => [...prev, { role: 'ai', text }]);
    recognizerRef.current?.abort();
    clearTurnTimers();

    const proceed = () => {
      if (!aliveRef.current) return;
      speakingRef.current = false;
      onDone?.();
    };

    if (voiceOn && ttsReady && text) {
      speakingRef.current = true;
      setOrb('speaking');
      // jeda kecil setelah suara berhenti, supaya ekor audio tidak ikut tertangkap
      speak(text, { onEnd: () => later(proceed, 320) });
    } else {
      speakingRef.current = false;
      setOrb('idle');
      later(proceed, 250);
    }
  }

  // ===== Mendengarkan satu giliran =====
  // Giliran selesai setelah hening SILENCE_MS, atau setelah MAX_LISTEN_MS.
  async function listen() {
    if (!aliveRef.current || !speechReady) return;
    if (speakingRef.current) return; // anti-gema: jangan pernah saat AI bersuara
    if (busyRef.current) return;
    if (listeningRef.current) return; // sudah ada satu pengenal berjalan

    listeningRef.current = true;
    clearTurnTimers();
    setHeard('');
    setMicProblem('');
    setOrb('listening');

    // Izin mikrofon dulu — supaya kegagalan punya sebab yang jelas.
    const perm = await ensureMicPermission();
    if (!aliveRef.current) {
      listeningRef.current = false;
      return;
    }
    if (!perm.ok) {
      listeningRef.current = false;
      setOrb('idle');
      setMicProblem(describeMicPermission(perm.reason));
      bumpFailure();
      return;
    }

    const rec = createRecognizer({
      lang: 'id-ID',
      onResult: ({ transcript }) => {
        if (transcript) setHeard(transcript);
        // setiap kata baru menunda akhir giliran
        if (silenceRef.current) window.clearTimeout(silenceRef.current);
        silenceRef.current = window.setTimeout(() => {
          recognizerRef.current?.stop();
        }, SILENCE_MS);
      },
      // Pengenalan berakhir: pakai apa pun yang sempat terdengar (termasuk interim).
      onEnd: ({ transcript }) => {
        clearTurnTimers();
        listeningRef.current = false;
        if (!aliveRef.current || busyRef.current) return;
        const text = String(transcript || '').trim();
        if (text) handleUserSpeech(text);
        else reask();
      },
      onError: (event) => {
        const code = event?.error;
        clearTurnTimers();
        listeningRef.current = false;
        if (code === 'aborted' || busyRef.current || !aliveRef.current) return;
        setOrb('idle');
        const message = describeSpeechError(code);
        if (message) setMicProblem(message);
        // 'no-speech' bukan kegagalan izin — cukup minta ulang dengan lembut
        if (code === 'no-speech') reask();
        else bumpFailure();
      },
    });

    if (!rec) {
      listeningRef.current = false;
      setOrb('idle');
      setMicProblem('Browser ini belum bisa mendengar suara. Coba buka lewat Chrome, ya.');
      bumpFailure();
      return;
    }

    recognizerRef.current = rec;
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setOrb('idle');
      setMicProblem('Mikrofon tidak bisa dinyalakan. Coba ketuk mikrofon sekali lagi.');
      bumpFailure();
      return;
    }

    // Batas waktu mendengarkan: jangan menggantung tanpa akhir.
    listenCapRef.current = window.setTimeout(() => {
      recognizerRef.current?.stop();
    }, MAX_LISTEN_MS);
  }

  // Penghitung kegagalan pakai ref: updater setState bisa dipanggil dua kali
  // (reactStrictMode), dan efek samping di dalamnya akan berjalan dobel.
  function bumpFailure() {
    failuresRef.current += 1;
    setFailures(failuresRef.current);
    return failuresRef.current;
  }

  // Suara belum tertangkap: minta ulang dengan kalimat lembut.
  // Dibatasi supaya tidak jadi lingkaran tanpa akhir.
  function reask() {
    if (!aliveRef.current || busyRef.current) return;
    const n = bumpFailure();
    if (n >= MAX_FAILURES) return;
    const line = VOICE_REPROMPTS[(n - 1) % VOICE_REPROMPTS.length];
    later(() => say(line, listen), 250);
  }

  // ===== Inti percakapan: tanggapi, lalu langsung pertanyaan berikutnya =====
  // Penting: giliran dibaca dari indexRef, bukan dari state `index`.
  // listen()/handleUserSpeech() dipanggil dari callback giliran sebelumnya (closure
  // render lama), jadi membaca state akan memakai pertanyaan yang sudah basi.
  function handleUserSpeech(rawText) {
    const text = String(rawText || '').trim();
    const turnIndex = indexRef.current;
    const currentQuestion = VOICE_QUESTIONS[turnIndex] || null;
    if (!text || !currentQuestion || busyRef.current) return;
    busyRef.current = true;
    listeningRef.current = false;
    clearTurnTimers();
    recognizerRef.current?.abort();
    speakingRef.current = false;

    if (CRISIS_RE.test(text)) setCrisis(true);

    setHeard('');
    setUserLine(text);
    setTurns((prev) => [...prev, { role: 'user', text }]);

    const isLast = turnIndex + 1 >= total;
    const nextQuestion = isLast ? null : VOICE_QUESTIONS[turnIndex + 1].question;

    // Proses giliran suara: toleransi kesalahan fonetik STT, tebak maksud dari konteks, dan jawab 2-3 kalimat santai tanpa markdown
    const turnResult = processVoiceTurn({
      text,
      questionKey: currentQuestion.key,
      history: turns,
      answers,
      nextQuestion,
    });

    if (!turnResult.ok || !turnResult.value) {
      // AI meminta ulang dengan santai jika suara benar-benar kosong
      busyRef.current = false;
      setOrb('idle');
      const n = bumpFailure();
      if (n < MAX_FAILURES) {
        const line = VOICE_REPROMPTS[(n - 1) % VOICE_REPROMPTS.length];
        later(() => say(line, listen), 300);
      }
      return;
    }

    const value = turnResult.value;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.key]: value,
      [`raw_${currentQuestion.key}`]: text,
    }));
    failuresRef.current = 0;
    setFailures(0);
    setMicProblem('');
    setOrb('thinking');

    // Kalimat AI siap TTS (maksimal 2-3 kalimat, tanpa format markdown visual)
    const line = turnResult.spokenReply;

    later(() => {
      busyRef.current = false;
      if (!isLast) {
        indexRef.current = turnIndex + 1;
        setIndex(turnIndex + 1);
      }
      say(line, () => {
        if (isLast) setPhase('done');
        else listen();
      });
    }, 420);
  }

  function startConversation() {
    aliveRef.current = true;
    failuresRef.current = 0;
    indexRef.current = 0;
    setFailures(0);
    setMicProblem('');
    setUserLine('');
    setHeard('');
    setTurns([]);
    setAiLine('');
    setIndex(0);
    busyRef.current = false;
    speakingRef.current = false;
    listeningRef.current = false;
    setPhase('talk');
    const greeting = `${VOICE_GREETING} ${VOICE_QUESTIONS[0].question}`;
    later(() => say(greeting, listen), 150);
  }

  // Jalan keluar teks: hanya saat suara tidak bisa dipakai / gagal berulang.
  function submitManual() {
    const text = manualText.trim();
    if (!text) return;
    setManualText('');
    handleUserSpeech(text);
  }

  // Seperti menyerobot bicara di ChatGPT: hentikan AI, langsung buka mikrofon.
  function interrupt() {
    stopSpeaking();
    speakingRef.current = false;
    busyRef.current = false;
    listeningRef.current = false;
    recognizerRef.current?.abort();
    clearTurnTimers();
    listen();
  }

  function toggleVoice() {
    setVoiceOn((v) => {
      const next = !v;
      if (!next) stopSpeaking();
      return next;
    });
  }

  function restart() {
    aliveRef.current = true;
    stopSpeaking();
    clearTurnTimers();
    recognizerRef.current?.abort();
    speakingRef.current = false;
    busyRef.current = false;
    listeningRef.current = false;
    failuresRef.current = 0;
    indexRef.current = 0;
    setAnswers({ language: 'id' });
    setIndex(0);
    setHeard('');
    setUserLine('');
    setTurns([]);
    setAiLine('');
    setError('');
    setMicProblem('');
    setFailures(0);
    setPhase('gate');
  }

  function handleBack() {
    stopSpeaking();
    clearTurnTimers();
    recognizerRef.current?.abort();
    router.push('/app');
  }

  // Tombol "Selanjutnya": simpan hasil, lalu transisi beranimasi ke fitur berikutnya.
  function goNext() {
    stopSpeaking();
    clearTurnTimers();
    recognizerRef.current?.abort();
    try {
      const summary = buildSummaryFromAnswers(answers);
      window.sessionStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify({ answers, summary, at: Date.now() }));
    } catch {
      setError('Browser memblokir penyimpanan sementara. Coba lagi ya.');
      return;
    }
    setPhase('leaving');
    later(() => router.push('/app'), 620);
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <WaveDots size="lg" label="Mempersiapkan ruang suara..." className="text-aurora-teal" />
      </div>
    );
  }

  const showTextFallback = !speechReady || failures >= MAX_FAILURES;
  const listening = orb === 'listening';
  const speaking = orb === 'speaking';

  const status = !speechReady
    ? 'Browser ini belum bisa mendengar suara.'
    : listening
      ? 'Mendengarkan… bicara pelan saja, aku menunggu sampai kamu selesai.'
      : speaking
        ? 'Aku sedang berbicara…'
        : orb === 'thinking'
          ? 'Aku menanggapi…'
          : 'Mikrofon siap.';

  return (
    <div className={`immersive ${phase === 'leaving' ? 'stage-leave' : 'stage-enter'}`}>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        {/* baris atas: tombol kembali + merek + kendali suara */}
        <div className="mb-6 flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-fog transition hover:border-white/20 hover:bg-white/10 hover:text-frost"
              title="Kembali ke ringkasan"
            >
              <ArrowLeft className="size-3.5" />
              <span>Kembali</span>
            </button>
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fog">
              <Logo size={28} />
              <span>hearme</span>
            </span>
          </div>
          {ttsReady && phase !== 'gate' && (
            <button
              type="button"
              className="btn-ghost"
              onClick={toggleVoice}
              aria-label={voiceOn ? 'Matikan suara' : 'Nyalakan suara'}
            >
              {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {voiceOn ? 'Suara aktif' : 'Suara mati'}
            </button>
          )}
        </div>

        {crisis && (
          <div className="mb-5 w-full text-left">
            <CrisisBanner onDismiss={() => setCrisis(false)} />
          </div>
        )}

        {/* ===== Gerbang ===== */}
        {phase === 'gate' && (
          <div className="space-y-6">
            <VoiceOrb state="idle" size={200} />
            <div className="space-y-3">
              <h1 className="font-display text-[clamp(1.9rem,5vw,2.7rem)] font-light leading-tight text-balance">
                Halo{profile?.display_name ? `, ${profile.display_name}` : ''}.
                <br />
                <span className="text-gradient italic">Malam ini, aku mendengarkan.</span>
              </h1>
              <p className="mx-auto max-w-md text-sm text-fog">
                Kita mengobrol seperti biasa. Aku bertanya, kamu menjawab dengan suara. Tidak perlu
                menekan apa pun.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <button type="button" className="btn-primary" onClick={startConversation}>
                <Mic className="size-4" /> Mulai mengobrol
              </button>
              <p className="max-w-sm text-xs text-mist">
                Mikrofon hanya menyala saat kamu bicara. Tidak ada rekaman yang dikirim atau disimpan.
              </p>
            </div>
          </div>
        )}

        {/* ===== Percakapan ===== */}
        {phase === 'talk' && (
          <div className="w-full space-y-5">
            <div className="flex items-center justify-center gap-2" aria-hidden="true">
              {VOICE_QUESTIONS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i < index
                      ? 'w-8 bg-aurora-indigo'
                      : i === index
                        ? 'w-10 bg-aurora-teal shadow-[0_0_10px_rgba(240,230,210,0.55)]'
                        : 'w-6 bg-white/15'
                  }`}
                />
              ))}
            </div>

            <VoiceOrb state={orb} size={200} />

            {/* kalimat AI yang sedang diucapkan — seperti transkrip ChatGPT voice */}
            <div className="space-y-2" aria-live="polite">
              <p className="flex items-center justify-center gap-2 text-xs font-medium tracking-wide text-fog">
                <span>Pertanyaan {Math.min(index + 1, total)} dari {total}</span>
                {speaking && <span>· aku sedang berbicara</span>}
                {listening && <span>· mendengarkanmu</span>}
                {orb === 'thinking' && (
                  <span className="inline-flex items-center gap-1.5 text-aurora-teal">
                    · aku menanggapi <WaveDots size="xs" />
                  </span>
                )}
              </p>
              <h2 className="font-display text-[clamp(1.3rem,3.4vw,1.8rem)] font-light leading-snug text-balance">
                {aiLine || question?.question}
              </h2>
            </div>

            {/* yang kamu ucapkan */}
            <div className="min-h-14 space-y-2">
              {(heard || userLine) && (
                <p className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-frost">
                  “{heard || userLine}”
                </p>
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={speaking ? interrupt : listening ? () => recognizerRef.current?.stop() : listen}
                disabled={!speechReady}
                className={`flex size-20 items-center justify-center rounded-full border transition ${
                  listening
                    ? 'border-teal-300/60 bg-teal-300/20 shadow-[0_0_36px_rgba(240,220,160,0.35)]'
                    : speaking
                      ? 'border-indigo-300/50 bg-indigo-300/15'
                      : 'border-white/15 bg-white/5 hover:border-indigo-300/40 hover:bg-indigo-300/10'
                } ${!speechReady ? 'cursor-not-allowed opacity-50' : ''}`}
                aria-label={
                  speaking ? 'Hentikan suaraku dan langsung bicara' : listening ? 'Selesai bicara' : 'Bicara sekarang'
                }
              >
                {speechReady ? (
                  <Mic
                    className={`size-8 ${
                      listening ? 'animate-pulse text-aurora-teal' : speaking ? 'text-aurora-indigo' : 'text-fog'
                    }`}
                  />
                ) : (
                  <MicOff className="size-8 text-fog" />
                )}
              </button>
              <p className="text-xs text-mist">{status}</p>

              {/* Opsi bantuan cepat: ketuk langsung opsi yang dimaksud */}
              {question?.options && (
                <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-1.5 pt-1">
                  {question.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUserSpeech(opt.label)}
                      className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-fog transition hover:border-aurora-teal/40 hover:bg-teal-300/10 hover:text-frost"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Sebab kegagalan mikrofon selalu ditampilkan — bukan diam-diam gagal. */}
              {micProblem && (
                <div className="w-full max-w-md rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-left">
                  <p className="text-sm text-amber-100">{micProblem}</p>
                  {speechReady && (
                    <button type="button" className="btn-ghost mt-2" onClick={() => listen()}>
                      <Mic className="size-4" /> Coba nyalakan mikrofon lagi
                    </button>
                  )}
                </div>
              )}

              {/* Jalan keluar: teks manual (selalu tersedia atas inisiatif pengguna atau saat gagal) */}
              {(showTextFallback || manualOpen) ? (
                <div className="w-full max-w-sm pt-2 text-left">
                  <label className="label text-xs" htmlFor="manualAnswer">
                    {speechReady
                      ? 'Tulis jawabanmu di sini:'
                      : 'Browser ini belum bisa menangkap suara — tulis dulu di sini:'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="manualAnswer"
                      className="input"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                      placeholder="Jawabanku…"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={submitManual}
                      disabled={!manualText.trim()}
                    >
                      Kirim
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="pt-1 text-xs text-mist underline-offset-2 hover:text-fog hover:underline"
                >
                  Atau ketik jawaban secara manual
                </button>
              )}
            </div>

            {/* riwayat singkat */}
            {turns.length > 2 && (
              <details className="mx-auto max-w-md text-left">
                <summary className="cursor-pointer text-xs text-mist">Lihat percakapan sebelumnya</summary>
                <ul className="mt-2 space-y-1.5">
                  {turns.slice(0, -2).map((t, i) => (
                    <li key={i} className={`text-xs ${t.role === 'ai' ? 'text-fog' : 'text-aurora-teal'}`}>
                      <span className="text-mist">{t.role === 'ai' ? 'Aku' : 'Kamu'}:</span> {t.text}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* ===== Selesai 3 pertanyaan: tombol Selanjutnya ===== */}
        {phase === 'done' && (
          <div className="w-full space-y-6">
            <VoiceOrb state="idle" size={180} />
            <div className="space-y-3">
              <h2 className="font-display text-[clamp(1.6rem,4vw,2.2rem)] font-light leading-tight text-balance">
                Terima kasih sudah bercerita.
                <br />
                <span className="text-gradient italic">Kata-katamu sudah tumbuh.</span>
              </h2>
              <p className="mx-auto max-w-md text-sm text-fog">
                Tiga pertanyaan selesai. Selanjutnya, lihat apa yang kami dengar — lalu pilih cara
                melewati malam ini.
              </p>
            </div>

            <ul className="mx-auto max-w-sm space-y-2 text-left">
              {VOICE_QUESTIONS.map((q) => (
                <li
                  key={q.key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm"
                >
                  <span className="text-mist">{q.question}</span>
                  <span className="text-frost">{labelFor(q, answers[q.key]) || '—'}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-center gap-3">
              <button type="button" className="btn-primary" onClick={goNext}>
                Selanjutnya <ArrowRight className="size-4" />
              </button>
              <button type="button" className="btn-ghost" onClick={restart}>
                <RotateCcw className="size-4" /> Ulangi dari awal
              </button>
            </div>
          </div>
        )}

        {phase === 'leaving' && (
          <div className="space-y-4">
            <VoiceOrb state="speaking" size={160} />
            <p className="text-sm text-fog">Menyiapkan ruang berikutnya…</p>
          </div>
        )}

        {error && <p className="mt-6 w-full rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}

        <div className="mt-10 flex items-center gap-2 text-xs text-mist">
          <ShieldAlert className="size-3.5" />
          <span>
            Kalau ada pikiran untuk menyakiti diri,{' '}
            <a className="underline" href="/app/account">
              jalur bantuan manusia
            </a>{' '}
            selalu terbuka.
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          Pertanyaan {Math.min(index + 1, total)} dari {total}
        </span>
      </div>
    </div>
  );
}
