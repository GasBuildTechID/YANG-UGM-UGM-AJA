'use client';

import { useState } from 'react';
import { LogOut, X, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Aksi keluar sesi yang aman (dokumen §11: pengguna bebas keluar kapan saja tanpa paksaan).
// Fitur laporkan & blokir telah dihapus dari antarmuka sesuai arahan privasi dan kenyamanan.
export default function SafetyActions({
  sessionId,
  participants = [],
  onLeft,
  className = '',
  compact = false,
}) {
  const supabase = createClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function leaveSession() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('leave_session', { p_session_id: sessionId });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmOpen(false);
    onLeft?.();
  }

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-fog transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200"
          onClick={() => setConfirmOpen(true)}
          title="Keluar dari sesi obrolan ini"
        >
          <LogOut className="size-3.5" />
          <span>Keluar Sesi</span>
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-midnight p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-frost">
                <AlertCircle className="size-5 text-aurora-teal" />
                <h2 className="font-display text-base font-medium">Keluar dari Sesi?</h2>
              </div>
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={() => setConfirmOpen(false)}
                aria-label="Batal"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-fog">
              Kamu bisa beristirahat atau kembali ke beranda kapan saja. Sesi ini akan tetap berjalan
              aman untuk teman-teman lainnya.
            </p>

            {error && <p className="mt-3 rounded-xl bg-rose-400/10 p-2.5 text-xs text-rose-200">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="btn-danger flex-1 justify-center py-2 text-xs"
                onClick={leaveSession}
                disabled={busy}
              >
                {busy ? 'Keluar...' : 'Ya, Keluar Sesi'}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1 justify-center py-2 text-xs"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
              >
                Tetap di Sini
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
