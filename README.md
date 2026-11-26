# CAT CPNS — Simulasi SKD (Latihan)

Website simulasi CAT CPNS — Seleksi Kompetensi Dasar — dengan format seperti
ujian CAT BKN: 110 soal, timer 100 menit, navigasi antar soal, tandai
ragu-ragu, hasil dibandingkan passing grade resmi, dan pembahasan lengkap
tiap soal.

**LATIHAN / SIMULASI.** Soal dibuat original mengikuti kisi-kisi resmi —
bukan soal CPNS asli dan bukan bocoran. Tidak berafiliasi dengan BKN,
KemenPANRB, atau panitia seleksi mana pun.

## Cara jalan (lokal)

```bash
cd ~/workspace/programmer/cat-cpns
python3 -m http.server 8000
# buka http://localhost:8000
```

Harus lewat HTTP server (bukan `file://`) karena soal dimuat dari
`data/questions.json` lewat `fetch`.

## Isi

- **5 paket soal (A–E)** — masing-masing 110 soal original (TWK 30 + TIU 35 +
  TKP 45), tanpa soal yang sama di dua paket. Pemilih paket ada di beranda
  sebelum memilih mode; simulasi, latihan per kategori, dan Pembahasan
  mengikuti paket yang dipilih. Hasil tersimpan ke akun dengan nama paketnya
  (mis. "SKD Penuh • Paket B").
- **Simulasi SKD Penuh** — 110 soal (TWK 30 + TIU 35 + TKP 45), 100 menit.
- **Latihan per kategori** — TWK (30 soal, 27 menit), TIU (35 soal, 32 menit),
  TKP (45 soal, 41 menit).
- **Pembahasan Soal** — telusuri semua 110 soal + penjelasan per kategori,
  dengan filter (semua / hanya yang salah / hanya ragu-ragu / hanya yang
  tidak dijawab).
- Progress tersimpan otomatis di browser (localStorage) — simulasi bisa
  dilanjutkan kalau halaman tertutup. Waktu habis = otomatis selesai.

## Bank soal per paket

- Sumber tiap paket: `data/paket-<huruf>/{twk,tiu,tkp}.json` (30/35/45).
- Build: `node scripts/build-questions.mjs` — menggabungkan tiap paket ke
  `data/questions-<huruf>.json`, menulis `data/questions.json` (= salinan
  Paket A, kompatibilitas lama) dan `data/pakets.json` (manifes paket yang
  tersedia, dibaca situs untuk mengaktifkan tombol paket). Validasi: jumlah,
  skema, skor, penjelasan ≥40 karakter, sebaran jawaban, sebaran subtopik,
  dan **duplikat antar paket** (teks pertanyaan ternormalisasi tidak boleh
  sama di dua paket).
- Sebaran subtopik tiap paket mengikuti Paket A (kisi-kisi 674/2026): TWK —
  Empat Konsensus 16, Nasionalisme 5, Integritas 3, Bela Negara 2, Bahasa
  Indonesia 4; TIU — Silogisme 4, Penalaran Induktif 4, Analitis 4, Deret
  Angka 4, Berhitung 4, Soal Cerita 4, Perbandingan Kuantitatif 3, Serial 3,
  Penalaran Matriks 3, Analogi 2; TKP — Pelayanan Publik 9, Jejaring Kerja 7,
  Anti Radikalisme 7, Profesionalisme 8, Sosial Budaya 7, Adaptasi TIK 7.
- Tes per paket: `python demo/test-paket.py <huruf>` (simulasi penuh 543
  LULUS + pembahasan + riwayat + latihan TWK).

## Tampilan beranda (pedoman ayocpns.com, isi tetap latihan)

Beranda mengikuti **gaya** ayocpns.com (26 Nov 2026): nav pil putih
mengambang, hero tengah terang (latar pucat + grid samar, judul navy besar,
kata kunci biru berputar SKD → TWK → TIU → TKP), pita statistik biru
(110 soal / 100 menit / 550 skor / 3 kategori), 6 kartu fitur, panel ajakan
gradasi biru, FAQ accordion (5 pertanyaan), footer navy gelap, dan label
kecil biru di atas tiap judul seksi. Hanya gayanya yang diadopsi — nama,
logo, angka, klaim pengguna, harga, dan paket situs pedoman **tidak**
disalin: semua angka di sini adalah fakta situs ini sendiri, dan situs ini
gratis (tanpa paket berbayar). Seksi **Alur Latihan** gaya timeline tetap
ada (Buat Akun → Pilih Mode → Kerjakan Soal → Lihat Hasil → Pelajari
Pembahasan).

**Beranda rapi untuk user sudah login** (26 Nov 2026): sesudah login,
hero, disclaimer di bawah pita statistik, dan kartu fitur disembunyikan
(`body.is-logged-in`, style.css); kartu ajakan tamu sudah hilang lewat
auth.js. **Cara Mengerjakan pindah ke paling atas**: Alur Latihan lalu
daftar "Cara mengerjakan" (dipindah DOM-nya oleh `renderHome()` di
auth.js; saat logout urutan tamu dikembalikan). Langkah "Buat Akun" di
Alur Latihan juga hilang sesudah login. Urutan beranda login: Alur →
Cara mengerjakan → pita statistik → Riwayat Saya → kartu mode (pemilih
paket + mode) → Format → FAQ. Uji: `demo/test-home-tidy.py` (tamu →
login → logout, tanpa console error).

Layout kanvas **1440×1024**: konten beranda melebar sampai 1400px, grid
mode 3 kolom di layar ≥1200px. Layar ujian / hasil / Pembahasan tetap di
lebar 1020px. Tabel format + riwayat bisa digeser horizontal di layar kecil
(perbaikan overflow 68px di 390px, 26 Nov 2026).

## Akun login (wajib untuk mengerjakan tes) — database Google Sheet

Login punya **halaman sendiri** (`#screen-auth`): tombol **Buat Akun** /
**Masuk** di pojok kanan atas, tombol hero, dan kartu ajakan di beranda
semuanya membuka halaman itu. **Soal hanya muncul sesudah login** — tamu
melihat beranda tanpa tombol mode tes (mode tes disembunyikan lewat CSS
sampai `body.is-logged-in`); sesudah login berhasil, beranda menampilkan
mode tes dan kartu ajakan login hilang. Menu **Pembahasan Soal** juga hanya
di dalam akun: tamu yang mengeklik nav Pembahasan, langkah "Pelajari
Pembahasan" di Alur Latihan, atau tombol Pembahasan diarahkan ke halaman
login (`openReview` di app.js memeriksa login dulu). Logout
kembali ke halaman login.

**Layout tampilan depan 1440×1024** (26 Nov 2026): konten beranda melebar
sampai 1400px (`.wrap`, `.hero-inner`, `.foot`), grid mode 3 kolom di layar
≥1200px. Layar ujian / hasil / Pembahasan tetap di lebar 1020px supaya
tampilannya tidak berubah.

Yang login mendapat:

- Hasil setiap simulasi/latihan tersimpan ke akun (tab `Hasil` di Sheet).
- **Riwayat Saya** di beranda — 20 hasil terakhir (tanggal, mode, skor
  TWK/TIU/TKP, total, status LULUS/TIDAK LULUS).
- Nama tampil di pojok kanan atas + tombol Keluar.

**Pembahasan milik tiap akun** (26 Nov 2026): hasil terakhir, sesi
tersimpan, dan paket pilihan disimpan di localStorage dengan kunci per
akun (sufiks email lowercase) — bukan satu kunci bersama — jadi akun
lain yang login di browser yang sama tidak bisa membaca riwayat di
Pembahasan atau melanjutkan simulasi akun lain. State dimuat ulang tiap
login/logout (`refreshCatcpnsUser`, dipanggil `Auth.render()`); kunci
lama tanpa sufiks dihapus saat halaman dimuat dan tidak pernah diadopsi.
Catatan Pembahasan berbunyi "hasil simulasi terakhir akunmu". Uji:
`demo/test-review-per-account.py` (A → B → A lagi, tanpa console
error). Timer simulasi juga berhenti sendiri kalau sesinya sudah tidak
ada (mis. ganti akun di tengah jalan).

**Soal figural TIU bergambar** (26 Nov 2026): 8 soal figural tiap paket
(Serial 3, Analogi 2, Penalaran Matriks 3) kini tampil sebagai gambar
SVG yang dibuat langsung dari data soal — tanpa file gambar eksternal.
Setiap soal punya field `figure` (DSL kecil: bangun lingkaran/kotak/
segitiga/belah ketupat/bintang/plus/panah, isi hitam/putih, rotasi
kelipatan 45°, titik 0–3; sel `"?"` = kotak yang dicari) dan 5 opsi
berupa gambar; pola yang dipakai murni visual (rotasi, isi, titik,
bentuk, cermin, gabungan). Spesifikasi lengkap di `FIGURAL.md` (dokumen
pengembangan lokal, tidak ikut terbit). Renderer ada di `app.js`
(`svgCell`, `renderFigure`) dan dipakai di layar soal (`#figureBox`)
maupun Pembahasan (`.rev-fig`); `scripts/build-questions.mjs`
memvalidasi DSL-nya (soal figural wajib punya `figure` + opsi gambar,
non-figural tidak boleh punya `figure`) dan kunci cek duplikat antar
paket mencakup teks + figure + opsi. Aturan yang dijaga: rotasi hanya
dipakai pada bangun yang arahnya terlihat (segitiga/bintang/panah) —
lingkaran/kotak/belah ketupat/plus tidak berubah wujud saat diputar
kelipatan 90°, jadi pola rotasi pada bangun itu membuat opsi yang
tampak identik. Uji: `demo/test-figural.py` (render sampel + E2E
latihan TIU: Serial/Matriks/Analogi tampil, total 175, Pembahasan
menampilkan gambar).

Tampilan login: kartu dua panel (panel navy berisi manfaat akun + form
Masuk/Daftar dengan tab). Backend **sudah di-deploy 25 Nov 2026** sebagai web
app "CAT CPNS auth v1" dan `AUTH_API_URL` di `auth.js` sudah terisi — login
langsung jalan.

**Keamanan:** password di-hash SHA-256 di browser sebelum dikirim; yang
disimpan di Sheet hanya hash-nya. Login memakai token acak yang kedaluwarsa
7 hari. Ini bukan keamanan tingkat produksi (tanpa rate limiting dan tanpa
verifikasi email) — jangan pakai ulang password akun penting di sini.

## Kisi-kisi materi (KepmenPANRB 674/2026, TA 2026)

- **TWK (5 aspek):** nasionalisme; integritas; bela negara; empat konsensus
  kebangsaan (Pancasila, UUD 1945, NKRI, Bhinneka Tunggal Ika); Bahasa
  Indonesia.
- **TIU (10 sub-materi):** verbal — silogisme, penalaran induktif, analitis;
  numerik — berhitung, deret angka, perbandingan kuantitatif, soal cerita;
  figural — serial, analogi, penalaran matriks.
- **TKP (6 aspek):** pelayanan publik; jejaring kerja; sosial budaya;
  adaptasi TIK; profesionalisme; anti radikalisme.

## Penilaian (format resmi, KepmenPANRB 674/2026 — TA 2026)

| Komponen | Soal | Penilaian | Maks | Passing grade |
|---|---|---|---|---|
| TWK | 30 | Benar 5, salah/kosong 0 | 150 | 65 |
| TIU | 35 | Benar 5, salah/kosong 0 | 175 | 80 |
| TKP | 45 | Setiap opsi 1–5, kosong 0 | 225 | 166 |
| Total | 110 | | 550 | 311 |

Lulus (kebutuhan umum) = ketiga passing grade terpenuhi sendiri-sendiri.
Kebutuhan khusus (Lampiran II KepmenPANRB 674/2026): cumlaude &amp; diaspora —
kumulatif ≥ 311 dan TIU ≥ 85; disabilitas &amp; Papua — kumulatif ≥ 286 dan
TIU ≥ 60; olahragawan berprestasi — ambang berdasarkan nilai terendah
pelamar. Di layar hasil ada pemilih jenis kebutuhan untuk menilai hasil
terhadap ambang kategori itu. Detail dan sumber: `SUMBER.md`.

## Formasi CPNS yang dibuka (data resmi SSCASN BKN)

Beranda menampilkan kartu **Formasi CPNS yang Dibuka**: statistik total formasi,
total orang yang akan diterima (jumlah kebutuhan), dan jumlah instansi; pencarian
teks (instansi/jabatan/lokasi) + filter jenis pengadaan; klik satu formasi untuk
melihat rincian (pendidikan, jenis formasi, usia, kode jabatan); tombol
**Daftar CPNS di SSCASN** ke https://sscasn.bkn.go.id/ (tab baru) dan tautan
**Lihat di SSCASN** ke https://sscasn.bkn.go.id/daftar-formasi/.

Sumber data: API resmi SSCASN BKN `https://api-rekrutmen.bkn.go.id/portal/api/spf`
(GET, tanpa parameter — semua seleksi yang sedang dibuka). API itu hanya
mengizinkan CORS dari `sscasn.bkn.go.id`, jadi browser situs ini tidak bisa
mengambilnya langsung: datanya ditarik sisi server oleh
`scripts/fetch-formasi.mjs` ke `data/formasi.json`, dan halaman memuat file lokal
itu secara malas (baru saat kartu terlihat). `scripts/fetch-formasi.mjs` hanya
menyimpan kolom yang ditampilkan (tanpa `persyaratan` yang berulang 3,2 MB,
tanpa penghasilan yang selalu kosong) — file ~600 KB. GitHub Actions
`.github/workflows/sync-formasi.yml` menjalankan skrip itu tiap 6 jam dan
commit bila ada perubahan. Kalau API BKN belum memuat satu pun formasi CPNS,
kartu menampilkan catatan jujur bahwa yang tampil adalah seleksi lain yang
sedang dibuka — bukan CPNS.

## File

- `index.html`, `style.css`, `app.js` — aplikasi (statis, tanpa build).
- `auth.js` — login/daftar, sesi, simpan hasil & riwayat (butuh `AUTH_API_URL`).
- `scripts/apps-script/` — backend Apps Script + panduan deploy.
- `data/questions.json` — bank soal (110 soal + pembahasan), digabung dari
  `data/questions-twk.json`, `data/questions-tiu.json`, `data/questions-tkp.json`.
- `SUMBER.md` — format resmi + status verifikasi + sumber.
- `scripts/build-questions.mjs` — menggabungkan ketiga file kategori menjadi
  `data/questions.json` (dengan validasi jumlah, jawaban, dan skor TKP).
- `data/formasi.json` — snapshot formasi dari API SSCASN (diperbarui otomatis
  tiap 6 jam oleh GitHub Actions; jangan edit manual).
- `scripts/fetch-formasi.mjs` — penarik data formasi dari API SSCASN.
- `.github/workflows/sync-formasi.yml` — jadwal sinkronisasi formasi.
