'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-16 text-center">
      <div className="card max-w-md space-y-4">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-400/10 text-rose-300">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-light text-frost">
          Terjadi kesalahan sejenak
        </h1>
        <p className="text-sm text-fog">
          Sistem sedang mengatur napas. Coba muat ulang halaman ini ya.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RotateCcw className="size-4" /> Coba Lagi
          </button>
          <Link href="/" className="btn-secondary">
            Ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

