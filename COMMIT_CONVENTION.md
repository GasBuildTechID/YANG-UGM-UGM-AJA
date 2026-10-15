# 📋 Standar Commit & Git Workflow — Hearme

Dokumen ini mendefinisikan standar penulisan pesan commit, penamaan branch, dan alur kolaborasi Git pada proyek **Hearme**. Standar ini mengadopsi format [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) yang terintegrasi dengan GitHub best practices.

---

## 📑 Daftar Isi
1. [Format Pesan Commit](#1-format-pesan-commit)
2. [Tipe Commit (`type`)](#2-tipe-commit-type)
3. [Cakupan (`scope`) Proyek](#3-cakupan-scope-proyek)
4. [Aturan Penulisan Subjek & Body](#4-aturan-penulisan-subjek--body)
5. [Contoh Kasus Nyata](#5-contoh-kasus-nyata)
6. [Konvensi Penamaan Branch](#6-konvensi-penamaan-branch)
7. [Aktivasi Git Commit Template Otomatis](#7-aktivasi-git-commit-template-otomatis)

---

## 1. Format Pesan Commit

Setiap pesan commit terdiri dari **header** (wajib), **body** (opsional), dan **footer** (opsional):

```text
<type>(<scope>): <subject>

[optional body: penjelasan latar belakang perubahan dan alasan teknis]

[optional footer: referensi issue atau BREAKING CHANGE]
```

### Aturan Batas Karakter:
- **Header**: Maksimal 72 karakter, ringkas, jelas, huruf kecil, tanpa tanda titik di akhir.
- **Body**: Pisahkan dengan satu baris kosong setelah header. Bungkus teks per baris pada ~72-80 karakter.
- **Footer**: Pisahkan dengan satu baris kosong setelah body.

---

## 2. Tipe Commit (`type`)

Gunakan tipe resmi berikut sesuai dengan jenis perubahan yang dilakukan:

| Tipe | Deskripsi Singkat | Kapan Digunakan? |
| :--- | :--- | :--- |
| `feat` | Fitur baru | Menambahkan kemampuan baru yang dirasakan oleh pengguna/sistem. |
| `fix` | Perbaikan bug | Memperbaiki bug atau kesalahan fungsi pada aplikasi. |
| `docs` | Dokumentasi | Mengubah atau menambah README, dokumen desain, atau komentar kode. |
| `style` | Formatting | Merapikan spasi, indentasi, titik koma, tanpa mengubah logika kode. |
| `refactor` | Refactoring | Mengubah struktur kode tanpa menambah fitur baru atau memperbaiki bug. |
| `perf` | Performa | Perubahan kode yang bertujuan meningkatkan kecepatan respons atau efisiensi. |
| `test` | Pengujian | Menambah atau memperbarui unit test, integration test, atau test suite. |
| `build` | Build system | Perubahan pada konfigurasi build, bundler, atau update dependencies (`package.json`). |
| `ci` | CI / CD | Mengubah workflow GitHub Actions, pipeline deployment, atau script otomasi. |
| `chore` | Pemeliharaan | Tugas rutin seperti mengupdate `.gitignore`, script migrasi, atau tooling. |
| `revert` | Pembatalan | Membatalkan commit sebelumnya (`revert: ...`). |

---

## 3. Cakupan (`scope`) Proyek

Scope ditulis di dalam kurung setelah `type`. Berikut adalah daftar scope resmi proyek **Hearme**:

- `voice` : Fitur Voice AI, Web Speech API (TTS/STT), orb visualizer, micro-turn handling.
- `auth` : Otentikasi Supabase, login, registrasi, session guard, role handling.
- `lobby` : Ruang tunggu relawan, broadcast matchmaking, claim call ("Buat Manggil").
- `queue` : Antrean matchmaking grup atau 1-on-1, timeout handling.
- `session` : Ruang sesi interaktif (chat realtime, pembagian fase, check-in, gema visual).
- `volunteer` : Alur pendaftaran relawan, validasi berkas STR/ijazah, upload storage.
- `admin` : Dashboard admin, persetujuan relawan, moderasi laporan, konfigurasi runtime.
- `db` : Supabase SQL schema, tabel, trigger, migration, RLS policies, RPC functions.
- `ui` : Komponen visual umum, styling Tailwind, layout, token editorial, motion tokens.
- `api` : Next.js Route Handlers (`app/api/...`), integrasi OpenAI API.
- `config` : Konfigurasi Next.js, PostCSS, env, aturan compiler.

---

## 4. Aturan Penulisan Subjek & Body

### Do's (Dianjurkan):
✔ Gunakan kata kerja bentuk imperatif / instruktif (misal: `tambah`, `perbaiki`, `update`, `refactor` atau dalam bahasa Inggris: `add`, `fix`, `update`, `refactor`).  
✔ Seluruh header gunakan huruf kecil (`lowercase`) kecuali nama modul / singkatan resmi (misal: `RPC`, `AI`, `RLS`, `API`).  
✔ Gunakan bahasa yang konsisten (Bahasa Indonesia atau Bahasa Inggris baku).  

### Don'ts (Hindari):
✖ Jangan mengakhiri subjek dengan tanda baca titik (`.`).  
✖ Jangan menulis pesan ambigu seperti: `fix bugs`, `update files`, `wip`, `coba-coba`, `test1`.  
✖ Jangan menggabungkan banyak fitur yang tidak berkaitan ke dalam 1 commit raksasa.  

---

## 5. Contoh Kasus Nyata

### Contoh 1: Penambahan Fitur Baru (`feat`)
```text
feat(voice): implementasi deteksi hening otomatis untuk transisi pertanyaan

Menggantikan penekanan tombol manual dengan silence detector (~1.4s jeda)
agar alur percakapan voice AI terasa alami seperti asisten suara real-time.
```

### Contoh 2: Perbaikan Bug (`fix`)
```text
fix(queue): atasi deadlock saat reservasi relawan ganda pada RPC

Menambahkan klausa FOR UPDATE SKIP LOCKED pada query pemilihan relawan
agar dua request bersamaan tidak menyebabkan konflik kunci baris.

Closes #42
```

### Contoh 3: Dokumentasi & Konfigurasi (`docs` & `chore`)
```text
docs(env): rapikan dokumentasi variabel lingkungan pada .env.local.example
```
```text
chore(deps): upgrade Next.js ke versi 15.1.0 dan sesuaikan postcss config
```

### Contoh 4: Perubahan Berdampak Luas (Breaking Change)
```text
feat(api)!: ubah format respons endpoint support-request

BREAKING CHANGE: payload respons kini mengembalikan objek terstruktur
{ summary: string, tags: string[], sentiment: string } menggantikan string mentah.
```

---

## 6. Konvensi Penamaan Branch

Sebelum membuat commit, pastikan Anda bekerja pada branch dengan format berikut:

```text
<kategori>/<deskripsi-singkat-dengan-strip>
```

| Kategori | Contoh Penamaan Branch |
| :--- | :--- |
| `feature/` | `feature/voice-silence-detector`, `feature/volunteer-kyc-upload` |
| `fix/` | `fix/realtime-broadcast-disconnect`, `fix/admin-rls-bypass` |
| `refactor/` | `refactor/matchmaking-rpc`, `refactor/tailwind-theme-tokens` |
| `docs/` | `docs/commit-standard`, `docs/api-documentation` |
| `chore/` | `chore/update-dependencies`, `chore/setup-eslint` |

---

## 7. Aktivasi Git Commit Template Otomatis

Proyek ini telah dilengkapi file template [`.gitmessage`](./.gitmessage). Anda dapat mengaktifkannya pada git lokal Anda dengan menjalankan perintah:

```bash
git config commit.template .gitmessage
```

Setelah diatur, setiap kali Anda mengetik `git commit` tanpa flag `-m`, editor Anda akan menampilkan template interaktif beserta panduan standar commit ini.

