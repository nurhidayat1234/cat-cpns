# Backend Login CAT CPNS — Google Apps Script + Google Sheet

Database pengguna & hasil simulasi disimpan di Google Sheet
**"CAT CPNS — Database"** (ID `1E8Yt1VptatN4HkJexZz1ZO0ppr9XpgbroaHeWNA-cZQ`):

| Tab | Kolom |
|-----|-------|
| `Users` | Email, Nama, PasswordHash, Token, TokenKadaluarsa, Dibuat, TerakhirLogin |
| `Hasil` | Email, Nama, Mode, TWK, TIU, TKP, Total, Status, Tanggal |

`Code.gs` adalah backend-nya: satu file Apps Script dengan 4 aksi
(`register`, `login`, `saveResult`, `history`) lewat `doPost`.

## Deploy (sekali saja)

1. Buka sheet di atas → menu **Extensions → Apps Script**.
2. Hapus isi `Code.gs` bawaan, tempel seluruh isi `Code.gs` dari folder ini,
   lalu **Save** (ikon disket).
3. **Deploy → New deployment →** pilih tipe **Web app**:
   - **Execute as:** Me (akun pemilik sheet)
   - **Who has access:** Anyone
   - Klik **Deploy**, izinkan akses saat diminta (akun Google pemilik).
4. Salin **Web app URL** (`https://script.google.com/macros/s/.../exec`)
   ke `AUTH_API_URL` di `auth.js` (root situs).

Untuk mengubah kode sesudah deploy: edit di editor Apps Script, lalu
**Deploy → Manage deployments → Edit (ikon pensil) → Version: New version →
Deploy**. URL-nya tetap sama.

## Alur di situs

- **Daftar:** form kirim email + nama + hash SHA-256 password (dihitung di
  browser, password asli tidak pernah terkirim). Email harus unik.
- **Login:** hash dicocokkan; kalau cocok server membuat token acak (UUID)
  yang berlaku 7 hari dan menyimpannya di tab `Users`.
- **Sesi:** token + nama + email disimpan di `localStorage` browser
  (`catcpns-auth-v1`). Logout menghapusnya.
- **Hasil:** setiap simulasi/latihan yang selesai dikirim ke backend
  (butuh token valid) dan tercatat di tab `Hasil`. Beranda menampilkan
  **Riwayat Saya** (20 hasil terakhir) untuk pengguna yang login.
- **Tamu tetap bisa latihan** tanpa login — hanya saja hasilnya tidak
  tersimpan di Sheet dan tidak muncul di riwayat.

## Catatan keamanan (jujur)

- Password disimpan sebagai hash SHA-256 (tanpa salt per pengguna).
  Ini melindungi dari orang yang sekadar membuka Sheet, tapi SHA-256 tanpa
  salt bukan standar keamanan akun tingkat produksi.
- URL web app "Anyone" bisa dipanggil siapa pun yang mengetahuinya;
  tidak ada rate limiting dan tidak ada verifikasi email.
- **Jangan pakai ulang password akun penting** (email, bank, dsb.) untuk
  akun latihan ini. Untuk situs latihan, tingkat ini sudah memadai.
