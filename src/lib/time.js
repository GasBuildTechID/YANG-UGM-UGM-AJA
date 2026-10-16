/**
 * Logika penentuan sapaan waktu berbasis jam lokal aktual (real-time).
 *
 * Pembagian rentang waktu:
 * - 04:00 - 10:59: Pagi
 * - 11:00 - 14:59: Siang
 * - 15:00 - 18:29: Sore
 * - 18:30 - 03:59: Malam
 */

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const totalMinutes = hour * 60 + minute;

  // 04:00 s/d 10:59 -> Pagi
  if (totalMinutes >= 240 && totalMinutes < 660) {
    return 'Pagi';
  }
  // 11:00 s/d 14:59 -> Siang
  if (totalMinutes >= 660 && totalMinutes < 900) {
    return 'Siang';
  }
  // 15:00 s/d 18:29 -> Sore
  if (totalMinutes >= 900 && totalMinutes < 1110) {
    return 'Sore';
  }
  // 18:30 s/d 03:59 -> Malam
  return 'Malam';
}

/**
 * Kalimat sapaan pembuka hero landing page
 */
export function getHeroGreeting(date = new Date()) {
  return `${getTimeGreeting(date)} ini terasa berat?`;
}

/**
 * Sapaan suara untuk Voice AI saat sesi dimulai
 */
export function getVoiceGreeting(date = new Date()) {
  const time = getTimeGreeting(date).toLowerCase();
  return `Halo, selamat ${time}. Aku di sini menemanimu saat ini.`;
}

