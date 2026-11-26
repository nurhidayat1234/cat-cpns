"""Uji pemilih jenis kebutuhan (KepmenPANRB 674/2026, Lampiran II) di layar hasil.

Simulasi 1: semua benar -> 550. Umum/cumlaude/disabilitas harus LULUS,
atlet harus menampilkan "TIDAK ADA AMBANG TETAP".
Simulasi 2: semua TIU salah, sisanya benar -> total 375, TIU 0. Umum harus
TIDAK LULUS (TIU); cumlaude harus menyebut "TIU kurang 85"; disabilitas
"TIU kurang 60"; baris TIU menampilkan PG 85 saat cumlaude dipilih.
Latihan TIU (semua salah) dengan kategori cumlaude -> TIDAK LULUS.
Butuh forwarder proxy lokal demo/proxyfwd.py (port 18080) untuk login.
"""
import json, os, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}
qs = json.load(open(os.path.expanduser("~/workspace/programmer/cat-cpns/data/questions.json")))
by_id = {q["id"]: q for q in qs}
order = [q["id"] for q in qs]

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, proxy=PROXY, args=["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE + "/", wait_until="networkidle", timeout=30000)

    email = f"penguji-pg-{int(time.time())}@example.com"
    page.locator("#authChip button:has-text('Buat Akun')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    page.locator('.auth-tab[data-tab="register"]').click()
    page.locator("#regNama").fill("Penguji PG")
    page.locator("#regEmail").fill(email)
    page.locator("#regPassword").fill("rahasia123")
    page.locator("#regPassword2").fill("rahasia123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji PG')", timeout=30000)
    print("1. Login OK.")

    def run_full(plan):
        page.locator('.mode[data-mode="full"]').click()
        page.wait_for_selector("#screen-exam:visible", timeout=10000)
        for i, qid in enumerate(order):
            page.locator(".opt").nth(plan[qid]).click()
            if i < len(order) - 1:
                page.locator("#nextBtn").click()
        page.locator("#finishBtn").click()
        page.wait_for_selector("#screen-result:visible", timeout=10000)

    def verdict():
        return page.locator("#resultVerdict").inner_text()

    # --- simulasi 1: semua benar ---
    run_full({q["id"]: q["answer"] for q in qs})
    assert page.locator("#resultTotal").inner_text() == "550"
    assert "LULUS" in verdict() and "TIDAK" not in verdict(), verdict()
    assert "Kumulatif: 550 / 550" in page.locator("#resultCumNote").inner_text()
    page.locator("#pgCatSelect").select_option("cumlaude")
    assert "LULUS" in verdict() and "Cumlaude" in verdict(), verdict()
    page.locator("#pgCatSelect").select_option("disabilitas")
    assert "LULUS" in verdict() and "Disabilitas" in verdict(), verdict()
    page.locator("#pgCatSelect").select_option("atlet")
    assert "TIDAK ADA AMBANG TETAP" in verdict(), verdict()
    page.locator("#pgCatSelect").select_option("umum")
    assert "LULUS" in verdict() and "TIDAK" not in verdict(), verdict()
    print("2. Simulasi 550: umum/cumlaude/disabilitas LULUS, atlet tanpa ambang tetap. OK")
    page.screenshot(path=os.path.expanduser("~/workspace/programmer/cat-cpns/demo/pg-cat-550.png"))

    # --- simulasi 2: semua TIU salah ---
    page.locator("#homeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    plan2 = {}
    for q in qs:
        plan2[q["id"]] = (q["answer"] + 1) % 5 if q["category"] == "TIU" else q["answer"]
    run_full(plan2)
    assert page.locator("#resultTotal").inner_text() == "375"
    assert "TIDAK LULUS" in verdict() and "TIU" in verdict(), verdict()
    page.locator("#pgCatSelect").select_option("cumlaude")
    assert "TIU kurang 85" in verdict(), verdict()
    assert "PG 85" in page.locator("#resultCats").inner_text()
    page.locator("#pgCatSelect").select_option("disabilitas")
    assert "TIU kurang 60" in verdict(), verdict()
    assert "Kumulatif: 375 / 550" in page.locator("#resultCumNote").inner_text()
    print("3. Simulasi 375 (TIU 0): umum TIDAK LULUS; cumlaude kurang 85; disabilitas kurang 60. OK")

    # --- latihan TIU saja, semua salah, kategori cumlaude ---
    page.locator("#homeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    page.locator('.mode[data-mode="TIU"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    tiu_ids = [q["id"] for q in qs if q["category"] == "TIU"]
    for i, qid in enumerate(tiu_ids):
        page.locator(".opt").nth((by_id[qid]["answer"] + 1) % 5).click()
        if i < len(tiu_ids) - 1:
            page.locator("#nextBtn").click()
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=10000)
    page.locator("#pgCatSelect").select_option("cumlaude")
    assert "TIDAK LULUS" in verdict() and "Cumlaude" in verdict(), verdict()
    print("4. Latihan TIU 0 + cumlaude: TIDAK LULUS. OK")
    page.locator("#pgCatSelect").select_option("atlet")
    assert "SKOR TIU" in verdict(), verdict()
    print("5. Latihan TIU + atlet: tanpa ambang per subtes. OK")
    print("console errors:", errors if errors else "none")
    b.close()
assert not errors, errors
print("CAT CPNS PG-CAT OK")
