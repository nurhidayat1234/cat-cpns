/**
 * CAT CPNS — Backend autentikasi & riwayat hasil (Google Apps Script)
 * ================================================================
 * Database: Google Sheet "CAT CPNS — Database"
 *   Tab Users: Email | Nama | PasswordHash | Token | TokenKadaluarsa | Dibuat | TerakhirLogin
 *   Tab Hasil: Email | Nama | Mode | TWK | TIU | TKP | Total | Status | Tanggal
 *
 * Cara deploy (sekali saja, lihat README.md di folder ini):
 *   1. Buka sheet di atas > Extensions > Apps Script.
 *   2. Tempel seluruh isi file ini menggantikan Code.gs bawaan, lalu Save.
 *   3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 *   4. Salin URL Web app (.../exec) ke AUTH_API_URL di auth.js situs CAT CPNS.
 *
 * Keamanan (jujur, baca sebelum dipakai):
 *   - Password TIDAK PERNAH dikirim apa adanya: browser menghitung SHA-256
 *     dari password, yang dikirim & disimpan hanya hash-nya.
 *   - Login menghasilkan token acak (UUID) yang kedaluwarsa 7 hari; setiap
 *     penyimpanan hasil & pengambilan riwayat wajib menyertakan token valid.
 *   - Ini BUKAN sistem keamanan tingkat produksi: tidak ada rate limiting,
 *     tidak ada verifikasi email, dan URL web app bersifat publik bagi siapa
 *     pun yang mengetahuinya. Cocok untuk situs latihan; JANGAN pakai ulang
 *     password akun penting (email, bank, dsb.) di sini.
 */
const SPREADSHEET_ID = '1E8Yt1VptatN4HkJexZz1ZO0ppr9XpgbroaHeWNA-cZQ';
const SHEET_USERS = 'Users';
const SHEET_HASIL = 'Hasil';
const TOKEN_DAYS = 7;

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, service: 'cat-cpns-auth', time: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse(e.postData.contents || '{}');
    const action = String(body.action || '');
    if (action === 'register') return json_(register_(body));
    if (action === 'login') return json_(login_(body));
    if (action === 'saveResult') return json_(saveResult_(body));
    if (action === 'history') return json_(history_(body));
    return json_({ ok: false, error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* abaikan */ }
  }
}

function sheet_(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

/** Daftar akun baru. Body: { email, nama, passwordHash (SHA-256 hex) } */
function register_(b) {
  const email = String(b.email || '').trim().toLowerCase();
  const nama = String(b.nama || '').trim();
  const hash = String(b.passwordHash || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Format email tidak valid.' };
  if (nama.length < 2) return { ok: false, error: 'Nama minimal 2 huruf.' };
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, error: 'Password tidak valid.' };
  const sh = sheet_(SHEET_USERS);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email) {
      return { ok: false, error: 'Email sudah terdaftar. Silakan login.' };
    }
  }
  const now = new Date();
  sh.appendRow([email, nama, hash, '', '', now, now]);
  return { ok: true, message: 'Pendaftaran berhasil. Silakan login.' };
}

/** Login. Body: { email, passwordHash } -> { ok, token, nama, email } */
function login_(b) {
  const email = String(b.email || '').trim().toLowerCase();
  const hash = String(b.passwordHash || '').trim();
  const sh = sheet_(SHEET_USERS);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email) {
      if (String(rows[i][2]).trim() !== hash) {
        return { ok: false, error: 'Email atau password salah.' };
      }
      const token = Utilities.getUuid() + '-' + Date.now().toString(36);
      const exp = new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();
      sh.getRange(i + 1, 4, 1, 2).setValues([[token, exp.toISOString()]]);
      sh.getRange(i + 1, 7).setValue(now);
      return { ok: true, token: token, nama: String(rows[i][1]), email: email };
    }
  }
  return { ok: false, error: 'Email atau password salah.' };
}

/** Validasi token sesi. Mengembalikan { email, nama } atau null. */
function authUser_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  const rows = sheet_(SHEET_USERS).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3]).trim() === token) {
      const exp = new Date(rows[i][4]);
      if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) return null;
      return { email: String(rows[i][0]), nama: String(rows[i][1]) };
    }
  }
  return null;
}

/** Simpan satu hasil simulasi/latihan. Body: { token, mode, twk, tiu, tkp, total, status } */
function saveResult_(b) {
  const user = authUser_(b.token);
  if (!user) return { ok: false, error: 'Sesi habis. Silakan login lagi.' };
  const mode = String(b.mode || 'full');
  const twk = Number(b.twk) || 0;
  const tiu = Number(b.tiu) || 0;
  const tkp = Number(b.tkp) || 0;
  const total = Number(b.total) || (twk + tiu + tkp);
  const status = String(b.status || '');
  sheet_(SHEET_HASIL).appendRow([user.email, user.nama, mode, twk, tiu, tkp, total, status, new Date()]);
  return { ok: true };
}

/** Ambil 20 hasil terakhir milik pengguna. Body: { token } */
function history_(b) {
  const user = authUser_(b.token);
  if (!user) return { ok: false, error: 'Sesi habis. Silakan login lagi.' };
  const rows = sheet_(SHEET_HASIL).getDataRange().getValues();
  const out = [];
  for (let i = rows.length - 1; i >= 1 && out.length < 20; i--) {
    if (String(rows[i][0]).trim().toLowerCase() === user.email) {
      out.push({
        mode: rows[i][2],
        twk: rows[i][3],
        tiu: rows[i][4],
        tkp: rows[i][5],
        total: rows[i][6],
        status: rows[i][7],
        tanggal: rows[i][8] ? new Date(rows[i][8]).toISOString() : ''
      });
    }
  }
  return { ok: true, history: out };
}
