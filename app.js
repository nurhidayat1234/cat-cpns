// Simulasi CAT CPNS — SKD (latihan). Static, no backend.
// Data: data/questions.json (110 soal original: TWK 30, TIU 35, TKP 45).
// Format resmi (KepmenPANRB 321/2024, TA 2024): TWK 30 soal PG 65, TIU 35
// soal PG 80, TKP 45 soal PG 166, total 110 soal / 100 menit / maks 550.
// TWK & TIU: benar 5, salah/kosong 0. TKP: tiap opsi 1-5, kosong 0.
const CONFIG = {
  TWK: { label: "TWK — Tes Wawasan Kebangsaan", count: 30, max: 150, pg: 65, minutes: 27 },
  TIU: { label: "TIU — Tes Intelegensia Umum", count: 35, max: 175, pg: 80, minutes: 32 },
  TKP: { label: "TKP — Tes Karakteristik Pribadi", count: 45, max: 225, pg: 166, minutes: 41 },
};
const FULL = { label: "SKD Penuh", count: 110, max: 550, minutes: 100 };
const STORE_SESSION = "catcpns-session-v1";
const STORE_RESULT = "catcpns-result-v1";
const LETTERS = ["A", "B", "C", "D", "E"];

let QUESTIONS = []; // all 110, ordered TWK -> TIU -> TKP
let session = null; // { mode, ids, answers, doubtful, current, remaining, startedAt }
let timerId = null;
let lastResult = null;

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

// ---------- data ----------
async function loadQuestions() {
  if (QUESTIONS.length) return QUESTIONS;
  const res = await fetch("data/questions.json");
  if (!res.ok) throw new Error("Gagal memuat data/questions.json (HTTP " + res.status + "). Jalankan lewat HTTP server, mis. python3 -m http.server.");
  QUESTIONS = await res.json();
  return QUESTIONS;
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
    if (session) localStorage.setItem(STORE_SESSION, JSON.stringify(session));
    else localStorage.removeItem(STORE_SESSION);
  } catch (e) { /* private mode etc. — lanjut tanpa simpan */ }
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORE_SESSION);
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

function startExam(mode) {
  if (!requireLogin()) return; // tes hanya untuk yang sudah login
  stopTimer();
  newSession(mode);
  renderExamChrome();
  renderQuestion();
  renderPalette();
  showScreen("exam");
  startTimer();
}

function resumeExam() {
  if (!requireLogin()) return; // lanjutkan simulasi juga butuh login
  const s = loadStoredSession();
  if (!s) return;
  stopTimer();
  session = s;
  renderExamChrome();
  renderQuestion();
  renderPalette();
  showScreen("exam");
  startTimer();
}

function renderExamChrome() {
  const modeLabel = session.mode === "full" ? "SKD Penuh — 110 soal" : CONFIG[session.mode].label;
  $("examModeLabel").textContent = modeLabel;
  $("examModeLabelTop").textContent = modeLabel;
  updateTimerUI();
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
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
  const box = $("options");
  box.innerHTML = "";
  q.options.forEach((text, i) => {
    const b = document.createElement("button");
    b.className = "opt" + (session.answers[session.current] === i ? " selected" : "");
    b.innerHTML = '<span class="letter">' + LETTERS[i] + '</span><span></span>';
    b.lastChild.textContent = text;
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
  try { localStorage.setItem(STORE_RESULT, JSON.stringify(result)); } catch (e) {}
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
    mode, perCat, total, maxTotal, pass,
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
  $("resultTitle").textContent = r.mode === "full" ? "Hasil Simulasi SKD" : "Hasil Latihan " + r.mode;
  const v = $("resultVerdict");
  if (r.mode === "full") {
    if (r.pass) {
      v.textContent = "LULUS — semua passing grade terpenuhi";
      v.className = "verdict pass";
    } else {
      const failed = cats.filter((c) => !r.perCat[c].pass).join(", ");
      v.textContent = "TIDAK LULUS — belum memenuhi passing grade: " + failed;
      v.className = "verdict fail";
    }
  } else {
    const c = cats[0];
    if (r.perCat[c].pass) {
      v.textContent = "LULUS — " + c + " mencapai passing grade";
      v.className = "verdict pass";
    } else {
      v.textContent = "TIDAK LULUS — " + c + " di bawah passing grade";
      v.className = "verdict fail";
    }
  }
  $("resultMeta").textContent = "Dijawab " + r.answered + " dari " + r.totalQ + " soal • Waktu dipakai "
    + Math.floor(r.usedSec / 60) + " menit " + (r.usedSec % 60) + " detik";
  $("resultTotal").textContent = r.total;
  $("resultTotal").nextSibling.textContent = "/ " + r.maxTotal;
  const box = $("resultCats");
  box.innerHTML = "";
  cats.forEach((c) => {
    const d = r.perCat[c];
    const row = document.createElement("div");
    row.className = "cat-row";
    const pct = Math.round((d.score / d.max) * 100);
    row.innerHTML =
      '<div class="cat-head"><span>' + CONFIG[c].label + '</span>' +
      '<span>' + d.score + ' / ' + d.max + ' &nbsp;•&nbsp; PG ' + d.pg +
      ' &nbsp;<span class="pill ' + (d.pass ? "pass" : "fail") + '">' + (d.pass ? "LULUS" : "BELUM LULUS") + '</span></span></div>' +
      '<div class="bar"><div class="' + (d.pass ? "fill-pass" : "fill-fail") + '" style="width:' + pct + '%"></div></div>' +
      '<div class="muted small">Jawaban terbaik: ' + d.correct + ' dari ' + d.count + ' soal • Dijawab: ' + d.answered + ' • '
      + (d.pass ? "Di atas passing grade." : "Kurang " + (d.pg - d.score) + " poin lagi dari passing grade.") + '</div>';
    box.appendChild(row);
  });
  $("reviewBtn").onclick = () => openReview(true);
}

// ---------- review / pembahasan ----------
function openReview(fromResult) {
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
    ? "Menampilkan hasil simulasi terakhir (" + lastResult.mode + ", " + lastResult.total + "/" + lastResult.maxTotal + "). Untuk TKP, tidak ada jawaban salah mutlak — setiap opsi bernilai 1–5, dan pembahasan menjelaskan peringkatnya."
    : "Mode jelajah: semua 110 soal beserta pembahasannya. Kerjakan dulu simulasi untuk melihat jawaban dan skormu di sini.";
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
      '<p class="q-text"></p>' + meta + '<div class="opts"></div>' +
      '<div class="expl"><strong>Pembahasan:</strong> <span></span></div>';
    card.querySelector(".q-text").textContent = q.question;
    const optsBox = card.querySelector(".opts");
    optsBox.innerHTML = "";
    q.options.forEach((text, i) => {
      const d = document.createElement("div");
      d.className = "rev-opt"
        + (i === best ? " correct" : "")
        + (choice === i ? (i === best ? " yours correct" : " yours wrong") : "");
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = LETTERS[i];
      const body = document.createElement("span");
      body.textContent = text + (q.category === "TKP" ? "  (" + q.scores[i] + " poin)" : "");
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
  $("resumeText").textContent = modeLabel + " • Dijawab " + answered + " dari " + s.ids.length
    + " soal • Sisa waktu " + fmtTime(s.remaining) + ".";
  card.style.display = "block";
}

async function init() {
  try {
    await loadQuestions();
  } catch (e) {
    document.querySelector(".hero").insertAdjacentHTML("beforeend",
      '<p class="disclaimer"><strong>Gagal memuat soal:</strong> ' + e.message + '</p>');
    return;
  }
  try {
    const raw = localStorage.getItem(STORE_RESULT);
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
      localStorage.removeItem(STORE_SESSION);
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
  $("filterCat").addEventListener("change", renderReviewList);
  $("filterShow").addEventListener("change", renderReviewList);

  // ---------- hero carousel + navigasi beranda ----------
  const slides = Array.from(document.querySelectorAll(".hero-slide"));
  const dots = Array.from(document.querySelectorAll(".hero-dot"));
  let heroIdx = 0, heroTimer = null;
  function showSlide(i) {
    if (!slides.length) return;
    heroIdx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("active", k === heroIdx));
    dots.forEach((d, k) => d.classList.toggle("active", k === heroIdx));
  }
  function heroAuto() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => showSlide(heroIdx + 1), 6000);
  }
  const heroEl = document.querySelector(".hero");
  if (slides.length) {
    $("heroPrev").addEventListener("click", () => { showSlide(heroIdx - 1); heroAuto(); });
    $("heroNext").addEventListener("click", () => { showSlide(heroIdx + 1); heroAuto(); });
    dots.forEach((d) => d.addEventListener("click", () => { showSlide(+d.dataset.slide); heroAuto(); }));
    heroEl.addEventListener("mouseenter", () => clearInterval(heroTimer));
    heroEl.addEventListener("mouseleave", heroAuto);
    heroAuto();
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
      const map = { home: null, format: "formatCard", howto: "howtoCard" };
      if (target === "home") window.scrollTo({ top: 0, behavior: "smooth" });
      else if (map[target]) {
        const t = document.getElementById(map[target]);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  refreshResumeCard();
}

document.addEventListener("DOMContentLoaded", init);
