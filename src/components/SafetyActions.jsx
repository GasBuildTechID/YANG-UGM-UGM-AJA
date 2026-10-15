'use client';

import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { REPORT_REASON_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';

// Modal Lapor / Blokir / Keluar (dokumen §11) — dipakai di ruang sesi & dashboard relawan.
export default function SafetyActions({
  sessionId,
  participants = [],
  onLeft,
  className = '',
  compact = false,
}) {
  const { user } = useSession();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('report'); // report | block
  const [reason, setReason] = useState('lainnya');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const others = participants.filter((p) => p.user_id !== user?.id);

  async function submitReport(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('reports').insert({
      reporter_id: user.id,
      session_id: sessionId,
      reported_user_id: target || null,
      reason_category: reason,
      note: note || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone('Laporan tercatat. Admin akan meninjau. Terima kasih sudah menjaga ruang ini.');
  }

  async function submitBlock(e) {
    e.preventDefault();
    if (!target) {
      setError('Pilih orang yang ingin diblokir.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: target });
    setBusy(false);
    if (err && !err.message.includes('duplicate')) {
      setError(err.message);
      return;
    }
    setDone('Kamu tidak akan dipertemukan lagi dengan orang ini.');
  }

  async function leaveSession() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('leave_session', { p_session_id: sessionId });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onLeft?.();
  }

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            setOpen(true);
            setMode('report');
            setDone('');
            setError('');
          }}
        >
          <Flag className="size-4" />
          Laporkan
        </button>
        {!compact && (
          <button type="button" className="btn-secondary" onClick={leaveSession} disabled={busy}>
            <X className="size-4" />
            Keluar dari sesi
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-midnight p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-frost">Jaga keamanan ruang ini</h2>
              <button type="button" className="btn-ghost p-1" onClick={() => setOpen(false)} aria-label="Tutup">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={mode === 'report' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                onClick={() => setMode('report')}
              >
                Laporkan
              </button>
              <button
                type="button"
                className={mode === 'block' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                onClick={() => setMode('block')}
              >
                Blokir
              </button>
            </div>

            {done ? (
              <p className="mt-4 rounded-2xl border border-teal-300/25 bg-teal-300/10 p-3 text-sm text-teal-100">
                {done}
              </p>
            ) : mode === 'report' ? (
              <form onSubmit={submitReport} className="mt-4 space-y-3">
                <div>
                  <label className="label" htmlFor="report-target">
                    Siapa yang ingin dilaporkan? (opsional)
                  </label>
                  <select id="report-target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">— tidak menyebut siapa —</option>
                    {others.map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.display_name} ({p.participant_role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="report-reason">
                    Apa yang terjadi?
                  </label>
                  <select id="report-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="report-note">
                    Catatan tambahan (opsional)
                  </label>
                  <textarea
                    id="report-note"
                    className="input min-h-20"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ceritakan singkat. Hanya admin yang melihat ini."
                  />
                </div>
                {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy}>
                  Kirim laporan
                </button>
                <p className="text-xs text-mist">Laporan ditinjau admin sesuai prosedur.</p>
              </form>
            ) : (
              <form onSubmit={submitBlock} className="mt-4 space-y-3">
                <div>
                  <label className="label" htmlFor="block-target">
                    Siapa yang ingin diblokir?
                  </label>
                  <select id="block-target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">— pilih —</option>
                    {others.map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.display_name} ({p.participant_role})
                      </option>
                    ))}
                  </select>
                </div>
                {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
                <button type="submit" className="btn-danger w-full" disabled={busy}>
                  Blokir orang ini
                </button>
                <p className="text-xs text-mist">Kamu tidak akan dipertemukan lagi dengannya.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
