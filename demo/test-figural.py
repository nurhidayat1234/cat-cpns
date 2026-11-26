"""Uji gambar figural TIU (SVG dari DSL, FIGURAL.md).
Bagian 1: renderFigure/svgCell langsung di halaman — sampel seq/matrix/analogi
dirender dan di-screenshot untuk dicek visual.
Bagian 2 (E2E): daftar akun baru, Latihan TIU Paket A, buka soal figural via
palet (TIU-28 Serial, TIU-30 Matriks, TIU-32 Analogi) — figureBox berisi SVG
dan 5 opsi gambar tampil; jawab semua benar -> total TIU 175; Pembahasan
menampilkan gambar. Setelah jalan, bersihkan baris Sheet yang dibuat tes ini.
"""
import json, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8140"
PROXY = {"server": "http://127.0.0.1:18080", "bypass": "127.0.0.1,localhost"}
errors = []

SAMPLES = {
    "seq": {"kind": "seq", "cells": [
        {"s": "triangle", "r": 0}, {"s": "triangle", "r": 90},
        {"s": "triangle", "r": 180}, {"s": "triangle", "r": 270}, "?"]},
    "matrix": {"kind": "matrix", "cells": [
        [{"s": "circle", "d": 0}, {"s": "circle", "d": 1}, {"s": "circle", "d": 2}],
        [{"s": "square", "d": 1}, {"s": "square", "d": 2}, {"s": "square", "d": 0}],
        [{"s": "diamond", "d": 2}, {"s": "diamond", "d": 0}, "?"]]},
    "analogy": {"kind": "analogy", "a": {"s": "circle", "f": "black"},
                "b": {"s": "circle", "f": "white"}, "c": {"s": "square", "f": "black"}},
}

with sync_playwright() as p:
    b = p.chromium.launch(proxy=PROXY, args=["--ignore-certificate-errors"])
    page = b.new_page()
    page.on("dialog", lambda d: d.accept())
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)

    # ---- Bagian 1: render sampel ----
    html = page.evaluate("""(samples) => {
        const out = {};
        for (const [k, fig] of Object.entries(samples)) out[k] = renderFigure(fig);
        out.cell = svgCell({s: 'star', f: 'white', d: 2}, 56);
        out.q = svgCell('?', 72);
        return out;
    }""", SAMPLES)
    assert html["seq"].count("<svg") == 5, "seq harus 5 svg (4 + ?)"
    assert html["matrix"].count("<svg") == 9, "matrix harus 9 svg (8 + ?)"
    assert html["analogy"].count("<svg") == 4, "analogi harus 4 svg (3 + ?)"
    assert "<svg" in html["cell"] and "<svg" in html["q"]
    page.evaluate("""(html) => {
        document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif">'
          + '<h2>Serial (segitiga berputar 90°)</h2>' + html.seq
          + '<h2>Matriks 3x3 (titik 0-1-2)</h2>' + html.matrix
          + '<h2>Analogi (lingkaran hitam : putih :: kotak hitam : ?)</h2>' + html.analogy
          + '<h2>Sel bintang putih + kotak ?</h2>' + html.cell + ' ' + html.q + '</div>';
    }""", html)
    page.wait_for_timeout(400)
    page.screenshot(path="demo/figural-samples.png")
    print("1. Render sampel OK (seq 5 svg, matrix 9 svg, analogi 4 svg). Screenshot: demo/figural-samples.png")

    # ---- Bagian 2: E2E latihan TIU + pembahasan ----
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    ts = int(time.time())
    email = f"penguji-figural-{ts}@example.com"
    page.locator("#authChip button:has-text('Buat Akun')").click()
    page.wait_for_selector("#screen-auth:visible", timeout=10000)
    page.locator('.auth-tab[data-tab="register"]').click()
    page.locator("#regNama").fill("Penguji Figural")
    page.locator("#regEmail").fill(email)
    page.locator("#regPassword").fill("rahasia123")
    page.locator("#regPassword2").fill("rahasia123")
    page.locator('#registerForm button[type="submit"]').click()
    page.wait_for_selector("#authChip:has-text('Penguji Figural')", timeout=30000)
    print("2. Daftar + login OK:", email)

    data = json.load(open("data/questions-a.json"))
    tiu = [q for q in data if q["category"] == "TIU"]
    by_id = {q["id"]: q for q in tiu}
    page.locator('.mode[data-mode="TIU"]').click()
    page.wait_for_selector("#screen-exam:visible", timeout=10000)
    for qid, label in [("TIU-28", "Serial"), ("TIU-30", "Matriks"), ("TIU-32", "Analogi")]:
        idx = [q["id"] for q in tiu].index(qid)
        page.locator(".pal").nth(idx).click()
        page.wait_for_timeout(400)
        assert f"Soal {idx + 1} " in page.locator("#qNum").inner_text(), page.locator("#qNum").inner_text()
        assert page.locator("#figureBox:visible").count() == 1, f"{qid}: figureBox tidak tampil"
        assert page.locator("#figureBox svg").count() >= 4, f"{qid}: SVG stem kurang"
        assert page.locator(".opt-fig").count() == 5, f"{qid}: opsi gambar bukan 5"
        print(f"3. {qid} ({label}) tampil: stem SVG + 5 opsi gambar OK.")
    # jawab semua TIU benar -> total 175
    for i, q in enumerate(tiu):
        page.locator(".pal").nth(i).click()
        page.wait_for_timeout(150)
        page.locator(".opt").nth(q["answer"]).click()
    page.locator("#finishBtn").click()
    page.wait_for_selector("#screen-result:visible", timeout=10000)
    total = page.locator("#resultTotal").inner_text()
    assert total == "175", f"total TIU harus 175, dapat {total}"
    print("4. Latihan TIU selesai, total 175.")
    # pembahasan menampilkan gambar
    page.locator("#reviewBtn").click()
    page.wait_for_selector("#screen-review:visible", timeout=10000)
    page.locator("#filterCat").select_option("TIU")
    page.wait_for_timeout(500)
    assert page.locator(".rev-fig svg").count() >= 8, "Pembahasan TIU harus menampilkan >=8 gambar stem"
    assert page.locator(".rev-opt .fig-opt svg").count() >= 40, "Pembahasan TIU harus menampilkan opsi gambar"
    print("5. Pembahasan TIU menampilkan gambar (stem + opsi) OK.")
    print("console errors:", errors if errors else "none")
    b.close()
assert not errors, errors
print("CAT CPNS FIGURAL OK")
