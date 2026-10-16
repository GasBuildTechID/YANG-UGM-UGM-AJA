'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, HeartHandshake, MessagesSquare, RefreshCcw, Users, XCircle } from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import { useCountdown } from '@/lib/hooks';
import { CATEGORY_LABELS, formatClock } from '@/lib/labels';

const POLL_MS = 4000;
const RELEASE_MS = 10000;

export default function QueuePage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24">
          <WaveDots size="lg" label="Menyiapkan antrean..." className="text-aurora-teal" />
        </div>
      }
    >
      <QueueInner />
    </Suspense>
  );
}

function QueueInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useSession();

  const [activeReqId, setActiveReqId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(sessionStorage.getItem('activeQueue') || '{}');
        return stored.requestId || searchParams.get('request') || null;
      } catch {
        return searchParams.get('request') || null;
      }
    }
    return searchParams.get('request') || null;
  });

  const [activeMode, setActiveMode] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(sessionStorage.getItem('activeQueue') || '{}');
        return stored.mode || searchParams.get('mode') || 'group';
      } catch {
        return searchParams.get('mode') || 'group';
      }
    }
    return searchParams.get('mode') || 'group';
  });

  const [request, setRequest] = useState(null);
  const [state, setState] = useState('loading'); // loading | waiting | expired | matched | none | left
  const [queueInfo, setQueueInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const releaseRef = useRef(0);

  const poll = useCallback(
    async (requestId, mode) => {
      try {
        // sesekali lepas reservasi relawan yang tidak merespons (idempoten)
        const now = Date.now();
        if (now - releaseRef.current > RELEASE_MS) {
          releaseRef.current = now;
          await supabase.rpc('release_stale_reservations');
        }

        const rpcName = mode === 'group' ? 'poll_group_queue' : 'poll_one_to_one_queue';
        const { data, error: err } = await supabase.rpc(rpcName);
        if (err) throw err;

        if (!data) {
          setState('none');
          return;
        }

        if (data?.status === 'matched' && data.session_id) {
          setState('matched');
          if (typeof window !== 'undefined') sessionStorage.removeItem('activeQueue');
          router.push(`/app/session/${data.session_id}`);
          return;
        }
        if (data?.status === 'expired') {
          setRequest(data.request || null);
          setState('expired');
          return;
        }
        if (data?.status === 'waiting') {
          setQueueInfo(data);
          setState('waiting');
          return;
        }
        if (data?.status === 'none') {
          // tidak ada antrean aktif — mungkin sudah matched/expired/dibatalkan
          const { data: req } = await supabase
            .from('support_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();
          if (req?.status === 'matched' && req.session_id) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('activeQueue');
            router.push(`/app/session/${req.session_id}`);
            return;
          }
          setRequest(req || null);
          setState(req?.status === 'cancelled' ? 'left' : req?.status === 'expired' ? 'expired' : 'none');
          return;
        }
      } catch (e) {
        setError(e.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (loading || !user) return undefined;

    // Bersihkan URL dari query parameters jika ada agar URL selalu bersih /app/queue
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    (async () => {
      let currentId = activeReqId;
      let currentMode = activeMode;

      // Cek sesi berjalan yang masih aktif/terjadwal
      const { data } = await supabase
        .from('session_participants')
        .select('session_id, sessions(id, mode, status)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(3);
      const active = (data || []).find((d) => d.sessions && ['scheduled', 'active'].includes(d.sessions.status));
      if (active) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('activeQueue');
        router.replace(`/app/session/${active.session_id}`);
        return;
      }

      if (!currentId) {
        const { data: waitingReq } = await supabase
          .from('support_requests')
          .select('id, mode, expires_at, status')
          .eq('user_id', user.id)
          .eq('status', 'waiting')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (waitingReq) {
          currentId = waitingReq.id;
          currentMode = waitingReq.mode;
          setActiveReqId(currentId);
          setActiveMode(currentMode);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('activeQueue', JSON.stringify({ requestId: currentId, mode: currentMode }));
          }
        } else {
          setState('none');
          return;
        }
      }

      const { data: req } = await supabase.from('support_requests').select('*').eq('id', currentId).maybeSingle();
      if (!req || req.status === 'cancelled') {
        setState(req ? 'left' : 'none');
        return;
      }
      setRequest(req);
      await poll(currentId, currentMode);
    })();

    if (!activeReqId) return undefined;
    const id = setInterval(() => poll(activeReqId, activeMode), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, activeReqId, activeMode]);

  const remaining = useCountdown(request?.expires_at, {
    onExpire: () => poll(activeReqId, activeMode),
  });

  async function cancelQueue() {
    setBusy(true);
    if (request?.id) {
      await supabase.rpc('cancel_support_request', { p_request_id: request.id });
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('activeQueue');
    }
    setBusy(false);
    setState('left');
  }

  async function retry(mode) {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('create_support_request', {
      p_mode: mode,
      p_category: request?.support_category || 'didengarkan',
      p_language: request?.language || 'id',
      p_summary: request?.needs_summary || '',
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setActiveReqId(data.id);
    setActiveMode(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('activeQueue', JSON.stringify({ requestId: data.id, mode }));
      window.history.replaceState(null, '', '/app/queue');
    }
    setState('waiting');
    await poll(data.id, mode);
  }

  if (loading || state === 'loading') {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Memeriksa antreanmu..." className="text-aurora-teal" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {state === 'waiting' && activeMode === 'group' && (
        <div className="card text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-300/10 text-aurora-teal">
            <Users className="size-7" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-frost">Menunggu yang lain datang</h1>
          <p className="mt-1 text-sm text-fog">
            {CATEGORY_LABELS[request?.support_category] || '-'} · {request?.language === 'en' ? 'Inggris' : 'Indonesia'}
          </p>

          <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-white/5 p-4">
            <p className="text-sm text-fog">
              Sudah hadir:{' '}
              <strong>
                {queueInfo?.position ?? 1} dari {queueInfo?.target ?? 3} orang
              </strong>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-gradient-to-r from-aurora-teal to-aurora-indigo transition-all"
                style={{ width: `${Math.min(100, ((queueInfo?.position ?? 1) / (queueInfo?.target ?? 3)) * 100)}%` }}
              />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-fog">
              <Clock className="size-4" /> Batas tunggu: {formatClock(remaining)}
            </p>
          </div>

          <p className="mt-4 text-xs text-mist">
            Lingkaran terbentuk saat anggotanya cukup.
          </p>

          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => poll(activeReqId, activeMode)} disabled={busy}>
              <RefreshCcw className="size-4" /> Periksa sekarang
            </button>
            <button type="button" className="btn-danger" onClick={cancelQueue} disabled={busy}>
              <XCircle className="size-4" /> Batalkan antrean
            </button>
          </div>
        </div>
      )}

      {state === 'waiting' && activeMode === 'one_to_one' && (
        <div className="card text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-300/10 text-aurora-teal">
            <HeartHandshake className="size-7" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-frost">Mencarikan seseorang untukmu</h1>
          <p className="mt-1 text-sm text-fog">
            Relawan terverifikasi yang siap mendengar, sesuai bahasamu.
          </p>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-fog">
            <Clock className="size-4" /> Sisa waktu pencarian: <strong>{formatClock(remaining)}</strong>
          </p>

          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => poll(activeReqId, activeMode)} disabled={busy}>
              <RefreshCcw className="size-4" /> Periksa sekarang
            </button>
            <button type="button" className="btn-danger" onClick={cancelQueue} disabled={busy}>
              <XCircle className="size-4" /> Batalkan
            </button>
          </div>
        </div>
      )}

      {state === 'matched' && (
        <div className="card text-center py-8">
          <WaveDots size="lg" className="mx-auto text-aurora-teal" />
          <p className="mt-3 text-sm font-medium text-fog">Seseorang menemani. Membuka ruang…</p>
        </div>
      )}

      {state === 'expired' && (
        <div className="card">
          <h1 className="text-xl font-bold text-frost">
            {activeMode === 'group' ? 'Lingkaran belum cukup' : 'Belum ada yang cocok'}
          </h1>
          <p className="mt-1 text-sm text-fog">
            Waktunya habis. Tidak apa-apa — kamu yang memilih langkah berikutnya.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-primary" onClick={() => retry(activeMode)} disabled={busy}>
              <Clock className="size-4" /> Tetap menunggu lagi
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => retry(activeMode === 'group' ? 'one_to_one' : 'group')}
              disabled={busy}
            >
              <MessagesSquare className="size-4" />
              {activeMode === 'group' ? 'Coba berdua dengan relawan' : 'Masuk lingkaran kecil'}
            </button>
            <Link href="/app" className="btn-secondary">
              Kembali ke ringkasan
            </Link>
            <Link href="/app/account" className="btn-secondary">
              Lihat sumber bantuan
            </Link>
          </div>
        </div>
      )}

      {state === 'left' && (
        <div className="card text-center">
          <h1 className="text-xl font-bold text-frost">Antrean dibatalkan</h1>
          <p className="mt-1 text-sm text-fog">Kamu sudah keluar. Tidak ada yang perlu dilakukan.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/app" className="btn-primary">
              Mulai lagi dari awal
            </Link>
            <Link href="/app/account" className="btn-secondary">
              Sumber bantuan
            </Link>
          </div>
        </div>
      )}

      {state === 'none' && (
        <div className="card text-center">
          <h1 className="text-xl font-bold text-frost">Tidak ada antrean aktif</h1>
          <p className="mt-1 text-sm text-fog">Ceritakan malammu dulu, lalu pilih jalurmu.</p>
          <Link href="/app" className="btn-primary mt-5 inline-flex">
            Mulai sekarang
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-rose-200">{error}</p>}
    </div>
  );
}
