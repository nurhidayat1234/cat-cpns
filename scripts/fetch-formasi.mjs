// Ambil data formasi dari API resmi SSCASN BKN, rapikan, simpan ke data/formasi.json.
// API: https://api-rekrutmen.bkn.go.id/portal/api/spf (GET, tanpa parameter,
// mengembalikan {error:false, data:[...]} — semua seleksi yang sedang dibuka).
// Dipakai dua arah: dijalankan manual di sini DAN oleh GitHub Actions
// (.github/workflows/sync-formasi.yml, tiap 6 jam) supaya data di situs
// selalu segar tanpa perlu fetch dari browser (API BKN hanya mengizinkan
// CORS dari sscasn.bkn.go.id, jadi fetch langsung dari github.io diblokir).
// Gagal fetch = keluar non-zero TANPA menimpa file lama.
import { writeFileSync } from "node:fs";

const API = "https://api-rekrutmen.bkn.go.id/portal/api/spf";
const OUT = new URL("../data/formasi.json", import.meta.url);

const KEEP = [
  "nama_event", "jenis_pengadaan", "instansi", "nama_jabatan",
  "lokasi_formasi", "nama_pendidikan", "jumlah", "jenis_formasi",
  "usia_min", "usia_max", "jabatan_kode", "is_disabilitas",
];
// Sengaja TIDAK disimpan: `persyaratan` (teks panjang yang sama berulang —
// 3,2 MB dari 4,6 MB), `penghasilan_min/max` (selalu kosong di API saat ini),
// `id` (UUID 36 karakter; urutan baris dipakai sebagai kunci), `jobdesc`
// dan `group_pendidikan` (kosong). Rincian lengkap tetap bisa dilihat di
// portal SSCASN lewat tautan di situs.

const res = await fetch(API, { headers: { Accept: "application/json" } });
if (!res.ok) {
  console.error(`API gagal: HTTP ${res.status}`);
  process.exit(1);
}
const body = await res.json();
if (body?.error !== false || !Array.isArray(body?.data)) {
  console.error("API mengembalikan bentuk tak dikenal:", JSON.stringify(body).slice(0, 200));
  process.exit(1);
}
const rows = body.data
  .filter((r) => r && r.nama_jabatan)
  .map((r) => {
    const o = {};
    for (const k of KEEP) {
      const v = r[k] ?? null;
      if (v !== null && v !== "") o[k] = v;
    }
    o.jumlah = Number(r.jumlah) || 0;
    return o;
  });
const totalKebutuhan = rows.reduce((s, r) => s + r.jumlah, 0);
const out = {
  source: "SSCASN BKN — api-rekrutmen.bkn.go.id/portal/api/spf",
  fetchedAt: new Date().toISOString(),
  totalRows: rows.length,
  totalKebutuhan,
  events: [...new Set(rows.map((r) => r.nama_event))],
  jenisPengadaan: [...new Set(rows.map((r) => r.jenis_pengadaan))],
  rows,
};
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`OK: ${rows.length} formasi, ${totalKebutuhan} kebutuhan -> data/formasi.json`);
