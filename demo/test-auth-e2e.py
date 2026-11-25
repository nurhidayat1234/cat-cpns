"""Uji E2E login CAT CPNS dengan backend Apps Script sungguhan.
Server lokal di 127.0.0.1:8140. Alur:
- daftar akun penguji (penguji-e2e@example.com) lewat UI -> chip nama tampil
- kerjakan latihan TWK (30 soal, jawab opsi pertama) -> hasil tersimpan ke Sheet
- beranda menampilkan Riwayat Saya (1 baris, mode TWK)
- logout -> login lagi dengan akun yang sama -> riwayat tetap ada
Jalankan: python3 demo/test-auth-e2e.py  (dari ~/workspace/programmer/cat-cpns)
Baris uji di Sheet dibersihkan manual sesudah tes (lihat README test).
"""
import os
import time
from playwright.sync_api import sync_playwright

# Chromium di VM ini tidak bisa egress langsung (TLS/proxy env bermasalah);
# pakai forwarder proxy lokal demo/proxyfwd.py (port 18080), lewati localhost.
# Pastikan forwarder jalan: cd ~/workspace/programmer/binance-agent-id/demo && python3 proxyfwd.py
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}

BASE = "http://127.0.0.1:8140/"
EMAIL = f"penguji-e2e-{int(time.time())}@example.com"  # unik tiap run (email harus unik di Sheet)
NAMA = "Penguji E2E"
PW = "rahasia123"
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, proxy=PROXY, args=["--no-sandbox", "--disable-gpu"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)

    # Daftar
    page.locator('.auth-tab[data-tab="register"]').click()
    page.locator("#regNama").fill(NAMA)
    page.locator("#regEmail").fill(EMAIL)
    page.locator("#regPassword").fill(PW)
    page.locator("#regPassword2").fill(PW)
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji E2E')", timeout=30000)
    print("OK: daftar + login otomatis, chip nama tampil (email:", EMAIL + ")")
    page.wait_for_selector("#historyCard:visible", timeout=15000)
    page.wait_for_function(
        "document.getElementById('historyMeta').innerText.includes('Belum ada hasil')",
        timeout=30000)
    print("OK: riwayat awal kosong")

    # Latihan TWK 30 soal
    page.locator('.mode[data-mode="TWK"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=15000)
    for _ in range(30):
        page.locator(".opt").nth(0).click()
        if page.locator("#nextBtn").is_enabled():
            page.locator("#nextBtn").click()
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=15000)
    page.wait_for_selector("#resultSaveNote:has-text('tersimpan di akunmu')", timeout=30000)
    print("OK: hasil tampil + catatan 'tersimpan di akunmu':",
          page.locator("#resultSaveNote").inner_text())
    total = page.locator("#resultTotal").inner_text()
    print("     total TWK:", total)

    # Beranda -> riwayat berisi 1 baris
    page.locator("#homeBtn").click()
    page.wait_for_selector("#historyCard:visible", timeout=15000)
    page.wait_for_function(
        "document.querySelectorAll('#historyList table.hist tbody tr').length >= 1",
        timeout=30000)
    row = page.locator("#historyList table.hist tbody tr").first.inner_text()
    assert "TWK" in row and total in row, f"baris riwayat tidak cocok: {row!r}"
    print("OK: riwayat menampilkan 1 hasil:", row.replace("\t", " | "))

    # Logout -> login lagi -> riwayat tetap ada
    page.locator("#authChip button").click()
    page.wait_for_selector("#authCard:visible", timeout=15000)
    assert "Masuk / Daftar" in page.locator("#authChip").inner_text()
    page.locator("#loginEmail").fill(EMAIL)
    page.locator("#loginPassword").fill(PW)
    page.locator('#loginForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji E2E')", timeout=30000)
    page.wait_for_function(
        "document.querySelectorAll('#historyList table.hist tbody tr').length >= 1",
        timeout=30000)
    print("OK: login ulang berhasil, riwayat tetap ada")
    page.screenshot(path=os.path.expanduser("~/workspace/programmer/cat-cpns/demo/auth-e2e-history.png"))
    b.close()

print("console errors:", errors if errors else "none")
assert not errors, f"ada console error: {errors}"
print("CAT CPNS AUTH E2E OK")
