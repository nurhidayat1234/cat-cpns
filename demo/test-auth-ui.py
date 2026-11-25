"""Uji UI login CAT CPNS (dengan backend Apps Script — AUTH_API_URL sudah terisi).
Menjalankan server lokal di 127.0.0.1:8140 lalu:
- beranda menampilkan kartu login profesional + tombol topbar + pemberitahuan kunci
- tamu yang klik mode tes DIBLOKIR: ujian tidak mulai, diarahkan ke kartu login
- tab Daftar bisa dibuka; validasi password pendek muncul sebelum memanggil server
- login dengan akun yang tidak terdaftar menampilkan pesan server yang jelas
- daftar akun baru -> mode terbuka -> latihan TWK jalan dan hasil tersimpan ke akun
Butuh forwarder proxy lokal demo/proxyfwd.py (port 18080) untuk mencapai Apps Script.
Jalankan: python3 demo/test-auth-ui.py  (dari ~/workspace/programmer/cat-cpns)
"""
import os
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140/"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, proxy=PROXY, args=["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)

    assert page.locator("#authCard").is_visible(), "kartu auth tidak tampil"
    assert page.locator("#authChip").inner_text().strip() == "Masuk / Daftar", "chip topbar salah"
    assert page.locator("#historyCard").is_hidden(), "riwayat harus tersembunyi saat logout"
    assert page.locator("#gateNotice").is_visible(), "pemberitahuan kunci harus tampil saat tamu"
    assert page.locator('.mode-test .lock-badge').first.is_visible(), "label kunci di mode tes tidak tampil"
    assert page.locator(".auth-side").is_visible(), "panel samping login tidak tampil"
    print("OK: kartu login profesional tampil, mode tes terkunci untuk tamu")

    # Tamu klik mode tes -> diblokir, ujian tidak mulai
    page.locator('.mode[data-mode="TWK"]').click()
    page.wait_for_timeout(1200)
    assert page.locator("#screen-exam").is_hidden(), "ujian TIDAK BOLEH mulai sebelum login"
    assert "Login dulu" in page.locator("#authMsg").inner_text(), "pesan arah login gagal"
    print("OK: tamu diblokir saat klik mode tes, diarahkan ke login")

    # Pembahasan tetap bisa dibuka tanpa login (bukan tes)
    page.locator('.mode[data-mode="review"]').click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    page.locator("#reviewHomeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    print("OK: Pembahasan tetap terbuka tanpa login")

    # Tab Daftar + validasi client-side (password pendek)
    page.locator('.auth-tab[data-tab="register"]').click()
    assert page.locator("#registerForm").is_visible(), "form daftar tidak tampil"
    page.locator("#regNama").fill("Penguji")
    page.locator("#regEmail").fill("penguji@example.com")
    page.locator("#regPassword").fill("123")
    page.locator("#regPassword2").fill("123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_timeout(800)
    assert "minimal 6 karakter" in page.locator("#authMsg").inner_text(), "validasi password pendek gagal"
    print("OK: validasi password pendek muncul")

    # Validasi konfirmasi password
    page.locator("#regPassword").fill("rahasia1")
    page.locator("#regPassword2").fill("rahasia2")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_timeout(800)
    assert "tidak sama" in page.locator("#authMsg").inner_text(), "validasi konfirmasi gagal"
    print("OK: validasi konfirmasi password muncul")

    # Login dengan akun yang tidak terdaftar -> pesan server yang jelas, bukan crash
    page.locator('.auth-tab[data-tab="login"]').click()
    page.locator("#loginEmail").fill("tidak-ada@example.com")
    page.locator("#loginPassword").fill("rahasia1")
    page.locator('#loginForm button[type="submit"]').click()
    page.wait_for_function(
        "document.getElementById('authMsg').innerText.includes('Email atau password salah')",
        timeout=30000)
    print("OK: login akun tak dikenal menampilkan pesan server yang jelas")

    # Daftar akun baru -> mode terbuka -> latihan TWK jalan, hasil tersimpan
    page.locator('.auth-tab[data-tab="register"]').click()
    email = f"penguji-ui-{int(time.time())}@example.com"
    page.locator("#regNama").fill("Penguji UI")
    page.locator("#regEmail").fill(email)
    page.locator("#regPassword").fill("rahasia123")
    page.locator("#regPassword2").fill("rahasia123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji UI')", timeout=30000)
    assert page.locator("#gateNotice").is_hidden(), "pemberitahuan kunci harus hilang sesudah login"
    assert page.locator('.mode-test .lock-badge').first.is_hidden(), "label kunci harus hilang sesudah login"
    print("OK: daftar + login berhasil, kunci mode terbuka")

    # Latihan TWK sebagai pengguna login
    page.locator('.mode[data-mode="TWK"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=15000)
    for _ in range(30):
        page.locator(".opt").nth(0).click()
        if page.locator("#nextBtn").is_enabled():
            page.locator("#nextBtn").click()
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=15000)
    page.wait_for_selector("#resultSaveNote:has-text('tersimpan di akunmu')", timeout=30000)
    note = page.locator("#resultSaveNote").inner_text()
    print("OK: hasil tampil, catatan tersimpan ke akun:", note)
    page.screenshot(path=os.path.expanduser("~/workspace/programmer/cat-cpns/demo/auth-ui-result.png"))
    b.close()

print("console errors:", errors if errors else "none")
assert not errors, f"ada console error: {errors}"
print("CAT CPNS AUTH UI OK")
