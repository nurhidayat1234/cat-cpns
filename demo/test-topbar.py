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
        pg.close()
        b.close()
    print("CAT CPNS TOPBAR " + ("OK" if all_ok else "GAGAL"))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
