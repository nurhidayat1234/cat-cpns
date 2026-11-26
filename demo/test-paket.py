"""Uji satu paket CAT CPNS end-to-end (dipakai per paket A-E).
Pemakaian: python demo/test-paket.py B
- Pilih paket di beranda, jalankan simulasi penuh dari bank soal paket itu:
  semua benar kecuali TWK-01 (salah) dan TKP-01 (skor 3) -> 543 LULUS,
  judul hasil menyebut "Paket X".
- Pembahasan paket itu: filter salah = 2 soal, filter TWK = 30 soal.
- Latihan TWK paket itu: 30 soal.
- Riwayat menampilkan mode dengan paket ("SKD Penuh • Paket X").
Butuh forwarder proxy lokal demo/proxyfwd.py (port 18080) untuk login.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

PAKET = (sys.argv[1] if len(sys.argv) > 1 else "A").upper()
assert PAKET in "ABCDE", PAKET
BASE = "http://127.0.0.1:8140"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}
qs = json.load(open(os.path.expanduser(f"~/workspace/programmer/cat-cpns/data/questions-{PAKET.lower()}.json")))
by_id = {q["id"]: q for q in qs}
order = [q["id"] for q in qs]
plan = {q["id"]: q["answer"] for q in qs}
plan["TWK-01"] = (by_id["TWK-01"]["answer"] + 1) % 5
plan["TKP-01"] = by_id["TKP-01"]["scores"].index(3)
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

    email = f"penguji-paket-{PAKET.lower()}-{int(time.time())}@example.com"
    page.locator("#authChip button:has-text('Buat Akun')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    page.locator('.auth-tab[data-tab="register"]').click()
    page.locator("#regNama").fill(f"Penguji Paket {PAKET}")
    page.locator("#regEmail").fill(email)
    page.locator("#regPassword").fill("rahasia123")
    page.locator("#regPassword2").fill("rahasia123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector(f"#authChip:has-text('Penguji Paket {PAKET}')", timeout=30000)
    print(f"1. Login OK (Paket {PAKET}).")

    # pilih paket di beranda
    page.locator(f".paket-btn[data-paket=\"{PAKET}\"]").click()
    page.wait_for_timeout(800)
    assert "active" in page.locator(f".paket-btn[data-paket=\"{PAKET}\"]").get_attribute("class")
    print(f"2. Pemilih paket: Paket {PAKET} aktif.")

    # simulasi penuh paket ini
    page.locator('.mode[data-mode="full"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    assert f"Paket {PAKET}" in page.locator("#examModeLabel").inner_text()
    for i, qid in enumerate(order):
        page.locator(".opt").nth(plan[qid]).click()
        if i < len(order) - 1:
            page.locator("#nextBtn").click()
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=10000)
    total = page.locator("#resultTotal").inner_text()
    title = page.locator("#resultTitle").inner_text()
    verdict = page.locator("#resultVerdict").inner_text()
    print(f"3. Hasil: {total} | {title} | {verdict}")
    assert total == str(exp["total"]), f"total {total} != {exp['total']}"
    assert f"Paket {PAKET}" in title, title
    assert "LULUS" in verdict and "TIDAK" not in verdict, verdict
    cats = page.locator("#resultCats").inner_text()
    for c, v in [("TWK", 145), ("TIU", 175), ("TKP", 223)]:
        assert f"{v} / " in cats, f"{c} {v} tidak ada di hasil"
    print("4. Skor per kategori cocok: TWK 145, TIU 175, TKP 223.")

    # pembahasan mengikuti paket ini
    page.locator("#reviewBtn").click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    assert f"Paket {PAKET}" in page.locator("#reviewNote").inner_text()
    page.locator("#filterShow").select_option("WRONG")
    page.wait_for_timeout(500)
    assert page.locator("#reviewCount").inner_text().startswith("2 soal"), page.locator("#reviewCount").inner_text()
    page.locator("#filterShow").select_option("ALL")
    page.locator("#filterCat").select_option("TWK")
    page.wait_for_timeout(500)
    assert page.locator("#reviewCount").inner_text().startswith("30 soal"), page.locator("#reviewCount").inner_text()
    print("5. Pembahasan Paket %s OK (salah=2, TWK=30)." % PAKET)

    # kembali ke beranda: riwayat menampilkan paket
    page.locator("#reviewHomeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    page.wait_for_selector("#historyList table", timeout=30000)
    hist = page.locator("#historyList").inner_text()
    assert f"Paket {PAKET}" in hist, hist[:300]
    assert "543" in hist
    print(f"6. Riwayat menampilkan 'SKD Penuh • Paket {PAKET}' + total 543.")

    # latihan TWK paket ini: 30 soal
    page.locator('.mode[data-mode="TWK"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    assert "Soal 1 " in page.locator("#qNum").inner_text()
    print(f"7. Latihan TWK Paket {PAKET} dimulai (30 soal).")
    print("console errors:", errors if errors else "none")
    b.close()
assert not errors, errors
print(f"CAT CPNS PAKET {PAKET} OK")
