# Implementasi MVP --- Platform Peer Support Mahasiswa

Dokumen kerja untuk mengubah flow tim menjadi fitur yang bisa dibangun
dan diuji saat hackathon.

> **Batas produk:** layanan ini adalah dukungan sebaya (*peer support*),
> bukan diagnosis, terapi, atau pengganti tenaga profesional.

## 1. Tujuan dan prinsip

Produk membantu mahasiswa yang mengalami stres atau merasa kewalahan
menemukan dukungan melalui: 
1. AI chat/voice sebagai pintu masuk.
2. Grup peer support yang terstruktur.
3. Sesi 1-on-1 dengan relawan terverifikasi.
4. Informasi rujukan profesional bila dibutuhkan.

AI merangkum kebutuhan berdasarkan jawaban pengguna, lalu meminta
pengguna mengonfirmasi atau mengubahnya. Jangan membuat diagnosis
berdasarkan kata kunci.

## 2. Keputusan flow utama

Setelah login dan persetujuan privasi:
1. Pengguna memulai AI chat/voice.
2. AI bertanya singkat dan merangkum kebutuhan, misalnya ingin didengarkan, berbagi pengalaman, mencari strategi praktis, atau mencari bantuan profesional. 3. Pengguna mengonfirmasi ringkasan.
4. Pengguna memilih sendiri salah satu jalur: - **Grup peer support** - **Ngobrol 1-on-1 dengan relawan** - **Lanjut dengan AI / lihat sumber bantuan**
5. Sistem menjalankan matchmaking sesuai pilihan.
6. Setelah sesi, pengguna mendapat check-in opsional dan pilihan langkah selanjutnya. (Opsional)

Jangan memindahkan pengguna ke grup atau menghubungkannya dengan relawan
tanpa persetujuan.


## 3. Bedakan grup dan 1-on-1

  -----------------------------------------------------------------------
  Aspek                   Grup peer support       1-on-1 relawan
  ----------------------- ----------------------- -----------------------
  Tujuan                  Berbagi pengalaman dan  Mendapat ruang untuk
                          merasa tidak sendirian  bercerita kepada satu
                                                  pendengar

  Peserta                 Target 3--4 pengguna;   1 pengguna + 1 relawan
                          maksimal 5 orang        
                          termasuk relawan        

  Relawan                 Bisa opsional untuk MVP Wajib relawan berstatus
                          jika ada panduan dan    approved dan available
                          kontrol keselamatan     
                          yang jelas              

  Tanpa relawan           Grup dapat berjalan     Tunggu maksimal 3
                          sebagai sesi peer       menit, lalu pengguna
                          support terstruktur,    memilih opsi lain
                          bukan chat bebas        
  -----------------------------------------------------------------------

**Rekomendasi:** grup jangan diperlakukan sebagai ruang tunggu relawan.
Jadikan grup sebagai layanan tersendiri, dengan aturan, panduan sesi,
tombol keluar, dan tombol lapor. Jika tim belum siap menjalankan grup
tanpa relawan, jadikan grup tanpa relawan sebagai simulasi demo saja
sampai ada mekanisme moderasi yang memadai.

## 4. Flow grup peer support, terapi grup

1.  Pengguna memilih **Grup peer support**.
2.  Sistem memasukkan pengguna ke antrean berdasarkan bahasa dan
    kategori dukungan yang dipilih sendiri.
3.  Sistem mengumpulkan 3--4 pengguna. Untuk MVP, batas pengumpulan
    dapat dimulai dari 5 menit dan dibuat configurable.
4.  Jika kuota tercapai, sistem membuat ruang grup dan menampilkan
    tujuan sesi, aturan privasi, hak untuk tidak menjawab, serta tombol
    lapor/keluar.
5.  Jalankan panduan sesi:
    -   **Pembukaan (5 menit):** nama samaran, tujuan, aturan.
    -   **Berbagi (20--25 menit):** pengguna boleh berbagi, melewati
        giliran, atau hanya mendengarkan.
    -   **Penutup (5--10 menit):** hal yang dirasa membantu dan satu
        langkah kecil berikutnya.
6.  Jika relawan datang setelah sesi dimulai, jangan otomatis
    memasukkannya. Tawarkan kepada peserta;
    1. lanjutkan hanya jika peserta menyetujui. setelah itu berubah menjadi terapi grup
    2. jika di tolak tetap menjadi grup support
8.  Setelah sesi, tampilkan check-in opsional.

Jika anggota belum cukup saat batas waktu habis, beri pilihan untuk
tetap menunggu, bergabung ke sesi terjadwal, beralih ke 1-on-1, atau
keluar dan melihat sumber bantuan. Jangan menggabungkan pengguna dengan
kategori yang tidak sesuai hanya demi memenuhi kuota.

AI boleh menampilkan prompt pembuka, aturan, dan prompt penutup. Jangan
menganggap AI sebagai moderator keselamatan yang selalu mampu mendeteksi
krisis dengan benar.

## 5. Flow 1-on-1 relawan

1.  Pengguna memilih **Ngobrol 1-on-1**.
2.  Sistem mencari relawan yang sudah approved, online, available, tidak
    sedang menangani sesi lain, dan sesuai bahasa/preferensi yang
    dipilih pengguna.
3.  Tampilkan status antrean. Untuk MVP, pencarian awal maksimal 3
    menit.
4.  Jika ada relawan yang cocok, tampilkan konfirmasi sebelum sesi
    dibuat.
5.  Jika tidak ada setelah 3 menit, tampilkan opsi:
    -   **Masuk grup peer support**
    -   **Tetap menunggu**
    -   **Kembali ke AI**
    -   **Lihat sumber bantuan**
6.  Jika pengguna memilih grup, masukkan ke antrean grup. Jangan
    memindahkan secara otomatis.
7.  Setelah sesi dimulai, ingatkan bahwa relawan adalah
    pendengar/pendukung sebaya, bukan otomatis konselor profesional.
8.  Saat sesi selesai, pengguna dapat memberi check-in opsional.

Jika relawan menolak atau tidak merespons, lepaskan reservasi relawan
dan cari kandidat berikutnya. Jika sesi berakhir, kembalikan relawan ke
available hanya jika ia memilih status tersebut.

## 6. Flow pendaftaran dan validasi relawan

1.  Akun baru selalu menjadi pengguna biasa.
2.  Calon relawan mengisi formulir terpisah.
3.  Admin memeriksa identitas dan kelayakan sesuai kebijakan tim/mitra
    kampus.
4.  Status awal `pending`.
5.  Setelah pemeriksaan, orientasi/pelatihan, dan persetujuan kode etik,
    admin dapat menyetujui pendaftar.
6.  Hanya relawan `approved` yang dapat mengaktifkan status `available`.
7.  Relawan dapat menerima/menolak permintaan, mengakhiri sesi, atau
    melaporkan perilaku berbahaya.
8.  Admin dapat menangguhkan akun selama peninjauan laporan.

Verifikasi email kampus saja tidak membuktikan kemampuan mendampingi.
Untuk produk nyata, prioritaskan relawan dari unit konseling atau
organisasi kampus yang memiliki pelatihan dan pengawasan. Label
"terverifikasi" berarti diverifikasi oleh platform, bukan berarti
psikolog/konselor profesional.

## 7. Flow admin

Dashboard admin minimum: - melihat pendaftar relawan; - menyetujui,
menolak, atau meminta informasi tambahan; - melihat status
pending/approved/suspended; - meninjau laporan pengguna dan mengambil
tindakan; - melihat statistik operasional agregat.

Admin tidak perlu memiliki akses default ke seluruh isi percakapan AI
atau percakapan privat. Batasi akses ke data sensitif sesuai kebutuhan.

## 8. Aturan matchmaking

### Data yang boleh dipakai

-   preferensi format yang relevan;
-   ketersediaan;
-   status relawan yang sudah diverifikasi.

Hindari matching berdasarkan popularitas, penampilan, jumlah teman, atau
skor psikologis yang tidak dapat dijelaskan. Jangan membuat diagnosis
dari kata kunci.

### Algoritma grup sederhana

sistem matchmaking mempertimbangkan:
1. Kategori masalah yang dikonfirmasi pengguna.
2. Kecocokan kebutuhan dukungan.
3. Bahasa yang digunakan.
4. Ketersediaan pengguna.
5. Kapasitas grup, dengan target awal sekitar 3–4 pengguna.

### Algoritma 1-on-1 sederhana

1.  Cari relawan `approved` dan `available`.
2.  Reservasi relawan sementara agar tidak menerima dua sesi sekaligus.
3.  Jika relawan menerima, buat sesi dan ubah status menjadi `busy`.
4.  Jika menolak/tidak merespons, lepaskan reservasi dan coba kandidat
    lain.
5.  Jika 3 menit berlalu tanpa kecocokan, tampilkan opsi alternatif.
6.  Setelah sesi selesai, relawan kembali `available` hanya jika ia
    menyetujuinya.

Angka 3 menit, jumlah anggota grup, dan durasi sesi adalah nilai awal
untuk diuji, bukan aturan universal. Simpan sebagai konfigurasi.

## 9. Status sistem yang disarankan

**Status relawan:** `pending`, `approved`, `available`, `busy`,
`offline`, `suspended`.

**Status antrean:** `waiting`, `matched`, `cancelled`, `expired`.

**Status sesi:** `scheduled`, `active`, `completed`, `ended_early`,
`reported`.

Perubahan status harus ditentukan backend, bukan hanya tampilan UI.

## 10. Struktur data minimum

Nama tabel/collection hanya contoh.

### `users`

-   `id`
-   `display_name` (nama samaran boleh)
-   `email` (jika diperlukan)
-   `role` (`user`, `admin`)
-   `created_at`

### `volunteer_applications`

-   `id`, `user_id`
-   `status` (`pending`, `approved`, `rejected`, `suspended`)
-   `reviewed_by`, `reviewed_at`
-   `training_completed`
-   `code_of_conduct_accepted_at`

### `volunteer_presence`

-   `volunteer_id`
-   `status` (`available`, `busy`, `offline`, `suspended`)
-   `last_seen_at`

### `support_requests`

-   `id`, `user_id`
-   `mode` (`group`, `one_to_one`)
-   `support_category`, `language`
-   `status`, `created_at`, `expires_at`

### `sessions`

-   `id`, `mode`, `status`
-   `started_at`, `ended_at`
-   `facilitator_id` (opsional untuk grup; wajib untuk 1-on-1)
-   `session_guidance_version`

### `session_participants`

-   `session_id`, `user_id`, `participant_role`
-   `joined_at`, `left_at`
-   `consent_to_joined_volunteer_at` (jika relawan bergabung belakangan)

### `reports`

-   `id`, `reporter_id`, `session_id`, `reported_user_id`
-   `reason_category`, `status`
-   `created_at`, `reviewed_by`, `reviewed_at`

Hindari menyimpan transkrip lengkap jika tidak diperlukan. Jika
disimpan, jelaskan tujuan, minta persetujuan yang sesuai, batasi
akses/masa simpan, dan jangan membagikannya kepada relawan tanpa
persetujuan eksplisit.

## 11. Keamanan dan privasi minimum

-   Tidak ada diagnosis atau klaim bahwa AI adalah terapis.
-   Pengguna boleh melewati giliran, membatalkan, atau keluar.
-   Tampilkan aturan sebelum masuk grup.
-   Sediakan **Laporkan**, **Blokir**, dan **Keluar dari sesi**.
-   Larang pelecehan, intimidasi, eksploitasi, meminta uang, memaksa
    orang bercerita, menyebarkan cerita/identitas, dan mengaku sebagai
    profesional tanpa kualifikasi.
-   Relawan tidak boleh menjanjikan kerahasiaan absolut. Jelaskan batas
    privasi dan cara laporan ditangani.
-   Jika ada indikasi risiko langsung mencederai diri sendiri/orang
    lain, jangan sekadar melakukan matchmaking. Tampilkan jalur bantuan
    manusia/profesional yang telah diverifikasi dan ikuti prosedur
    eskalasi yang disusun bersama pihak kompeten.
-   Jangan mengklaim AI mampu mendeteksi semua krisis secara akurat.
-   Uji skenario keselamatan dengan akun simulasi sebelum membuka akses
    publik.

Panduan WHO tentang Psychological First Aid menekankan bantuan yang
manusiawi, menghormati pilihan dan martabat, menjaga privasi, tidak
memaksa orang bercerita, dan memahami batas kemampuan penolong:
https://www.who.int/publications/i/item/9789241548205

## 12. Prioritas implementasi hackathon

### P0 --- wajib untuk demo

-   [ ] Login/akun demo.
-   [ ] AI chat/voice sederhana, atau simulasi alur jika integrasi suara
    belum siap.
-   [ ] Ringkasan kebutuhan yang bisa dikoreksi pengguna.
-   [ ] Pilihan grup vs 1-on-1.
-   [ ] Formulir pendaftaran relawan.
-   [ ] Admin approve/reject relawan.
-   [ ] Matchmaking 1-on-1 dengan relawan demo yang sudah approved.
-   [ ] Grup dengan batas anggota, aturan, dan panduan sesi.
-   [ ] Timeout antrean dan pilihan alternatif.
-   [ ] Tombol keluar dan lapor.
-   [ ] Check-in setelah sesi.

### P1 --- jika waktu cukup

-   [ ] Voice chat real-time.
-   [ ] Notifikasi ketika relawan tersedia.
-   [ ] Preferensi bahasa/format sesi.
-   [ ] Jadwal sesi grup.
-   [ ] Statistik agregat.
-   [ ] Rujukan kampus/profesional yang sudah diverifikasi.

### Jangan dibuat dulu

-   Matching berdasarkan diagnosis/skor emosi.
-   Rating publik dan fitur popularitas.
-   Swipe/like.
-   Penyimpanan permanen semua transkrip.
-   Klaim deteksi krisis otomatis yang selalu benar.
-   Pendaftaran relawan publik tanpa verifikasi dan pengawasan.

## 13. Skenario pengujian

  -----------------------------------------------------------------------
  Skenario                            Hasil yang diharapkan
  ----------------------------------- -----------------------------------
  Relawan belum disetujui             Tidak dapat menerima sesi

  Relawan approved tetapi offline     Tidak dipilih matchmaking

  Relawan sedang busy                 Tidak menerima sesi kedua

  Tidak ada relawan selama 3 menit    Pengguna mendapat opsi alternatif

  Anggota grup belum cukup            Status dan opsi alternatif
                                      ditampilkan

  Relawan datang saat grup berjalan   Tidak masuk otomatis; butuh
                                      persetujuan

  Pengguna tidak ingin berbagi        Bisa melewati giliran atau keluar

  Pengguna melaporkan anggota         Laporan tercatat dan dapat ditinjau
                                      admin

  Pengguna ingin menghentikan sesi    Sesi dapat diakhiri

  Ada indikasi risiko langsung        Jalur bantuan yang sesuai
                                      ditampilkan, bukan hanya
                                      matchmaking
  -----------------------------------------------------------------------

## 14. Urutan pengerjaan

1.  Sepakati flow dan aturan.
2.  Buat autentikasi dan status akun.
3.  Buat pendaftaran relawan dan persetujuan admin.
4.  Buat status online/offline/busy.
5.  Buat antrean 1-on-1 dan timeout.
6.  Buat antrean grup dan batas jumlah anggota.
7.  Buat ruang sesi, aturan, panduan, keluar, dan lapor.
8.  Hubungkan AI dengan ringkasan kebutuhan yang dapat dikoreksi.
9.  Tambahkan check-in dan sumber bantuan.
10. Uji semua skenario pada bagian 13.

**Saran:** bangun matchmaking berbasis aturan sederhana dulu. Untuk
hackathon, flow yang jelas, aman, dan konsisten lebih kuat daripada
algoritma AI yang terlihat canggih tetapi sulit diuji.

## 15. Pertanyaan yang harus diputuskan tim

-   Apakah grup tanpa relawan boleh berjalan saat demo? Jika ya, apa
    yang memandu sesi?
-   Apakah 3 menit adalah batas pencarian relawan atau waktu tunggu
    total?
-   Apakah grup mulai saat kuota terpenuhi atau berdasarkan jadwal?
-   Apakah relawan hanya online, atau ada sesi tatap muka offline? Tatap
    muka perlu aturan lokasi, tempat aman, persetujuan, dan prosedur
    keselamatan terpisah.
-   Siapa mitra untuk pelatihan relawan dan rujukan profesional?
-   Data apa yang benar-benar perlu disimpan, siapa yang dapat
    melihatnya, dan kapan dihapus?

Selesaikan pertanyaan ini sebelum menambah fitur, karena jawabannya
memengaruhi backend, UI, dan pengujian.
