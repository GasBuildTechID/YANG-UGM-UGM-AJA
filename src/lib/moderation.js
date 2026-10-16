// Modul moderasi chat otomatis (Bahasa Indonesia)
// Menyaring kata-kata tidak pantas, umpatan, ujaran kebencian, pelecehan, dan kekerasan.
// Menghasilkan teks yang disensor dengan karakter bintang (***) dan memberikan status keamanan.

const INDONESIAN_BAD_WORDS = [
  // Makian & kata kotor umum
  'anjing', 'anjir', 'anjay', 'anying', 'asw', 'asu',
  'babi', 'bangsat', 'bgsat', 'bajingan', 'bjingan',
  'kontol', 'kntol', 'kntl', 'titit', 'peler', 'pelor', 'jembut',
  'memek', 'mmk', 'pepek', 'pantek', 'puki', 'pukimak', 'itil',
  'ngentot', 'ngentot', 'ngewe', 'ewe', 'coly', 'coli',
  'jancok', 'jancuk', 'dancok', 'cok', 'cuk',
  'goblok', 'goblk', 'goblokkk', 'tolol', 'tlol', 'bego', 'idiot', 'bloon', 'belegug',
  'tai', 'taek', 'tae', 'berak',
  'lonte', 'perek', 'pelacur', 'bispak', 'jablay',
  'kampret', 'brengsek', 'brngsk', 'keparat', 'monyet', 'sialan', 'setan', 'iblis',

  // Pelecehan seksual & kekerasan eksplisit
  'perkosa', 'memperkosa', 'pemerkosa', 'bacok', 'gorok', 'mutilasi', 'bantai',
  'sange', 'bokep', 'porn', 'porno', 'tetek', 'toket'
];

// Mapping karakter leetspeak / penggantian umum
const LEET_REPLACEMENTS = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
};

/**
 * Normalisasi teks untuk deteksi variasi leetspeak (misal: "k0nt0l" -> "kontol")
 */
function normalizeText(text) {
  if (!text) return '';
  let normalized = text.toLowerCase();
  for (const [char, replacement] of Object.entries(LEET_REPLACEMENTS)) {
    normalized = normalized.replaceAll(char, replacement);
  }
  // Hapus karakter pemisah berulang di tengah kata (misal: "k.o.n.t.o.l" atau "k-o-n-t-o-l")
  return normalized;
}

/**
 * Buat Regex yang menangkap kata kasar dengan variasi batas kata dan pengulangan huruf
 */
function buildPattern(word) {
  // Karakter bisa berulang, misal: "gooooobloook"
  const chars = word.split('').map((c) => `${c}+`).join('[^a-zA-Z0-9]?');
  return new RegExp(`\\b${chars}\\b`, 'gi');
}

// Kompilasi regex patterns
const BAD_WORD_PATTERNS = INDONESIAN_BAD_WORDS.map((word) => ({
  word,
  regex: buildPattern(word),
}));

/**
 * Sensor kata dengan bintang (*), mempertahankan huruf pertama & terakhir jika kata cukup panjang,
 * atau ganti seluruhnya dengan bintang jika pendek.
 */
function maskWord(word) {
  const len = word.length;
  if (len <= 2) return '*'.repeat(len);
  if (len === 3) return `${word[0]}*${word[2]}`;
  return `${word[0]}${'*'.repeat(len - 2)}${word[len - 1]}`;
}

/**
 * Sensor otomatis seluruh kata kasar dalam teks
 * @param {string} text
 * @returns {string} teks yang telah disensor
 */
export function censorProfanity(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  // Lakukan penyaringan berbasis kata
  for (const { regex } of BAD_WORD_PATTERNS) {
    result = result.replace(regex, (matched) => maskWord(matched));
  }

  return result;
}

/**
 * Periksa status moderasi teks
 * @param {string} text
 * @returns {{ isClean: boolean, cleanText: string, flaggedWords: string[], warningMessage: string | null }}
 */
export function checkModeration(text) {
  if (!text || typeof text !== 'string') {
    return { isClean: true, cleanText: '', flaggedWords: [], warningMessage: null };
  }

  const normalized = normalizeText(text);
  const flagged = [];

  for (const { word, regex } of BAD_WORD_PATTERNS) {
    if (regex.test(text) || regex.test(normalized)) {
      flagged.push(word);
    }
  }

  const isClean = flagged.length === 0;
  const cleanText = isClean ? text : censorProfanity(text);

  return {
    isClean,
    cleanText,
    flaggedWords: flagged,
    warningMessage: isClean
      ? null
      : 'Pesanmu disensor otomatis agar ruang obrolan tetap aman dan nyaman bagi semua teman.',
  };
}

