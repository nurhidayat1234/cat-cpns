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

## Tampilan beranda (gaya SSCASN, isi tetap latihan)

Beranda meniru *tata letak* situs SSCASN — hero biru full-bleed dengan pola
titik, menu atas, tombol **Buat Akun** / **Masuk**, carousel 3 slide, dan
seksi **Alur Latihan** gaya timeline — tetapi logo, nama, dan isinya tetap
milik situs latihan ini. Tidak ada logo SSCASN/BKN, tidak ada foto ASN, dan
tidak ada tanggal/jadwal resmi: timeline berisi alur latihan (Buat Akun →
Pilih Mode → Kerjakan Soal → Lihat Hasil → Pelajari Pembahasan), bukan
jadwal pengadaan. Carousel berputar otomatis 6 detik (berhenti saat
di-hover) dengan panah + dot; tombol hero mengarah ke mode, format, atau
kartu daftar.

## Akun login (wajib untuk mengerjakan tes) — database Google Sheet

Pengguna **wajib daftar / login** sebelum mengerjakan simulasi dan latihan.
Tanpa login, tombol mode tes menampilkan label "Login diperlukan" dan klik
apa pun mengarah ke kartu login. Menu **Pembahasan Soal** tetap bisa dibuka
tanpa login (hanya membaca soal + penjelasan, tanpa nilai).

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
