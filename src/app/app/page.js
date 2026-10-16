'use client';

// Fitur setelah alur suara — sengaja TIDAK terbuka dari awal.
// Layar ini hanya berisi hasil dari cerita suara: ringkasan + pilihan cara melewati malam.
// Kalau belum ada cerita, yang muncul hanya ajakan memulai (bukan formulir penuh).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Mic, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import CrisisBanner from '@/components/CrisisBanner';
import GenerativeArt from '@/components/GenerativeArt';
import WaveDots from '@/components/WaveDots';
import { INTAKE_STORAGE_KEY } from '@/lib/intake';
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS, LANGUAGE_LABELS } from '@/lib/labels';

export default function IntakeResultPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading } = useSession();

  const [step, setStep] = useState('loading'); // loading | empty | summary | choose
  const [answers, setAnswers] = useState({});
  const [edited, setEdited] = useState({
    summary: '',
    suggested_category: 'didengarkan',
    suggested_mode: null,
    language: 'id',
  });
  const [evidence, setEvidence] = useState({
    note: '',
    coping: '',
    papers: [],
  });
  const [crisis, setCrisis] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previous, setPrevious] = useState(null);

  // Ambil hasil alur suara (disimpan sementara oleh /app/voice).
  useEffect(() => {
    let payload = null;
    try {
      const raw = window.sessionStorage.getItem(INTAKE_STORAGE_KEY);
      if (raw) payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    if (payload?.summary) {
      setAnswers(payload.answers || {});
      setEdited({
        summary: payload.summary.summary || '',
        suggested_category: payload.summary.suggested_category || 'didengarkan',
        suggested_mode: payload.summary.suggested_mode || null,
        language: payload.summary.language || 'id',
      });
      setEvidence({
        note: payload.summary.evidence_note || '',
        coping: payload.summary.coping_suggestion || '',
        papers: payload.summary.cited_papers || [],
      });
      setStep('summary');
    } else {
      setStep('empty');
    }
  }, []);

  // Sesi/antrean yang masih berjalan -> tawarkan lanjut
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('session_participants')
        .select('session_id, sessions(id, mode, status, phase, needs_summary)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const s = data?.sessions;
      if (s && ['scheduled', 'active'].includes(s.status)) {
        setPrevious({ id: s.id, mode: s.mode });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const artSeed = useMemo(
    () => [edited.summary, answers.mood, answers.need, answers.format].filter(Boolean).join(' · ') || 'malam yang tenang',
    [edited.summary, answers]
  );

  async function startQueue(mode) {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('create_support_request', {
      p_mode: mode,
      p_category: edited.suggested_category,
      p_language: edited.language,
      p_summary: edited.summary,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    try {
      window.sessionStorage.setItem('active_queue_mode', mode);
      if (data?.id) window.sessionStorage.setItem('active_queue_request', data.id);
    } catch {}
    router.push('/app/queue');
  }

  function restart() {
    try {
      window.sessionStorage.removeItem(INTAKE_STORAGE_KEY);
    } catch {
      // abaikan
    }
    router.push('/app/voice');
  }

  if (loading || step === 'loading') {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Memuat ringkasan ceritamu..." className="text-aurora-teal" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {previous && (
        <div className="card flex items-center justify-between gap-3 border-teal-300/25 bg-teal-300/10">
          <p className="text-sm text-teal-100">
            Kamu masih punya sesi <strong>{previous.mode === 'group' ? 'lingkaran kecil' : 'berdua'}</strong> yang
            berjalan.
          </p>
          <button type="button" className="btn-primary" onClick={() => router.push(`/app/session/${previous.id}`)}>
            Lanjut ke sesi
          </button>
        </div>
      )}

      {crisis && <CrisisBanner onDismiss={() => setCrisis(false)} />}

      {/* ===== Belum ada cerita: hanya ajakan mulai ===== */}
      {step === 'empty' && (
        <div className="card stage-enter text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-indigo-300/25 bg-indigo-300/10">
            <Mic className="size-6 text-aurora-indigo" />
          </div>
          <h1 className="mt-5 font-display text-[clamp(1.6rem,4vw,2.2rem)] font-light leading-tight text-balance">
            Malam ini belum ada cerita.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-fog">
            Semua dimulai dari suaramu. Setelah itu, ringkasan dan pilihan teman bicara akan terbuka di sini.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="btn-primary" onClick={() => router.push('/app/voice')}>
              <Mic className="size-4" /> Mulai bercerita
            </button>
          </div>
          <p className="mt-4 text-xs text-mist">Kamu boleh berhenti kapan saja.</p>
        </div>
      )}

      {/* ===== Fitur berikutnya: gema + ringkasan (transisi beranimasi) ===== */}
      {step === 'summary' && (
        <div className="stage-enter space-y-4">
          <div className="card text-center">
            <span className="chip-teal">
              <Sparkles className="size-3.5" /> Gema malam ini
            </span>
            <h2 className="mt-4 font-display text-xl font-light">
              Kata-katamu tumbuh <span className="text-gradient italic">jadi ini.</span>
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-fog">
              Malam ini melahirkan gema yang hanya milikmu. Kami tidak menyimpannya.
            </p>
          </div>

          <GenerativeArt text={artSeed} height={260} />

          <div className="card">
            <h3 className="font-display text-lg">Ini yang kami dengar</h3>
            <p className="mt-1 text-sm text-mist">
              Koreksi kalau kurang tepat. Ini yang dipakai untuk mencarikan teman — bukan label.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="summaryText">
                  Ringkasan
                </label>
                <textarea
                  id="summaryText"
                  className="input min-h-24"
                  value={edited.summary}
                  onChange={(e) => setEdited({ ...edited, summary: e.target.value })}
                />
              </div>
              <div>
                <span className="label">Yang paling kamu butuhkan</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEdited({ ...edited, suggested_category: value })}
                      className={`rounded-full border px-3.5 py-2 text-sm transition ${
                        edited.suggested_category === value
                          ? 'border-indigo-300/50 bg-indigo-300/15 text-frost'
                          : 'border-white/10 bg-white/4 text-fog hover:bg-white/8'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-mist">{CATEGORY_DESCRIPTIONS[edited.suggested_category]}</p>
              </div>
              <div>
                <label className="label" htmlFor="langSelect">
                  Bahasa sesi
                </label>
                <select
                  id="langSelect"
                  className="input max-w-56"
                  value={edited.language}
                  onChange={(e) => setEdited({ ...edited, language: e.target.value })}
                >
                  {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Kartu Landasan Ilmiah Berbasis Jurnal */}
            {(evidence.note || evidence.coping) && (
              <div className="mt-5 rounded-2xl border border-teal-300/30 bg-teal-300/10 p-4 text-left">
                <div className="flex items-center gap-2 font-semibold text-frost">
                  <BookOpen className="size-4 text-aurora-teal" />
                  <span>Landasan Ilmiah & Saran Praktis</span>
                </div>
                {evidence.note && (
                  <p className="mt-2 text-xs leading-relaxed text-fog">
                    💡 <strong className="text-frost">Fakta Studi:</strong> {evidence.note}
                  </p>
                )}
                {evidence.coping && (
                  <p className="mt-1.5 text-xs leading-relaxed text-frost">
                    🌿 <strong className="text-frost">Langkah Koping:</strong> {evidence.coping}
                  </p>
                )}
                {evidence.papers?.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <p className="text-[11px] font-medium text-mist">
                      Berdasarkan telaah literatur ilmiah (English Papers):
                    </p>
                    <ul className="mt-1 space-y-1">
                      {evidence.papers.map((title, i) => (
                        <li key={i} className="truncate text-[11px] text-fog italic">
                          • {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3 pt-2">
              <button
                type="button"
                className="btn-primary w-full justify-center text-sm font-medium"
                onClick={() => setStep('choose')}
              >
                Lanjut pilih teman bicara <ArrowRight className="size-4" />
              </button>
              <div className="flex items-center justify-between text-xs text-fog">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 transition hover:text-frost"
                  onClick={restart}
                >
                  <RotateCcw className="size-3.5" /> Cerita ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pilih jalur ===== */}
      {step === 'choose' && (
        <div className="card stage-enter">
          <h2 className="font-display text-xl font-light">
            Mau melewati malam ini <span className="text-gradient italic">dengan cara apa?</span>
          </h2>
          <p className="mt-2 text-sm text-fog">Kamu yang memilih. Tidak ada perpindahan otomatis.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => startQueue('group')}
              className={`rounded-3xl border p-5 text-left transition ${
                edited.suggested_mode === 'group'
                  ? 'border-indigo-300/50 bg-indigo-300/12'
                  : 'border-white/10 bg-white/4 hover:border-indigo-300/30 hover:bg-white/8'
              }`}
            >
              <span className="chip-teal">Lingkaran kecil</span>
              <h3 className="mt-3 font-display text-lg">3–4 mahasiswa, saling menjaga</h3>
              <p className="mt-1.5 text-sm text-fog">Berpanduan. Boleh hanya mendengarkan.</p>
              {edited.suggested_mode === 'group' && (
                <span className="mt-2 inline-block text-xs font-semibold text-aurora-teal">
                  Paling dekat dengan ceritamu
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => startQueue('one_to_one')}
              className={`rounded-3xl border p-5 text-left transition ${
                edited.suggested_mode === 'one_to_one'
                  ? 'border-indigo-300/50 bg-indigo-300/12'
                  : 'border-white/10 bg-white/4 hover:border-indigo-300/30 hover:bg-white/8'
              }`}
            >
              <span className="chip-teal">Berdua</span>
              <h3 className="mt-3 font-display text-lg">Ditemani relawan yang siap mendengar</h3>
              <p className="mt-1.5 text-sm text-fog">Relawan terverifikasi. Tak cocok? Ada pilihan lain.</p>
              {edited.suggested_mode === 'one_to_one' && (
                <span className="mt-2 inline-block text-xs font-semibold text-aurora-teal">
                  Paling dekat dengan ceritamu
                </span>
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={() => setStep('summary')}>
              ← Kembali ke ringkasan
            </button>
            <Link className="btn-ghost flex items-center gap-1.5" href="/app/account">
              <ShieldAlert className="size-4" /> Lihat jalur bantuan dulu
            </Link>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    </div>
  );
}
