/**
 * HEARME — DEPLOYMENT & INTEGRATION TEST SUITE
 * Memverifikasi integritas arsitektur deployment, route handlers, validasi keamanan,
 * sensor moderasi pesan, serta logika waktu adaptif.
 */

import fs from 'fs';
import path from 'path';
import { GET as healthHandler } from '../src/app/api/health/route.js';
import { checkModeration, censorProfanity } from '../src/lib/moderation.js';
import { getTimeGreeting, getHeroGreeting, getVoiceGreeting } from '../src/lib/time.js';
import { getAdaptiveVoiceQuestions } from '../src/lib/intake.js';
import { isSupabaseConfigured, supabaseUrl, supabaseKey } from '../src/lib/supabase/env.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 MENJALANKAN AUDIT & PENGUJIAN INTEGRASI DEPLOYMENT');
  console.log('======================================================\n');

  // 1. Health Check Endpoint Test
  console.log('▶ [1/6] Menguji Endpoint Health Check (/api/health)...');
  try {
    const res = await healthHandler();
    const json = await res.json();
    assert(res.status === 200, 'Health check mengembalikan HTTP 200');
    assert(json.status === 'ok', "Status payload bernilai 'ok'");
    assert(json.service === 'hearme-api', 'Nama service teridentifikasi dengan benar');
    assert(typeof json.uptime === 'number', 'Uptime berupa angka yang valid');
    assert(json.integrations && json.integrations.supabase, 'Status integrasi Supabase dilaporkan');
  } catch (err) {
    assert(false, `Error saat menguji health check: ${err.message}`);
  }

  // 2. Secret & Environment Security Check
  console.log('\n▶ [2/6] Memverifikasi Keamanan Secret & File Environment...');
  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    assert(gitignore.includes('.env*.local') || gitignore.includes('.env.local'), '.gitignore memblokir file rahasia lokal (.env.local)');
    assert(fs.existsSync('.env.example'), 'Template .env.example tersedia untuk deployment Vercel');
    
    const envExample = fs.readFileSync('.env.example', 'utf8');
    assert(!envExample.includes('eyJh') && !envExample.includes('sb_secret'), '.env.example bersih dari secret nyata (tidak bocor)');
    assert(envExample.includes('NEXT_PUBLIC_SUPABASE_URL'), '.env.example mendokumentasikan NEXT_PUBLIC_SUPABASE_URL');
  } catch (err) {
    assert(false, `Error saat memverifikasi keamanan file env: ${err.message}`);
  }

  // 3. Database Environment Validation Invariant
  console.log('\n▶ [3/6] Menguji Validasi Konfigurasi Supabase Client...');
  try {
    const hasConfig = isSupabaseConfigured();
    assert(typeof hasConfig === 'boolean', 'isSupabaseConfigured() menghasilkan boolean yang valid');
    const url = supabaseUrl();
    assert(typeof url === 'string', 'supabaseUrl() menghasilkan string aman');
  } catch (err) {
    assert(false, `Error saat menguji Supabase env: ${err.message}`);
  }

  // 4. Automated Chat Moderation & Sensor Test
  console.log('\n▶ [4/6] Menguji Sensor Moderasi Pesan Chat Otomatis...');
  const toxicSample = 'halo anjing kamu jangan ngomong kasar goblok';
  const cleanSample = 'terima kasih banyak sudah mendengarkan ceritaku hari ini';

  const modToxic = checkModeration(toxicSample);
  assert(!modToxic.isClean, 'Mendeteksi kata tidak pantas / kasar');
  assert(modToxic.flaggedWords.length >= 2, 'Mengidentifikasi seluruh kata kasar yang terkandung');

  const censoredText = censorProfanity(toxicSample);
  assert(!censoredText.includes('anjing') && !censoredText.includes('goblok'), 'Kata kasar berhasil disensor dengan tanda bintang');

  const modClean = checkModeration(cleanSample);
  assert(modClean.isClean, 'Pesan bersih dan sopan lolos tanpa sensor');

  // 5. Real-time Adaptive Greeting Test
  console.log('\n▶ [5/6] Menguji Logika Salam Berbasis Waktu Nyata...');
  const slots = [
    { h: 7, expected: 'Pagi' },
    { h: 13, expected: 'Siang' },
    { h: 16, expected: 'Sore' },
    { h: 21, expected: 'Malam' },
  ];

  slots.forEach(({ h, expected }) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    const greeting = getTimeGreeting(d);
    assert(greeting === expected, `Pukul ${h}:00 terdeteksi sebagai sapaan '${expected}'`);
  });

  const heroMalam = getHeroGreeting(new Date(2026, 9, 16, 21, 0));
  assert(heroMalam === 'Malam ini terasa berat?', 'Judul hero malam terformat dengan tepat');

  // 6. Adaptive Voice Questions Invariants
  console.log('\n▶ [6/6] Menguji Pertanyaan Voice AI Adaptif...');
  const voiceQuestionsMorning = getAdaptiveVoiceQuestions(new Date(2026, 9, 16, 8, 0));
  assert(voiceQuestionsMorning.length === 3, 'Tersedia 3 pertanyaan intake terstruktur');
  assert(voiceQuestionsMorning[0].question.startsWith('Pagi ini'), 'Pertanyaan pertama disesuaikan dengan pagi hari');

  const voiceQuestionsNight = getAdaptiveVoiceQuestions(new Date(2026, 9, 16, 22, 0));
  assert(voiceQuestionsNight[0].question.startsWith('Malam ini'), 'Pertanyaan pertama disesuaikan dengan malam hari');

  // Summary
  console.log('\n======================================================');
  console.log(`HASIL: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
