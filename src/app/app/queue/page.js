'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, HeartHandshake, Loader2, MessagesSquare, RefreshCcw, Users, XCircle } from 'lucide-react';
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
          <Loader2 className="size-6 animate-spin text-aurora-teal" />
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

  const initialRequestId = searchParams.get('request');
  const initialMode = searchParams.get('mode') || 'group';

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

    (async () => {
      if (!initialRequestId) {
        // tidak ada antrean di URL -> cek sesi berjalan, lalu antrean yang masih menunggu
        const { data } = await supabase
          .from('session_participants')
          .select('session_id, sessions(id, mode, status)')
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false })
          .limit(3);
        const active = (data || []).find((d) => d.sessions && ['scheduled', 'active'].includes(d.sessions.status));
        if (active) {
          router.replace(`/app/session/${active.session_id}`);
          return;
        }

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
          router.replace(`/app/queue?request=${waitingReq.id}&mode=${waitingReq.mode}`);
          return;
        }

        setState('none');
        return;
      }

      const { data: req } = await supabase.from('support_requests').select('*').eq('id', initialRequestId).maybeSingle();
      setRequest(req || null);
      await poll(initialRequestId, initialMode);
    })();

    if (!initialRequestId) return undefined;
    const id = setInterval(() => poll(initialRequestId, initialMode), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, initialRequestId, initialMode]);

  const remaining = useCountdown(request?.expires_at, {
    onExpire: () => poll(initialRequestId, initialMode),
  });

  async function cancelQueue() {
    setBusy(true);
    if (request?.id) {
      await supabase.rpc('cancel_support_request', { p_request_id: request.id });
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
    router.replace(`/app/queue?request=${data.id}&mode=${mode}`);
  }

  if (loading || state === 'loading') {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-6 animate-spin text-aurora-teal" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {state === 'waiting' && initialMode === 'group' && (
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
            <button type="button" className="btn-secondary" onClick={() => poll(initialRequestId, initialMode)} disabled={busy}>
              <RefreshCcw className="size-4" /> Periksa sekarang
            </button>
            <button type="button" className="btn-danger" onClick={cancelQueue} disabled={busy}>
              <XCircle className="size-4" /> Batalkan antrean
            </button>
          </div>
        </div>
      )}

      {state === 'waiting' && initialMode === 'one_to_one' && (
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
            <button type="button" className="btn-secondary" onClick={() => poll(initialRequestId, initialMode)} disabled={busy}>
              <RefreshCcw className="size-4" /> Periksa sekarang
            </button>
            <button type="button" className="btn-danger" onClick={cancelQueue} disabled={busy}>
              <XCircle className="size-4" /> Batalkan
            </button>
          </div>


        </div>
      )}

      {state === 'matched' && (
        <div className="card text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-aurora-teal" />
          <p className="mt-2 text-sm text-fog">Seseorang menemani. Membuka ruang…</p>
        </div>
      )}

      {state === 'expired' && (
        <div className="card">
          <h1 className="text-xl font-bold text-frost">
            {initialMode === 'group' ? 'Lingkaran belum cukup' : 'Belum ada yang cocok'}
          </h1>
          <p className="mt-1 text-sm text-fog">
            Waktunya habis. Tidak apa-apa — kamu yang memilih langkah berikutnya.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-primary" onClick={() => retry(initialMode)} disabled={busy}>
              <Clock className="size-4" /> Tetap menunggu lagi
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => retry(initialMode === 'group' ? 'one_to_one' : 'group')}
              disabled={busy}
            >
              <MessagesSquare className="size-4" />
              {initialMode === 'group' ? 'Coba berdua dengan relawan' : 'Masuk lingkaran kecil'}
            </button>
            <Link href="/app" className="btn-secondary">
              Kembali ke ringkasan
            </Link>
            <Link href="/app/account#bantuan" className="btn-secondary">
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
            <Link href="/app/account#bantuan" className="btn-secondary">
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
