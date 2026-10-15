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

function pickVoice(lang) {
  if (!ttsSupported()) return null;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const base = String(lang || 'id').slice(0, 2).toLowerCase();
    return (
      voices.find((v) => String(v.lang || '').toLowerCase() === base) ||
      voices.find((v) => String(v.lang || '').toLowerCase().startsWith(base)) ||
      null
    );
  } catch {
    return null;
  }
}

// Bacakan teks. onEnd SELALU dipanggil — lewat onend, onerror, atau jaring pengaman.
// Ini yang membuat mikrofon tetap terbuka walau browser "lupa" memanggil onend.
// Jaring pengaman: (1) pantau speechSynthesis.speaking, (2) batas waktu mutlak.
// Mengembalikan fungsi pembatalan yang TIDAK memicu onEnd.
export function speak(text, { lang = 'id-ID', rate = 1, pitch = 1, onEnd, minMs = 900 } = {}) {
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
  const estimate = Math.min(20000, Math.max(minMs, String(text).length * 95));
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
    // Penetapan voice punya try sendiri: kalau gagal (objek voice tidak dikenali
    // browser), bicara tetap jalan dengan voice bawaan. Kalau digabung dengan
    // try utama, satu kegagalan di sini membatalkan seluruh ucapan dalam diam.
    try {
      const voice = pickVoice(lang);
      if (voice) utterance.voice = voice;
    } catch {
      // lanjut dengan voice bawaan
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

// Minta izin mikrofon lebih dulu (getUserMedia) supaya kegagalan punya sebab yang jelas.
// Bukan hanya soal izin: ini juga menyalakan indikator mikrofon di browser.
export async function ensureMicPermission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true, reason: 'unsupported' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
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

// Pengenal suara. continuous=true supaya kalimat panjang tidak terpotong di tengah;
// transkrip terakhir (final maupun interim) selalu dikirim saat pengenalan berakhir,
// jadi ucapan yang sudah terdengar tidak hilang begitu saja.
// Pemanggil yang menentukan kapan giliran bicara selesai (mis. lewat deteksi hening).
export function createRecognizer({ lang = 'id-ID', continuous = true, onResult, onEnd, onError } = {}) {
  if (!sttSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = continuous;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let interimText = '';
  let cancelled = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const chunk = result[0]?.transcript || '';
      if (result.isFinal) finalText = `${finalText} ${chunk}`.trim();
      else interimText = chunk.trim();
    }
    onResult?.({
      finalText: finalText.trim(),
      interim: interimText,
      transcript: `${finalText} ${interimText}`.trim(),
    });
  };

  recognition.onerror = (event) => onError?.(event);

  recognition.onend = () => {
    if (cancelled) return;
    onEnd?.({ transcript: `${finalText} ${interimText}`.trim() });
  };

  return {
    start() {
      recognition.start();
    },
    // stop(): pengenalan ditutup wajar, transkrip tetap dikirim lewat onEnd.
    stop() {
      try {
        recognition.stop();
      } catch {
        // abaikan
      }
    },
    // abort(): dibatalkan sengaja, onEnd tidak dipanggil.
    abort() {
      cancelled = true;
      try {
        recognition.abort();
      } catch {
        // abaikan
      }
    },
  };
}
