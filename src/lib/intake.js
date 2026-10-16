// Ringkasan kebutuhan berbasis aturan (fallback tanpa API) + parser ringkasan LLM.
// Nada bahasa: hangat dan adaptif sesuai waktu — singkat dan puitis, bukan kuesioner klinis.
import { getTimeGreeting, getVoiceGreeting } from './time.js';

export { getTimeGreeting, getVoiceGreeting };

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

import { findRelevantJournals } from './journalKnowledge.js';

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

  const userStory = answers.raw_mood || answers.story || '';
  const searchContext = (userStory ? `${userStory} ` : '') + (answers.mood || '') + ' ' + (answers.need || '');
  const relevant = findRelevantJournals(searchContext, answers.need);

  const evidenceMap = {
    stres: 'Studi JMIR (2024) menemukan bahwa intervensi sebaya daring efektif mereduksi distres akademik mahasiswa sebelum berujung kecemasan berat.',
    sedih: 'Prinsip trauma-informed care (SAMHSA/JMIR) menegaskan bahwa validasi emosi tanpa penghakiman mempercepat pemulihan rasa duka.',
    lelah: 'Penelitian kesehatan mahasiswa menunjukkan istirahat terencana dan pelepasan beban kognitif krusial mencegah kelelahan mental kronis (burnout).',
    lainnya: 'Penelitian literatur LLM & kesehatan mental menekankan pentingnya ruang aman berbatas etis untuk mengekspresikan perasaan yang kompleks.',
  };

  const copingMap = {
    stres: 'Lakukan teknik pernapasan 4-7-8 sejenak, lalu urai tugas menjadi langkah-langkah kecil.',
    sedih: 'Izinkan dirimu merasakan emosi ini tanpa menyalahkan diri sendiri. Bercerita pada rekan sebaya dapat meringankan beban.',
    lelah: 'Beri jeda tanpa layar selama 15 menit, cukupi hidrasi, dan jangan paksakan mengambil keputusan besar malam ini.',
    lainnya: 'Tuangkan pikiran bebas ke dalam tulisan tanpa menyunting, lalu pilih lingkaran pendamping untuk mendengarkan.',
  };

  const summary = userStory
    ? `Malam ini kamu bercerita: "${userStory.slice(0, 180)}". Kebutuhan utama: ${need}. Preferensi awal: ${format}.`
    : `Malam ini, pengguna ${mood}. Yang paling dibutuhkan: ${need}. Preferensi awal: ${format}. Bahasa: ${answers.language === 'en' ? 'Inggris' : 'Indonesia'}.`;

  return {
    summary,
    suggested_category: answers.need || 'didengarkan',
    suggested_mode: answers.format === 'unsure' ? null : answers.format || null,
    evidence_note: evidenceMap[answers.mood] || 'Dukungan sebaya dini terbukti efektif menjaga resiliensi mental mahasiswa.',
    coping_suggestion: copingMap[answers.mood] || 'Tarik napas dalam, dan temukan teman bicara yang aman malam ini.',
    cited_papers: relevant.map((j) => j.title),
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

  const relevant = findRelevantJournals(clean, category);

  return {
    summary: `Malam ini, pengguna menulis: "${clean.slice(0, 240)}". Kebutuhan utama terdeteksi: ${category.replaceAll('_', ' ')}. Bahasa: ${language === 'en' ? 'Inggris' : 'Indonesia'}.`,
    suggested_category: category,
    suggested_mode: null,
    evidence_note: 'Berdasarkan telaah sistematis kesehatan mental mahasiswa, mengungkapkan beban pikiran pada fase awal menurunkan risiko keparahan psikologis.',
    coping_suggestion: 'Pilihlah format teman bicara yang paling nyaman untukmu dan izinkan dirimu beristirahat.',
    cited_papers: relevant.map((j) => j.title),
    language,
  };
}

export const FREE_TEXT_HINT = 'Tidak harus rapi. Tulis apa adanya.';

// ===== Alur voice AI (3 pertanyaan yang dibacakan AI) =====
// Bahasa tidak ditanyakan lewat suara — disetel belakangan di layar ringkasan.
export const VOICE_QUESTION_KEYS = ['mood', 'need', 'format'];

export const VOICE_QUESTIONS = INTAKE_QUESTIONS.filter((q) => VOICE_QUESTION_KEYS.includes(q.key));

/**
 * Menghasilkan pertanyaan Voice AI yang dinamis dan menyesuaikan waktu riil (pagi, siang, sore, malam)
 */
export function getAdaptiveVoiceQuestions(date = new Date()) {
  const time = getTimeGreeting(date).toLowerCase();
  const timeCap = getTimeGreeting(date);

  return [
    {
      key: 'mood',
      question: `${timeCap} ini, apa yang paling berat?`,
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
      question: `Melewati ${time} ini dengan cara apa?`,
      helper: 'Bisa berubah pikiran kapan saja.',
      options: [
        { value: 'group', label: 'Lingkaran kecil — 3–4 orang' },
        { value: 'one_to_one', label: 'Berdua dengan relawan' },
        { value: 'unsure', label: 'Belum tahu' },
      ],
    },
  ];
}

// Kunci penyimpanan sementara antar layar (voice AI -> ringkasan). Bukan data permanen.
export const INTAKE_STORAGE_KEY = 'hearme:intake';

// Pencocokan jawaban suara -> nilai opsi (alur "voice ai interaktif").
// Aturan sederhana dan transparan — bukan diagnosis, hanya mengenali pilihan yang diucapkan.
const SPEECH_RULES = {
  mood: [
    {
      match: /(stres|stress|tugas|deadline|ujian|sidang|skripsi|kuliah|revisi|dosen|mumet|pusing|penuh|overthinking|beban|panik|cemas|takut|tekanan|tumpuk|banyak pikiran|kepikiran|kacau|ancur|hancur|overwhelm|overwhelmed|tegang)/i,
      value: 'stres',
    },
    {
      match: /(sedih|nangis|menangis|kehilangan|patah hati|patah|sepi|kesepian|sendiri|sendirian|hampa|galau|kecewa|terluka|down|rapuh|berduka|drop|putus|ditinggal|merana)/i,
      value: 'sedih',
    },
    {
      match: /(lelah|capek|cape|letih|burnout|burn out|penat|jenuh|bosan|pengen rehat|istirahat|tidur|berhenti|lemas|lemes|habis energi|tenaga habis|drop fisik|loyo|pegal|cape bgt|capek bgt)/i,
      value: 'lelah',
    },
    {
      match: /(sulit|bingung|campur aduk|tidak tahu|gak tau|gatau|nggak tau|entah|aneh|kebal|mati rasa|ga jelas|nggak jelas|sulit dijelaskan|bimbang|blank|kosong)/i,
      value: 'lainnya',
    },
  ],
  need: [
    {
      match: /(didengar|dengar|curhat|cerita|dengarkan|unek-unek|keluh kesah|butuh teman bicara|validasi|tanpa dinilai|tanpa dihakimi|ngobrol|bicara|dengerin|nemani|menemani|nemenin|ditemani|temani aku|jangan sendiri)/i,
      value: 'didengarkan',
    },
    {
      match: /(pengalaman|senasib|relate|sama seperti|berbagi|teman senasib|sharing|rekan|saling menguatkan|diskusi|tukar pikiran)/i,
      value: 'berbagi_pengalaman',
    },
    {
      match: /(praktis|strategi|tips|solusi|langkah|cara|arah|harus ngapain|jalan keluar|rekomendasi|bantuan langkah|action)/i,
      value: 'strategi_praktis',
    },
    {
      match: /(profesional|psikolog|konselor|konseling|terapis|ahli|medis|psikiater|klinis|bantuan serius|rujukan)/i,
      value: 'bantuan_profesional',
    },
  ],
  format: [
    {
      match: /(grup|group|lingkaran|kelompok|rame|ramai|banyak orang|bareng|circle|komunitas|bertiga|berempat|bareng-bareng)/i,
      value: 'group',
    },
    {
      match: /(berdua|1 on 1|one on one|satu satu|privat|private|relawan|sendirian|personal|dua orang|sendiri saja)/i,
      value: 'one_to_one',
    },
    {
      match: /(belum tahu|belum tau|bingung|terserah|bebas|mana saja|mana aja|ikut aja|belum kepikiran|ragu)/i,
      value: 'unsure',
    },
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
    stres: 'Aku menangkap kepalamu sedang penuh dan stres. Terima kasih sudah mengutarakannya.',
    sedih: 'Aku mendengar rasa sedihmu. Tidak apa-apa, kamu aman bercerita di sini.',
    lelah: 'Aku mengerti kamu sangat lelah. Kamu tidak harus memaksakan diri malam ini.',
    lainnya: 'Perasaan yang rumit itu wajar. Aku tetap di sini mendengarkanmu.',
  },
  need: {
    didengarkan: 'Baik, aku menangkap kamu ingin didengarkan tanpa dihakimi.',
    berbagi_pengalaman: 'Mengobrol dengan teman yang senasib seringkali sangat melegakan.',
    strategi_praktis: 'Dipahami, kita akan fokus mencari langkah-langkah praktis bersama.',
    bantuan_profesional: 'Pilihan yang sangat bijak. Aku bantu siapkan rujukan profesional.',
  },
  format: {
    group: 'Lingkaran kecil bersama 3–4 teman akan menemanimu.',
    one_to_one: 'Sesi pribadi berdua dengan relawan pendamping.',
    unsure: 'Tidak apa-apa belum yakin, nanti kamu bisa memilih kembali.',
  },
};

export function acknowledgementFor(questionKey, value) {
  return ACKNOWLEDGEMENTS[questionKey]?.[value] || 'Aku mendengar ceritamu.';
}

// Kalimat pembuka sebelum pertanyaan pertama, dan penutup setelah pertanyaan terakhir.
export const VOICE_GREETING = 'Halo. Aku di sini menemanimu malam ini.';
export const VOICE_CLOSING =
  'Terima kasih sudah bercerita. Kata-katamu sudah tumbuh — aku siapkan langkah berikutnya.';

// Kalimat saat suara belum tertangkap (dipakai bergantian supaya tidak monoton).
export const VOICE_REPROMPTS = [
  'Aku belum menangkap suaramu dengan jelas. Coba ulangi pelan-pelan ya.',
  'Sepertinya suaramu belum terdengar. Kamu juga bisa mengetuk salah satu opsi di layar jika lebih nyaman.',
];

// ==============================================================================
// AI VOICE ASSISTANT INTAKE ENGINE
// ==============================================================================

export const AI_VOICE_SYSTEM_PROMPT = `
# ROLE AND OBJECTIVE
Kamu adalah AI Voice Assistant yang dirancang untuk berinteraksi langsung melalui percakapan suara (Voice-to-Voice). Tugas utamanya adalah berkomunikasi dengan pengguna secara natural, responsif, dan konsisten.

# STT ERROR HANDLING & TOLERANCE (CRITICAL)
1. Input teks yang kamu terima berasal dari modul Speech-to-Text (STT). Input ini sering kali mengandung:
   - Kesalahan dengar fonetik (misal: "lu" dibaca "luar", "mau" dibaca "kau", "web" dibaca "wep").
   - Kesalahan ejaan, typo, tanda baca yang hilang, atau kalimat yang menggantung/terpotong.
2. JANGAN langsung menolak atau bingung jika teks terlihat berantakan. 
3. Gunakan riwayat percakapan sebelumnya (Context History) untuk MENEBAK dan MENYIMPULKAN maksud sebenarnya dari kata-kata yang salah dengar tersebut.
4. Jika maksud pengguna masih bisa dipahami secara logis dari konteksnya, langsung jawab pertanyaan tersebut seolah-olah teks inputnya normal. Jangan mengoreksi typo pengguna kecuali diminta.

# VOICE CONVERSATION STYLE & CONSISTENCY
1. **Pendek & Ringkas:** Jawab dengan singkat, padat, dan langsung ke inti masalah. Batasi jawaban maksimal 2 hingga 3 kalimat saja agar nyaman didengar saat diubah kembali menjadi suara.
2. **Bahasa:** Gunakan bahasa Indonesia yang santai, kasual, tapi tetap sopan dan profesional (sesuaikan dengan gaya bicara pengguna, termasuk jika pengguna menggunakan bahasa campuran/Indish).
3. **Format Tanpa Visual:** Hindari penggunaan format markdown yang rumit seperti bullet points (*), tabel, bold (**), atau kode blok, kecuali pengguna memintanya. Struktur jawabanmu agar mengalir seperti cara manusia berbicara.

# CONTEXT PRESERVATION
Selalu perhatikan alur obrolan dari history sebelumnya. Jangan berikan jawaban yang kontradiktif dengan apa yang sudah kamu katakan di pesan-pesan sebelumnya. Tetap konsisten pada persona dan informasi yang telah disepakati.
`.trim();

/**
 * Normalisasi kesalahan dengar fonetik STT, typo, slang, dan kalimat menggantung.
 * Menoleransi kesalahan tanpa menolak pengguna.
 */
export function normalizeSttInput(rawText = '', questionKey = '', history = []) {
  let text = String(rawText || '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  // 1. Pemetaan kesalahan dengar fonetik umum (STT phonetics)
  const PHONETIC_MAP = [
    // Contoh eksplisit dari instruksi
    [/\bluar\b/g, 'lu'],
    [/\bkau\b/g, 'mau'],
    [/\bwep\b/g, 'web'],
    // Kata-kata kampus / curhat umum yang sering salah tangkap oleh STT
    [/\bkpk\b/g, 'capek'],
    [/\b(deline|detlen|dateline|dedlen|detline)\b/g, 'deadline'],
    [/\b(kripsi|skripshit|skrip)\b/g, 'skripsi'],
    [/\b(tres|setres|setress|strees)\b/g, 'stres'],
    [/\b(surat|curat)\b/g, 'curhat'],
    [/\b(kedua|ber dua)\b/g, 'berdua'],
    [/\b(drop|grup kecil)\b/g, 'grup'],
    [/\b(bener|dibenerin|didenger|di denger)\b/g, 'didengarkan'],
    [/\b(nemenin|temenin)\b/g, 'menemani'],
    [/\b(ga|gak|ngga|nggak|nda|ndak)\s*tau\b/g, 'tidak tahu'],
    [/\b(cape|cpek|capek bgt|cape bgt)\b/g, 'lelah'],
    [/\b(overthingking|overtingking|operthinking)\b/g, 'overthinking'],
  ];

  for (const [pattern, replacement] of PHONETIC_MAP) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

/**
 * Menebak dan menyimpulkan maksud pengguna berdasarkan teks + riwayat percakapan.
 */
export function matchOptionFromSpeech(questionKey, text, history = [], answers = {}) {
  const normalized = normalizeSttInput(text, questionKey, history);
  if (!normalized) return null;

  const rules = SPEECH_RULES[questionKey] || [];
  let bestMatch = null;
  let highestScore = 0;

  for (const rule of rules) {
    const matches = normalized.match(new RegExp(rule.match.source, 'gi'));
    if (!matches) continue;
    if (matches.length > highestScore) {
      highestScore = matches.length;
      bestMatch = rule.value;
    }
  }

  if (bestMatch) return bestMatch;

  // Pencocokan label pertanyaan
  const question = INTAKE_QUESTIONS.find((q) => q.key === questionKey);
  if (question) {
    for (const opt of question.options) {
      const words = opt.label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3);
      const count = words.filter((w) => normalized.includes(w)).length;
      if (count > 0 && count > highestScore) {
        highestScore = count;
        bestMatch = opt.value;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // Inferensi berbasis konteks history (STT error tolerance)
  // Jika pengguna sudah bicara (>= 3 karakter), jangan tolak!
  if (normalized.length >= 3) {
    if (questionKey === 'mood') {
      // Cek apakah ada indikasi lelah fisik vs stres pikiran vs sedih
      if (/tidur|istirahat|badan|energi|tenaga|drop/i.test(normalized)) return 'lelah';
      if (/tangis|nangis|air mata|sendiri|sepi|kecewa/i.test(normalized)) return 'sedih';
      if (/kuliah|tugas|kampus|otak|pusing|mumet/i.test(normalized)) return 'stres';
      return 'lainnya';
    }
    if (questionKey === 'need') {
      if (/orang|teman|rekan|senasib|cerita/i.test(normalized)) return 'didengarkan';
      if (/tips|cara|solusi|harus/i.test(normalized)) return 'strategi_praktis';
      if (/dokter|ahli|konsul/i.test(normalized)) return 'bantuan_profesional';
      return 'didengarkan';
    }
    if (questionKey === 'format') {
      if (/sendiri|berdua|personal|privat|satu/i.test(normalized)) return 'one_to_one';
      if (/banyak|rame|lingkaran|bareng/i.test(normalized)) return 'group';
      return 'unsure';
    }
  }

  return null;
}

/**
 * Hasilkan balasan suara AI yang:
 * 1. Pendek & Ringkas (2-3 kalimat saja).
 * 2. Kasual, santai, tapi tetap sopan dan empatik.
 * 3. 100% bebas markdown visual (*, **, _, #, bullet point).
 * 4. Mengalir konsisten dengan riwayat percakapan.
 */
export function generateVoiceReply({ questionKey, value, rawText = '', nextQuestion = null }) {
  const clean = String(rawText || '').trim();

  let reply = '';
  if (questionKey === 'mood') {
    if (value === 'stres') {
      reply = clean.length > 10
        ? `Aku menangkap kepalamu lagi penuh dan stres karena ${clean.slice(0, 80)}. Wajar banget merasa terbebani malam ini.`
        : 'Aku menangkap kepalamu lagi penuh dan stres banget malam ini. Wajar kalau rasanya berat.';
    } else if (value === 'sedih') {
      reply = 'Aku mendengar rasa sedihmu malam ini. Tidak apa-apa, kamu aman dan tidak perlu menahan semuanya sendirian di sini.';
    } else if (value === 'lelah') {
      reply = 'Aku paham kamu sangat lelah dan energinya sudah terkuras. Istirahatkan pikiranmu sejenak, jangan dipaksa dulu ya.';
    } else {
      reply = 'Perasaan yang campur aduk itu wajar banget. Aku tetap di sini menemani dan mendengarkanmu.';
    }
  } else if (questionKey === 'need') {
    if (value === 'didengarkan') {
      reply = 'Baik, kamu hanya ingin didengarkan dengan tenang tanpa dihakimi. Aku pastikan ruang ini nyaman untuk itu.';
    } else if (value === 'berbagi_pengalaman') {
      reply = 'Mengobrol bareng teman yang merasakan hal serupa memang sering kali bikin jauh lebih lega.';
    } else if (value === 'strategi_praktis') {
      reply = 'Dipahami, nanti kita bisa cari langkah praktis kecil yang bisa kamu ambil tanpa terburu-buru.';
    } else {
      reply = 'Pilihan yang sangat bijak. Mengetahui kapan butuh bantuan profesional itu langkah yang luar biasa.';
    }
  } else if (questionKey === 'format') {
    if (value === 'group') {
      reply = 'Lingkaran kecil bersama tiga sampai empat teman sebaya akan siap menemanimu malam ini.';
    } else if (value === 'one_to_one') {
      reply = 'Sesi berdua ditemani relawan terlatih akan segera disiapkan khusus untukmu.';
    } else {
      reply = 'Tidak apa-apa kalau belum yakin sekarang, kamu selalu bisa memilih atau mengubahnya nanti.';
    }
  } else {
    reply = 'Terima kasih sudah membagikannya padaku.';
  }

  // Sambungkan langsung dengan pertanyaan berikutnya (mengalir tanpa format visual)
  if (nextQuestion) {
    return `${reply} ${nextQuestion}`;
  }
  return `${reply} ${VOICE_CLOSING}`;
}

/**
 * Memproses 1 giliran percakapan suara secara menyeluruh dengan STT Error Tolerance & Context Deduction.
 */
export function processVoiceTurn({ text, questionKey, history = [], answers = {}, nextQuestion = null }) {
  const normalized = normalizeSttInput(text, questionKey, history);
  const detectedValue = matchOptionFromSpeech(questionKey, normalized, history, answers);

  // Jika benar-benar kosong atau suara belum masuk
  if (!detectedValue) {
    return {
      ok: false,
      value: null,
      spokenReply: 'Aku belum menangkap maksudmu dengan jelas. Boleh ceritakan lagi sedikit lebih pelan?',
      normalizedText: normalized,
    };
  }

  const spokenReply = generateVoiceReply({
    questionKey,
    value: detectedValue,
    rawText: text,
    nextQuestion,
  });

  return {
    ok: true,
    value: detectedValue,
    spokenReply,
    normalizedText: normalized,
  };
}
