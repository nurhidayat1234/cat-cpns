// Gabungkan data/paket-<huruf>/{twk,tiu,tkp}.json -> data/questions-<huruf>.json
// dengan validasi per paket: jumlah per kategori, 5 opsi, answer valid,
// scores valid (TWK/TIU: satu 5 sisanya 0; TKP: permutasi 1-5), explanation
// tidak kosong, sebaran jawaban tidak menumpuk. Ditambah cek duplikat
// ANTAR paket: tidak boleh ada soal yang sama (teks pertanyaan ternormalisasi)
// dipakai di dua paket.
// Keluaran: data/questions-a.json ... data/questions-e.json (yang ada),
// data/questions.json (= salinan Paket A, kompatibilitas lama),
// data/pakets.json (manifes paket yang tersedia, dibaca situs).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const EXPECT = { TWK: 30, TIU: 35, TKP: 45 };
const problems = [];
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const seen = new Map(); // teks ternormalisasi -> "Paket X / id"

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
      if (q.options && q.options.some((o) => typeof o !== "string" || !o.trim())) problems.push(`${tag}: ada opsi kosong`);
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
      // Duplikat antar paket: teks pertanyaan yang sama persis (abaikan kapital/spasi/tanda baca).
      const key = norm(q.question);
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
