'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  ClipboardList,
  Compass,
  FileCheck2,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  LogOut,
  Search,
  Settings2,
  ShieldAlert,
  UserRound,
  Users,
} from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import {
  APPLICATION_BADGE_LABELS,
  PROOF_TYPE_LABELS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  formatDateTime,
} from '@/lib/labels';
import { proofSignedUrl } from '@/lib/volunteer';

// Menu dashboard admin — hanya fitur yang benar-benar ada di app.
const SECTIONS = [
  { key: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard, hint: 'Angka operasional harian' },
  { key: 'relawan', label: 'Relawan', icon: Users, hint: 'Pendaftaran & verifikasi relawan' },
  { key: 'laporan', label: 'Laporan', icon: ShieldAlert, hint: 'Laporan pengguna yang perlu ditinjau' },
  { key: 'konfigurasi', label: 'Konfigurasi', icon: Settings2, hint: 'Nilai operasional layanan' },
];

const APP_BADGE = {
  pending: 'chip-amber',
  approved: 'chip-teal',
  rejected: 'chip-rose',
  suspended: 'chip-rose',
};

const REPORT_BADGE = {
  open: 'chip-amber',
  reviewed: 'chip-teal',
  actioned: 'chip-teal',
  dismissed: 'chip',
};

const FILTERS = [
  { key: 'semua', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
  { key: 'suspended', label: 'Ditangguhkan' },
];

const CONFIG_FIELDS = [
  { key: 'group_target_members', label: 'Target anggota grup', unit: 'orang', hint: 'Jumlah peserta yang membuat sesi grup terbentuk otomatis.' },
  { key: 'group_wait_minutes', label: 'Batas tunggu grup', unit: 'menit', hint: 'Antrean grup kedaluwarsa setelah waktu ini.' },
  { key: 'one_to_one_wait_minutes', label: 'Batas cari relawan', unit: 'menit', hint: 'Antrean berdua kedaluwarsa setelah waktu ini.' },
  { key: 'one_to_one_ring_seconds', label: 'Waktu relawan menjawab', unit: 'detik', hint: 'Panggilan berbunyi selama ini sebelum dilempar ke relawan lain.' },
  { key: 'volunteer_join_consent_seconds', label: 'Waktu peserta menyetujui', unit: 'detik', hint: 'Batas peserta menekan setuju saat relawan ikut sesi grup.' },
];

export default function AdminPage() {
  const supabase = createClient();
  const { user, profile, loading } = useSession();

  const [section, setSection] = useState('ringkasan');
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [filter, setFilter] = useState('semua');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const [{ data: apps }, { data: reps }, { data: st }, { data: cfg }] = await Promise.all([
      supabase
        .from('volunteer_applications')
        .select('*, users!volunteer_applications_user_id_fkey(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.rpc('admin_stats'),
      supabase.from('app_config').select('*'),
    ]);

    setApplications(apps || []);
    setReports(reps || []);
    setStats(st || null);
    if (cfg) {
      setConfig(Object.fromEntries(cfg.map((c) => [c.key, c.value])));
    }
    setLoadingPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    if (profile?.role !== 'admin') {
      setLoadingPage(false);
      return undefined;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile, load]);

  async function reviewApplication(app, status) {
    setBusyId(app.id);
    setError('');
    const { error: err } = await supabase
      .from('volunteer_applications')
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', app.id);
    if (!err && status === 'approved') {
      await supabase
        .from('volunteer_presence')
        .upsert({ volunteer_id: app.user_id, status: 'offline', last_seen_at: new Date().toISOString() });
    }
    setBusyId('');
    if (err) {
      setError(err.message);
      return;
    }
    load();
  }

  async function reviewReport(report, status) {
    setBusyId(report.id);
    setError('');
    const { error: err } = await supabase
      .from('reports')
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', report.id);
    setBusyId('');
    if (err) {
      setError(err.message);
      return;
    }
    load();
  }

  async function suspendVolunteer(userId) {
    setBusyId(userId);
    const { error: err } = await supabase
      .from('volunteer_applications')
      .update({ status: 'suspended', reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'approved');
    if (!err) {
      await supabase
        .from('volunteer_presence')
        .upsert({ volunteer_id: userId, status: 'suspended', last_seen_at: new Date().toISOString() });
    }
    setBusyId('');
    if (err) setError(err.message);
    load();
  }

  // Buka berkas bukti relawan lewat signed URL (bucket privat).
  async function openProof(path, id) {
    setError('');
    setBusyId(`proof-${id}`);
    const url = await proofSignedUrl(supabase, path);
    setBusyId('');
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError('Bukti tidak bisa dibuka. Coba lagi sebentar lagi.');
  }

  async function saveConfig(e) {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSaved(false);
    for (const field of CONFIG_FIELDS) {
      const value = Number(config[field.key]);
      await supabase
        .from('app_config')
        .update({ value: Number.isFinite(value) ? value : 0, updated_at: new Date().toISOString() })
        .eq('key', field.key);
    }
    setConfigSaving(false);
    setConfigSaved(true);
  }

  const pending = useMemo(() => applications.filter((a) => a.status === 'pending'), [applications]);
  const openReports = useMemo(() => reports.filter((r) => r.status === 'open'), [reports]);

  // Filter status + pencarian nama/email, dihitung di klien (data sudah dimuat).
  const filteredApplications = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((a) => {
      if (filter !== 'semua' && a.status !== filter) return false;
      if (!q) return true;
      const name = (a.users?.display_name || '').toLowerCase();
      const email = (a.users?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [applications, filter, query]);

  // Laporan terbuka tampil lebih dulu — itu yang butuh tindakan.
  const sortedReports = useMemo(() => {
    const rank = { open: 0, reviewed: 1, actioned: 2, dismissed: 3 };
    return [...reports].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  }, [reports]);

  if (loading || loadingPage) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <WaveDots size="lg" label="Memuat dashboard admin..." className="text-aurora-teal" />
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card max-w-lg text-center">
          <h1 className="text-lg font-bold text-frost">Halaman khusus admin</h1>
          <p className="mt-1 text-sm text-fog">Akunmu bukan admin.</p>
          <Link href="/app" className="btn-secondary mt-4">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  }

  const current = SECTIONS.find((s) => s.key === section) || SECTIONS[0];

  const angkaUtama = stats
    ? [
        { label: 'Relawan aktif', value: stats.volunteers_available, hint: 'siap menerima sesi', icon: HeartPulse, tone: stats.volunteers_available > 0 ? 'teal' : 'plain' },
        { label: 'Sesi berjalan', value: stats.sessions_active, hint: 'grup + berdua', icon: Activity, tone: stats.sessions_active > 0 ? 'teal' : 'plain' },
        { label: 'Pendaftar menunggu', value: stats.applications_pending, hint: 'perlu diverifikasi', icon: Users, tone: stats.applications_pending > 0 ? 'amber' : 'plain' },
        { label: 'Laporan terbuka', value: stats.reports_open, hint: 'perlu ditinjau', icon: AlertTriangle, tone: stats.reports_open > 0 ? 'amber' : 'plain' },
      ]
    : [];

  const angkaPendukung = stats
    ? [
        { label: 'Relawan disetujui', value: stats.applications_approved },
        { label: 'Sesi total', value: stats.sessions_total },
        { label: 'Sesi grup', value: stats.sessions_group },
        { label: 'Sesi berdua', value: stats.sessions_one_to_one },
        { label: 'Check-in terisi', value: stats.checkins_total },
        { label: 'Check-in membaik', value: stats.checkins_lebih_baik },
      ]
    : [];

  const toneText = { teal: 'text-aurora-teal', amber: 'text-amber-200', plain: 'text-fog' };

  // Aksi pada satu pendaftaran — dipakai tabel desktop maupun kartu mobile.
  function applicationActions(a, { compact }) {
    const size = compact ? 'btn-sm' : '';
    if (a.status === 'pending') {
      return (
        <div className="flex gap-2">
          <button type="button" className={`btn-primary ${size}`} onClick={() => reviewApplication(a, 'approved')} disabled={busyId === a.id}>
            Setujui
          </button>
          <button type="button" className={`btn-danger ${size}`} onClick={() => reviewApplication(a, 'rejected')} disabled={busyId === a.id}>
            Tolak
          </button>
        </div>
      );
    }
    if (a.status === 'approved') {
      return (
        <button
          type="button"
          className={`btn-secondary ${size}`}
          onClick={() => suspendVolunteer(a.user_id)}
          disabled={busyId === a.user_id}
          title="Tangguhkan sementara, misalnya saat ada laporan yang ditinjau"
        >
          Tangguhkan
        </button>
      );
    }
    return <span className="text-xs text-mist">—</span>;
  }

  function proofCell(a, { compact }) {
    if (!a.proof_path) {
      return <span className="text-xs text-amber-200">Belum ada</span>;
    }
    return (
      <button
        type="button"
        onClick={() => openProof(a.proof_path, a.id)}
        disabled={busyId === `proof-${a.id}`}
        className={`inline-flex items-center gap-1.5 font-semibold text-aurora-teal hover:underline disabled:opacity-60 ${compact ? 'text-xs' : 'text-sm'}`}
        title={PROOF_TYPE_LABELS[a.proof_type] || 'Bukti lain'}
      >
        <FileCheck2 className={compact ? 'size-3.5' : 'size-4'} />
        {busyId === `proof-${a.id}` ? 'Membuka…' : 'Lihat bukti'}
      </button>
    );
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* ============ Sidebar (desktop) ============ */}
      <aside className="hidden border-r border-white/8 bg-midnight/40 backdrop-blur-xl lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-4 font-bold text-frost">
          <Logo size={28} />
          <span>hearme</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-mist">Menu</p>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.key === section;
            const badge = s.key === 'relawan' ? pending.length : s.key === 'laporan' ? openReports.length : 0;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? 'border border-indigo-300/25 bg-indigo-300/10 text-frost'
                    : 'border border-transparent text-fog hover:bg-white/5 hover:text-frost'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{s.label}</span>
                {badge > 0 && <span className="chip-amber px-2 py-0.5 text-[11px]">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t border-white/8 p-3">
          <Link href="/" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-fog transition hover:bg-white/5 hover:text-frost">
            <Compass className="size-4" /> Beranda Utama
          </Link>
          <Link href="/app/account" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-fog transition hover:bg-white/5 hover:text-frost">
            <UserRound className="size-4" /> Akun
          </Link>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-fog transition hover:bg-white/5 hover:text-frost"
          >
            <LogOut className="size-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* ============ Kolom utama ============ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/8 bg-void/70 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="lg:hidden">
                <Logo size={24} />
              </span>
              <div className="hidden min-w-0 lg:block">
                <h1 className="truncate text-sm font-bold text-frost">{current.label}</h1>
                <p className="truncate text-[11px] text-mist">{current.hint}</p>
              </div>
              <span className="truncate text-sm font-bold text-frost lg:hidden">Dashboard admin</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex">
                <span className="chip">Admin tidak melihat isi cerita</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-aurora-indigo to-aurora-violet text-xs font-bold text-void">
                  {(profile?.display_name || 'A').slice(0, 1).toUpperCase()}
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="max-w-[180px] truncate text-xs font-semibold text-frost">{profile?.display_name || 'Admin'}</p>
                  <p className="max-w-[180px] truncate text-[11px] text-mist">{user?.email || 'Admin'}</p>
                </div>
              </div>
              <Link href="/" className="btn-ghost lg:hidden" title="Beranda Utama">
                <Compass className="size-4" />
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/';
                }}
                className="btn-ghost lg:hidden"
                title="Keluar"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>

          {/* Tab bagian — pengganti sidebar di layar kecil (dibungkus, bukan digeser) */}
          <nav className="flex flex-wrap gap-1.5 px-3 pb-2 lg:hidden">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.key === section;
              const badge = s.key === 'relawan' ? pending.length : s.key === 'laporan' ? openReports.length : 0;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium ${
                    active ? 'border border-indigo-300/25 bg-indigo-300/10 text-frost' : 'border border-transparent text-fog'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {s.label}
                  {badge > 0 && <span className="chip-amber px-1.5 py-0 text-[10px]">{badge}</span>}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 px-4 py-5 lg:px-6">
          {error && <p className="mb-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

          {/* ============ Ringkasan ============ */}
          {section === 'ringkasan' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {angkaUtama.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="card">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-fog">{s.label}</p>
                        <Icon className={`size-4 ${toneText[s.tone]}`} />
                      </div>
                      <p className="mt-2 text-4xl font-bold text-frost">{s.value ?? 0}</p>
                      <p className="text-xs text-mist">{s.hint}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="card lg:col-span-2">
                  <h2 className="flex items-center gap-2 font-bold text-frost">
                    <ClipboardList className="size-4 text-aurora-teal" /> Perlu tindakan
                  </h2>
                  {pending.length === 0 && openReports.length === 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-fog">
                      <CircleCheck className="size-4 text-aurora-teal" /> Tidak ada yang menunggu tindakan.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {pending.length > 0 && (
                        <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
                          <span className="text-sm text-frost">
                            <strong>{pending.length}</strong> pendaftar relawan menunggu verifikasi
                          </span>
                          <button type="button" className="btn-secondary" onClick={() => setSection('relawan')}>
                            Tinjau
                          </button>
                        </li>
                      )}
                      {openReports.length > 0 && (
                        <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
                          <span className="text-sm text-frost">
                            <strong>{openReports.length}</strong> laporan pengguna terbuka
                          </span>
                          <button type="button" className="btn-secondary" onClick={() => setSection('laporan')}>
                            Tinjau
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                <div className="card">
                  <h2 className="font-bold text-frost">Angka lain</h2>
                  <dl className="mt-2 divide-y divide-white/8">
                    {angkaPendukung.map((s) => (
                      <div key={s.label} className="flex items-center justify-between py-2 text-sm">
                        <dt className="text-fog">{s.label}</dt>
                        <dd className="font-semibold text-frost">{s.value ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          )}

          {/* ============ Relawan ============ */}
          {section === 'relawan' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => {
                    const count = f.key === 'semua' ? applications.length : applications.filter((a) => a.status === f.key).length;
                    const active = filter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                          active ? 'border-indigo-300/25 bg-indigo-300/10 text-frost' : 'border-white/10 text-fog hover:bg-white/5'
                        }`}
                      >
                        {f.label} <span className="text-mist">({count})</span>
                      </button>
                    );
                  })}
                </div>
                <label className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
                  <input
                    className="input pl-9"
                    placeholder="Cari nama atau email…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Cari pendaftar relawan"
                  />
                </label>
              </div>

              {/* Tabel desktop */}
              <div className="card hidden overflow-hidden p-0 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-wider text-mist">
                      <th className="px-4 py-3 font-semibold">Relawan</th>
                      <th className="px-4 py-3 font-semibold">Dikirim</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Bukti</th>
                      <th className="px-4 py-3 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((a) => (
                      <tr key={a.id} className="border-b border-white/6 last:border-0 align-top hover:bg-white/3">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-frost">{a.users?.display_name || 'Pengguna'}</p>
                          <p className="text-xs text-mist">{a.users?.email}</p>
                          {a.motivation && <p className="mt-1 max-w-md text-xs text-fog">{a.motivation}</p>}
                          <p className="mt-1 text-[11px] text-mist">
                            Pelatihan: {a.training_completed ? 'sudah' : 'belum'} · Kode etik:{' '}
                            {a.code_of_conduct_accepted_at ? formatDateTime(a.code_of_conduct_accepted_at) : 'belum'}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-fog">{formatDateTime(a.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={APP_BADGE[a.status] || 'chip'}>{APPLICATION_BADGE_LABELS[a.status] || a.status}</span>
                        </td>
                        <td className="px-4 py-3">{proofCell(a, { compact: true })}</td>
                        <td className="px-4 py-3">{applicationActions(a, { compact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredApplications.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-mist">Tidak ada pendaftar yang cocok dengan filter ini.</p>
                )}
                <p className="border-t border-white/8 px-4 py-2 text-xs text-mist">
                  Menampilkan {filteredApplications.length} dari {applications.length} pendaftar.
                </p>
              </div>

              {/* Kartu mobile */}
              <div className="space-y-3 md:hidden">
                {filteredApplications.map((a) => (
                  <div key={a.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-frost">{a.users?.display_name || 'Pengguna'}</p>
                        <p className="text-xs text-mist">{a.users?.email}</p>
                      </div>
                      <span className={APP_BADGE[a.status] || 'chip'}>{APPLICATION_BADGE_LABELS[a.status] || a.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-fog">Dikirim {formatDateTime(a.created_at)}</p>
                    {a.motivation && <p className="mt-2 rounded-lg bg-white/5 p-2 text-sm text-fog">{a.motivation}</p>}
                    <p className="mt-2 text-xs text-mist">
                      Pelatihan: {a.training_completed ? 'sudah' : 'belum'} · Kode etik:{' '}
                      {a.code_of_conduct_accepted_at ? formatDateTime(a.code_of_conduct_accepted_at) : 'belum'}
                    </p>
                    <div className="mt-2">{proofCell(a, { compact: false })}</div>
                    <div className="mt-3">{applicationActions(a, { compact: false })}</div>
                  </div>
                ))}
                {filteredApplications.length === 0 && <p className="card text-center text-sm text-mist">Tidak ada pendaftar yang cocok.</p>}
              </div>
            </div>
          )}

          {/* ============ Laporan ============ */}
          {section === 'laporan' && (
            <div className="space-y-4">
              <div className="card hidden overflow-hidden p-0 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-wider text-mist">
                      <th className="px-4 py-3 font-semibold">Alasan</th>
                      <th className="px-4 py-3 font-semibold">Sesi</th>
                      <th className="px-4 py-3 font-semibold">Waktu</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReports.map((r) => (
                      <tr key={r.id} className="border-b border-white/6 last:border-0 align-top hover:bg-white/3">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-frost">{REPORT_REASON_LABELS[r.reason_category] || r.reason_category}</p>
                          {r.note && <p className="mt-1 max-w-md text-xs text-fog">{r.note}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-fog">{r.session_id ? r.session_id.slice(0, 8) : '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-fog">{formatDateTime(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={REPORT_BADGE[r.status] || 'chip'}>{REPORT_STATUS_LABELS[r.status] || r.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'open' ? (
                            <div className="flex gap-2">
                              <button type="button" className="btn-secondary btn-sm" onClick={() => reviewReport(r, 'reviewed')} disabled={busyId === r.id}>
                                Tandai ditinjau
                              </button>
                              <button type="button" className="btn-danger btn-sm" onClick={() => reviewReport(r, 'actioned')} disabled={busyId === r.id}>
                                Sudah ditindaklanjuti
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-mist">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedReports.length === 0 && <p className="px-4 py-6 text-center text-sm text-mist">Belum ada laporan pengguna.</p>}
              </div>

              <div className="space-y-3 md:hidden">
                {sortedReports.map((r) => (
                  <div key={r.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-frost">{REPORT_REASON_LABELS[r.reason_category] || r.reason_category}</p>
                      <span className={REPORT_BADGE[r.status] || 'chip'}>{REPORT_STATUS_LABELS[r.status] || r.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-fog">
                      Sesi {r.session_id ? r.session_id.slice(0, 8) : '—'} · {formatDateTime(r.created_at)}
                    </p>
                    {r.note && <p className="mt-2 rounded-lg bg-white/5 p-2 text-sm text-fog">{r.note}</p>}
                    {r.status === 'open' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary" onClick={() => reviewReport(r, 'reviewed')} disabled={busyId === r.id}>
                          Tandai ditinjau
                        </button>
                        <button type="button" className="btn-danger" onClick={() => reviewReport(r, 'actioned')} disabled={busyId === r.id}>
                          Sudah ditindaklanjuti
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {sortedReports.length === 0 && <p className="card text-center text-sm text-mist">Belum ada laporan pengguna.</p>}
              </div>
            </div>
          )}

          {/* ============ Konfigurasi ============ */}
          {section === 'konfigurasi' && config && (
            <div className="card max-w-3xl">
              <h2 className="flex items-center gap-2 font-bold text-frost">
                <Settings2 className="size-4 text-aurora-teal" /> Konfigurasi operasional
              </h2>
              <p className="mt-1 text-sm text-fog">
                Nilai awal layanan — sesuaikan dengan kebutuhan ruang.
              </p>
              <form onSubmit={saveConfig} className="mt-4 grid gap-4 sm:grid-cols-2">
                {CONFIG_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="label" htmlFor={f.key}>
                      {f.label} <span className="text-mist">({f.unit})</span>
                    </label>
                    <input
                      id={f.key}
                      type="number"
                      min="1"
                      inputMode="numeric"
                      className="input"
                      value={config[f.key] ?? ''}
                      onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                    />
                    <p className="mt-1 text-[11px] text-mist">{f.hint}</p>
                  </div>
                ))}
                <div className="flex items-center gap-3 sm:col-span-2">
                  <button type="submit" className="btn-primary" disabled={configSaving}>
                    {configSaving ? 'Menyimpan…' : 'Simpan konfigurasi'}
                  </button>
                  {configSaved && <span className="text-sm text-aurora-teal">Tersimpan ✓</span>}
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
