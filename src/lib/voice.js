// Suara untuk alur "voice AI interaktif" (diagram alur baru):
// AI membacakan pertanyaan (TTS) dan pengguna menjawab dengan suara (STT).
// Memakai Web Speech API bawaan browser — tanpa API key, tanpa mengirim audio ke server.
//
// Pelajaran nyata di Chrome/Windows (penting, pernah bikin mikrofon diam total):
// 1. speechSynthesis sering TIDAK memanggil onend — daftar voice belum siap, atau
//    cancel() dipanggil. Kalau kita menunggu onend untuk membuka mikrofon, mikrofon
//    tidak akan pernah terbuka. Karena itu speak() SELALU punya batas waktu.
// 2. SpeechRecognition butuh izin mikrofon. Tanpa izin, Chrome memanggil onerror
//    dengan 'not-allowed' dan tidak ada satu kata pun yang tertangkap. Izin diminta
//    lebih dulu lewat getUserMedia supaya sebabnya jelas dan bisa ditindaklanjuti.
// 3. Chrome bisa mengakhiri pengenalan sebelum kalimat selesai. Hasil yang sudah
//    terdengar (final maupun interim) harus tetap dipakai, bukan dibuang.
// 4. Kalau getVoices() masih kosong, speak() tidak menghasilkan suara sama sekali.
//    getVoices() dipanaskan lebih dulu dan utterance.voice dipilih kalau tersedia.

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function sttSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function stopSpeaking() {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // abaikan
  }
}

let lockedVoiceURI = null;
const VOICE_STORAGE_KEY = 'hearme_voice_uri';

export function getSavedVoiceURI() {
  if (lockedVoiceURI) return lockedVoiceURI;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const saved = window.sessionStorage.getItem(VOICE_STORAGE_KEY);
      if (saved) {
        lockedVoiceURI = saved;
        return saved;
      }
    } catch {
      // abaikan jika sessionStorage diblokir
    }
  }
  return null;
}

export function setSelectedVoiceURI(uri) {
  lockedVoiceURI = uri || null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (uri) window.sessionStorage.setItem(VOICE_STORAGE_KEY, uri);
      else window.sessionStorage.removeItem(VOICE_STORAGE_KEY);
    } catch {
      // abaikan
    }
  }
}

// Daftar voice bisa datang terlambat — panggil sekali saat halaman dibuka.
export function warmUpVoices() {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  } catch {
    // abaikan
  }
}

/**
 * Mengambil daftar voice Bahasa Indonesia yang tersedia di browser
 */
export function getAvailableVoices() {
  if (!ttsSupported()) return [];
  try {
    const all = window.speechSynthesis.getVoices() || [];
    return all.filter((v) => {
      const l = String(v.lang || '').toLowerCase();
      return l.startsWith('id') || l.includes('indonesia');
    });
  } catch {
    return [];
  }
}

/**
 * Pemilihan voice yang konsisten dan deterministik.
 * Sekali sebuah voice dipilih, voice tersebut disimpan agar TIDAK berubah-ubah antar-respons.
 */
function pickVoice(lang) {
  if (!ttsSupported()) return null;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    // 1. Jika sudah ada voice yang terkunci di sesi ini, selalu pakai voice tersebut
    const savedUri = getSavedVoiceURI();
    if (savedUri) {
      const exact = voices.find((v) => v.voiceURI === savedUri);
      if (exact) return exact;
    }

    const base = String(lang || 'id').slice(0, 2).toLowerCase();

    // 2. Filter voice bahasa target (Indonesia)
    const matching = voices.filter((v) => {
      const l = String(v.lang || '').toLowerCase();
      return l === base || l.startsWith(`${base}-`) || l.startsWith(base);
    });

    if (matching.length > 0) {
      // Urutkan secara deterministik berdasarkan kualitas suara
      const ranked = matching.sort((a, b) => {
        const score = (v) => {
          const name = String(v.name || '').toLowerCase();
          let s = 0;
          if (name.includes('google')) s += 10;
          if (name.includes('natural')) s += 8;
          if (name.includes('indonesia')) s += 5;
          if (name.includes('gadis') || name.includes('ardi')) s += 6;
          if (v.localService) s += 2;
          return s;
        };
        return score(b) - score(a);
      });

      const chosen = ranked[0];
      if (chosen?.voiceURI) {
        setSelectedVoiceURI(chosen.voiceURI);
      }
      return chosen;
    }

    // Fallback pertama jika tidak ada id-ID
    const defaultVoice = voices.find((v) => v.default) || voices[0] || null;
    if (defaultVoice?.voiceURI) {
      setSelectedVoiceURI(defaultVoice.voiceURI);
    }
    return defaultVoice;
  } catch {
    return null;
  }
}

// Bacakan teks. onEnd SELALU dipanggil — lewat onend, onerror, atau jaring pengaman.
// Ini yang membuat mikrofon tetap terbuka walau browser "lupa" memanggil onend.
// Jaring pengaman: (1) pantau speechSynthesis.speaking, (2) batas waktu mutlak.
// Mengembalikan fungsi pembatalan yang TIDAK memicu onEnd.
export function speak(text, { lang = 'id-ID', rate = 1.0, pitch = 1.0, onEnd, minMs = 900 } = {}) {
  if (!ttsSupported() || !text) {
    onEnd?.();
    return () => {};
  }
  stopSpeaking();

  let done = false;
  let timer = null;
  let poll = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (poll) clearInterval(poll);
    timer = null;
    poll = null;
  };
  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    onEnd?.();
  };

  // perkiraan durasi bicara + batas waktu mutlak
  const estimate = Math.min(22000, Math.max(minMs, String(text).length * 95));
  timer = setTimeout(finish, estimate + 4000);

  // Chrome kadang tidak memanggil onend. Pantau status bicara sebagai gantinya:
  // begitu speechSynthesis berhenti dan tidak ada antrean, bacaan dianggap selesai.
  let ticks = 0;
  poll = setInterval(() => {
    ticks += 1;
    try {
      const synth = window.speechSynthesis;
      if (ticks > 2 && !synth.speaking && !synth.pending) finish();
    } catch {
      finish();
    }
  }, 250);

  try {
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    try {
      const voice = pickVoice(lang);
      if (voice) utterance.voice = voice;
    } catch {
      // lanjut dengan voice bawaan jika gagal menetapkan
    }

    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  } catch {
    finish();
  }

  return () => {
    done = true;
    cleanup();
    stopSpeaking();
  };
}

let micPermissionGranted = false;

// Minta izin mikrofon lebih dulu (getUserMedia) supaya kegagalan punya sebab yang jelas.
// Bukan hanya soal izin: ini juga menyalakan indikator mikrofon di browser.
export async function ensureMicPermission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true, reason: 'unsupported' };
  }
  // Jika sudah pernah berhasil di sesi ini, tidak perlu mengunci hardware lagi
  if (micPermissionGranted) {
    return { ok: true };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // abaikan
      }
    });
    micPermissionGranted = true;
    return { ok: true };
  } catch (err) {
    micPermissionGranted = false;
    return { ok: false, reason: err?.name || 'Error' };
  }
}

// Kode error Web Speech API -> kalimat yang bisa ditindaklanjuti. null = jangan ditampilkan.
export function describeSpeechError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mikrofon belum diizinkan browser. Klik ikon kunci/mikrofon di bilah alamat, pilih Izinkan, lalu muat ulang halaman ini.';
    case 'audio-capture':
      return 'Mikrofon tidak terdeteksi. Pastikan ada mikrofon tersambung dan tidak sedang dipakai aplikasi lain.';
    case 'no-speech':
      return 'Belum ada suara yang terdengar. Coba bicara sedikit lebih dekat ke mikrofon.';
    case 'network':
      return 'Butuh koneksi internet untuk mengenali suaramu, dan sambungannya gagal. Periksa koneksi lalu coba lagi.';
    case 'aborted':
      return null;
    default:
      return 'Aku kehilangan suaramu tadi. Coba lagi ya.';
  }
}

// Nama error getUserMedia -> kalimat yang bisa ditindaklanjuti.
export function describeMicPermission(reason) {
  switch (reason) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Mikrofon diblokir untuk situs ini. Izinkan mikrofon di pengaturan browser (ikon kunci di bilah alamat), lalu muat ulang halaman.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Tidak ada mikrofon yang terdeteksi di perangkat ini.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.';
    default:
      return 'Mikrofon tidak bisa dibuka. Coba lagi ya.';
  }
}

// Pengenal suara dengan state-machine yang aman dari race condition
export function createRecognizer({ lang = 'id-ID', continuous = true, onResult, onEnd, onError } = {}) {
  if (!sttSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = continuous;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let lastInterim = '';
  let cancelled = false;
  let isRunning = false;
  let isStopping = false;

  recognition.onstart = () => {
    isRunning = true;
    isStopping = false;
  };

  recognition.onresult = (event) => {
    let finalStr = '';
    let interimStr = '';
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      const chunk = result[0]?.transcript || '';
      if (result.isFinal) {
        finalStr = `${finalStr} ${chunk}`.trim();
      } else {
        interimStr = `${interimStr} ${chunk}`.trim();
      }
    }
    finalText = finalStr;
    lastInterim = interimStr;
    const combined = `${finalText} ${lastInterim}`.trim();
    onResult?.({
      finalText,
      interim: lastInterim,
      transcript: combined,
    });
  };

  recognition.onerror = (event) => {
    isRunning = false;
    isStopping = false;
    onError?.(event);
  };

  recognition.onend = () => {
    isRunning = false;
    isStopping = false;
    if (cancelled) return;
    onEnd?.({ transcript: `${finalText} ${lastInterim}`.trim() });
  };

  return {
    start() {
      if (isRunning || isStopping) return;
      cancelled = false;
      try {
        recognition.start();
      } catch (err) {
        // Tangani jika browser melempar exception karena state internal
        if (err?.name !== 'InvalidStateError') {
          throw err;
        }
      }
    },
    // stop(): pengenalan ditutup wajar, transkrip tetap dikirim lewat onEnd.
    stop() {
      if (!isRunning || isStopping) return;
      isStopping = true;
      try {
        recognition.stop();
      } catch {
        // abaikan
      }
    },
    // abort(): dibatalkan sengaja, onEnd tidak dipanggil.
    abort() {
      cancelled = true;
      isRunning = false;
      isStopping = false;
      try {
        recognition.abort();
      } catch {
        // abaikan
      }
    },
    get isRunning() {
      return isRunning;
    },
  };
}
