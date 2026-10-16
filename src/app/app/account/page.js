'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookHeart, LifeBuoy, ScrollText, ShieldAlert } from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import { CRISIS_RESOURCES, SESSION_STATUS_LABELS, formatDateTime } from '@/lib/labels';

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useSession();

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const backHref = isAdmin ? '/app/admin' : '/app';

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('session_participants')
        .select('session_id, joined_at, sessions(id, mode, status, ended_at, created_at)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(10);
      setHistory(data || []);
      setLoadingHistory(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from('users').update({ display_name: displayName }).eq('id', user.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      refreshProfile();
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Memuat akun..." className="text-aurora-teal" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push(backHref);
            }
          }}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-fog transition hover:text-frost"
        >
          <ArrowLeft className="size-3.5" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-frost">Akun & privasi</h1>
      </div>

      <div className="card">
        <h2 className="font-bold text-frost">Profil</h2>
        <p className="mt-1 text-sm text-fog">Nama samaran boleh — itu yang dilihat orang lain.</p>
        <form onSubmit={saveProfile} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <label className="label" htmlFor="displayName">
              Nama panggilan
            </label>
            <input
              id="displayName"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          {saved && <span className="text-sm text-aurora-teal">Tersimpan ✓</span>}
        </form>
        <p className="mt-2 text-xs text-mist">Email: {user?.email}</p>
      </div>

      <div className="card">
        <h2 className="flex items-center gap-2 font-bold text-frost">
          <ScrollText className="size-5" /> Riwayat sesi
        </h2>
        {loadingHistory ? (
          <div className="py-4">
            <WaveDots size="sm" label="Memuat riwayat sesi..." className="text-aurora-teal" />
          </div>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-mist">Belum ada sesi.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li key={h.session_id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                <div>
                  <p className="text-sm font-semibold text-frost">
                    {h.sessions?.mode === 'group' ? 'Lingkaran kecil' : 'Sesi berdua'}
                  </p>
                  <p className="text-xs text-fog">{formatDateTime(h.joined_at)}</p>
                </div>
                <span className="chip">{SESSION_STATUS_LABELS[h.sessions?.status] || h.sessions?.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="flex items-center gap-2 font-bold text-frost">
          <ShieldAlert className="size-5" /> Batas layanan & privasi
        </h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-fog">
          <li>Tanpa transkrip rekaman suara. Yang tersimpan hanyalah ringkasan yang kamu setujui.</li>
          <li>Kenyamanan dan ruang aman dijaga bersama dengan sistem moderasi otomatis.</li>
          <li>Kamu bebas diam atau keluar dari sesi kapan saja dengan aman.</li>
        </ul>
      </div>

      <div id="bantuan" className="card border-teal-300/25 bg-teal-300/10">
        <h2 className="flex items-center gap-2 font-bold text-teal-100">
          <LifeBuoy className="size-5" /> Sumber bantuan
        </h2>
        <p className="mt-1 text-sm text-teal-100">
          Kalau ada risiko langsung, ini jalur bantuan manusia — bukan sekadar teman bicara:
        </p>
        <ul className="mt-3 space-y-2">
          {CRISIS_RESOURCES.map((r) => (
            <li key={r.label} className="rounded-xl bg-white/6 p-3">
              <p className="text-sm font-semibold text-frost">{r.label}</p>
              <p className="text-sm text-fog">{r.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-teal-100">
          Panduan WHO — Psychological First Aid:{' '}
          <a className="underline" href="https://www.who.int/publications/i/item/9789241548205" target="_blank" rel="noreferrer">
            who.int
          </a>
        </p>
      </div>

      <p className="text-center text-sm text-mist">
        Mau jadi relawan?{' '}
        <Link href="/app/volunteer" className="font-semibold text-aurora-teal">
          Buka halaman relawan
        </Link>
      </p>
    </div>
  );
}
