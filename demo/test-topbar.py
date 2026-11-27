"""Reproduksi + verifikasi kerapian topbar CAT CPNS saat login.

Alur: buka situs lokal -> login sebagai aaa -> pilih Paket D -> Latihan TWK.
Di tiap kondisi (tamu, login di beranda, login di layar ujian) ukur tinggi
topbar dan apakah tiap bagiannya membungkus (wrap) ke >1 baris.
Topbar yang rapi = tinggi ~satu baris isi (<= 64px di desktop) dan tidak ada
bagian yang membungkus.

Pakai: python demo/test-topbar.py
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140"


def measure(page, label):
    m = page.evaluate("""() => {
      const tb = document.querySelector('.topbar');
      const r = tb.getBoundingClientRect();
      const lines = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || 16;
        return {h: el.getBoundingClientRect().height, lines: Math.round(el.getBoundingClientRect().height / lh),
                text: (el.textContent || '').trim().slice(0, 60)};
      };
      return {
        topbarH: Math.round(r.height),
        overflowX: tb.scrollWidth > tb.clientWidth + 1,
        brandSmall: lines('.brand small'),
        modeLabel: lines('#examModeLabelTop'),
        authChip: lines('#authChip'),
        navVisible: getComputedStyle(document.querySelector('.topnav')).display !== 'none',
        toggleVisible: getComputedStyle(document.querySelector('#navToggle')).display !== 'none',
        brandShortVisible: getComputedStyle(document.querySelector('.brand-short')).display !== 'none',
        brandLongVisible: getComputedStyle(document.querySelector('.brand > div')).display !== 'none',
      };
    }""")
    print(f"[{label}] topbar {m['topbarH']}px overflowX={m['overflowX']} nav={m['navVisible']}")
    for k in ("brandSmall", "modeLabel", "authChip"):
        v = m[k]
        if v:
            print(f"    {k}: {v['h']:.0f}px ~{v['lines']} baris | {v['text']!r}")
    return m


def check(label, m, baseline):
    ok = abs(m["topbarH"] - baseline) <= 2 and not m["overflowX"]
    for k in ("brandSmall", "modeLabel", "authChip"):
        v = m[k]
        if v and v["lines"] > 1:
            ok = False
    print(("  OK  " if ok else "  RUSAK") + f" {label} (tinggi {m['topbarH']}px vs tamu {baseline}px)")
    return ok


def check_menu(pg, label, logged_in=False):
    """Menu hamburger: tombol terlihat, daftar 5 tautan, klik menutup + navigasi,
    Escape menutup, klik di luar menutup."""
    ok = True
    def fail(msg):
        nonlocal ok
        ok = False
        print(f"  GAGAL {label}: {msg}")
    toggle = pg.locator("#navToggle")
    menu = pg.locator("#mobileMenu")
    if not toggle.is_visible():
        fail("tombol hamburger tidak terlihat")
        return False
    links = menu.locator("a")
    if links.count() != 5:
        fail(f"tautan menu {links.count()}, harus 5")
    labels = [links.nth(i).inner_text().strip() for i in range(links.count())]
    if labels != ["Beranda", "Formasi CPNS", "Format SKD", "Cara Mengerjakan", "Pembahasan"]:
        fail(f"label menu salah: {labels}")
    # buka -> klik Formasi CPNS -> menu menutup + kartu formasi terlihat
    toggle.click()
    pg.wait_for_timeout(300)
    if not menu.evaluate("el => el.classList.contains('open')"):
        fail("menu tidak terbuka setelah klik hamburger")
    links.nth(1).click()
    pg.wait_for_timeout(1300)
    if menu.evaluate("el => el.classList.contains('open')"):
        fail("menu tidak menutup setelah klik tautan")
    top = pg.evaluate("document.getElementById('formasiCard').getBoundingClientRect().top")
    if not (0 <= top < 844):
        fail(f"formasiCard tidak terlihat setelah navigasi (top={top:.0f})")
    # Escape menutup
    toggle.click()
    pg.wait_for_timeout(300)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    if menu.evaluate("el => el.classList.contains('open')"):
        fail("menu tidak menutup dengan Escape")
    # klik di luar menutup
    toggle.click()
    pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('.foot').scrollIntoView()")
    pg.locator(".foot").click()
    pg.wait_for_timeout(200)
    if menu.evaluate("el => el.classList.contains('open')"):
        fail("menu tidak menutup dengan klik di luar")
    print(("  OK  " if ok else "  RUSAK") + f" menu hamburger {label}")
    return ok


def main():
    all_ok = True
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--ignore-certificate-errors"],
                              proxy={"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"})
        for width, max_h in ((1440, 64), (1280, 64), (1024, 64)):
            pg = b.new_page(viewport={"width": width, "height": 900})
            errs = []
            pg.on("console", lambda msg: errs.append(msg.text) if msg.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
            pg.wait_for_timeout(600)
            m = measure(pg, f"tamu {width}px")
            baseline = m["topbarH"]
            all_ok &= check(f"tamu {width}px", m, baseline)
            want_toggle = width <= 1100
            if m["toggleVisible"] != want_toggle:
                print(f"  RUSAK toggle {width}px (terlihat={m['toggleVisible']}, harus {want_toggle})")
                all_ok = False
            # login sebagai aaa (password akun itu: 123456, cocok hash di Sheet)
            pg.locator("#authChip button:has-text('Masuk')").click()
            pg.wait_for_selector("#screen-auth:visible", timeout=10000)
            pg.fill("#loginEmail", "aaa@gmail.com")
            pg.fill("#loginPassword", "123456")
            pg.locator("#loginForm button[type='submit']").click()
            pg.wait_for_selector("#authChip:has-text('aaa')", timeout=30000)
            pg.wait_for_timeout(600)
            m = measure(pg, f"login beranda {width}px")
            all_ok &= check(f"login beranda {width}px", m, baseline)
            pg.screenshot(path=f"/tmp/topbar-login-home-{width}.png")
            # pilih Paket D lalu Latihan TWK (label mode muncul di topbar)
            pg.locator(".paket-btn[data-paket='D']").click()
            pg.wait_for_timeout(400)
            pg.locator(".mode[data-mode='TWK']").click()
            pg.wait_for_selector("#screen-exam:visible", timeout=10000)
            pg.wait_for_timeout(600)
            m = measure(pg, f"login ujian TWK-D {width}px")
            all_ok &= check(f"login ujian TWK-D {width}px", m, baseline)
            pg.screenshot(path=f"/tmp/topbar-login-exam-{width}.png")
            # kembali ke beranda lewat nav atas: label mode harus hilang.
            # (Klik via JS: di lebar <=1100px nav disembunyikan CSS, tapi
            # tautannya tetap berfungsi.)
            pg.evaluate("document.querySelector(\".topnav a[data-nav='home']\").click()")
            pg.wait_for_selector("#screen-home:visible", timeout=10000)
            pg.wait_for_timeout(600)
            m = measure(pg, f"login beranda stlh ujian {width}px")
            label_top = pg.locator("#examModeLabelTop").inner_text().strip()
            print(f"    examModeLabelTop setelah kembali: {label_top!r} (harus kosong)")
            if label_top:
                all_ok = False
            all_ok &= check(f"login beranda stlh ujian {width}px", m, baseline)
            if errs:
                print("  console errors:", errs)
                all_ok = False
            pg.close()
        # mobile 390px: nav sembunyi, topbar tetap 1 baris (56px: padding
        # lebih kecil; yang dicek: tidak meluber dan tidak ada yang membungkus)
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
        pg.wait_for_timeout(600)
        m = measure(pg, "tamu 390px")
        all_ok &= check("tamu 390px", m, m["topbarH"])
        # judul panjang diganti "CAT CPNS", tombol "Buat Akun" disembunyikan
        if not (m["brandShortVisible"] and not m["brandLongVisible"]):
            print("  RUSAK brand 390px (judul pendek harus tampil, judul panjang sembunyi)")
            all_ok = False
        if pg.locator("#authChip button:has-text('Buat Akun')").is_visible():
            print("  RUSAK tombol Buat Akun masih tampil di 390px")
            all_ok = False
        all_ok &= check_menu(pg, "tamu 390px")
        pg.close()
        # mobile 390px saat login: sapaan disembunyikan, Keluar tetap ada
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
        pg.locator("#authChip button:has-text('Masuk')").click()
        pg.wait_for_selector("#screen-auth:visible", timeout=10000)
        pg.fill("#loginEmail", "aaa@gmail.com")
        pg.fill("#loginPassword", "123456")
        pg.locator("#loginForm button[type='submit']").click()
        pg.wait_for_selector("#authChip:has-text('aaa')", timeout=30000)
        pg.wait_for_timeout(600)
        m = measure(pg, "login 390px")
        all_ok &= check("login 390px", m, m["topbarH"])
        if pg.locator("#authChip span").first.is_visible():
            print("  RUSAK sapaan 'Halo, ...' masih tampil di 390px")
            all_ok = False
        if not pg.locator("#authChip button:has-text('Keluar')").is_visible():
            print("  RUSAK tombol Keluar tidak tampil di 390px saat login")
            all_ok = False
        all_ok &= check_menu(pg, "login 390px", logged_in=True)
        pg.close()
        b.close()
    print("CAT CPNS TOPBAR " + ("OK" if all_ok else "GAGAL"))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
