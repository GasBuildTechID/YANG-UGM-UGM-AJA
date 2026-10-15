'use client';

import { AlertTriangle, X } from 'lucide-react';
import { CRISIS_RESOURCES } from '@/lib/labels';

// Tampil saat jawaban user mengindikasikan risiko langsung (dokumen §11):
// jangan hanya matchmaking — tampilkan jalur bantuan manusia yang terverifikasi.
export default function CrisisBanner({ onDismiss, compact = false }) {
  return (
    <div className="reveal rounded-3xl border border-amber-300/40 bg-amber-400/10 p-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div className="flex-1">
          <p className="font-semibold text-amber-100">
            Sepertinya malam ini berat sekali. Kamu tidak sendirian — dan kamu berharga.
          </p>
          <p className="mt-1 text-sm text-amber-200/90">
            Kalau ada dorongan menyakiti diri sendiri, hubungi jalur bantuan di bawah. Kami tetap menemanimu di
            ruang ini.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-amber-100">
            {CRISIS_RESOURCES.map((r) => (
              <li key={r.label}>
                <span className="font-semibold">{r.label}:</span> {r.detail}
              </li>
            ))}
          </ul>
          {!compact && onDismiss && (
            <button type="button" onClick={onDismiss} className="btn-secondary mt-3">
              Tetap lanjut dengan pendampingan
            </button>
          )}
        </div>
        {compact && onDismiss && (
          <button type="button" onClick={onDismiss} className="btn-ghost p-1" aria-label="Tutup">
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
