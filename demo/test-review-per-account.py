"""Uji Pembahasan per akun (26 Nov 2026).
Bug: hasil terakhir + sesi tersimpan di localStorage dengan kunci global
(catcpns-result-v1 / catcpns-session-v1), jadi akun B yang login sesudah
akun A di browser yang sama bisa membaca riwayat A di Pembahasan (bahkan
melanjutkan simulasi A).
Perbaikan: kunci per akun (sufiks email lowercase); state dimuat ulang
tiap login/logout (refreshCatcpnsUser).
- A: latihan TWK (TWK-01 salah) -> Pembahasan A menampilkan hasil A.
- A: mulai simulasi penuh, jawab 2 soal, pulang -> kartu lanjutkan tampil.
- A logout, B daftar -> B tidak melihat kartu lanjutkan, Pembahasan B
  mode jelajah (0 soal di filter Salah), tanpa "Jawabanmu" dan tanpa total A.
- B logout, A masuk lagi -> kartu lanjutkan + Pembahasan A kembali.
Butuh forwarder proxy lokal demo/proxyfwd.py (port 18080) untuk login.
"""
import json, os, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}
qs = json.load(open(os.path.expanduser("~/workspace/programmer/cat-cpns/data/questions-a.json")))
by_id = {q["id"]: q for q in qs}
twk = [q["id"] for q in qs if q["category"] == "TWK"]
plan_twk = {qid: by_id[qid]["answer"] for qid in twk}
plan_twk["TWK-01"] = (by_id["TWK-01"]["answer"] + 1) % 5  # 1 salah -> total 145

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, proxy=PROXY, args=["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE + "/", wait_until="networkidle", timeout=30000)
    assert "CAT CPNS" in page.title(), page.title()

    def register(nama, email):
        page.locator("#authChip button:has-text('Buat Akun')").click()
        page.wait_for_selector("#screen-auth:visible", timeout=10000)
        page.locator('.auth-tab[data-tab="register"]').click()
        page.locator("#regNama").fill(nama)
        page.locator("#regEmail").fill(email)
        page.locator("#regPassword").fill("rahasia123")
        page.locator("#regPassword2").fill("rahasia123")
        page.locator('#registerForm button[type="submit"]').click()
        page.wait_for_selector(f"#authChip:has-text('{nama}')", timeout=30000)

    def login(nama, email):
        page.locator("#loginEmail").fill(email)
        page.locator("#loginPassword").fill("rahasia123")
        page.locator('#loginForm button[type="submit"]').click()
        page.wait_for_selector(f"#authChip:has-text('{nama}')", timeout=30000)

    def logout():
        page.locator("#authChip button:has-text('Keluar')").click()
        page.wait_for_selector("#screen-auth:visible", timeout=10000)

    ts = int(time.time())
    email_a = f"penguji-review-a-{ts}@example.com"
    email_b = f"penguji-review-b-{ts}@example.com"

    # 1. Akun A daftar + latihan TWK (1 salah)
    register("Penguji A", email_a)
    page.locator('.mode[data-mode="TWK"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    for i, qid in enumerate(twk):
        page.locator(".opt").nth(plan_twk[qid]).click()
        if i < len(twk) - 1:
            page.locator("#nextBtn").click()
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=10000)
    total_a = page.locator("#resultTotal").inner_text()
    assert total_a == "145", f"total A harus 145, dapat {total_a}"
    print(f"1. A latihan TWK selesai, total {total_a}.")

    # 2. Pembahasan A: hasil A tampil, filter Salah = 1
    page.locator("#reviewBtn").click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    note_a = page.locator("#reviewNote").inner_text()
    assert "akunmu" in note_a and "145" in note_a, f"note A salah: {note_a}"
    page.locator("#filterShow").select_option("WRONG")
    page.wait_for_timeout(500)
    assert page.locator("#reviewCount").inner_text().startswith("1 soal"), page.locator("#reviewCount").inner_text()
    assert page.locator("text=Jawabanmu kurang tepat").count() >= 1
    print("2. Pembahasan A OK (hasil A, filter Salah = 1).")

    # 3. A mulai simulasi penuh, jawab 2 soal, pulang -> kartu lanjutkan tampil
    page.locator("#reviewHomeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    page.locator('.mode[data-mode="full"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    for i, qid in enumerate(["TWK-01", "TWK-02"]):
        page.locator(".opt").nth(by_id[qid]["answer"]).click()
        if i == 0:
            page.locator("#nextBtn").click()
    page.locator('a[data-nav="home"]').first.click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    assert page.locator("#resumeCard").is_visible(), "kartu lanjutkan A harus tampil"
    print("3. Sesi A tersimpan (kartu lanjutkan tampil).")

    # 4. A logout, B daftar -> B tidak melihat sesi/hasil A
    logout()
    register("Penguji B", email_b)
    assert not page.locator("#resumeCard").is_visible(), "kartu lanjutkan harus HILANG untuk B"
    page.locator('a[data-nav="review"]').first.click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    note_b = page.locator("#reviewNote").inner_text()
    assert note_b.startswith("Mode jelajah"), f"note B harus mode jelajah: {note_b}"
    assert "145" not in note_b, "total A bocor ke note B"
    page.locator("#filterShow").select_option("WRONG")
    page.wait_for_timeout(500)
    assert page.locator("#reviewCount").inner_text().startswith("0 soal"), page.locator("#reviewCount").inner_text()
    assert page.locator("text=Jawabanmu").count() == 0, "jawaban A bocor ke Pembahasan B"
    print("4. Pembahasan B bersih OK (mode jelajah, 0 salah, tanpa jawaban A).")

    # 5. B logout, A masuk lagi -> hasil + sesi A kembali (per akun, bukan hapus)
    page.locator("#reviewHomeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    logout()
    login("Penguji A", email_a)
    assert page.locator("#resumeCard").is_visible(), "kartu lanjutkan A harus kembali"
    page.locator('a[data-nav="review"]').first.click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    note_a2 = page.locator("#reviewNote").inner_text()
    assert "akunmu" in note_a2 and "145" in note_a2, f"note A sesudah login ulang salah: {note_a2}"
    page.locator("#filterShow").select_option("WRONG")
    page.wait_for_timeout(500)
    assert page.locator("#reviewCount").inner_text().startswith("1 soal"), page.locator("#reviewCount").inner_text()
    print("5. A login lagi: hasil + sesi A kembali OK.")

    assert not errors, f"console errors: {errors}"
    print("console errors: none")
    print("CAT CPNS REVIEW-PER-AKUN OK")
    b.close()
