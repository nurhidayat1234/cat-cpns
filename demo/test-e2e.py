"""End-to-end test website CAT CPNS (lokal, http://127.0.0.1:8140).
Login dulu (tes wajib login sejak 25 Nov 2026), lalu menjawab 110 soal lewat
UI: semua benar KECUALI TWK-01 (salah) dan TKP-01 (pilih opsi skor 3).
Harapan: TWK 145, TIU 175, TKP 223, total 543, LULUS.
Lalu cek pembahasan (filter salah = 2 soal) dan mode jelajah dari beranda.
Butuh forwarder proxy lokal demo/proxyfwd.py (port 18080) untuk login.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}
qs = json.load(open(os.path.expanduser("~/workspace/programmer/cat-cpns/data/questions.json")))
by_id = {q["id"]: q for q in qs}
order = [q["id"] for q in qs]  # TWK -> TIU -> TKP, urutan tampil

# rencana jawaban: semua benar, kecuali TWK-01 salah & TKP-01 skor 3
plan = {}
for q in qs:
    plan[q["id"]] = q["answer"]
plan["TWK-01"] = (by_id["TWK-01"]["answer"] + 1) % 5
tkp01 = by_id["TKP-01"]
plan["TKP-01"] = tkp01["scores"].index(3)

exp = {"TWK": 145, "TIU": 175, "TKP": 223, "total": 543}

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, proxy=PROXY, args=["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE + "/", wait_until="networkidle", timeout=30000)
    assert "CAT CPNS" in page.title(), page.title()
    assert page.locator("text=110 soal").first.is_visible()
    t0 = page.locator("#timer")
    print("1. Beranda OK (110 soal, mode tersedia).")

    # login dulu (wajib sebelum tes): buka halaman login, daftar akun penguji unik
    email = f"penguji-e2e-{int(time.time())}@example.com"
    page.locator("#authChip button:has-text('Buat Akun')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    page.locator('.auth-tab[data-tab="register"]').click()
    page.locator("#regNama").fill("Penguji E2E")
    page.locator("#regEmail").fill(email)
    page.locator("#regPassword").fill("rahasia123")
    page.locator("#regPassword2").fill("rahasia123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji E2E')", timeout=30000)
    assert page.locator("#gateNotice").is_hidden(), "pemberitahuan kunci harus hilang sesudah login"
    print("1b. Login OK, mode tes terbuka.")

    # mulai simulasi penuh
    page.locator('.mode[data-mode="full"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    timer1 = page.locator("#timer").inner_text()
    print("2. Simulasi dimulai, timer awal:", timer1)
    assert timer1 in ("100:00", "99:59"), timer1

    # jawab semua soal
    for i, qid in enumerate(order):
        qnum = page.locator("#qNum").inner_text()
        assert f"Soal {i+1} " in qnum, f"di soal {i+1} tapi header: {qnum}"
        page.locator(".opt").nth(plan[qid]).click()
        # tandai soal ke-5 ragu-ragu, lalu lanjut
        if i == 4:
            page.locator("#doubtBtn").click()
            assert "Ditandai Ragu-ragu" in page.locator("#doubtBtn").inner_text()
        if i < len(order) - 1:
            page.locator("#nextBtn").click()
    print("3. 110 soal dijawab lewat UI (soal 5 ditandai ragu-ragu).")

    # navigasi lewat palet: lompat ke soal 1, pastikan jawaban tersimpan
    page.locator(".pal").nth(0).click()
    assert "Soal 1 " in page.locator("#qNum").inner_text()
    assert "selected" in page.locator(".opt").nth(plan["TWK-01"]).get_attribute("class")
    page.locator(".pal").nth(109).click()
    assert "Soal 110 " in page.locator("#qNum").inner_text()
    print("4. Navigasi palet OK, jawaban tersimpan.")

    # timer berjalan
    time.sleep(3)
    timer2 = page.locator("#timer").inner_text()
    def _sec(t):
        m, s = t.split(":")
        return int(m) * 60 + int(s)
    assert _sec(timer2) < _sec(timer1), f"timer tidak jalan: {timer1} -> {timer2}"
    print("5. Timer berjalan:", timer1, "->", timer2)

    # selesai (dialog confirm: terima)
    page.on("dialog", lambda d: d.accept())
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=10000)
    total = page.locator("#resultTotal").inner_text()
    verdict = page.locator("#resultVerdict").inner_text()
    print("6. Hasil:", total, "|", verdict)
    assert total == str(exp["total"]), f"total {total} != {exp['total']}"
    assert "LULUS" in verdict and "TIDAK" not in verdict, verdict
    cats = page.locator("#resultCats").inner_text()
    for c, v in [("TWK", 145), ("TIU", 175), ("TKP", 223)]:
        assert f"{v} / " in cats, f"{c} {v} tidak ada di hasil: {cats[:200]}"
    print("7. Skor per kategori cocok: TWK 145, TIU 175, TKP 223.")
    page.screenshot(path=os.path.expanduser("~/workspace/programmer/cat-cpns/demo/e2e-result.png"))

    # pembahasan: filter salah -> harus 2 soal (TWK-01 + TKP-01)
    page.locator("#reviewBtn").click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    page.locator("#filterShow").select_option("WRONG")
    page.wait_for_timeout(500)
    count = page.locator("#reviewCount").inner_text()
    print("8. Filter 'hanya yang salah':", count)
    assert count.startswith("2 soal"), count
    body = page.locator("#reviewList").inner_text()
    assert "TWK-01" in body and "TKP-01" in body
    assert "Pembahasan:" in body
    print("9. Pembahasan menampilkan TWK-01 + TKP-01 beserta penjelasan.")
    page.screenshot(path=os.path.expanduser("~/workspace/programmer/cat-cpns/demo/e2e-review.png"), full_page=False)

    # kembali ke beranda -> mode jelajah pembahasan (tanpa hasil)
    page.locator("#reviewHomeBtn").click()
    page.locator('.mode[data-mode="review"]').click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    page.locator("#filterCat").select_option("TWK")
    page.wait_for_timeout(500)
    count = page.locator("#reviewCount").inner_text()
    print("10. Mode jelajah, filter TWK:", count)
    assert count.startswith("30 soal"), count
    b.close()

print("console errors:", errors if errors else "none")
assert not errors, errors
print("CAT CPNS E2E OK")
