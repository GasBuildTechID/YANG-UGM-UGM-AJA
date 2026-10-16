'use client';

// Alur relawan (diagram alur baru):
// isi formulir & validasi -> menunggu verif dari admin -> lobby (matchmaking).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  DoorOpen,
  FileCheck2,
  HeartHandshake,
  Loader2,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import WaveDots from '@/components/WaveDots';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import { APPLICATION_LABELS, PROOF_TYPE_LABELS, formatDateTime } from '@/lib/labels';
import { PROOF_ACCEPT, PROOF_MAX_BYTES, validateProofFile, uploadProof, proofSignedUrl } from '@/lib/volunteer';

export default function VolunteerPage() {
  const supabase = createClient();
  const { user, loading } = useSession();

  const [application, setApplication] = useState(undefined);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');

  // form pendaftaran
  const [motivation, setMotivation] = useState('');
  const [training, setTraining] = useState(false);
  const [conduct, setConduct] = useState(false);
  // satu bukti kualifikasi
  const [proofType, setProofType] = useState('str');
  const [proofFile, setProofFile] = useState(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: app } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setApplication(app || null);
    setLoadingPage(false);
  }, [user, supabase]);

  useEffect(() => {
    if (loading || !user) return undefined;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, load]);

  async function submitApplication(e) {
    e.preventDefault();
    setError('');

    // Satu bukti wajib: unggah dulu, baru simpan pendaftaran.
    const check = validateProofFile(proofFile);
    if (!check.ok) {
      setError(check.reason);
      return;
    }

    setBusy(true);
    const uploaded = await uploadProof(supabase, user.id, proofFile);
    if (uploaded.error) {
      setBusy(false);
      setError(uploaded.error);
      return;
    }

    const { error: err } = await supabase.from('volunteer_applications').insert({
      user_id: user.id,
      status: 'pending',
      motivation,
      training_completed: training,
      code_of_conduct_accepted_at: conduct ? new Date().toISOString() : null,
      proof_type: proofType,
      proof_path: uploaded.path,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    load();
  }

  // Pilih / buang berkas bukti. Validasi di klien supaya sebabnya langsung terlihat.
  function onPickProof(e) {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    const check = validateProofFile(f);
    if (!check.ok) {
      setError(check.reason);
      setProofFile(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setError('');
    setProofFile(f);
  }

  function clearProof() {
    setProofFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Buka bukti yang sudah dikirim lewat signed URL (bucket privat).
  async function openOwnProof() {
    const url = await proofSignedUrl(supabase, application?.proof_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError('Bukti tidak bisa dibuka sekarang. Coba lagi sebentar lagi.');
  }

  if (loading || (user && loadingPage)) {
    return (
      <div className="grid place-items-center py-24">
        <WaveDots size="lg" label="Memuat formulir relawan..." className="text-aurora-teal" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <HeartHandshake className="mx-auto size-8 text-aurora-indigo" />
        <h1 className="mt-3 text-lg font-bold text-frost">Masuk dulu ya</h1>
        <p className="mt-1 text-sm text-fog">Halaman relawan terbuka setelah kamu masuk.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href="/app"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-fog hover:text-frost"
        >
          <ArrowLeft className="size-3.5" /> Kembali ke beranda
        </Link>
        <h1 className="text-2xl font-bold text-frost">Relawan pendamping</h1>
        <p className="mt-1 text-fog">
          Pendengar sebaya terlatih — <strong>bukan</strong> konselor. Jangan menjanjikan kerahasiaan absolut,
          jangan mendiagnosis.
        </p>
      </div>

      {!application && (
        <div className="card">
          <h2 className="flex items-center gap-2 text-lg font-bold text-frost">
            <UserPlus className="size-5" /> Formulir Dokumen Pendukung Relawan
          </h2>
          <p className="mt-1 text-sm text-fog">
            Isi formulir &amp; lampirkan 1 bukti kualifikasi (STR, Ijazah, atau Sertifikat). Setelah dikirim, akunmu langsung menunggu verifikasi admin.
          </p>
          <form onSubmit={submitApplication} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="motivation">
                Kenapa kamu ingin menjadi pendamping?
              </label>
              <textarea
                id="motivation"
                required
                className="input min-h-24"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Ceritakan singkat. Ini dibaca admin untuk menilai kelayakan."
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-fog">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={training}
                onChange={(e) => setTraining(e.target.checked)}
              />
              <span>Aku sudah/sedang ikut pelatihan pendampingan sebaya (atau bersedia ikut orientasi kampus).</span>
            </label>

            {/* Satu bukti kualifikasi — wajib, dibaca admin saat verifikasi. */}
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-frost">
                <FileCheck2 className="size-4 text-aurora-teal" /> Lampirkan 1 bukti
              </p>
              <p className="mt-1 text-xs leading-relaxed text-fog">
                Satu berkas yang menunjukkan latar psikologi/pendampinganmu. Hanya admin yang bisa membukanya.
              </p>

              <div className="mt-3">
                <label className="label" htmlFor="proof_type">
                  Jenis bukti
                </label>
                <select
                  id="proof_type"
                  className="input"
                  value={proofType}
                  onChange={(e) => setProofType(e.target.value)}
                >
                  {Object.entries(PROOF_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                {proofFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-300/30 bg-teal-300/10 p-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-frost">
                      <Paperclip className="size-4 shrink-0 text-aurora-teal" />
                      <span className="truncate">{proofFile.name}</span>
                      <span className="shrink-0 text-xs text-fog">
                        {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={clearProof}
                      className="shrink-0 rounded-lg p-1.5 text-fog transition hover:bg-white/10 hover:text-frost"
                      aria-label="Hapus berkas bukti"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="proof"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/4 p-4 text-sm text-fog transition hover:border-teal-300/40 hover:text-frost"
                  >
                    <Upload className="size-4" />
                    Pilih berkas bukti — JPG, PNG, atau PDF (maks {PROOF_MAX_BYTES / 1024 / 1024} MB)
                  </label>
                )}
                <input
                  ref={fileRef}
                  id="proof"
                  type="file"
                  accept={PROOF_ACCEPT}
                  className="sr-only"
                  onChange={onPickProof}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-fog">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={conduct}
                onChange={(e) => setConduct(e.target.checked)}
              />
              <span>
                Aku menyetujui kode etik: tidak memaksa bercerita, tidak meminta uang/kontak, tidak menyebarkan
                cerita, tidak mengaku profesional.
              </span>
            </label>
            {error && <p className="text-sm text-rose-200">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy || !training || !conduct || !proofFile}>
              {busy ? 'Mengirim…' : 'Kirim pendaftaran'}
            </button>
          </form>
        </div>
      )}

      {application && application.status === 'pending' && (
        <div className="card space-y-5">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-amber-300/35 bg-amber-300/10 text-amber-200">
              <Clock className="size-6 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-frost">Dashboard Verifikasi Relawan</h2>
                <span className="chip-amber">Menunggu Verifikasi Admin</span>
              </div>
              <p className="mt-1 text-sm text-fog leading-relaxed">
                Dokumen bukti kualifikasimu telah berhasil diterima. Tim admin kampus sedang melakukan verifikasi data kelayakan pendampingan sebaya.
              </p>
            </div>
          </div>

          {/* Timeline tahapan verifikasi */}
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mist">Progres Pendaftaran</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5 text-teal-100">
                <CheckCircle2 className="size-4 shrink-0 text-aurora-teal" />
                <span>Akun relawan berhasil terdaftar</span>
              </div>
              <div className="flex items-center gap-2.5 text-teal-100">
                <CheckCircle2 className="size-4 shrink-0 text-aurora-teal" />
                <span>
                  Formulir &amp; dokumen pendukung terkirim ({formatDateTime(application.created_at)})
                </span>
              </div>
              <div className="flex items-center gap-2.5 font-medium text-amber-200">
                <Clock className="size-4 shrink-0 text-amber-300 animate-spin" />
                <span>Sedang diverifikasi oleh admin (estimasi maksimal 1×24 jam)</span>
              </div>
              <div className="flex items-center gap-2.5 text-mist">
                <DoorOpen className="size-4 shrink-0 opacity-40" />
                <span>Akses Lobby Relawan akan otomatis aktif setelah disetujui</span>
              </div>
            </div>
          </div>

          {/* Info berkas yang dilampirkan */}
          {application.proof_path && (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-fog">
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 text-aurora-teal" />
                <span>
                  Dokumen bukti: <strong className="text-frost">{PROOF_TYPE_LABELS[application.proof_type] || 'Dokumen Kualifikasi'}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={openOwnProof}
                className="font-semibold text-aurora-teal underline-offset-2 hover:underline"
              >
                Lihat Berkas
              </button>
            </div>
          )}

          {/* Opsi akses bagi relawan sambil menunggu */}
          <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-mist text-center sm:text-left">
              Sambil menunggu verifikasi selesai, kamu tetap bisa menggunakan hearme sebagai pengguna biasa.
            </p>
            <Link
              href="/app"
              className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs whitespace-nowrap"
            >
              Ke Halaman Pengguna <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      {application && application.status !== 'pending' && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-frost">Status pendaftaranmu</h2>
            <span
              className={
                application.status === 'approved'
                  ? 'chip-teal'
                  : 'chip-rose'
              }
            >
              {APPLICATION_LABELS[application.status]}
            </span>
          </div>
          <p className="mt-2 text-sm text-fog">Dikirim {formatDateTime(application.created_at)}. Diverifikasi admin.</p>
          {application.proof_path && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fog">
              <Paperclip className="size-3.5" />
              Bukti: {PROOF_TYPE_LABELS[application.proof_type] || 'Bukti terkirim'}
              <button
                type="button"
                onClick={openOwnProof}
                className="font-semibold text-aurora-teal underline-offset-2 hover:underline"
              >
                Lihat
              </button>
            </p>
          )}
          {application.status === 'rejected' && (
            <p className="mt-3 rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">
              Pendaftaranmu belum disetujui. Kamu bisa menghubungi admin kampus untuk info lebih lanjut.
            </p>
          )}
          {application.status === 'suspended' && (
            <p className="mt-3 rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">
              Akunmu ditangguhkan sementara, biasanya saat ada laporan yang sedang ditinjau.
            </p>
          )}
        </div>
      )}

      {application?.status === 'approved' && (
        <Link
          href="/app/lobby"
          className="group flex items-center justify-between gap-3 rounded-3xl border border-teal-300/30 bg-teal-300/10 p-5 transition hover:-translate-y-0.5 hover:border-teal-300/50"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-teal-300/15 text-aurora-teal">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-frost">Kamu sudah terverifikasi</h2>
              <p className="text-sm text-teal-100">
                Buka lobby: set status siap, lihat pengguna yang menunggu, dan panggil yang ingin kamu temani.
              </p>
            </div>
          </div>
          <DoorOpen className="size-5 text-aurora-teal transition group-hover:translate-x-0.5" />
        </Link>
      )}

      {!application && (
        <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-fog">
          <HeartHandshake className="mr-1 inline size-3.5" />
          Relawan tidak boleh menjanjikan kerahasiaan absolut. Jelaskan batas privasi dan cara laporan ditangani.
        </div>
      )}
    </div>
  );
}
