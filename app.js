// Simulasi CAT CPNS — SKD (latihan). Static, no backend.
// Data: data/questions-<paket>.json, satu file per paket (A-E), masing-masing
// 110 soal original: TWK 30, TIU 35, TKP 45. Paket A = bank soal awal.
// data/pakets.json memuat daftar paket yang tersedia (dibaca situs).
// Format resmi (KepmenPANRB 674/2026, TA 2026): TWK 30 soal PG 65, TIU 35
// soal PG 80, TKP 45 soal PG 166, total 110 soal / 100 menit / maks 550.
// TWK & TIU: benar 5, salah/kosong 0. TKP: tiap opsi 1-5, kosong 0.
const CONFIG = {
  TWK: { label: "TWK — Tes Wawasan Kebangsaan", count: 30, max: 150, pg: 65, minutes: 27 },
  TIU: { label: "TIU — Tes Intelegensia Umum", count: 35, max: 175, pg: 80, minutes: 32 },
  TKP: { label: "TKP — Tes Karakteristik Pribadi", count: 45, max: 225, pg: 166, minutes: 41 },
};
const FULL = { label: "SKD Penuh", count: 110, max: 550, minutes: 100 };
// Ambang batas kebutuhan khusus (KepmenPANRB 674/2026, Lampiran II).
// Umum: per subtes TWK 65 / TIU 80 / TKP 166 (kumulatif minimal 311).
// Cumlaude & diaspora: kumulatif >= 311 dan TIU >= 85.
// Disabilitas & Papua: kumulatif >= 286 dan TIU >= 60.
// Olahragawan berprestasi: ambang = nilai terendah pelamar (perankingan,
// tanpa angka tetap) — tidak bisa dinilai LULUS/TIDAK dari skor saja.
const PG_CATS = {
  umum: { label: "Kebutuhan Umum", tiu: 80, total: 311 },
  cumlaude: { label: "Cumlaude & Diaspora", tiu: 85, total: 311 },
  disabilitas: { label: "Disabilitas & Papua", tiu: 60, total: 286 },
  atlet: { label: "Olahragawan Berprestasi", tiu: null, total: null },
};
const STORE_SESSION = "catcpns-session-v1";
const STORE_RESULT = "catcpns-result-v1";
const STORE_PAKET = "catcpns-paket-v1";
// Kunci penyimpanan PER AKUN (sufiks email lowercase) — hasil terakhir,
// sesi tersimpan, dan paket pilihan milik tiap akun terpisah, jadi
// Pembahasan tidak pernah menampilkan hasil akun lain di browser yang sama.
function userKeySuffix() {
  const u = (window.Auth && Auth.getUser) ? Auth.getUser() : null;
  return u && u.email ? ":" + String(u.email).trim().toLowerCase() : ":tamu";
}
function sessionKey() { return STORE_SESSION + userKeySuffix(); }
function resultKey() { return STORE_RESULT + userKeySuffix(); }
function paketKey() { return STORE_PAKET + userKeySuffix(); }
const LETTERS = ["A", "B", "C", "D", "E"];

// ---- Gambar figural TIU (SVG dari DSL kecil, lihat FIGURAL.md) ----
// Sel: {s:"circle"|"square"|"triangle"|"diamond"|"star"|"plus"|"arrow",
//       f:"black"|"white", r:0|45|90|135|180|225|270|315, d:0..3}
// "?" = kotak kosong yang dicari.
const FIG_SHAPES = ["circle", "square", "triangle", "diamond", "star", "plus", "arrow"];

function starPoints(cx, cy, rO, rI) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = (-90 + k * 36) * Math.PI / 180;
    const r = k % 2 === 0 ? rO : rI;
    pts.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1));
  }
  return pts.join(" ");
}

function shapeMarkup(cell) {
  const s = cell.s || "circle";
  if (s === "square") return '<rect x="20" y="20" width="60" height="60"/>';
  if (s === "triangle") return '<polygon points="50,16 84,80 16,80"/>';
  if (s === "diamond") return '<polygon points="50,14 86,50 50,86 14,50"/>';
  if (s === "star") return '<polygon points="' + starPoints(50, 50, 36, 15) + '"/>';
  if (s === "plus") return '<path d="M42 18 h16 v24 h24 v16 h-24 v24 h-16 v-24 h-24 v-16 h24 z"/>';
  if (s === "arrow") return '<polygon points="50,12 78,52 62,52 62,88 38,88 38,52 22,52"/>';
  return '<circle cx="50" cy="50" r="32"/>';
}

function svgCell(cell, size) {
  size = size || 72;
  if (cell === "?") {
    return '<svg class="fig-svg" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" role="img" aria-label="gambar yang dicari"><rect x="6" y="6" width="88" height="88" fill="none" stroke="#94a3b8" stroke-width="3" stroke-dasharray="8 6" rx="8"/><text x="50" y="66" text-anchor="middle" font-size="44" font-weight="700" fill="#64748b">?</text></svg>';
  }
  const fill = cell.f === "white" ? "#ffffff" : "#1a1a1a";
  const dotFill = cell.f === "white" ? "#1a1a1a" : "#ffffff";
  const dots = cell.d || 0;
  let dotSvg = "";
  if (dots === 1) dotSvg = '<circle cx="50" cy="50" r="6" fill="' + dotFill + '"/>';
  else if (dots === 2) dotSvg = '<circle cx="36" cy="50" r="6" fill="' + dotFill + '"/><circle cx="64" cy="50" r="6" fill="' + dotFill + '"/>';
  else if (dots === 3) dotSvg = '<circle cx="50" cy="34" r="6" fill="' + dotFill + '"/><circle cx="36" cy="62" r="6" fill="' + dotFill + '"/><circle cx="64" cy="62" r="6" fill="' + dotFill + '"/>';
  return '<svg class="fig-svg" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" role="img" aria-label="gambar soal"><g transform="rotate(' + (cell.r || 0) + ' 50 50)" fill="' + fill + '" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round">' + shapeMarkup(cell) + '</g>' + dotSvg + '</svg>';
}

function renderFigure(fig) {
  if (!fig) return "";
  if (fig.kind === "seq") {
    return '<div class="fig-seq">' + fig.cells.map((c) => '<span class="fig-cell">' + svgCell(c, 72) + '</span>').join('<span class="fig-arrow">&rarr;</span>') + '</div>';
  }
  if (fig.kind === "matrix") {
    return '<div class="fig-matrix">' + fig.cells.flat().map((c) => '<span class="fig-cell">' + svgCell(c, 64) + '</span>').join("") + '</div>';
  }
  if (fig.kind === "analogy") {
    return '<div class="fig-analogy"><span class="fig-cell">' + svgCell(fig.a, 72) + '</span><span class="fig-sep">:</span><span class="fig-cell">' + svgCell(fig.b, 72) + '</span><span class="fig-sep">::</span><span class="fig-cell">' + svgCell(fig.c, 72) + '</span><span class="fig-sep">:</span><span class="fig-cell">' + svgCell("?", 72) + '</span></div>';
  }
  return "";
}

let QUESTIONS = []; // 110 soal paket yang aktif, urutan TWK -> TIU -> TKP
let QUESTIONS_BY_PAKET = {}; // cache per paket: { A: [...], B: [...] }
let currentPaket = "A"; // dibaca dari kunci per akun saat init (auth sudah jalan)
let AVAILABLE_PAKETS = ["A"]; // diisi dari data/pakets.json saat init
let session = null; // { mode, paket, ids, answers, doubtful, current, remaining, startedAt }
let timerId = null;
let lastResult = null;

// Dipanggil auth.js setiap login/logout: muat ulang state milik akun yang
// sedang aktif (hasil terakhir, sesi tersimpan, paket pilihan) dan gambar
// ulang pemilih paket + kartu lanjutkan. (Fungsi top-level = window.)
function refreshCatcpnsUser() {
  try {
    const raw = localStorage.getItem(resultKey());
    lastResult = raw ? JSON.parse(raw) : null;
  } catch (e) { lastResult = null; }
  try { currentPaket = localStorage.getItem(paketKey()) || "A"; } catch (e) { currentPaket = "A"; }
  if (!AVAILABLE_PAKETS.includes(currentPaket)) currentPaket = AVAILABLE_PAKETS[0] || "A";
  session = loadStoredSession();
  renderPaketPicker();
  refreshResumeCard();
}

const $ = (id) => document.getElementById(id);

function showScreen(name) {
  ["home", "exam", "result", "review", "auth"].forEach((s) => {
    $("screen-" + s).style.display = s === name ? "block" : "none";
  });
  window.scrollTo(0, 0);
}

function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function scoreOf(q, choice) {
  if (choice === null || choice === undefined) return 0;
  return q.scores[choice] || 0;
}

function maxOf(q) {
  return Math.max(...q.scores);
}

// ---------- data (per paket) ----------
async function loadPaketsManifest() {
  try {
    const res = await fetch("data/pakets.json");
    if (!res.ok) return;
    const m = await res.json();
    if (Array.isArray(m.pakets) && m.pakets.length) AVAILABLE_PAKETS = m.pakets;
  } catch (e) { /* pakets.json tidak ada — tetap Paket A */ }
  if (!AVAILABLE_PAKETS.includes(currentPaket)) currentPaket = AVAILABLE_PAKETS[0];
}

async function loadQuestions(paket) {
  paket = paket || currentPaket;
  if (QUESTIONS_BY_PAKET[paket]) {
    QUESTIONS = QUESTIONS_BY_PAKET[paket];
    currentPaket = paket;
    return QUESTIONS;
  }
  const file = "data/questions-" + paket.toLowerCase() + ".json";
  const res = await fetch(file);
  if (!res.ok) throw new Error("Gagal memuat " + file + " (HTTP " + res.status + "). Jalankan lewat HTTP server, mis. python3 -m http.server.");
  const list = await res.json();
  QUESTIONS_BY_PAKET[paket] = list;
  QUESTIONS = list;
  currentPaket = paket;
  return QUESTIONS;
}

// Pemilih paket di beranda: tombol A-E, yang belum tersedia dinonaktifkan.
function renderPaketPicker() {
  const box = $("paketPicker");
  if (!box) return;
  box.innerHTML = "";
  ["A", "B", "C", "D", "E"].forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "paket-btn" + (p === currentPaket ? " active" : "");
    b.dataset.paket = p;
    const ready = AVAILABLE_PAKETS.includes(p);
    b.disabled = !ready;
    b.innerHTML = "<strong>Paket " + p + "</strong><span>" + (ready ? "110 soal original" : "Segera hadir") + "</span>";
    b.addEventListener("click", () => selectPaket(p));
    box.appendChild(b);
  });
}

async function selectPaket(p) {
  if (p === currentPaket || !AVAILABLE_PAKETS.includes(p)) return;
  const s = loadStoredSession();
  if (s && s.paket && s.paket !== p) {
    if (!confirm("Ada simulasi tersimpan di Paket " + s.paket + ".\nGanti ke Paket " + p + " akan menghapus simulasi tersimpan itu.")) return;
    localStorage.removeItem(sessionKey());
    session = null;
  }
  try {
    await loadQuestions(p);
    try { localStorage.setItem(paketKey(), p); } catch (e) {}
    renderPaketPicker();
    refreshResumeCard();
  } catch (e) {
    alert("Paket " + p + " belum bisa dimuat: " + e.message);
  }
}

function questionsFor(mode) {
  if (mode === "full") return QUESTIONS.slice();
  return QUESTIONS.filter((q) => q.category === mode);
}

// ---------- session ----------
function newSession(mode) {
  const qs = questionsFor(mode);
  const minutes = mode === "full" ? FULL.minutes : CONFIG[mode].minutes;
  session = {
    mode,
    paket: currentPaket,
    ids: qs.map((q) => q.id),
    answers: qs.map(() => null),
    doubtful: [],
    current: 0,
    remaining: minutes * 60,
    startedAt: Date.now(),
  };
  saveSession();
  return session;
}

function saveSession() {
  try {
    if (session) localStorage.setItem(sessionKey(), JSON.stringify(session));
    else localStorage.removeItem(sessionKey());
  } catch (e) { /* private mode etc. — lanjut tanpa simpan */ }
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(sessionKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function getQ(i) {
  return QUESTIONS.find((q) => q.id === session.ids[i]);
}

// ---------- exam ----------
function requireLogin() {
  if (window.Auth && Auth.isLoggedIn()) return true;
  if (window.Auth && Auth.promptLogin) Auth.promptLogin();
  return false;
}

async function startExam(mode) {
  if (!requireLogin()) return; // tes hanya untuk yang sudah login
  stopTimer();
  await loadQuestions(currentPaket);
  newSession(mode);
  renderExamChrome();
  renderQuestion();
  renderPalette();
  showScreen("exam");
  startTimer();
}

async function resumeExam() {
  if (!requireLogin()) return; // lanjutkan simulasi juga butuh login
  const s = loadStoredSession();
  if (!s) return;
  stopTimer();
  await loadQuestions(s.paket || "A");
  renderPaketPicker();
  session = s;
  renderExamChrome();
  renderQuestion();
  renderPalette();
  showScreen("exam");
  startTimer();
}

function renderExamChrome() {
  const modeLabel = session.mode === "full" ? "SKD Penuh — 110 soal" : CONFIG[session.mode].label;
  const label = modeLabel + " • Paket " + (session.paket || currentPaket);
  $("examModeLabel").textContent = label;
  $("examModeLabelTop").textContent = label;
  updateTimerUI();
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!session) { stopTimer(); return; } // sesi sudah tidak ada (mis. ganti akun saat timer jalan) — hentikan timer
    session.remaining -= 1;
    if (session.remaining <= 0) {
      session.remaining = 0;
      updateTimerUI();
      finishExam(true);
      return;
    }
    updateTimerUI();
    if (session.remaining % 15 === 0) saveSession();
  }, 1000);
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function updateTimerUI() {
  const t = $("timer");
  t.textContent = fmtTime(session ? session.remaining : 0);
  t.classList.toggle("low", session && session.remaining <= 300);
}

function renderQuestion() {
  const q = getQ(session.current);
  const n = session.ids.length;
  $("examCatLabel").textContent = q.category;
  $("examProgress").textContent = "Soal " + (session.current + 1) + " dari " + n;
  $("qNum").textContent = "Soal " + (session.current + 1) + " • " + q.category;
  $("qSubtopic").textContent = q.subtopic || "";
  $("qText").textContent = q.question;
  const figBox = $("figureBox");
  const isFig = !!q.figure;
  figBox.innerHTML = isFig ? renderFigure(q.figure) : "";
  figBox.style.display = isFig ? "" : "none";
  const box = $("options");
  box.classList.toggle("fig-options", isFig);
  box.innerHTML = "";
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "opt" + (isFig ? " opt-fig" : "") + (session.answers[session.current] === i ? " selected" : "");
    if (isFig) {
      b.innerHTML = '<span class="letter">' + LETTERS[i] + '</span><span class="fig-opt">' + svgCell(opt, 56) + '</span>';
    } else {
      b.innerHTML = '<span class="letter">' + LETTERS[i] + '</span><span></span>';
      b.lastChild.textContent = opt;
    }
    b.onclick = () => {
      session.answers[session.current] = i;
      saveSession();
      renderQuestion();
      renderPalette();
    };
    box.appendChild(b);
  });
  const isDoubt = session.doubtful.includes(session.current);
  $("doubtBtn").classList.toggle("active", isDoubt);
  $("doubtBtn").textContent = isDoubt ? "★ Ditandai Ragu-ragu (klik untuk batal)" : "Tandai Ragu-ragu";
  $("prevBtn").disabled = session.current === 0;
  $("nextBtn").disabled = session.current === n - 1;
}

function renderPalette() {
  const grid = $("palette");
  grid.innerHTML = "";
  const n = session.ids.length;
  let answered = 0, doubt = 0;
  session.answers.forEach((a, i) => {
    if (a !== null) answered++;
    if (session.doubtful.includes(i)) doubt++;
    const b = document.createElement("button");
    b.className = "pal"
      + (a !== null ? " answered" : "")
      + (session.doubtful.includes(i) ? " doubt" : "")
      + (i === session.current ? " current" : "");
    b.textContent = i + 1;
    b.onclick = () => { session.current = i; saveSession(); renderQuestion(); renderPalette(); };
    grid.appendChild(b);
  });
  $("paletteSummary").textContent = "Dijawab: " + answered + " / " + n
    + " • Ragu-ragu: " + doubt + " • Belum dijawab: " + (n - answered);
}

function goTo(i) {
  session.current = Math.max(0, Math.min(session.ids.length - 1, i));
  saveSession();
  renderQuestion();
  renderPalette();
}

function toggleDoubt() {
  const i = session.current;
  const at = session.doubtful.indexOf(i);
  if (at >= 0) session.doubtful.splice(at, 1);
  else session.doubtful.push(i);
  saveSession();
  renderQuestion();
  renderPalette();
}

function finishExam(timeUp) {
  stopTimer();
  const n = session.ids.length;
  const unanswered = session.answers.filter((a) => a === null).length;
  if (!timeUp) {
    const ok = confirm("Selesaikan simulasi?\n\nSoal belum dijawab: " + unanswered + " dari " + n + ".\nSoal yang belum dijawab bernilai 0.");
    if (!ok) { startTimer(); return; }
  } else {
    alert("Waktu habis. Simulasi selesai otomatis.");
  }
  const result = computeResult();
  lastResult = result;
  try { localStorage.setItem(resultKey(), JSON.stringify(result)); } catch (e) {}
  session = null;
  saveSession();
  renderResult(result);
  // Simpan hasil ke akun (Google Sheet) bila sedang login; tamu dilewati.
  const note = $("resultSaveNote");
  if (note) note.textContent = "";
  if (window.Auth && Auth.isLoggedIn()) {
    Auth.saveResult(result).then((ok) => {
      if (note) note.textContent = ok
        ? "Hasil tersimpan di akunmu — lihat di Riwayat Saya (beranda)."
        : "Hasil tidak tersimpan di akun (server tidak merespons). Hasil tetap tersimpan di browser ini.";
    });
  } else if (note) {
    note.textContent = "Kamu mengerjakan sebagai tamu — login untuk menyimpan hasil ke akunmu.";
  }
  showScreen("result");
}

function computeResult() {
  const mode = session.mode;
  const cats = mode === "full" ? ["TWK", "TIU", "TKP"] : [mode];
  const perCat = {};
  let total = 0, maxTotal = 0;
  cats.forEach((c) => {
    let score = 0, correct = 0, answered = 0;
    session.ids.forEach((id, i) => {
      const q = QUESTIONS.find((x) => x.id === id);
      if (!q || q.category !== c) return;
      const choice = session.answers[i];
      if (choice !== null) answered++;
      const s = scoreOf(q, choice);
      score += s;
      if (s === maxOf(q) && choice !== null) correct++;
    });
    const cfg = CONFIG[c];
    perCat[c] = { score, max: cfg.max, pg: cfg.pg, pass: score >= cfg.pg, correct, answered, count: cfg.count };
    total += score;
    maxTotal += cfg.max;
  });
  const usedSec = Math.round((Date.now() - session.startedAt) / 1000);
  const pass = cats.every((c) => perCat[c].pass);
  return {
    mode, paket: session.paket || currentPaket, perCat, total, maxTotal, pass,
    usedSec,
    answered: session.answers.filter((a) => a !== null).length,
    totalQ: session.ids.length,
    answers: session.answers.slice(),
    doubtful: session.doubtful.slice(),
    ids: session.ids.slice(),
    at: new Date().toISOString(),
  };
}

// ---------- result ----------
function renderResult(r) {
  const cats = Object.keys(r.perCat);
  $("resultTitle").textContent = (r.mode === "full" ? "Hasil Simulasi SKD" : "Hasil Latihan " + r.mode)
    + " — Paket " + (r.paket || currentPaket);
  const catKey = ($("pgCatSelect") && $("pgCatSelect").value) || "umum";
  const cat = PG_CATS[catKey] || PG_CATS.umum;
  const special = catKey === "cumlaude" || catKey === "disabilitas";
  const v = $("resultVerdict");
  // Evaluasi per subtes sesuai jenis kebutuhan yang dipilih.
  // Ambang khusus hanya mengenal kumulatif + TIU; TWK/TKP tidak punya
  // ambang per subtes (KepmenPANRB 674/2026, Lampiran II).
  function rowEval(c) {
    const d = r.perCat[c];
    if (catKey === "umum") return { pg: d.pg, pass: d.pass };
    if (catKey === "atlet") return { pg: "—", pass: null };
    if (c === "TIU") return { pg: cat.tiu, pass: d.score >= cat.tiu };
    return { pg: "—", pass: null };
  }
  if (r.mode === "full") {
    if (catKey === "atlet") {
      v.textContent = "TIDAK ADA AMBANG TETAP — kelulusan olahragawan berprestasi berdasarkan nilai terendah pelamar (perankingan).";
      v.className = "verdict";
    } else if (special) {
      const tiuOk = r.perCat.TIU.score >= cat.tiu;
      const totalOk = r.total >= cat.total;
      if (tiuOk && totalOk) {
        v.textContent = "LULUS — memenuhi ambang " + cat.label + " (kumulatif ≥ " + cat.total + ", TIU ≥ " + cat.tiu + ")";
        v.className = "verdict pass";
      } else {
        const kurang = [];
        if (!totalOk) kurang.push("kumulatif kurang " + (cat.total - r.total) + " poin (butuh ≥ " + cat.total + ")");
        if (!tiuOk) kurang.push("TIU kurang " + (cat.tiu - r.perCat.TIU.score) + " poin (butuh ≥ " + cat.tiu + ")");
        v.textContent = "TIDAK LULUS — " + kurang.join("; ");
        v.className = "verdict fail";
      }
    } else if (r.pass) {
      v.textContent = "LULUS — semua passing grade terpenuhi";
      v.className = "verdict pass";
    } else {
      const failed = cats.filter((c) => !r.perCat[c].pass).join(", ");
      v.textContent = "TIDAK LULUS — belum memenuhi passing grade: " + failed;
      v.className = "verdict fail";
    }
  } else {
    const c = cats[0];
    const ev = rowEval(c);
    if (ev.pass === null) {
      v.textContent = "SKOR " + c + " — ambang khusus tidak menetapkan nilai per subtes untuk " + c + " (hanya kumulatif + TIU).";
      v.className = "verdict";
    } else if (ev.pass) {
      v.textContent = "LULUS — " + c + " mencapai passing grade (" + cat.label + ")";
      v.className = "verdict pass";
    } else {
      v.textContent = "TIDAK LULUS — " + c + " di bawah passing grade (" + cat.label + ")";
      v.className = "verdict fail";
    }
  }
  const cumNote = $("resultCumNote");
  if (cumNote) {
    cumNote.textContent = r.mode === "full"
      ? ("Kumulatif: " + r.total + " / 550 • Ambang " + cat.label + ": " + (cat.total === null ? "perankingan (nilai terendah pelamar)" : "≥ " + cat.total))
      : "";
  }
  $("resultMeta").textContent = "Dijawab " + r.answered + " dari " + r.totalQ + " soal • Waktu dipakai "
    + Math.floor(r.usedSec / 60) + " menit " + (r.usedSec % 60) + " detik";
  $("resultTotal").textContent = r.total;
  $("resultTotal").nextSibling.textContent = "/ " + r.maxTotal;
  const box = $("resultCats");
  box.innerHTML = "";
  cats.forEach((c) => {
    const d = r.perCat[c];
    const ev = rowEval(c);
    const row = document.createElement("div");
    row.className = "cat-row";
    const pct = Math.round((d.score / d.max) * 100);
    const pill = ev.pass === null
      ? '<span class="pill">—</span>'
      : '<span class="pill ' + (ev.pass ? "pass" : "fail") + '">' + (ev.pass ? "LULUS" : "BELUM LULUS") + '</span>';
    const barCls = ev.pass === null ? "fill-pass" : (ev.pass ? "fill-pass" : "fill-fail");
    const note = ev.pass === null
      ? "Tidak ada ambang per subtes untuk kategori ini."
      : (ev.pass ? "Di atas passing grade." : "Kurang " + (ev.pg - d.score) + " poin lagi dari passing grade.");
    row.innerHTML =
      '<div class="cat-head"><span>' + CONFIG[c].label + '</span>' +
      '<span>' + d.score + ' / ' + d.max + ' &nbsp;•&nbsp; PG ' + ev.pg +
      ' &nbsp;' + pill + '</span></div>' +
      '<div class="bar"><div class="' + barCls + '" style="width:' + pct + '%"></div></div>' +
      '<div class="muted small">Jawaban terbaik: ' + d.correct + ' dari ' + d.count + ' soal • Dijawab: ' + d.answered + ' • '
      + note + '</div>';
    box.appendChild(row);
  });
  $("reviewBtn").onclick = () => openReview(true);
}

// ---------- review / pembahasan ----------
async function openReview(fromResult) {
  // Pembahasan hanya di dalam akun: tamu diarahkan ke halaman login.
  if (window.Auth && !Auth.isLoggedIn()) { Auth.promptLogin(); return; }
  // Pembahasan mengikuti paket hasil terakhir; bila paketnya berbeda dengan
  // yang sedang aktif, muat dulu bank soal paket itu.
  if (lastResult && lastResult.paket && lastResult.paket !== currentPaket) {
    try { await loadQuestions(lastResult.paket); renderPaketPicker(); } catch (e) { /* tetap tampilkan paket aktif */ }
  }
  const list = $("reviewList");
  list.innerHTML = "";
  $("reviewResultBtn").style.display = fromResult ? "inline-block" : "none";
  $("filterShow").value = "ALL";
  $("filterCat").value = "ALL";
  renderReviewList();
  showScreen("review");
}

function reviewItems() {
  // Items to show: from the last result if any, otherwise the whole bank.
  const ids = lastResult ? lastResult.ids : QUESTIONS.map((q) => q.id);
  return ids.map((id, idx) => {
    const q = QUESTIONS.find((x) => x.id === id);
    const choice = lastResult ? lastResult.answers[idx] : null;
    const doubt = lastResult ? lastResult.doubtful.includes(idx) : false;
    return { q, choice, doubt, idx };
  });
}

function renderReviewList() {
  const cat = $("filterCat").value;
  const show = $("filterShow").value;
  const items = reviewItems().filter(({ q, choice, doubt }) => {
    if (cat !== "ALL" && q.category !== cat) return false;
    if (show === "WRONG") {
      if (choice === null) return false;
      return scoreOf(q, choice) < maxOf(q);
    }
    if (show === "DOUBT") return doubt;
    if (show === "UNANSWERED") return choice === null && !!lastResult;
    return true;
  });
  $("reviewCount").textContent = items.length + " soal ditampilkan";
  $("reviewNote").textContent = lastResult
    ? "Menampilkan hasil simulasi terakhir akunmu (Paket " + (lastResult.paket || currentPaket) + ", " + lastResult.mode + ", " + lastResult.total + "/" + lastResult.maxTotal + "). Untuk TKP, tidak ada jawaban salah mutlak — setiap opsi bernilai 1–5, dan pembahasan menjelaskan peringkatnya."
    : "Mode jelajah: semua 110 soal Paket " + currentPaket + " beserta pembahasannya. Kerjakan dulu simulasi untuk melihat jawaban dan skormu di sini.";
  const list = $("reviewList");
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = '<div class="card"><p class="muted">Tidak ada soal yang cocok dengan filter ini.</p></div>';
    return;
  }
  items.forEach(({ q, choice, doubt }) => {
    const card = document.createElement("div");
    card.className = "card rev-card";
    const best = q.scores.indexOf(maxOf(q));
    let meta = "";
    if (lastResult) {
      const earned = scoreOf(q, choice);
      const verdict = choice === null
        ? '<b class="fail">Tidak dijawab — skor 0</b>'
        : (earned === maxOf(q)
          ? '<b class="pass">Jawabanmu benar/terbaik — skor ' + earned + '</b>'
          : '<b class="fail">Jawabanmu kurang tepat — skor ' + earned + ' dari ' + maxOf(q) + '</b>');
      meta = '<p class="rev-meta">' + verdict + ' • Jawaban terbaik: <b>' + LETTERS[best] + '</b>'
        + (doubt ? ' • ★ Ditandai ragu-ragu' : '') + '</p>';
    }
    card.innerHTML =
      '<div class="q-head"><span class="q-num">Soal ' + (q.id) + '</span>' +
      '<span><span class="tag ' + q.category.toLowerCase() + '">' + q.category + '</span><span class="q-subtopic">' + (q.subtopic || "") + '</span></span></div>' +
      '<p class="q-text"></p>' + (q.figure ? '<div class="rev-fig">' + renderFigure(q.figure) + '</div>' : '') + meta + '<div class="opts"></div>' +
      '<div class="expl"><strong>Pembahasan:</strong> <span></span></div>';
    card.querySelector(".q-text").textContent = q.question;
    const optsBox = card.querySelector(".opts");
    optsBox.innerHTML = "";
    q.options.forEach((opt, i) => {
      const d = document.createElement("div");
      d.className = "rev-opt"
        + (i === best ? " correct" : "")
        + (choice === i ? (i === best ? " yours correct" : " yours wrong") : "");
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = LETTERS[i];
      const body = document.createElement("span");
      if (q.figure) {
        body.className = "fig-opt";
        body.innerHTML = svgCell(opt, 56);
      } else {
        body.textContent = opt + (q.category === "TKP" ? "  (" + q.scores[i] + " poin)" : "");
      }
      d.appendChild(letter);
      d.appendChild(body);
      optsBox.appendChild(d);
    });
    card.querySelector(".expl span").textContent = q.explanation;
    list.appendChild(card);
  });
}

// ---------- home / resume ----------
function refreshResumeCard() {
  const s = loadStoredSession();
  const card = $("resumeCard");
  if (!s) { card.style.display = "none"; return; }
  const answered = s.answers.filter((a) => a !== null).length;
  const modeLabel = s.mode === "full" ? "SKD Penuh" : CONFIG[s.mode].label;
  $("resumeText").textContent = modeLabel + " • Paket " + (s.paket || "A") + " • Dijawab " + answered + " dari " + s.ids.length
    + " soal • Sisa waktu " + fmtTime(s.remaining) + ".";
  card.style.display = "block";
}

// ---------- Formasi CPNS (data resmi API SSCASN BKN) ----------
// API BKN (api-rekrutmen.bkn.go.id/portal/api/spf) hanya mengizinkan CORS
// dari sscasn.bkn.go.id, jadi browser situs ini TIDAK bisa mengambilnya
// langsung. Datanya ditarik sisi server oleh scripts/fetch-formasi.mjs
// (dijalankan GitHub Actions tiap 6 jam) ke data/formasi.json, lalu halaman
// ini memuat file lokal tersebut — malas (lazy): baru diunduh saat kartu
// formasi terlihat di layar.
const SSCASN_FORMASI = "https://sscasn.bkn.go.id/daftar-formasi/";
let formasiData = null;
let formasiLoadStarted = false;
let formasiPage = 1;
const FORMASI_PAGE = 10;

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtNum(n) { return Number(n || 0).toLocaleString("id-ID"); }

async function loadFormasi() {
  if (formasiLoadStarted) return formasiData;
  formasiLoadStarted = true;
  const status = $("formasiStatus");
  try {
    const res = await fetch("data/formasi.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    formasiData = await res.json();
    if (!Array.isArray(formasiData.rows)) throw new Error("bentuk data tidak dikenal");
  } catch (e) {
    if (status) status.innerHTML = "Gagal memuat data formasi. Cek langsung di <a href=\"" + SSCASN_FORMASI + "\" target=\"_blank\" rel=\"noopener\">portal SSCASN</a>.";
    return null;
  }
  renderFormasiStats();
  fillFormasiJenis();
  renderFormasiList();
  return formasiData;
}

function renderFormasiStats() {
  const d = formasiData;
  $("formasiStatRows").textContent = fmtNum(d.totalRows);
  $("formasiStatNeed").textContent = fmtNum(d.totalKebutuhan);
  $("formasiStatInst").textContent = fmtNum(new Set(d.rows.map((r) => r.instansi)).size);
  $("formasiStats").style.display = "flex";
  // Jujur soal CPNS: kalau API BKN belum memuat satu pun formasi CPNS,
  // katakan begitu — jangan tampilkan daftar PPPK seolah-olah itu CPNS.
  const note = $("formasiCpnsNote");
  const hasCpns = d.rows.some((r) => /cpns/i.test(r.jenis_pengadaan || ""));
  if (!hasCpns) {
    note.textContent = "Formasi CPNS belum tersedia di data SSCASN saat ini — yang tampil di bawah adalah seleksi lain yang sedang dibuka. Formasi CPNS akan muncul otomatis di sini begitu BKN merilisnya.";
    note.style.display = "block";
  } else {
    note.style.display = "none";
  }
  if (d.fetchedAt) {
    const t = new Date(d.fetchedAt);
    const fmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    $("formasiMeta").textContent = "Diperbarui " + fmt.format(t).replace(/\./g, ":") + " WIB · Sumber: SSCASN BKN";
  }
}

function fillFormasiJenis() {
  const sel = $("formasiJenis");
  const jenis = (formasiData.jenisPengadaan && formasiData.jenisPengadaan.length)
    ? formasiData.jenisPengadaan
    : [...new Set(formasiData.rows.map((r) => r.jenis_pengadaan))];
  for (const j of jenis) {
    const o = document.createElement("option");
    o.value = j;
    o.textContent = j;
    sel.appendChild(o);
  }
}

function formasiFiltered() {
  const q = ($("formasiSearch").value || "").trim().toLowerCase();
  const jenis = $("formasiJenis").value;
  return formasiData.rows.filter((r) => {
    if (jenis && r.jenis_pengadaan !== jenis) return false;
    if (!q) return true;
    return [r.nama_jabatan, r.instansi, r.lokasi_formasi, r.nama_pendidikan, r.nama_event]
      .some((v) => (v || "").toLowerCase().includes(q));
  });
}

function formasiRowHtml(r) {
  const det = [
    r.nama_pendidikan ? "<div><span>Pendidikan</span><strong>" + escHtml(r.nama_pendidikan) + "</strong></div>" : "",
    r.jenis_formasi ? "<div><span>Jenis formasi</span><strong>" + escHtml(r.jenis_formasi) + "</strong></div>" : "",
    (r.usia_min != null || r.usia_max != null) ? "<div><span>Usia</span><strong>" + escHtml(r.usia_min ?? "–") + "–" + escHtml(r.usia_max ?? "–") + " tahun</strong></div>" : "",
    r.jabatan_kode ? "<div><span>Kode jabatan</span><strong>" + escHtml(r.jabatan_kode) + "</strong></div>" : "",
    r.is_disabilitas ? "<div><span>Disabilitas</span><strong>" + escHtml(r.is_disabilitas) + "</strong></div>" : "",
  ].filter(Boolean).join("");
  return '<article class="formasi-item">'
    + '<button type="button" class="formasi-head">'
    + '<span class="formasi-main"><strong>' + escHtml(r.nama_jabatan) + "</strong>"
    + "<span>" + escHtml(r.instansi) + "</span>"
    + '<span class="formasi-loc">' + escHtml(r.lokasi_formasi || "–") + "</span></span>"
    + '<span class="formasi-need"><strong>' + fmtNum(r.jumlah) + "</strong><span>kebutuhan</span></span>"
    + "</button>"
    + '<div class="formasi-tags"><span class="tag">' + escHtml(r.jenis_pengadaan) + '</span><span class="tag tag-soft">' + escHtml(r.nama_event) + "</span></div>"
    + (det ? '<div class="formasi-detail" hidden>' + det + '<a href="' + SSCASN_FORMASI + '" target="_blank" rel="noopener">Rincian lengkap di SSCASN &rsaquo;</a></div>' : "")
    + "</article>";
}

function renderFormasiList(reset = true) {
  if (!formasiData) return;
  const rows = formasiFiltered();
  const totalPages = Math.max(1, Math.ceil(rows.length / FORMASI_PAGE));
  if (reset) formasiPage = 1;
  formasiPage = Math.min(Math.max(1, formasiPage), totalPages);
  const start = (formasiPage - 1) * FORMASI_PAGE;
  const pageRows = rows.slice(start, start + FORMASI_PAGE);
  $("formasiList").innerHTML = pageRows.map(formasiRowHtml).join("");
  $("formasiStatus").textContent = rows.length === 0
    ? "Tidak ada formasi yang cocok dengan pencarian. Coba ubah kata kunci atau reset filter."
    : "Menampilkan " + fmtNum(pageRows.length ? start + 1 : 0) + "–" + fmtNum(start + pageRows.length) + " dari " + fmtNum(rows.length) + " formasi"
      + (rows.length !== formasiData.totalRows ? " (difilter dari " + fmtNum(formasiData.totalRows) + ")" : "");
  $("formasiPageInfo").textContent = "Halaman " + formasiPage + " dari " + fmtNum(totalPages);
  $("formasiPrev").disabled = formasiPage <= 1;
  $("formasiNext").disabled = formasiPage >= totalPages;
  $("formasiPager").style.display = rows.length > 0 ? "flex" : "none";
}

function initFormasi() {
  const card = $("formasiCard");
  if (!card) return;
  $("formasiSearch").addEventListener("input", () => renderFormasiList());
  $("formasiJenis").addEventListener("change", () => renderFormasiList());
  $("formasiReset").addEventListener("click", () => {
    $("formasiSearch").value = "";
    $("formasiJenis").value = "";
    renderFormasiList();
  });
  $("formasiPrev").addEventListener("click", () => {
    if (formasiPage > 1) { formasiPage--; renderFormasiList(false); }
  });
  $("formasiNext").addEventListener("click", () => {
    formasiPage++; renderFormasiList(false);
  });
  $("formasiList").addEventListener("click", (ev) => {
    const head = ev.target.closest(".formasi-head");
    if (!head) return;
    const det = head.parentElement.querySelector(".formasi-detail");
    if (det) det.hidden = !det.hidden;
  });
  // Muat data hanya saat kartu terlihat (file ~600 KB) — jangan bebani
  // kunjungan yang cuma mau latihan.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadFormasi(); }
    }, { rootMargin: "400px" });
    io.observe(card);
  } else {
    loadFormasi();
  }
}

async function init() {
  // Hapus kunci lama TANPA sufiks akun (data pra-perbaikan yang bisa
  // dibaca akun lain) — jangan pernah diadopsi ke akun yang sedang login.
  try {
    localStorage.removeItem(STORE_SESSION);
    localStorage.removeItem(STORE_RESULT);
    localStorage.removeItem(STORE_PAKET);
    // Paket + hasil terakhir milik akun yang sedang login (auth sudah jalan).
    currentPaket = localStorage.getItem(paketKey()) || "A";
  } catch (e) { currentPaket = "A"; }
  try {
    await loadPaketsManifest();
    renderPaketPicker();
    await loadQuestions(currentPaket);
  } catch (e) {
    document.querySelector(".hero").insertAdjacentHTML("beforeend",
      '<p class="disclaimer"><strong>Gagal memuat soal:</strong> ' + e.message + '</p>');
    return;
  }
  try {
    const raw = localStorage.getItem(resultKey());
    if (raw) lastResult = JSON.parse(raw);
  } catch (e) {}
  document.querySelectorAll(".mode").forEach((b) => {
    b.addEventListener("click", async () => {
      const mode = b.dataset.mode;
      if (mode === "review") { lastResult = lastResult; openReview(false); return; }
      startExam(mode);
    });
  });
  $("resumeBtn").addEventListener("click", resumeExam);
  $("discardBtn").addEventListener("click", () => {
    if (confirm("Hapus simulasi yang tersimpan?")) {
      localStorage.removeItem(sessionKey());
      session = null;
      refreshResumeCard();
    }
  });
  $("prevBtn").addEventListener("click", () => goTo(session.current - 1));
  $("nextBtn").addEventListener("click", () => goTo(session.current + 1));
  $("doubtBtn").addEventListener("click", toggleDoubt);
  $("finishBtn").addEventListener("click", () => finishExam(false));
  $("retryBtn").addEventListener("click", () => { if (lastResult) startExam(lastResult.mode); });
  $("homeBtn").addEventListener("click", () => { showScreen("home"); refreshResumeCard(); });
  $("reviewHomeBtn").addEventListener("click", () => { showScreen("home"); refreshResumeCard(); });
  $("reviewResultBtn").addEventListener("click", () => { if (lastResult) { renderResult(lastResult); showScreen("result"); } });
  // Pilih jenis kebutuhan di layar hasil: nilai ulang hasil yang sama
  // terhadap ambang kategori itu (tanpa mengubah hasil yang tersimpan).
  const pgSel = $("pgCatSelect");
  if (pgSel) pgSel.addEventListener("change", () => { if (lastResult) renderResult(lastResult); });
  $("filterCat").addEventListener("change", renderReviewList);
  $("filterShow").addEventListener("change", renderReviewList);

  // ---------- hero: kata kunci berputar (SKD / TWK / TIU / TKP) ----------
  const heroRot = $("heroRot");
  if (heroRot) {
    const words = ["SKD", "TWK", "TIU", "TKP"];
    let wi = 0;
    setInterval(() => {
      wi = (wi + 1) % words.length;
      heroRot.style.opacity = 0;
      setTimeout(() => { heroRot.textContent = words[wi]; heroRot.style.opacity = 1; }, 250);
    }, 2600);
  }
  // Tombol di hero / timeline: gulir ke kartu atau buka daftar/masuk.
  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", () => {
      showScreen("home");
      const t = document.getElementById(el.dataset.scrollTo);
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  // Tombol di hero / timeline / kartu tamu: masuk, daftar, atau gulir ke kartu.
  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      if (!window.Auth) return;
      if (el.dataset.action === "login") { Auth.promptLogin(); return; }
      if (el.dataset.action === "start") {
        if (Auth.isLoggedIn()) {
          showScreen("home");
          const t = document.getElementById("modeCard");
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
        } else Auth.promptLogin();
        return;
      }
      if (el.dataset.action === "register") {
        if (Auth.isLoggedIn()) {
          showScreen("home");
          const t = document.getElementById("modeCard");
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
        } else Auth.promptRegister();
      }
    });
  });
  // Link nav atas: Beranda / Format / Cara / Pembahasan.
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const target = el.dataset.nav;
      if (target === "review") { openReview(false); return; }
      showScreen("home");
      refreshResumeCard();
      const map = { home: null, formasi: "formasiCard", format: "formatCard", howto: "howtoCard" };
      if (target === "home") window.scrollTo({ top: 0, behavior: "smooth" });
      else if (map[target]) {
        const t = document.getElementById(map[target]);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  initFormasi();
  refreshResumeCard();
}

document.addEventListener("DOMContentLoaded", init);
