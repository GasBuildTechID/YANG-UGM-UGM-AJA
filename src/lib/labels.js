// Label & warna terpusat supaya konsisten di seluruh UI.
export const CATEGORY_LABELS = {
  didengarkan: 'Ingin didengarkan',
  berbagi_pengalaman: 'Berbagi pengalaman',
  strategi_praktis: 'Strategi praktis',
  bantuan_profesional: 'Bantuan profesional',
};

export const CATEGORY_DESCRIPTIONS = {
  didengarkan: 'Ada yang mau kudengar. Ceritakan saja.',
  berbagi_pengalaman: 'Bertemu teman yang punya pengalaman serupa.',
  strategi_praktis: 'Cari cara praktis menghadapi beban kuliah/kehidupan.',
  bantuan_profesional: 'Butuh rujukan ke bantuan profesional/kampus.',
};

export const LANGUAGE_LABELS = { id: 'Bahasa Indonesia', en: 'English' };

export const PRESENCE_LABELS = {
  available: 'Siap menerima sesi',
  busy: 'Sedang sesi',
  offline: 'Offline',
  suspended: 'Ditangguhkan',
};

export const APPLICATION_LABELS = {
  pending: 'Menunggu verifikasi admin',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  suspended: 'Ditangguhkan',
};

// Versi ringkas untuk lencana (badge) di tabel dashboard admin.
export const APPLICATION_BADGE_LABELS = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  suspended: 'Ditangguhkan',
};

// Jenis bukti kualifikasi yang dilampirkan relawan saat mendaftar.
export const PROOF_TYPE_LABELS = {
  str: 'STR Psikolog (Surat Tanda Registrasi)',
  ijazah: 'Ijazah sarjana psikologi',
  sertifikat: 'Sertifikat pelatihan pendampingan',
  kampus: 'Surat keterangan unit psikologi kampus',
  lainnya: 'Bukti lain',
};

export const REPORT_REASON_LABELS = {
  pelecehan: 'Pelecehan',
  intimidasi: 'Intimidasi',
  eksploitasi: 'Eksploitasi',
  meminta_uang: 'Meminta uang',
  memaksa_bercerita: 'Memaksa bercerita',
  menyebar_cerita: 'Menyebarkan cerita/identitas',
  mengaku_profesional: 'Mengaku profesional tanpa kualifikasi',
  lainnya: 'Lainnya',
};

export const REPORT_STATUS_LABELS = {
  open: 'Terbuka',
  reviewed: 'Sudah ditinjau',
  actioned: 'Sudah ditindaklanjuti',
  dismissed: 'Diabaikan',
};

export const MOOD_LABELS = {
  lebih_baik: 'Lebih baik',
  sama: 'Sama saja',
  lebih_berat: 'Lebih berat',
};

export const PHASE_LABELS = {
  opening: 'Pembukaan',
  sharing: 'Berbagi',
  closing: 'Penutup',
  ended: 'Selesai',
};

export const SESSION_STATUS_LABELS = {
  scheduled: 'Terjadwal',
  active: 'Berlangsung',
  completed: 'Selesai',
  ended_early: 'Berakhir lebih awal',
  reported: 'Dalam peninjauan',
};

// Panduan sesi (dokumen §4) — durasi awal, bukan aturan universal.
export const SESSION_GUIDE = {
  opening: {
    title: 'Pembukaan (±5 menit)',
    bullets: [
      'Nama samaran saja — jangan identitas asli.',
      'Saling mendengarkan, bukan menasihati paksa.',
      'Boleh melewati giliran.',
    ],
  },
  sharing: {
    title: 'Berbagi (±20–25 menit)',
    bullets: [
      'Cerita secukupnya. Tidak wajib menjawab.',
      'Dengarkan tanpa menghakimi.',
      'Jangan minta uang atau kontak pribadi.',
    ],
  },
  closing: {
    title: 'Penutup (±5–10 menit)',
    bullets: [
      'Satu hal yang tadi membantu, kalau mau.',
      'Satu langkah kecil untuk dirimu.',
      'Terima kasih sudah saling menjaga.',
    ],
  },
};

export const CRISIS_RESOURCES = [
  {
    label: 'Layanan bantuan psikologis Kemenkes (SEJIWA)',
    detail: 'Hotline 119 ext. 8 — 24 jam, gratis.',
  },
  {
    label: 'Unit Layanan Psikologi kampus',
    detail: 'Cek jadwal layanan konseling kampusmu (Bimbingan Konseling / Unit Psikologi).',
  },
  {
    label: 'Pendampingan iman & spiritual kampus',
    detail: 'Rohaniwan/pendamping kampus bisa menjadi teman bicara awal.',
  },
  {
    label: 'Dalam bahaya langsung',
    detail: 'Hubungi 112 (darurat) atau orang terdekat yang bisa menemanimu saat ini.',
  },
];

export function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
