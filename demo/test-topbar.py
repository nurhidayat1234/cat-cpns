"""Reproduksi + verifikasi kerapian topbar CAT CPNS saat login dan menu mobile.

Alur: buka situs lokal -> login sebagai aaa -> pilih Paket D -> Latihan TWK.
Di tiap kondisi (tamu, login di beranda, login di layar ujian) ukur tinggi
topbar dan apakah tiap bagiannya membungkus (wrap) ke >1 baris.
Topbar yang rapi = tinggi ~satu baris isi (70px desktop, 61px HP) dan tidak ada
bagian yang membungkus. Menu hamburger (<=1100px): panel dropdown di kanan,
isi rata kiri, 5 tautan nav + baris auth (tamu: Masuk/Buat Akun; login:
sapaan + Keluar); chip akun topbar hanya tampil di desktop.

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
        authChipVisible: getComputedStyle(document.querySelector('#authChip')).display !== 'none',
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
    """Menu hamburger: tombol terlihat, panel menempel di kanan + isi rata kanan,
    5 tautan nav, baris auth sesuai status login, klik menutup + navigasi,
    Escape menutup, klik di luar menutup, aksi auth (Masuk/Keluar) jalan."""
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
    toggle.click()
    pg.wait_for_timeout(300)
    if not menu.evaluate("el => el.classList.contains('open')"):
        fail("menu tidak terbuka setelah klik hamburger")
        return False
    nav_links = menu.locator("a[data-nav]")
    if nav_links.count() != 5:
        fail(f"tautan nav {nav_links.count()}, harus 5")
    labels = [nav_links.nth(i).inner_text().strip() for i in range(nav_links.count())]
    if labels != ["Beranda", "Formasi CPNS", "Format SKD", "Cara Mengerjakan", "Pembahasan"]:
        fail(f"label menu salah: {labels}")
    # panel menempel di pinggir kanan pil + isi rata kiri
    geo = pg.evaluate("""() => {
      const m = document.getElementById('mobileMenu').getBoundingClientRect();
      const t = document.querySelector('.topbar').getBoundingClientRect();
      const a = document.querySelector('#mobileMenu a');
      return {menuRight: m.right, topbarRight: t.right, menuW: m.width, topbarW: t.width,
              align: getComputedStyle(a).textAlign};
    }""")
    if abs(geo["menuRight"] - geo["topbarRight"]) > 2:
        fail(f"panel tidak menempel di kanan (menu {geo['menuRight']:.0f} vs topbar {geo['topbarRight']:.0f})")
    if geo["menuW"] >= geo["topbarW"]:
        fail("panel selebar topbar, harus dropdown sempit di kanan")
    if geo["align"] != "left":
        fail(f"isi menu rata {geo['align']}, harus left")
    # baris auth sesuai status login
    def auth_visible(action):
        return pg.locator(f"#mobileMenu [data-action='{action}']").is_visible()
    if logged_in:
        if not pg.locator("#mobileMenu .menu-user").is_visible():
            fail("baris sapaan tidak tampil saat login")
        elif "aaa" not in pg.locator("#mobileMenu .menu-user").inner_text():
            fail("baris sapaan tidak berisi nama akun")
        if not auth_visible("logout"):
            fail("Keluar tidak tampil di menu saat login")
        if auth_visible("login") or auth_visible("register"):
            fail("Masuk/Buat Akun masih tampil di menu saat login")
    else:
        if pg.locator("#mobileMenu .menu-user").is_visible():
            fail("baris sapaan tampil padahal tamu")
        if not (auth_visible("login") and auth_visible("register")):
            fail("Masuk/Buat Akun tidak tampil di menu saat tamu")
        if auth_visible("logout"):
            fail("Keluar tampil di menu padahal tamu")
    # Escape menutup
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
    # klik Formasi CPNS -> menu menutup + kartu formasi terlihat
    toggle.click()
    pg.wait_for_timeout(300)
    nav_links.nth(1).click()
    pg.wait_for_timeout(1300)
    if menu.evaluate("el => el.classList.contains('open')"):
        fail("menu tidak menutup setelah klik tautan")
    top = pg.evaluate("document.getElementById('formasiCard').getBoundingClientRect().top")
    if not (-10 <= top < 844):
        fail(f"formasiCard tidak terlihat setelah navigasi (top={top:.0f})")
    # aksi auth terakhir (meninggalkan halaman): tamu -> Masuk, login -> Keluar
    toggle.click()
    pg.wait_for_timeout(300)
    if logged_in:
        pg.locator("#mobileMenu [data-action='logout']").click()
        pg.wait_for_timeout(800)
        if pg.evaluate("document.body.classList.contains('is-logged-in')"):
            fail("masih login setelah Keluar dari menu")
        if not pg.locator("#screen-auth:visible").is_visible():
            fail("tidak pindah ke layar login setelah Keluar")
    else:
        pg.locator("#mobileMenu [data-action='login']").click()
        pg.wait_for_timeout(800)
        if menu.evaluate("el => el.classList.contains('open')"):
            fail("menu tidak menutup setelah klik Masuk")
        if not pg.locator("#screen-auth:visible").is_visible():
            fail("tidak pindah ke layar login setelah Masuk")
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
            # chip akun hanya di desktop; di <=1100px auth pindah ke dalam menu
            if m["authChipVisible"] != (width > 1100):
                print(f"  RUSAK authChip {width}px (terlihat={m['authChipVisible']}, harus {width > 1100})")
                all_ok = False
            # login sebagai aaa (password akun itu: 123456, cocok hash di Sheet)
            # di <=1100px Masuk sudah pindah ke dalam menu hamburger
            if width <= 1100:
                pg.locator("#navToggle").click()
                pg.wait_for_timeout(300)
                pg.locator("#mobileMenu [data-action='login']").click()
            else:
                pg.locator("#authChip button:has-text('Masuk')").click()
            pg.wait_for_selector("#screen-auth:visible", timeout=10000)
            pg.fill("#loginEmail", "aaa@gmail.com")
            pg.fill("#loginPassword", "123456")
            pg.locator("#loginForm button[type='submit']").click()
            pg.wait_for_selector("body.is-logged-in", timeout=30000)
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
        # judul panjang diganti "CAT CPNS", chip akun pindah ke menu
        if not (m["brandShortVisible"] and not m["brandLongVisible"]):
            print("  RUSAK brand 390px (judul pendek harus tampil, judul panjang sembunyi)")
            all_ok = False
        if m["authChipVisible"]:
            print("  RUSAK chip akun masih tampil di topbar 390px (harus di dalam menu)")
            all_ok = False
        all_ok &= check_menu(pg, "tamu 390px")
        pg.close()
        # mobile 390px saat login: chip akun di menu, topbar tinggal logo + hamburger
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
        pg.wait_for_timeout(600)
        # login lewat menu (Masuk sudah pindah ke dalam menu)
        pg.locator("#navToggle").click()
        pg.wait_for_timeout(300)
        pg.locator("#mobileMenu [data-action='login']").click()
        pg.wait_for_selector("#screen-auth:visible", timeout=10000)
        pg.fill("#loginEmail", "aaa@gmail.com")
        pg.fill("#loginPassword", "123456")
        pg.locator("#loginForm button[type='submit']").click()
        pg.wait_for_selector("body.is-logged-in", timeout=30000)
        pg.wait_for_timeout(600)
        m = measure(pg, "login 390px")
        all_ok &= check("login 390px", m, m["topbarH"])
        if m["authChipVisible"]:
            print("  RUSAK chip akun masih tampil di topbar 390px saat login")
            all_ok = False
        all_ok &= check_menu(pg, "login 390px", logged_in=True)
        pg.close()
        b.close()
    print("CAT CPNS TOPBAR " + ("OK" if all_ok else "GAGAL"))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
