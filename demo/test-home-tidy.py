"""Uji rapihan beranda untuk user sudah login (26 Nov 2026).
- Tamu: hero, kartu fitur, dan kartu tamu tampil; Alur Latihan di bawah
  kartu mode, Cara Mengerjakan sesudah Format.
- Login: hero + disclaimer + kartu fitur hilang, kartu tamu hilang,
  Alur Latihan + Cara Mengerjakan pindah ke paling atas beranda,
  langkah "Buat Akun" di Alur hilang, kartu mode + riwayat tampil.
- Logout lalu kembali ke beranda: urutan tamu kembali seperti semula.
Butuh forwarder proxy lokal demo/proxyfwd.py (port 18080) untuk login.
"""
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, proxy=PROXY, args=["--no-sandbox", "--disable-gpu", "--ignore-certificate-errors"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE + "/", wait_until="networkidle", timeout=30000)
    assert "CAT CPNS" in page.title(), page.title()

    def order():
        return page.evaluate("""() => {
          const kids = [...document.querySelector('#screen-home').children]
            .filter(el => getComputedStyle(el).display !== 'none')
            .map(el => el.id || el.className.split(' ')[0]);
          return kids;
        }""")

    # 1. Tamu: hero + fitur + kartu tamu tampil, Alur di bawah kartu mode
    assert page.locator("#screen-home .hero").is_visible(), "hero tamu harus tampil"
    assert page.locator("#featuresCard").is_visible(), "kartu fitur tamu harus tampil"
    assert page.locator("#guestCtaCard").is_visible(), "kartu tamu harus tampil"
    assert not page.locator("#historyCard").is_visible(), "riwayat tamu harus sembunyi"
    assert not page.locator("#modeCard").is_visible(), "kartu mode tamu harus sembunyi"
    o = order()
    assert o.index("alurCard") > o.index("guestCtaCard"), f"alur tamu harus sesudah kartu tamu: {o}"
    assert o.index("howtoCard") > o.index("formatCard"), f"howto tamu harus sesudah formatCard: {o}"
    print("1. Tamu OK:", o)

    # 2. Daftar akun baru (login)
    email = f"penguji-tidy-{int(time.time())}@example.com"
    page.locator("#authChip button:has-text('Buat Akun')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    page.locator('.auth-tab[data-tab="register"]').click()
    page.locator("#regNama").fill("Penguji Tidy")
    page.locator("#regEmail").fill(email)
    page.locator("#regPassword").fill("rahasia123")
    page.locator("#regPassword2").fill("rahasia123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji Tidy')", timeout=30000)
    assert "is-logged-in" in page.locator("body").get_attribute("class")
    print("2. Login OK.")

    # 3. Login: yang tidak perlu hilang, Cara Mengerjakan paling atas
    assert not page.locator("#screen-home .hero").is_visible(), "hero login harus hilang"
    assert not page.locator("#screen-home .hero-disclaimer").is_visible(), "disclaimer login harus hilang"
    assert not page.locator("#featuresCard").is_visible(), "kartu fitur login harus hilang"
    assert not page.locator("#guestCtaCard").is_visible(), "kartu tamu login harus hilang"
    assert page.locator("#historyCard").is_visible(), "riwayat login harus tampil"
    assert page.locator("#modeCard").is_visible(), "kartu mode login harus tampil"
    assert not page.locator("#alurStepAkun").is_visible(), "langkah Buat Akun harus hilang"
    assert not page.locator("#alurChev1").is_visible(), "chevron sesudah Buat Akun harus hilang"
    o = order()
    assert o[0] == "alurCard" and o[1] == "howtoCard", f"alur+howto harus 2 teratas: {o}"
    assert o.index("modeCard") > o.index("howtoCard"), f"modeCard harus sesudah howto: {o}"
    print("3. Beranda login rapi OK:", o)
    page.locator("#screen-home .hero").wait_for(state="hidden")
    page.screenshot(path="demo/home-tidy-loggedin.png")
    page.screenshot(path="demo/home-tidy-loggedin-full.png", full_page=True)
    print("   Screenshot: demo/home-tidy-loggedin.png (+ full).")

    # 4. Logout -> kembali ke beranda: urutan tamu kembali
    page.locator("#authChip button:has-text('Keluar')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    page.locator('.auth-back[data-nav="home"]').click()
    page.wait_for_selector("#screen-home:visible", timeout=10000)
    assert "is-logged-in" not in (page.locator("body").get_attribute("class") or "")
    assert page.locator("#screen-home .hero").is_visible(), "hero sesudah logout harus tampil"
    assert page.locator("#featuresCard").is_visible(), "kartu fitur sesudah logout harus tampil"
    assert not page.locator("#modeCard").is_visible(), "kartu mode sesudah logout harus sembunyi"
    o = order()
    assert o.index("alurCard") > o.index("guestCtaCard"), f"alur sesudah logout harus sesudah kartu tamu: {o}"
    assert o.index("howtoCard") > o.index("formatCard"), f"howto sesudah logout harus sesudah formatCard: {o}"
    print("4. Logout -> urutan tamu kembali OK:", o)

    assert not errors, f"console errors: {errors}"
    print("console errors: none")
    print("CAT CPNS HOME-TIDY OK")
    b.close()
