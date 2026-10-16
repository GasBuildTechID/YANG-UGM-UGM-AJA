'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export default function SupabaseConfigBanner() {
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  if (configured) return null;

  return (
    <aside
      role="alert"
      aria-label="Peringatan konfigurasi Supabase"
      className="border-b border-amber-300/40 bg-amber-300/15 px-4 py-2.5 text-xs text-amber-100 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-200" />
          <span>
            <strong>Supabase belum terhubung:</strong> Variabel lingkungan di{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-100">.env.local</code> belum
            diisi atau masih menggunakan placeholder.
          </span>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <span className="flex items-center gap-1 text-amber-100">
            <KeyRound className="size-3.5" /> Salin kredensial dari Supabase Dashboard
          </span>
        </div>
      </div>
    </aside>
  );
}

