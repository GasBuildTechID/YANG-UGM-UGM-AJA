// Ringkasan kebutuhan berbasis aturan (fallback tanpa API) + parser ringkasan LLM.
// Nada bahasa: malam yang hangat — singkat dan puitis, bukan kuesioner klinis.

export const BREATHING_STEPS = ['Tarik napas…', 'Tahan sebentar…', 'Buang pelan-pelan…'];

export const INTAKE_QUESTIONS = [
  {
    key: 'mood',
    question: 'Malam ini, apa yang paling berat?',
    helper: 'Tidak ada jawaban yang salah.',
    options: [
      { value: 'stres', label: 'Pikiran penuh — tugas menumpuk' },
      { value: 'sedih', label: 'Sedih yang belum selesai' },
      { value: 'lelah', label: 'Lelah — ingin berhenti sebentar' },
      { value: 'lainnya', label: 'Sulit dijelaskan' },
    ],
  },
  {
    key: 'need',
    question: 'Kalau ada yang bisa menemanimu, kamu ingin…',
    helper: 'Bukan tes — hanya apa yang kamu butuhkan.',
    options: [
      { value: 'didengarkan', label: 'Didengarkan — tanpa dinilai' },
      { value: 'berbagi_pengalaman', label: 'Bertemu yang senasib' },
      { value: 'strategi_praktis', label: 'Bantuan langkah praktis' },
      { value: 'bantuan_profesional', label: 'Bantuan profesional' },
    ],
  },
  {
    key: 'format',
    question: 'Melewati malam ini dengan cara apa?',
    helper: 'Bisa berubah pikiran kapan saja.',
    options: [
      { value: 'group', label: 'Lingkaran kecil — 3–4 orang' },
      { value: 'one_to_one', label: 'Berdua dengan relawan' },
      { value: 'unsure', label: 'Belum tahu' },
    ],
  },
  {
    key: 'language',
    question: 'Bahasa yang paling nyaman?',
    options: [
      { value: 'id', label: 'Bahasa Indonesia' },
      { value: 'en', label: 'English' },
    ],
  },
];

export function buildSummaryFromAnswers(answers) {
  const needMap = {
    didengarkan: 'ingin didengarkan tanpa dihakimi',
    berbagi_pengalaman: 'ingin bertemu orang dengan pengalaman serupa',
    strategi_praktis: 'mencari strategi praktis',
    bantuan_profesional: 'ingin diarahkan ke bantuan profesional',
  };
  const moodMap = {
    stres: 'pikiran penuh oleh tuntutan kuliah/kehidupan',
    sedih: 'ada rasa sedih atau kehilangan yang belum selesai',
    lelah: 'lelah dan ingin berhenti sebentar',
    lainnya: 'ada beban pikiran yang sulit dijelaskan',
  };

  const mood = moodMap[answers.mood] || 'sedang merasa berat';
  const need = needMap[answers.need] || 'ingin didengarkan';
  const format =
    answers.format === 'group'
      ? 'lingkaran kecil'
      : answers.format === 'one_to_one'
        ? 'sesi berdua dengan relawan'
        : 'belum memilih format';

  return {
    summary: `Malam ini, pengguna ${mood}. Yang paling dibutuhkan: ${need}. Preferensi awal: ${format}. Bahasa: ${answers.language === 'en' ? 'Inggris' : 'Indonesia'}.`,
    suggested_category: answers.need || 'didengarkan',
    suggested_mode: answers.format === 'unsure' ? null : answers.format || null,
    language: answers.language || 'id',
  };
}

// Parser pertanyaan bebas (kalau ada OPENAI_API_KEY dan user mengetik sendiri).
const KEYWORD_RULES = [
  { match: /(didengar|didengarkan|curhat|cerita)/i, category: 'didengarkan' },
  { match: /(pengalaman|senasib|sama seperti|berbagi)/i, category: 'berbagi_pengalaman' },
  { match: /(strategi|tips|cara|praktis)/i, category: 'strategi_praktis' },
  { match: /(psikolog|konselor|profesional|terapis|dokter|bantuan profesional)/i, category: 'bantuan_profesional' },
];

export function buildSummaryFromText(text, language = 'id') {
  const clean = (text || '').trim();
  let category = 'didengarkan';
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(clean)) {
      category = rule.category;
      break;
    }
  }

  return {
    summary: `Malam ini, pengguna menulis: "${clean.slice(0, 240)}". Kebutuhan utama terdeteksi: ${category.replaceAll('_', ' ')}. Bahasa: ${language === 'en' ? 'Inggris' : 'Indonesia'}.`,
    suggested_category: category,
    suggested_mode: null,
    language,
  };
}

export const FREE_TEXT_HINT = 'Tidak harus rapi. Tulis apa adanya.';

// ===== Alur voice AI (3 pertanyaan yang dibacakan AI) =====
// Bahasa tidak ditanyakan lewat suara — disetel belakangan di layar ringkasan.
export const VOICE_QUESTION_KEYS = ['mood', 'need', 'format'];

export const VOICE_QUESTIONS = INTAKE_QUESTIONS.filter((q) => VOICE_QUESTION_KEYS.includes(q.key));

// Kunci penyimpanan sementara antar layar (voice AI -> ringkasan). Bukan data permanen.
export const INTAKE_STORAGE_KEY = 'hearme:intake';

// Pencocokan jawaban suara -> nilai opsi (alur "voice ai interaktif").
// Aturan sederhana dan transparan — bukan diagnosis, hanya mengenali pilihan yang diucapkan.
const SPEECH_RULES = {
  mood: [
    { match: /(stres|tugas|penuh|deadline|ujian|tumpuk)/i, value: 'stres' },
    { match: /(sedih|kehilangan|menangis|patah hati|sepi)/i, value: 'sedih' },
    { match: /(lelah|capek|letih|berhenti|istirahat|lemas)/i, value: 'lelah' },
    { match: /(sulit dijelaskan|tidak tahu|bingung|gak bisa jelasin)/i, value: 'lainnya' },
  ],
  need: [
    { match: /(didengar|dengar|curhat|cerita|dengarkan)/i, value: 'didengarkan' },
    { match: /(pengalaman|senasib|sama seperti|berbagi|teman senasib)/i, value: 'berbagi_pengalaman' },
    { match: /(praktis|strategi|tips|cara|solusi|langkah)/i, value: 'strategi_praktis' },
    { match: /(profesional|psikolog|konselor|terapis|bantuan ahli)/i, value: 'bantuan_profesional' },
  ],
  format: [
    { match: /(grup|lingkaran|kelompok|rame|banyak orang|bareng)/i, value: 'group' },
    { match: /(berdua|1 on 1|satu satu|one on one|relawan|pribadi)/i, value: 'one_to_one' },
    { match: /(belum tahu|belum tau|bingung|terserah|belum kepikiran)/i, value: 'unsure' },
  ],
  language: [
    { match: /(english|inggris)/i, value: 'en' },
    { match: /(indonesia|bahasa)/i, value: 'id' },
  ],
};

// ===== Balasan percakapan (alur voice seperti ChatGPT voice) =====
// Satu kalimat tanggapan per jawaban, lalu AI langsung membacakan pertanyaan berikutnya.
// Berbasis aturan supaya tetap jalan tanpa API key — bukan diagnosis, hanya menanggapi.

export const ACKNOWLEDGEMENTS = {
  mood: {
    stres: 'Aku dengar — kepalamu sedang penuh. Terima kasih sudah bilang.',
    sedih: 'Sedih yang belum selesai memang berat. Aku di sini.',
    lelah: 'Lelah itu nyata. Kamu tidak harus kuat terus.',
    lainnya: 'Tidak apa-apa kalau sulit dijelaskan. Aku tetap mendengarkan.',
  },
  need: {
    didengarkan: 'Baik. Aku akan mendengarkan, tanpa menilai.',
    berbagi_pengalaman: 'Bertemu yang senasib sering meringankan.',
    strategi_praktis: 'Kita cari langkah kecil yang bisa kamu lakukan.',
    bantuan_profesional: 'Itu keputusan yang berani. Aku bantu arahkan.',
  },
  format: {
    group: 'Lingkaran kecil bisa terasa hangat.',
    one_to_one: 'Berdua dengan relawan. Aku carikan yang tepat.',
    unsure: 'Tidak apa-apa belum tahu. Kita lihat nanti.',
  },
};

export function acknowledgementFor(questionKey, value) {
  return ACKNOWLEDGEMENTS[questionKey]?.[value] || 'Aku dengar.';
}

// Kalimat pembuka sebelum pertanyaan pertama, dan penutup setelah pertanyaan terakhir.
export const VOICE_GREETING = 'Halo. Aku di sini menemanimu malam ini.';
export const VOICE_CLOSING =
  'Terima kasih sudah bercerita. Kata-katamu sudah tumbuh — aku siapkan langkah berikutnya.';

// Kalimat saat suara belum tertangkap (dipakai bergantian supaya tidak monoton).
export const VOICE_REPROMPTS = [
  'Aku belum menangkap suaramu. Coba ulangi pelan-pelan ya.',
  'Sepertinya belum terdengar. Bicara sedikit lebih dekat ke mikrofon, ya.',
];

export function matchOptionFromSpeech(questionKey, text) {
  const clean = (text || '').toLowerCase();
  if (!clean) return null;
  const rules = SPEECH_RULES[questionKey] || [];
  for (const rule of rules) {
    if (rule.match.test(clean)) return rule.value;
  }
  const question = INTAKE_QUESTIONS.find((q) => q.key === questionKey);
  if (!question) return null;
  for (const opt of question.options) {
    const words = opt.label
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    if (words.length && words.every((w) => clean.includes(w))) return opt.value;
  }
  return null;
}
