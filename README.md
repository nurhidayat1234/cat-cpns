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

- **Simulasi SKD Penuh** — 110 soal (TWK 30 + TIU 35 + TKP 45), 100 menit.
- **Latihan per kategori** — TWK (30 soal, 27 menit), TIU (35 soal, 32 menit),
  TKP (45 soal, 41 menit).
- **Pembahasan Soal** — telusuri semua 110 soal + penjelasan per kategori,
  dengan filter (semua / hanya yang salah / hanya ragu-ragu / hanya yang
  tidak dijawab).
- Progress tersimpan otomatis di browser (localStorage) — simulasi bisa
  dilanjutkan kalau halaman tertutup. Waktu habis = otomatis selesai.

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

Tampilan login: kartu dua panel (panel navy berisi manfaat akun + form
Masuk/Daftar dengan tab). Backend **sudah di-deploy 25 Nov 2026** sebagai web
app "CAT CPNS auth v1" dan `AUTH_API_URL` di `auth.js` sudah terisi — login
langsung jalan.

**Keamanan:** password di-hash SHA-256 di browser sebelum dikirim; yang
disimpan di Sheet hanya hash-nya. Login memakai token acak yang kedaluwarsa
7 hari. Ini bukan keamanan tingkat produksi (tanpa rate limiting dan tanpa
verifikasi email) — jangan pakai ulang password akun penting di sini.

## Penilaian (format resmi, KepmenPANRB 321/2024 — TA 2024)

| Komponen | Soal | Penilaian | Maks | Passing grade |
|---|---|---|---|---|
| TWK | 30 | Benar 5, salah/kosong 0 | 150 | 65 |
| TIU | 35 | Benar 5, salah/kosong 0 | 175 | 80 |
| TKP | 45 | Setiap opsi 1–5, kosong 0 | 225 | 166 |
| Total | 110 | | 550 | 311 |

Lulus = ketiga passing grade terpenuhi sendiri-sendiri. Catatan: per
pengecekan 25 Nov 2026, passing grade CPNS 2026 belum ditetapkan pemerintah —
angka di atas adalah acuan terakhir (TA 2024). Detail dan sumber: `SUMBER.md`.

## File

- `index.html`, `style.css`, `app.js` — aplikasi (statis, tanpa build).
- `auth.js` — login/daftar, sesi, simpan hasil & riwayat (butuh `AUTH_API_URL`).
- `scripts/apps-script/` — backend Apps Script + panduan deploy.
- `data/questions.json` — bank soal (110 soal + pembahasan), digabung dari
  `data/questions-twk.json`, `data/questions-tiu.json`, `data/questions-tkp.json`.
- `SUMBER.md` — format resmi + status verifikasi + sumber.
- `scripts/build-questions.mjs` — menggabungkan ketiga file kategori menjadi
  `data/questions.json` (dengan validasi jumlah, jawaban, dan skor TKP).
