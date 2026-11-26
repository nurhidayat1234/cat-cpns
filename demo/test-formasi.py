"""Uji seksi Formasi CPNS di beranda (data resmi API SSCASN BKN).

Menjalankan server lokal port 8140 bila belum hidup, lalu memeriksa:
1. Kartu formasi tampil di beranda (tamu, tanpa login), data dimuat malas
   saat kartu terlihat: statistik cocok dengan data/formasi.json.
2. Catatan jujur "Formasi CPNS belum tersedia" muncul karena API BKN
   saat ini belum memuat satu pun formasi CPNS (baru PPPK Sekolah Rakyat).
3. Pencarian (instansi/jabatan/lokasi) + filter jenis pengadaan bekerja.
4. Klik item membuka rincian; paginasi 10/halaman dengan tombol
   Sebelumnya/Berikutnya + info "Halaman X dari Y" (cari/filter reset ke
   halaman 1).
5. Tombol "Daftar CPNS di SSCASN" mengarah ke https://sscasn.bkn.go.id/
   (target _blank) dan tautan "Lihat di SSCASN" ke /daftar-formasi/.
6. Tanpa console error.

Jalankan: python3 demo/test-formasi.py
"""
import json
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8140
BASE = f"http://127.0.0.1:{PORT}/"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}


def ensure_server():
    try:
        import urllib.request
        urllib.request.urlopen(BASE, timeout=2)
        return None
    except Exception:
        p = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT)],
            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(20):
            try:
                import urllib.request
                urllib.request.urlopen(BASE, timeout=2)
                return p
            except Exception:
                time.sleep(0.5)
        raise RuntimeError("server lokal tidak mau hidup")


def main():
    data = json.loads((ROOT / "data" / "formasi.json").read_text())
    exp_rows = data["totalRows"]
    exp_need = data["totalKebutuhan"]
    exp_inst = len({r["instansi"] for r in data["rows"]})
    exp_jenis = sorted({r["jenis_pengadaan"] for r in data["rows"]})
    server = ensure_server()
    errors = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(proxy=PROXY, args=["--ignore-certificate-errors"])
            page = b.new_page()
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(800)

            assert page.locator("#formasiCard").count() == 1, "kartu formasi tidak ada"
            # Lazy load: data belum dimuat sebelum kartu terlihat.
            assert page.locator("#formasiStats").is_hidden(), "statistik sudah tampil sebelum scroll"
            page.locator("#formasiCard").scroll_into_view_if_needed()
            page.wait_for_selector("#formasiStats:visible", timeout=15000)
            page.wait_for_timeout(500)

            def stat(sel):
                return page.locator(sel).inner_text().replace(".", "").replace(",", "")

            assert int(stat("#formasiStatRows")) == exp_rows, f"total formasi {stat('#formasiStatRows')} != {exp_rows}"
            assert int(stat("#formasiStatNeed")) == exp_need, f"total kebutuhan {stat('#formasiStatNeed')} != {exp_need}"
            assert int(stat("#formasiStatInst")) == exp_inst, f"instansi {stat('#formasiStatInst')} != {exp_inst}"
            print(f"OK statistik: {exp_rows} formasi, {exp_need} kebutuhan, {exp_inst} instansi")

            # Catatan CPNS: data saat ini tanpa CPNS.
            has_cpns = any("cpns" in (r.get("jenis_pengadaan") or "").lower() for r in data["rows"])
            note_visible = page.locator("#formasiCpnsNote").is_visible()
            assert note_visible == (not has_cpns), "catatan CPNS tidak sesuai isi data"
            print("OK catatan CPNS:", "tampil (belum ada CPNS)" if note_visible else "tidak tampil (CPNS ada)")

            # Daftar awal: paginasi 10 per halaman.
            import math
            exp_pages = math.ceil(exp_rows / 10)
            assert page.locator(".formasi-item").count() == 10, "bukan 10 item awal"
            assert "1–10 dari" in page.locator("#formasiStatus").inner_text()
            assert page.locator("#formasiPageInfo").inner_text() == f"Halaman 1 dari {exp_pages}", \
                page.locator("#formasiPageInfo").inner_text()
            assert page.locator("#formasiPrev").is_disabled(), "Sebelumnya harus nonaktif di hal. 1"
            assert page.locator("#formasiNext").is_enabled(), "Berikutnya harus aktif di hal. 1"
            first_need = page.locator(".formasi-item .formasi-need strong").first.inner_text()
            assert first_need, "angka kebutuhan kosong"
            first_title_p1 = page.locator(".formasi-item .formasi-main strong").first.inner_text()
            print(f"OK daftar awal 10 item, halaman 1 dari {exp_pages}, kebutuhan pertama: {first_need}")

            # Paginasi: Berikutnya -> halaman 2 (item berbeda), Sebelumnya -> kembali.
            page.locator("#formasiNext").click()
            page.wait_for_timeout(300)
            assert page.locator("#formasiPageInfo").inner_text() == f"Halaman 2 dari {exp_pages}"
            assert page.locator(".formasi-item").count() == 10
            assert page.locator("#formasiPrev").is_enabled(), "Sebelumnya harus aktif di hal. 2"
            assert "11–20 dari" in page.locator("#formasiStatus").inner_text()
            page.locator("#formasiPrev").click()
            page.wait_for_timeout(300)
            assert page.locator("#formasiPageInfo").inner_text() == f"Halaman 1 dari {exp_pages}"
            assert page.locator(".formasi-item .formasi-main strong").first.inner_text() == first_title_p1
            print("OK paginasi Berikutnya/Sebelumnya + info halaman")

            # Filter jenis pengadaan: reset ke halaman 1, paginasi ikut hasil filter.
            opts = [o.inner_text() for o in page.locator("#formasiJenis option").all()[1:]]
            assert opts == exp_jenis, f"opsi jenis {opts} != {exp_jenis}"
            page.locator("#formasiJenis").select_option(label=exp_jenis[0])
            page.wait_for_timeout(300)
            n_jenis = sum(1 for r in data["rows"] if r["jenis_pengadaan"] == exp_jenis[0])
            shown = page.locator(".formasi-item").count()
            assert shown == min(10, n_jenis), f"filter jenis: {shown} != {min(10, n_jenis)}"
            assert page.locator("#formasiPageInfo").inner_text() == \
                f"Halaman 1 dari {math.ceil(n_jenis / 10)}", "filter harus reset ke halaman 1"
            print(f"OK filter jenis '{exp_jenis[0]}': {n_jenis} formasi, halaman 1 dari {math.ceil(n_jenis / 10)}")
            # Pindah ke halaman 2 dulu, lalu ganti filter -> harus kembali ke halaman 1.
            page.locator("#formasiNext").click()
            page.wait_for_timeout(300)
            assert "Halaman 2 dari" in page.locator("#formasiPageInfo").inner_text()
            page.locator("#formasiReset").click()
            page.wait_for_timeout(300)
            assert page.locator(".formasi-item").count() == 10, "reset tidak mengembalikan 10 item"
            assert page.locator("#formasiPageInfo").inner_text() == f"Halaman 1 dari {exp_pages}", \
                "reset harus kembali ke halaman 1"

            # Pencarian teks: reset ke halaman 1, paginasi ikut hasil cari.
            page.locator("#formasiSearch").fill("Kementerian Sosial")
            page.wait_for_timeout(300)
            n_cari = sum(1 for r in data["rows"] if "kementerian sosial" in (r["instansi"] or "").lower())
            assert page.locator(".formasi-item").count() == min(10, n_cari), "pencarian instansi salah"
            assert "Kementerian Sosial" in page.locator(".formasi-item").first.inner_text()
            assert page.locator("#formasiPageInfo").inner_text() == \
                f"Halaman 1 dari {math.ceil(n_cari / 10)}"
            print(f"OK pencarian 'Kementerian Sosial': {n_cari} formasi, halaman 1")
            page.locator("#formasiSearch").fill("zzzz-tidak-ada")
            page.wait_for_timeout(300)
            assert page.locator(".formasi-item").count() == 0, "pencarian kosong harus 0 item"
            assert "Tidak ada formasi" in page.locator("#formasiStatus").inner_text()
            assert page.locator("#formasiPager").is_hidden(), "pager harus hilang saat 0 hasil"
            page.locator("#formasiReset").click()
            page.wait_for_timeout(300)

            # Rincian item.
            page.locator(".formasi-item .formasi-head").first.click()
            page.wait_for_timeout(200)
            assert page.locator(".formasi-item .formasi-detail").first.is_visible(), "rincian tidak terbuka"
            print("OK klik item membuka rincian")

            # Tautan resmi.
            daftar = page.locator(".formasi-cta a.btn-primary")
            assert daftar.get_attribute("href") == "https://sscasn.bkn.go.id/", "href Daftar salah"
            assert daftar.get_attribute("target") == "_blank", "Daftar harus tab baru"
            lihat = page.locator(".formasi-cta a.btn-ghost")
            assert lihat.get_attribute("href") == "https://sscasn.bkn.go.id/daftar-formasi/", "href Lihat salah"
            print("OK tautan Daftar CPNS -> sscasn.bkn.go.id (tab baru)")

            # Nav "Formasi CPNS" menggulir ke kartu.
            page.evaluate("window.scrollTo(0,0)")
            page.locator('[data-nav="formasi"]').first.click()
            page.wait_for_timeout(800)
            assert page.locator("#formasiCard").is_visible()
            print("OK nav Formasi CPNS menggulir ke kartu")

            assert not errors, f"console/page errors: {errors}"
            print("OK tanpa console error")
            b.close()
    finally:
        if server:
            server.terminate()
    print("TEST FORMASI: SEMUA LULUS")


if __name__ == "__main__":
    main()
