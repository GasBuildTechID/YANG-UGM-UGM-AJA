'use client';

import { useEffect, useMemo, useRef } from 'react';

// "Gema" — karya seni abstrak generatif dari kata-kata pengguna.
// Deterministik: teks yang sama selalu melahirkan gema yang sama.
// Canvas murni dekoratif (aria-hidden).
//
// Keandalan: gambar penuh digambar SINKRON saat mount (tidak bergantung rAF),
// animasi "tumbuh" hanya fade CSS — sehingga canvas tidak pernah kosong.

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ['#f0e4cc', '#d9c9a8', '#a8b89a'],
  ['#e8c87a', '#d9c9a8', '#c9b48e'],
  ['#f0e4cc', '#e8dcc2', '#b9c4a8'],
];

export default function GenerativeArt({ text, className = '', height = 220, bare = false }) {
  const canvasRef = useRef(null);
  const seed = useMemo(() => hashSeed(text || 'hearme'), [text]);
  const palette = useMemo(() => PALETTES[seed % PALETTES.length], [seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    function paint() {
      const width = canvas.clientWidth;
      if (!width) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rand = mulberry32(seed);
      const particleCount = 220;

      // medan aliran (flow field) — arah ditentukan noise sinus dari seed
      const freqA = 0.9 + rand() * 1.4;
      const freqB = 0.7 + rand() * 1.6;
      const phase = rand() * Math.PI * 2;

      const angleAt = (x, y) =>
        Math.sin(x * 0.004 * freqA + phase) * Math.cos(y * 0.005 * freqB - phase) * Math.PI * 1.6;

      const particles = Array.from({ length: particleCount }, () => ({
        x: rand() * width,
        y: rand() * height,
        life: 40 + rand() * 90,
        color: palette[Math.floor(rand() * palette.length)],
        speed: 0.6 + rand() * 1.1,
        width: 0.5 + rand() * 1.1,
      }));

      // latar malam hangat (ruang gema)
      ctx.fillStyle = '#16140f';
      ctx.fillRect(0, 0, width, height);

      // coretan aliran
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        let { x, y } = p;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < p.life; i++) {
          const angle = angleAt(x, y);
          x += Math.cos(angle) * p.speed;
          y += Math.sin(angle) * p.speed;
          ctx.lineTo(x, y);
          if (x < -20 || x > width + 20 || y < -20 || y > height + 20) break;
        }
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = p.width;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // vignette lembut supaya menyatu dengan malam
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        height * 0.2,
        width / 2,
        height / 2,
        width * 0.72
      );
      grad.addColorStop(0, 'rgba(22,20,15,0)');
      grad.addColorStop(1, 'rgba(22,20,15,0.92)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // gambar sinkron — canvas tidak pernah kosong, apa pun kondisi rAF/tab
    paint();

    // gambar ulang saat ukuran berubah (mis. rotasi layar / resize)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => paint()) : null;
    if (ro) ro.observe(canvas);

    return () => {
      if (ro) ro.disconnect();
    };
  }, [seed, palette, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ height }}
      className={`gema-fade w-full ${bare ? '' : 'rounded-3xl border border-white/10'} ${className}`}
    />
  );
}
