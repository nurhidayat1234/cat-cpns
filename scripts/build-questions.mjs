// Gabungkan data/paket-<huruf>/{twk,tiu,tkp}.json -> data/questions-<huruf>.json
// dengan validasi per paket: jumlah per kategori, 5 opsi, answer valid,
// scores valid (TWK/TIU: satu 5 sisanya 0; TKP: permutasi 1-5), explanation
// tidak kosong, sebaran jawaban tidak menumpuk. Soal figural TIU wajib
// punya `figure` (DSL gambar SVG, lihat FIGURAL.md) dan 5 opsi gambar.
// Ditambah cek duplikat ANTAR paket: tidak boleh ada soal yang sama
// (teks pertanyaan + figure + opsi ternormalisasi) dipakai di dua paket.
// Keluaran: data/questions-a.json ... data/questions-e.json (yang ada),
// data/questions.json (= salinan Paket A, kompatibilitas lama),
// data/pakets.json (manifes paket yang tersedia, dibaca situs).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const EXPECT = { TWK: 30, TIU: 35, TKP: 45 };
const problems = [];
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const seen = new Map(); // kunci soal -> "Paket X / id"

// Validasi DSL gambar figural (FIGURAL.md): sel = {s,f,r,d} atau "?".
const FIG_SHAPES = ["circle", "square", "triangle", "diamond", "star", "plus", "arrow"];
const FIG_ROT = [0, 45, 90, 135, 180, 225, 270, 315];
function validCell(c, tag) {
  if (c === "?") return;
  if (!c || typeof c !== "object") { problems.push(`${tag}: sel gambar bukan objek`); return; }
  if (!FIG_SHAPES.includes(c.s)) problems.push(`${tag}: bentuk gambar tidak dikenal: ${c.s}`);
  if (c.f !== undefined && c.f !== "black" && c.f !== "white") problems.push(`${tag}: isi gambar harus black/white`);
  if (c.r !== undefined && !FIG_ROT.includes(c.r)) problems.push(`${tag}: rotasi gambar tidak valid: ${c.r}`);
  if (c.d !== undefined && (!Number.isInteger(c.d) || c.d < 0 || c.d > 3)) problems.push(`${tag}: titik gambar harus 0-3`);
}
function validFigure(fig, tag) {
  if (!fig || typeof fig !== "object") { problems.push(`${tag}: soal figural wajib punya figure`); return; }
  if (fig.kind === "seq") {
    if (!Array.isArray(fig.cells) || fig.cells.length < 4 || fig.cells.length > 6) problems.push(`${tag}: figure seq harus 4-6 sel`);
    else {
      fig.cells.forEach((c) => validCell(c, tag));
      if (fig.cells[fig.cells.length - 1] !== "?") problems.push(`${tag}: sel terakhir seq harus "?"`);
    }
  } else if (fig.kind === "matrix") {
    const rows = fig.cells;
    if (!Array.isArray(rows) || rows.length !== 3 || rows.some((r) => !Array.isArray(r) || r.length !== 3)) problems.push(`${tag}: figure matrix harus 3x3`);
    else {
      rows.flat().forEach((c) => validCell(c, tag));
      if (rows[2][2] !== "?") problems.push(`${tag}: sel kanan bawah matrix harus "?"`);
    }
  } else if (fig.kind === "analogy") {
    ["a", "b", "c"].forEach((k) => validCell(fig[k], tag));
  } else problems.push(`${tag}: figure kind tidak dikenal: ${fig.kind}`);
}

function buildPaket(letter) {
  const dir = `data/paket-${letter.toLowerCase()}`;
  if (!existsSync(dir)) return null;
  const out = [];
  for (const cat of ["TWK", "TIU", "TKP"]) {
    const path = `${dir}/${cat.toLowerCase()}.json`;
    if (!existsSync(path)) { problems.push(`Paket ${letter} ${cat}: file ${path} tidak ada`); continue; }
    const list = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(list)) problems.push(`Paket ${letter} ${cat}: bukan array`);
    if (list.length !== EXPECT[cat]) problems.push(`Paket ${letter} ${cat}: jumlah ${list.length}, harus ${EXPECT[cat]}`);
    const ids = new Set();
    list.forEach((q, i) => {
      const tag = `Paket ${letter} ${cat}[${i}]`;
      if (q.category !== cat) problems.push(`${tag}: category ${q.category}`);
      if (ids.has(q.id)) problems.push(`${tag}: id duplikat ${q.id}`);
      ids.add(q.id);
      if (!Array.isArray(q.options) || q.options.length !== 5) problems.push(`${tag}: options bukan 5`);
      else if (q.options.some((o) => typeof o === "object")) {
        if (!q.options.every((o) => typeof o === "object")) problems.push(`${tag}: opsi gambar dan teks tercampur`);
        q.options.forEach((o) => validCell(o, tag));
      } else if (q.options.some((o) => typeof o !== "string" || !o.trim())) problems.push(`${tag}: ada opsi kosong`);
      // Soal figural wajib punya figure + opsi gambar; non-figural tidak boleh punya figure.
      const isFigural = (q.subtopic || "").startsWith("Figural");
      if (isFigural) {
        validFigure(q.figure, tag);
        if (q.options && !q.options.every((o) => typeof o === "object")) problems.push(`${tag}: soal figural opsinya harus gambar`);
      } else if (q.figure) problems.push(`${tag}: soal non-figural tidak boleh punya figure`);
      if (typeof q.question !== "string" || !q.question.trim()) problems.push(`${tag}: question kosong`);
      if (typeof q.explanation !== "string" || q.explanation.trim().length < 40) problems.push(`${tag}: explanation terlalu pendek/kosong`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 4) problems.push(`${tag}: answer tidak valid`);
      if (!Array.isArray(q.scores) || q.scores.length !== 5) problems.push(`${tag}: scores bukan 5`);
      else if (cat === "TKP") {
        if ([...q.scores].sort().join() !== "1,2,3,4,5") problems.push(`${tag}: scores TKP bukan permutasi 1-5: ${q.scores}`);
        if (q.scores[q.answer] !== 5) problems.push(`${tag}: answer bukan skor 5`);
      } else {
        const expect = [0, 0, 0, 0, 0]; expect[q.answer] = 5;
        if (q.scores.join() !== expect.join()) problems.push(`${tag}: scores harus ${expect}, dapat ${q.scores}`);
      }
      // Duplikat antar paket: teks + figure + opsi yang sama persis
      // (abaikan kapital/spasi/tanda baca pada teks).
      const key = norm(q.question) + "|" + JSON.stringify(q.figure || null) + "|" + JSON.stringify(q.options);
      if (key.length > 20) {
        if (seen.has(key)) problems.push(`${tag}: soal sama dengan ${seen.get(key)} (duplikat antar paket)`);
        else seen.set(key, `Paket ${letter} / ${q.id}`);
      }
    });
    out.push(...list);
  }
  // Jawaban benar tidak boleh menumpuk di satu huruf.
  for (const cat of ["TWK", "TIU", "TKP"]) {
    const dist = [0, 0, 0, 0, 0];
    out.filter((q) => q.category === cat).forEach((q) => dist[q.answer]++);
    console.log(`Paket ${letter} ${cat} distribusi jawaban A-E:`, dist.join("/"));
    if (Math.max(...dist) > Math.ceil(EXPECT[cat] * 0.4)) problems.push(`Paket ${letter} ${cat}: jawaban menumpuk di satu huruf (${dist})`);
  }
  // Sebaran subtopik (kisi-kisi 674/2026) — dicetak untuk dicek merata.
  const sub = {};
  out.forEach((q) => { sub[q.subtopic] = (sub[q.subtopic] || 0) + 1; });
  console.log(`Paket ${letter} subtopik:`, JSON.stringify(sub));
  return out;
}

const pakets = [];
for (const letter of ["A", "B", "C", "D", "E"]) {
  const out = buildPaket(letter);
  if (!out) continue;
  pakets.push(letter);
  writeFileSync(`data/questions-${letter.toLowerCase()}.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(`OK: data/questions-${letter.toLowerCase()}.json — total`, out.length, "soal (TWK 30, TIU 35, TKP 45).");
}
if (!pakets.includes("A")) problems.push("Paket A wajib ada (data/paket-a/)");
if (problems.length) {
  console.error("VALIDASI GAGAL (" + problems.length + " masalah):");
  problems.forEach((p) => console.error(" - " + p));
  process.exit(1);
}
// Kompatibilitas: data/questions.json = salinan Paket A.
writeFileSync("data/questions.json", readFileSync("data/questions-a.json", "utf8"));
writeFileSync("data/pakets.json", JSON.stringify({ pakets }, null, 2) + "\n");
console.log("OK: data/questions.json (= Paket A), data/pakets.json:", JSON.stringify(pakets));
