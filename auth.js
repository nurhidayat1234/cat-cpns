// CAT CPNS — Autentikasi (login / daftar) dengan database Google Sheet.
// Backend: Google Apps Script web app (lihat scripts/apps-script/Code.gs).
// Database: Sheet "CAT CPNS — Database" (tab Users + Hasil).
//
// ISI URL DI BAWAH SETELAH DEPLOY APPS SCRIPT. Selama masih kosong, form
// login menampilkan pesan "Backend login belum dikonfigurasi" dan situs
// tetap bisa dipakai sebagai tamu (latihan tanpa akun).
const AUTH_API_URL = "https://script.google.com/macros/s/AKfycbxNlCI_SZgCCRHkCqYfqFVl7aqcwifUtbVy4CKrDSghpQBcX0S5MYT7qJDvWYDG1pDX_Q/exec"; // Web app Apps Script "CAT CPNS auth v1", deploy 25 Nov 2026 ~19:11 WIB (Execute as: Me, Anyone)

const STORE_AUTH = "catcpns-auth-v1";

const Auth = (() => {
  let user = null; // { token, nama, email }

  const $ = (id) => document.getElementById(id);

  function loadUser() {
    try {
      const raw = localStorage.getItem(STORE_AUTH);
      user = raw ? JSON.parse(raw) : null;
    } catch (e) { user = null; }
    return user;
  }

  function saveUser(u) {
    user = u;
    try { localStorage.setItem(STORE_AUTH, JSON.stringify(u)); } catch (e) {}
  }

  function clearUser() {
    user = null;
    try { localStorage.removeItem(STORE_AUTH); } catch (e) {}
  }

  function isLoggedIn() {
    return !!(user && user.token);
  }

  async function sha256Hex(text) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error("Browser ini tidak mendukung hashing aman (butuh HTTPS).");
    }
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function api(action, payload) {
    if (!AUTH_API_URL) throw new Error("Backend login belum dikonfigurasi.");
    const res = await fetch(AUTH_API_URL, {
      method: "POST",
      // text/plain agar tidak memicu preflight CORS; Apps Script tetap
      // membaca body JSON-nya dan mengembalikan JSON.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, payload || {})),
    });
    if (!res.ok) throw new Error("Server login tidak merespons (HTTP " + res.status + ").");
    return res.json();
  }

  function showMsg(text, ok) {
    const el = $("authMsg");
    if (!el) return;
    el.textContent = text;
    el.className = "auth-msg " + (ok ? "ok" : "err");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- render ----------
  function renderChip() {
    const chip = $("authChip");
    if (!chip) return;
    chip.innerHTML = "";
    if (isLoggedIn()) {
      const hello = document.createElement("span");
      hello.innerHTML = "Halo, <b></b>";
      hello.querySelector("b").textContent = user.nama;
      const out = document.createElement("button");
      out.className = "chip-btn";
      out.textContent = "Keluar";
      out.onclick = () => {
        clearUser();
        render();
        showMsg("Kamu sudah keluar.", true);
      };
      chip.appendChild(hello);
      chip.appendChild(out);
    } else {
      const reg = document.createElement("button");
      reg.className = "chip-btn chip-btn-outline";
      reg.textContent = "Buat Akun";
      reg.onclick = () => promptRegister();
      const login = document.createElement("button");
      login.className = "chip-btn chip-btn-solid";
      login.textContent = "Masuk";
      login.onclick = () => promptLogin();
      chip.appendChild(reg);
      chip.appendChild(login);
    }
  }

  function showScreenHome() {
    ["home", "exam", "result", "review"].forEach((s) => {
      const el = $("screen-" + s);
      if (el) el.style.display = s === "home" ? "block" : "none";
    });
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const authCard = $("authCard");
    const historyCard = $("historyCard");
    if (authCard) authCard.style.display = isLoggedIn() ? "none" : "";
    if (historyCard) historyCard.style.display = isLoggedIn() ? "block" : "none";
    document.body.classList.toggle("is-logged-in", isLoggedIn());
    if (isLoggedIn()) loadHistory();
    else switchTab("login"); // sesudah logout, form kembali ke tab Masuk
  }

  // Dipanggil saat tamu mencoba mengerjakan tes: arahkan ke kartu login.
  function promptLogin() {
    showScreenHome();
    const card = $("authCard");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    switchTab("login");
    showMsg("Login dulu untuk mengerjakan tes — masuk atau daftar gratis di sini.", false);
    const em = $("loginEmail");
    if (em) em.focus();
  }

  // Arahkan ke kartu daftar (dari tombol "Buat Akun" / hero).
  function promptRegister() {
    if (isLoggedIn()) return;
    showScreenHome();
    const card = $("authCard");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    switchTab("register");
    const nm = $("regNama");
    if (nm) nm.focus();
  }

  function render() {
    renderChip();
    renderHome();
  }

  // ---------- riwayat ----------
  function modeLabel(mode) {
    return mode === "full" ? "SKD Penuh" : mode;
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  async function loadHistory() {
    const box = $("historyList");
    const meta = $("historyMeta");
    if (!box) return;
    box.innerHTML = '<p class="muted small">Memuat riwayat…</p>';
    try {
      const r = await api("history", { token: user.token });
      if (!r.ok) {
        if (/sesi habis/i.test(r.error || "")) {
          clearUser();
          render();
          showMsg("Sesi habis. Silakan login lagi.", false);
          return;
        }
        throw new Error(r.error || "Gagal memuat riwayat.");
      }
      const rows = r.history || [];
      if (meta) meta.textContent = rows.length
        ? rows.length + " hasil terakhir tersimpan di akunmu."
        : "Belum ada hasil tersimpan. Selesaikan satu simulasi atau latihan untuk mengisi riwayat ini.";
      if (!rows.length) { box.innerHTML = ""; return; }
      let html = '<table class="fmt hist"><thead><tr><th>Tanggal</th><th>Mode</th><th>TWK</th><th>TIU</th><th>TKP</th><th>Total</th><th>Status</th></tr></thead><tbody>';
      rows.forEach((h) => {
        html += "<tr><td>" + esc(fmtDate(h.tanggal)) + "</td><td>" + esc(modeLabel(h.mode)) + "</td>"
          + "<td>" + esc(h.twk) + "</td><td>" + esc(h.tiu) + "</td><td>" + esc(h.tkp) + "</td>"
          + "<td><b>" + esc(h.total) + "</b></td>"
          + "<td>" + esc(h.status || "-") + "</td></tr>";
      });
      html += "</tbody></table>";
      box.innerHTML = html;
    } catch (e) {
      if (meta) meta.textContent = "";
      box.innerHTML = '<p class="muted small">Riwayat tidak bisa dimuat: ' + esc(e.message) + "</p>";
    }
  }

  // ---------- aksi ----------
  async function doLogin(email, password) {
    const hash = await sha256Hex(password);
    const r = await api("login", { email, passwordHash: hash });
    if (!r.ok) throw new Error(r.error || "Login gagal.");
    saveUser({ token: r.token, nama: r.nama, email: r.email });
    render();
    return r;
  }

  async function doRegister(nama, email, pw1, pw2) {
    if (pw1.length < 6) throw new Error("Password minimal 6 karakter.");
    if (pw1 !== pw2) throw new Error("Konfirmasi password tidak sama.");
    const hash = await sha256Hex(pw1);
    const r = await api("register", { nama, email, passwordHash: hash });
    if (!r.ok) throw new Error(r.error || "Pendaftaran gagal.");
    await doLogin(email, pw1); // langsung masuk sesudah daftar
    return r;
  }

  async function saveResult(result) {
    if (!isLoggedIn()) return false;
    try {
      const per = result.perCat || {};
      const r = await api("saveResult", {
        token: user.token,
        mode: result.mode,
        twk: per.TWK ? per.TWK.score : 0,
        tiu: per.TIU ? per.TIU.score : 0,
        tkp: per.TKP ? per.TKP.score : 0,
        total: result.total,
        status: result.pass ? "LULUS" : "TIDAK LULUS",
      });
      if (r.ok) loadHistory();
      return !!r.ok;
    } catch (e) {
      return false;
    }
  }

  function switchTab(tab) {
    document.querySelectorAll(".auth-tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
    const lf = $("loginForm"), rf = $("registerForm");
    if (lf) lf.style.display = tab === "login" ? "flex" : "none";
    if (rf) rf.style.display = tab === "register" ? "flex" : "none";
  }

  // ---------- init ----------
  function init() {
    loadUser();
    document.querySelectorAll(".auth-tab").forEach((b) => {
      b.addEventListener("click", () => {
        switchTab(b.dataset.tab);
        showMsg("", true);
      });
    });
    const lf = $("loginForm");
    if (lf) lf.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = lf.querySelector('button[type="submit"]');
      btn.disabled = true;
      showMsg("Memproses…", true);
      try {
        await doLogin($("loginEmail").value.trim(), $("loginPassword").value);
        showMsg("Berhasil masuk. Selamat berlatih, " + user.nama + "!", true);
      } catch (e) {
        showMsg(e.message, false);
      } finally {
        btn.disabled = false;
      }
    });
    const rf = $("registerForm");
    if (rf) rf.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = rf.querySelector('button[type="submit"]');
      btn.disabled = true;
      showMsg("Memproses…", true);
      try {
        await doRegister(
          $("regNama").value.trim(),
          $("regEmail").value.trim(),
          $("regPassword").value,
          $("regPassword2").value
        );
        showMsg("Akun dibuat dan kamu sudah masuk. Selamat berlatih!", true);
      } catch (e) {
        showMsg(e.message, false);
      } finally {
        btn.disabled = false;
      }
    });
    render();
  }

  return { init, isLoggedIn, saveResult, render, loadHistory, promptLogin, promptRegister };
})();

// Diekspos ke window agar app.js bisa memanggil Auth.isLoggedIn()/saveResult().
// (const di top-level script tidak otomatis menjadi properti window.)
window.Auth = Auth;

document.addEventListener("DOMContentLoaded", () => Auth.init());
