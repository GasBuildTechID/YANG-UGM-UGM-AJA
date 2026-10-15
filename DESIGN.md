---
name: hearme — Warm Paper Editorial
description: Ruang aman malam hari untuk katarsis mahasiswa. Bahasa visual diadaptasi dari referensi Framer (dibaca via MCP UnFramer) — kertas hangat, tinta, garis rambut; layar suara tetap menjadi "ruang malam".
tokens:
  color:
    paper: "#FBFAF8"        # latar halaman (kertas)
    surface: "#FFFFFF"      # kartu / panel
    ink: "#12100E"          # teks utama
    body: "#6E6862"         # teks sekunder
    faint: "#948C83"        # teks tersier (ikon dekoratif)
    mist: "#7A7269"         # teks kecil (≥4.5:1)
    hairline: "#DEDAD3"     # garis pemisah / border kartu
    field-line: "#97907F"   # garis kontrol form (≥3:1)
    night: "#16140F"        # latar layar suara (ruang malam)
    night-raised: "#211E19" # panel di dalam malam
    night-line: "#3A352E"   # garis di dalam malam
    on-dark: "#FBFAF8"      # teks utama di malam
    on-dark-body: "#A8A29A" # teks sekunder di malam
    sage: "#2F5D45"         # positif / disetujui (teks)
    sage-soft: "#4A7C5E"    # positif (border/ikon)
    ochre: "#6F4E12"        # menunggu / peringatan (teks)
    ochre-soft: "#B08327"   # menunggu (border/ikon)
    terracotta: "#8F3A2B"   # galat / ditolak / destruktif (teks)
    terracotta-soft: "#A4442F"
  font:
    sans: "'Figtree', ui-sans-serif, system-ui, sans-serif"
    display: "'Figtree', ui-sans-serif, system-ui, sans-serif"
  radius:
    card: "24px"
    control: "12px"
    pill: "999px"
  motion:
    aurora-drift: "52s ease-in-out infinite alternate"
    reveal: "420ms cubic-bezier(.22,1,.36,1)"
    hover: "200ms ease"
---

# DESIGN.md — hearme (Warm Paper Editorial)

## Overview

hearme adalah **ruang aman saat gelap**. Bahasa visualnya diambil dari proyek Framer
referensi (situs terapi "Therapy that starts where you are", dibaca melalui MCP UnFramer) dan
diadaptasikan ke struktur aplikasi yang sudah ada:

- **Kertas hangat, bukan layar biru** — halaman memakai kertas `#FBFAF8` dengan tinta `#12100E`,
  garis rambut `#DEDAD3`, dan sapuan aurora hangat (krem/karamel) yang sangat halus.
- **Ruang malam untuk suara** — layar voice (`/app/voice`) tetap menjadi ruang gelap hangat
  (`#16140F`) supaya momen bercerita terasa seperti lampu kecil di kegelapan.
- **Kata menjadi bentuk** — kata-kata pengguna melahirkan **Gema**, karya seni abstrak generatif
  (canvas flow-field, deterministik dari teks) dengan palet malam hangat.

Batasan produk tetap: bukan diagnosis/terapi; tombol lapor/blokir/keluar selalu tersedia;
indikasi risiko langsung selalu memunculkan jalur bantuan manusia.

## Colors

| Token | Nilai | Pemakaian |
|---|---|---|
| `paper` | `#FBFAF8` | Latar halaman (body) |
| `surface` | `#FFFFFF` | Kartu, panel, input, tombol sekunder |
| `ink` | `#12100E` | Teks utama (kontras ≈ 18:1 di atas paper) |
| `body` | `#6E6862` | Teks sekunder (≈ 5.3:1) |
| `mist` | `#7A7269` | Teks kecil / footer (≈ 4.5:1) |
| `hairline` | `#DEDAD3` | Border kartu, pemisah |
| `field-line` | `#97907F` | Border input/select/textarea (≥ 3:1, WCAG 1.4.11) |
| `night` | `#16140F` | Latar layar suara (immersive) |
| `night-raised` | `#211E19` | Kartu/panel di dalam layar suara |
| `on-dark` | `#FBFAF8` | Teks utama di layar suara |
| `sage` | `#2F5D45` | Status positif (disetujui) |
| `ochre` | `#6F4E12` | Status menunggu / peringatan |
| `terracotta` | `#8F3A2B` | Galat / ditolak / aksi destruktif |

Latar halaman tidak pernah satu warna polos: tiga "blob" blur hangat (krem, abu-hangat, gading)
melayang sangat lambat (52–64 detik, alternate) + lapisan grain 4% untuk tekstur kertas.

**Aturan aksen:** monokrom hangat sebagai dasar; warna semantik (sage/ochre/terracotta) hanya
untuk status dan peringatan. Tidak ada gradien jenuh — CTA adalah blok tinta solid.

## Typography

- **Figtree (300–700)** untuk semua teks — UI, display, kontrol.
- Display: Figtree 500 dengan tracking rapat (`-0.025em`) — headline landing, judul fase, sapaan.
- Body 14–17px, line-height longgar untuk konten emosional.
- Eyebrow/label kecil: 11–12px, `tracking-wide` bila uppercase.
- Tidak ada font di bawah 12px.

## Layout & Spacing

- Grid 4px; konten `max-w-5xl` (app) / `max-w-2xl` (alur) / `max-w-md` (form).
- Kartu `radius 24px`, kontrol `12px`, tombol `pill`.
- Satu ide per panel; jarak antar panel 16px; padding kartu 20px.
- Ruang kosong adalah bagian desain — bukan area yang harus diisi.

## Components

| Komponen | Aturan |
|---|---|
| `card` | Bidang putih, border hairline `#DEDAD3`, shadow sangat tipis (1px + 32px -28px tinta 35%) |
| `btn-primary` | Blok tinta solid `#16140F`, teks paper; hover `#2A2620`; active turun 1px |
| `btn-secondary` | Putih + border hairline; hover `#F2EFE9` |
| `btn-danger` | Terracotta 8% + border 35%; hover 14% |
| `input` | Putih, border `field-line` (≥3:1), fokus border tinta + ring 3px 8% |
| `chip-*` | Pill 9–12% warna semantik, border 32–35%, teks versi gelap (semua ≥ 6.5:1) |
| Aurora background | Fixed, `z-index:-10`, `pointer-events:none`, blur 90px, opacity 0.5 |
| GenerativeArt | Canvas flow-field seed deterministik; palet krem/karamel/sage di atas malam `#16140F` |
| Banner keselamatan | Ochre 10% + border 40%; ikon + jalur bantuan nyata (119 ext. 8, 112) |
| Layar suara (`.immersive`) | Latar `night`, token didefinisikan ulang di dalamnya; orb = lampu krem hangat |

## Motion

- Aurora drift 52–64s, `ease-in-out`, `alternate` — gerakan yang tidak menuntut perhatian.
- Reveal konten: fade + naik 8px, 420ms `cubic-bezier(.22,1,.36,1)`.
- Landing: entrance berjenjang + reveal saat gulir lewat **motion** (Framer Motion, `motion/react`) —
  easing sama, dan semuanya berhenti saat pengguna memilih `prefers-reduced-motion`.
- Hover kartu: translateY(-2px) 200ms.
- Orb suara: bernafas 5.2s; saat bicara/mendengar berdenyut + riak.
- GenerativeArt: menggambar sinkron saat mount, lalu **berhenti** (hemat CPU).
- **Reduced motion:** semua animasi aurora, orb & canvas dimatikan.

## Responsive

- 375px: nav bawah 4 ikon + admin, kartu penuh lebar, headline clamp.
- 768px: grid 2 kolom untuk pilihan jalur; nav atas muncul.
- 1280px: konten tetap `max-w-5xl`; aurora menskala dengan viewport.
- Teks Indonesia panjang: hindari pemotongan; `text-balance` untuk headline.

## Accessibility

- Kontras teks ≥ 4.5:1 (ink/paper ≈ 18:1; body ≈ 5.3:1; mist ≈ 4.5:1; on-dark/night ≈ 17.6:1).
- Border kontrol form ≥ 3:1 (WCAG 1.4.11) — `field-line` `#97907F`.
- Fokus terlihat di semua kontrol: ring 2px tinta + offset 2px (di malam: ring paper).
- Semua animasi hormat `prefers-reduced-motion`.
- Canvas murni dekoratif: `aria-hidden`, tidak pernah satu-satunya pembawa informasi.
- Form tetap native (input/select/textarea/label), target sentuh ≥ 44px.

## States (wajib ada per primitif)

default · hover · focus-visible · active · disabled · loading (spinner + teks) ·
empty (kalimat hangat, bukan "no data") · error (terracotta 10%, pesan manusiawi).

## Do / Don't

- **Do:** gunakan bahasa malam yang hangat ("malam ini", "gema", "ruang"); beri jeda antar langkah;
  pertahankan satu bidang tinta per layar sebagai aksi utama.
- **Don't:** istilah klinis ("pasien", "gejala", "skrining"), merah menyala, ikon medis,
  badge/streak/gamifikasi, progress "1/4 pertanyaan" bergaya kuesioner, teks berkedip,
  gradien jenuh berwarna-warni.
