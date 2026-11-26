"""Uji UI login CAT CPNS (dengan backend Apps Script — AUTH_API_URL sudah terisi).
Menjalankan server lokal di 127.0.0.1:8140 lalu:
- tamu melihat beranda tanpa soal dan tanpa Pembahasan: kartu mode tersembunyi, hanya ajakan login
- Pembahasan tertutup untuk tamu (nav + langkah timeline mengarah ke halaman login)
- tamu yang memanggil promptLogin diarahkan ke halaman login
- validasi password pendek muncul sebelum memanggil server
- login dengan akun yang tidak terdaftar menampilkan pesan server yang jelas
- daftar akun baru -> soal muncul -> latihan TWK jalan dan hasil tersimpan ke akun
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

    # Tamu: beranda tanpa soal dan tanpa Pembahasan — kartu mode tersembunyi semua
    assert page.locator("#screen-home").is_visible(), "beranda tidak tampil"
    assert page.locator("#screen-auth").is_hidden(), "halaman login harus tersembunyi saat awal"
    assert page.locator("#authCard").is_hidden(), "kartu login harus di halaman sendiri, bukan beranda"
    assert page.locator("#modeCard").is_hidden(), "kartu mode harus tersembunyi sebelum login (Pembahasan di dalam akun)"
    assert page.locator('.mode[data-mode="review"]').is_hidden(), "Pembahasan harus tersembunyi sebelum login"
    assert page.locator("#guestCtaCard").is_visible(), "ajakan login untuk tamu tidak tampil"
    chip_text = page.locator("#authChip").inner_text()
    assert "Buat Akun" in chip_text and "Masuk" in chip_text, f"chip topbar salah: {chip_text!r}"
    assert page.locator("#historyCard").is_hidden(), "riwayat harus tersembunyi saat logout"
    print("OK: tamu melihat beranda tanpa soal dan tanpa Pembahasan")

    # Tombol topbar Masuk membuka halaman login sendiri
    page.locator("#authChip button:has-text('Masuk')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    assert page.locator("#authCard").is_visible(), "kartu login tidak tampil di halaman sendiri"
    assert page.locator(".auth-side").is_visible(), "panel samping login tidak tampil"
    assert page.locator("#loginForm").is_visible(), "form masuk tidak tampil"
    print("OK: halaman login sendiri terbuka dari topbar")

    # Kembali ke beranda, soal tetap tersembunyi; promptLogin mengarah ke halaman login
    page.locator(".auth-back").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    assert page.locator(".mode-test").first.is_hidden(), "mode tes harus tetap tersembunyi"
    page.evaluate("Auth.promptLogin()")
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    assert "Login dulu" in page.locator("#authMsg").inner_text(), "pesan arah login gagal"
    print("OK: promptLogin mengarah ke halaman login")

    # Pembahasan tertutup untuk tamu: nav atas + langkah timeline mengarah ke login
    page.locator(".auth-back").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    page.locator('.topnav [data-nav="review"]').click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    assert "Login dulu" in page.locator("#authMsg").inner_text(), "nav Pembahasan harus mengarah ke login"
    page.locator(".auth-back").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    page.locator('.tstep[data-nav="review"]').click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    print("OK: Pembahasan tertutup untuk tamu (nav + timeline mengarah ke login)")

    # Buka halaman login lagi untuk tab Daftar + validasi client-side (password pendek)
    page.locator("#authChip button:has-text('Masuk')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
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
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    assert page.locator(".mode-test").first.is_visible(), "mode tes harus muncul sesudah login"
    assert page.locator("#gateNotice").is_hidden(), "pemberitahuan kunci harus hilang sesudah login"
    assert page.locator('.mode-test .lock-badge').first.is_hidden(), "label kunci harus hilang sesudah login"
    assert page.locator("#guestCtaCard").is_hidden(), "ajakan login harus hilang sesudah login"
    print("OK: daftar + login berhasil, soal muncul di beranda")

    # Pembahasan kini terbuka di dalam akun (110 soal + penjelasan)
    page.locator('.mode[data-mode="review"]').click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    page.wait_for_function(
        "document.querySelectorAll('#reviewList .rev-card').length >= 110",
        timeout=15000)
    page.locator("#reviewHomeBtn").click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    print("OK: Pembahasan terbuka sesudah login (110 soal)")

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
