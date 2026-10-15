# hearme — Platform Peer Support Mahasiswa

MVP hackathon untuk [implementasi_mvp_peer_support.md](./implementasi_mvp_peer_support.md):
**pilihan** → **voice AI interaktif** (cerita dengan suara) → ringkasan kebutuhan yang bisa dikoreksi →
**grup peer support** (3–4 orang, terstruktur) atau **1-on-1 dengan relawan approved** — dengan aturan
keselamatan, lapor, blokir, dan jalur bantuan.

> **Batas produk:** ini layanan dukungan sebaya, **bukan** diagnosis, terapi, atau pengganti tenaga profesional.

## Alur baru (sesuai diagram tim)

```
LOGIN / BIKIN AKUN → PILIHAN (Pengguna | Relawan | admin)
                       │
                       ├─ Pengguna → layar suara (voice ai, 3 pertanyaan) → [Selanjutnya] → gema & validasi kata
                       │                          │                                       │
                       │                          │                    GRUP ─→ MATCHMAKING ─→ USER 3-4 + RELAWAN 1
                       │                          │                    BY 1 ─→ MATCHMAKING ke RELAWAN ─┐
                       │                          │   (jalur merah baru: gema & validasi kata → langsung ke matchmaking)
                       │
                       ├─ Relawan → formulir + lampirkan 1 bukti kualifikasi → menunggu verif dari admin → LOBBY
                       │            → "muncul matchmaking dari user" → (Buat Manggil) → USER VS RELAWAN
                       │
                       └─ admin → dashboard
```

- **`/app/voice`** — **layar imersif setelah login** (tanpa header/nav): hanya AI yang tampil. Percakapan
  **mengalir seperti ChatGPT voice**: AI membacakan pertanyaan (TTS) dengan orb beranimasi, pengguna menjawab
  dengan suara (STT), dan **begitu pengguna selesai bicara AI langsung menanggapi lalu langsung membacakan
  pertanyaan berikutnya** — tanpa menekan mikrofon lagi. Tidak ada tombol opsi.
  - Akhir giliran dideteksi dari jeda hening (~1,4 dtk), bukan dari tombol.
  - Mikrofon **tidak pernah** terbuka selama AI bicara (mencegah AI mendengar suaranya sendiri).
  - Bisa **menyerobot bicara** (ketuk mikrofon saat AI bersuara) untuk memotong dan langsung menjawab.
  - Kalau suara gagal (izin ditolak / tidak terdengar), sebabnya ditampilkan dan ada input teks cadangan
    supaya pengguna tidak pernah terjebak.
  - Setelah **3 pertanyaan**, muncul tombol **Selanjutnya** yang bertransisi beranimasi ke fitur berikutnya.
- **`/app`** — fitur setelah suara: **Gema** dari kata-katamu + ringkasan yang bisa dikoreksi, lalu pilih jalur.
  Sengaja tidak terbuka dari awal — sebelum ada cerita, halaman ini hanya menampilkan ajakan mulai.
- **`/app/pilih`** — **pintu pertama setelah login**: pilih sebagai **Pengguna** atau **Relawan**.
  - **Pengguna** → langsung dibawa ke layar suara (`/app/voice`).
  - **Relawan** → langsung dibawa ke formulir pendaftaran (`/app/volunteer`); kalau sudah disetujui, ke lobby.
  - Admin melihat kartu tambahan ke dashboard.
- **`/app/lobby`** — lobby relawan: status siap, feed **"muncul matchmaking dari user"**, tombol **Panggil**
  (Buat Manggil) untuk 1-on-1, dan tawaran mendampingi grup yang berjalan.
- **`/app/queue`** — antrean user (grup / 1-on-1) + timeout dan opsi alternatif; otomatis lanjut kalau antrean
  masih menunggu atau relawan sudah memanggil.
- **`/app/session/[id]`** — ruang bicara: user mengonfirmasi dulu sebelum 1-on-1 dimulai (tidak ada
  perpindahan otomatis).

## Pengalaman: Warm Paper Editorial

Bukan kuesioner medis yang kaku. Bahasa visualnya diadaptasi dari proyek Framer referensi
(dibaca via MCP UnFramer) — editorial hangat, bukan UI klinis:

- **Kertas hangat** (`#FBFAF8`) + tinta `#12100E`, garis rambut `#DEDAD3`, sapuan aurora krem
  yang melayang lambat dan lapisan grain film.
- **Ruang malam untuk suara**: layar voice (`/app/voice`) memakai latar `#16140F` dengan orb
  bercahaya — momen bercerita terasa seperti lampu kecil di kegelapan.
- **Katarsis → karya**: kata-kata pengguna melahirkan **Gema**, karya seni abstrak generatif (canvas
  flow-field, deterministik dari teks — teks yang sama selalu melahirkan gema yang sama).
  Muncul saat ringkasan kebutuhan dan di akhir sesi. Murni dekoratif (`aria-hidden`), tidak pernah disimpan.
- Bahasa yang hangat dan manusiawi ("malam ini", "gema", "ruang") — bukan istilah klinis.
- Semua animasi menghormati `prefers-reduced-motion`. Token desain lengkap ada di
  [`DESIGN.md`](./DESIGN.md) (palet, tipografi Figtree, motion, a11y, do/don't).

## Stack

- **Next.js 15** (App Router) + React 19 + Tailwind v4
- **Supabase** — Auth, Postgres + RLS, RPC matchmaking (semua transisi status di backend)
- Chat sesi via **Realtime Broadcast** (ephemeral, **tanpa transkrip tersimpan**)

## Setup (5 langkah)

1. **Buat project Supabase** di https://supabase.com/dashboard.
2. **Jalankan schema**: buka *SQL Editor* → tempel seluruh isi [`supabase/schema.sql`](./supabase/schema.sql) → Run.
   (Aman dijalankan berulang.) Schema ini juga membuat bucket privat **`volunteer-proofs`** untuk bukti
   kualifikasi relawan — kalau sudah pernah menjalankan schema sebelumnya, jalankan ulang agar bucket & kolom
   `proof_type`/`proof_path` ikut terpasang.
3. **Isi kredensial**: salin `.env.local.example` → `.env.local`, lalu isi dari
   *Project Settings → API keys*: `NEXT_PUBLIC_SUPABASE_URL` + kunci **publik** kamu, dan
   `SUPABASE_SERVICE_ROLE_KEY` (kunci rahasia — hanya untuk seed/API server, jangan pernah diekspos ke browser).
   Kunci publik boleh ditulis di salah satu nama: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`,
   nama di dashboard baru) atau `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`eyJ…`, nama lama). Aplikasi membaca keduanya.
4. **Matikan konfirmasi email** (khusus demo): *Authentication → Sign In / Providers → Email* → matikan
   “Confirm email”. (Atau konfirmasi manual dari email.)
5. **Install & seed**:
   ```bash
   npm install
   npm run seed   # membuat akun demo + menyetujui relawan demo
   npm run dev
   ```

## Akun demo (dari `npm run seed`)

| Email | Peran | Catatan |
|---|---|---|
| `user@demo.local` | Pengguna | pengguna biasa |
| `relawan@demo.local` | Relawan | sudah `approved`, tinggal set “Siap menerima sesi” |
| `admin@demo.local` | Admin | panel admin |

Password semua akun demo: `DemoHearme123!` — **ganti sebelum dipakai publik**.

## Alur demo di panggung (≈4 menit)

1. **1-on-1 (Buat Manggil)** — Login `relawan@demo.local` (jendela 1) → **Lobby** → set *Siap menerima sesi*.
   Login `user@demo.local` (jendela 2) → **pilihan** → klik **Pengguna** → ketuk *Mulai mengobrol* → jawab
   **3 pertanyaan dengan suara** (AI langsung menanggapi tiap jawaban dan melanjutkan sendiri) → **Selanjutnya**
   (transisi beranimasi) → ringkasan bisa dikoreksi → pilih **1-on-1**.
   Di lobby relawan muncul permintaan itu → klik **Panggil** → user mengonfirmasi → ngobrol → **Akhiri sesi** → check-in.
2. **Grup** — Panel admin → **Konfigurasi** → `group_target_members = 2` (biar cepat).
   Dua akun pengguna masuk antrean grup kategori sama → grup terbentuk otomatis.
3. **Keselamatan** — Saat menulis indikasi risiko langsung, muncul **banner jalur bantuan** (bukan sekadar matchmaking).
   Di dalam sesi: tombol **Laporkan** (kategori alasan) dan **Blokir**; admin meninjau di panel.
4. **Relawan gabung grup** — Di lobby, relawan klik *Tawarkan diri mendampingi* pada grup aktif → peserta diberi
   pilihan **setuju/tolak** dengan batas waktu (default 30 detik). Semua setuju → sesi jadi terapi grup; ditolak →
   tetap grup peer support.
5. **Timeout** — Biarkan antrean 1-on-1 lewat batas waktu (default 3 menit, ubah di panel admin) → muncul opsi:
   tetap menunggu / masuk grup / kembali ke AI / sumber bantuan.

## Peta implementasi (P0 §12 dokumen)

| P0 | Implementasi |
|---|---|
| Login/akun demo | Supabase Auth + `scripts/seed.mjs` |
| Pilihan jalur (pilihan) | `/app/pilih` — **pintu pertama setelah login**: Pengguna → voice AI, Relawan → formulir pendaftaran. **Admin tidak lewat sini** — langsung dialihkan ke dashboard |
| AI chat/voice sederhana | `/app/voice` — percakapan mengalir (gaya ChatGPT voice): AI membacakan pertanyaan (TTS) + orb beranimasi, pengguna menjawab dengan suara (STT, Web Speech API), AI langsung menanggapi & melanjutkan; endpointing dari jeda hening, mikrofon tidak pernah terbuka saat AI bicara |
| Ringkasan bisa dikoreksi | `/app` — setelah tombol **Selanjutnya**: Gema + edit teks, kategori, bahasa |
| Pilihan grup vs 1-on-1 | `/app` langkah pilih jalur; tidak ada perpindahan otomatis |
| Formulir pendaftaran relawan | `/app/volunteer` — formulir + **wajib lampirkan 1 bukti kualifikasi** (STR / ijazah psikologi / sertifikat / surat kampus) → menunggu verif admin |
| Bukti kualifikasi relawan | Storage privat `volunteer-proofs` (1 berkas per pendaftar, maks 5 MB, JPG/PNG/WEBP/PDF); admin membukanya lewat **signed URL** di `/app/admin` |
| Admin approve/reject | `/app/admin` — **dashboard operasional**: angka utama (relawan aktif, sesi berjalan, pendaftar menunggu, laporan terbuka), daftar pendaftar + lihat bukti, laporan, konfigurasi demo. Navigasi admin terpisah dari menu pengguna/relawan |
| Lobby relawan | `/app/lobby` — "muncul matchmaking dari user" + **Buat Manggil** (`volunteer_claim_request`) |
| Matchmaking 1-on-1 | RPC `poll_one_to_one_queue` (reservasi, ring 30 dtk) **dan** klaim dari lobby; user konfirmasi (`confirm_member_consent`) |
| Grup + aturan + panduan sesi | RPC `poll_group_queue`; panduan pembukaan/berbagi/penutup di ruang sesi |
| Timeout antrean + opsi alternatif | Halaman `/app/queue` |
| Tombol keluar & lapor | `SafetyActions` (lapor/blokir/keluar) + `leave_session` |
| Check-in setelah sesi | `submit_checkin` (mood + catatan, opsional) |

## Struktur

```
supabase/schema.sql          # tabel + enum + RLS + semua RPC matchmaking & lobby (jalankan di SQL Editor)
scripts/seed.mjs             # akun demo via service role
src/app/app/voice/page.js   # percakapan suara mengalir (gaya ChatGPT voice): tanggapan + lanjut otomatis
src/app/app/page.js          # setelah suara: Gema + ringkasan bisa dikoreksi, pilih jalur (grup / 1-on-1)
src/app/app/pilih/page.js    # "pilihan": pintu pertama setelah login — Pengguna (suara) | Relawan (formulir)
src/components/VoiceOrb.jsx  # orb animasi (speaking / listening / thinking) — dekoratif, aria-hidden
src/app/app/lobby/page.js    # lobby relawan: status siap, muncul matchmaking dari user, Buat Manggil
src/app/app/queue/page.js    # antrean grup / 1-on-1 + timeout & opsi alternatif
src/app/app/session/[id]/    # ruang sesi: chat realtime, panduan fase, konfirmasi, check-in
src/app/app/volunteer/       # formulir relawan + unggah 1 bukti kualifikasi -> menunggu verif admin
src/app/app/admin/           # dashboard admin: angka operasional, approve/reject (termasuk lihat bukti), laporan, konfigurasi demo
src/lib/voice.js             # Web Speech API: TTS (AI bicara) + STT (jawab dengan suara)
src/lib/volunteer.js         # validasi + unggah bukti kualifikasi ke bucket privat & signed URL-nya
src/app/api/support-request/ # ringkasan AI (opsional OPENAI_API_KEY; default berbasis aturan)
```

## Keputusan desain penting (sesuai dokumen)

- **Tidak ada transkrip tersimpan** — pesan hanya lewat Realtime Broadcast. Yang tersimpan hanya ringkasan
  kebutuhan yang *dikonfirmasi pengguna* (`support_requests.needs_summary`).
- **Admin tidak punya akses default ke percakapan**; RLS membatasi. Admin hanya melihat laporan & agregat.
- **Semua transisi status di backend** (RPC `SECURITY DEFINER`), bukan hanya di UI.
- **Relawan `approved` saja** yang bisa `available` (dicek trigger, bukan cuma UI).
- **Relawan telat di grup tidak masuk otomatis** — butuh persetujuan semua peserta (batas waktu configurable).
- **Blokir & laporan** memengaruhi matchmaking (blokir difilter di RPC).
- **Angka 3 menit / kuota grup / durasi fase = konfigurasi** (`app_config`), bukan aturan universal.

## Konfigurasi operasional (`app_config`, bisa diubah dari panel admin)

| Key | Default | Arti |
|---|---|---|
| `group_target_members` | 3 | kuota pembentukan grup (turunkan ke 2 untuk demo) |
| `group_max_members` | 5 | maksimum termasuk relawan |
| `group_wait_minutes` | 5 | batas tunggu grup |
| `one_to_one_wait_minutes` | 3 | batas pencarian relawan |
| `one_to_one_ring_seconds` | 30 | waktu relawan menjawab tawaran |
| `volunteer_join_consent_seconds` | 30 | waktu peserta menyetujui relawan gabung |
| `session_durations` | 5/25/10 | menit fase pembukaan/berbagi/penutup |

## Pertanyaan terbuka tim (§15 dokumen) — rekomendasi implementasi saat ini

- Grup tanpa relawan **boleh berjalan** (dianggap layanan tersendiri, bukan ruang tunggu relawan).
- 3 menit = **batas pencarian relawan** (per request, bukan total).
- Grup mulai saat **kuota terpenuhi** (jadwal menyusul di P1).
- Sesi tatap muka **belum** ada — perlu aturan lokasi & keselamatan terpisah.
- Rujukan profesional masih placeholder di `/app/account#bantuan` — ganti dengan kontak kampus yang terverifikasi.

## Deploy

Vercel: import repo, set env vars yang sama seperti `.env.local`, deploy.
Pastikan **Site URL** Supabase diarahkan ke domain Vercel untuk redirect auth.

## Standar Commit & Kontribusi

Proyek ini menggunakan format standar **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/)**.  
Panduan lengkap tipe commit, cakupan (*scope*), dan aturan branch dapat dibaca di:
👉 **[`COMMIT_CONVENTION.md`](./COMMIT_CONVENTION.md)**

Untuk mengaktifkan template commit otomatis di Git lokal Anda:
```bash
git config commit.template .gitmessage
```
