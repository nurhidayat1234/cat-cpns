// Gabungkan data/questions-{twk,tiu,tkp}.json -> data/questions.json
// dengan validasi: jumlah per kategori, 5 opsi, answer valid, scores valid
// (TWK/TIU: satu 5 sisanya 0; TKP: permutasi 1-5), explanation tidak kosong.
import { readFileSync, writeFileSync } from "node:fs";

const EXPECT = { TWK: 30, TIU: 35, TKP: 45 };
const out = [];
const problems = [];

for (const cat of ["TWK", "TIU", "TKP"]) {
  const path = `data/questions-${cat.toLowerCase()}.json`;
  const list = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(list)) problems.push(`${cat}: bukan array`);
  if (list.length !== EXPECT[cat]) problems.push(`${cat}: jumlah ${list.length}, harus ${EXPECT[cat]}`);
  const ids = new Set();
  list.forEach((q, i) => {
    const tag = `${cat}[${i}]`;
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
  });
  out.push(...list);
}

// jawaban benar tidak boleh menumpuk di satu huruf
for (const cat of ["TWK", "TIU", "TKP"]) {
  const dist = [0, 0, 0, 0, 0];
  out.filter((q) => q.category === cat).forEach((q) => dist[q.answer]++);
  console.log(cat, "distribusi jawaban A-E:", dist.join("/"));
  if (Math.max(...dist) > Math.ceil(EXPECT[cat] * 0.4)) problems.push(`${cat}: jawaban menumpuk di satu huruf (${dist})`);
}

if (problems.length) {
  console.error("VALIDASI GAGAL (" + problems.length + " masalah):");
  problems.forEach((p) => console.error(" - " + p));
  process.exit(1);
}
writeFileSync("data/questions.json", JSON.stringify(out, null, 2) + "\n");
console.log("OK: data/questions.json — total", out.length, "soal (TWK 30, TIU 35, TKP 45).");
