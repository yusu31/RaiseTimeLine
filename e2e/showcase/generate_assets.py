"""README用スクリーンショットに使う画像を自作する（著作権の問題を避けるため写真は使わない）。

投稿画像: 空のグラデーション + 太陽 + 重なる山 + 手前の地面で、風景イラストを描く。
アイコン: 円形のグラデーション + 頭文字。
実行: python -I generate_assets.py（Pillow が必要）
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).parent / "assets"
OUT.mkdir(exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def landscape(name, sky_top, sky_bottom, sun, mountains, ground, seed, size=(1200, 800)):
    rnd = random.Random(seed)
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(sky_top, sky_bottom, y / (h * 0.75)))
    # 太陽（ぼかしで光らせる）
    glow = Image.new("RGB", size, (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    sx, sy = int(w * rnd.uniform(0.55, 0.8)), int(h * rnd.uniform(0.28, 0.4))
    gd.ellipse([sx - 150, sy - 150, sx + 150, sy + 150], fill=sun)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L")), 0.7)
    d = ImageDraw.Draw(img)
    d.ellipse([sx - 55, sy - 55, sx + 55, sy + 55], fill=sun)
    # 山（奥から手前へ、色を濃くしていく）
    base = h * 0.62
    for i, col in enumerate(mountains):
        pts = [(0, h)]
        phase = rnd.uniform(0, 6.28)
        amp = 120 + 40 * (len(mountains) - i)
        for x in range(0, w + 20, 20):
            y = base + i * 60 - amp * (0.5 + 0.5 * math.sin(x / (210 - i * 25) + phase)) - rnd.uniform(0, 12)
            pts.append((x, y))
        pts.append((w, h))
        d.polygon(pts, fill=col)
    d.rectangle([0, int(h * 0.86), w, h], fill=ground)
    img.save(OUT / name, quality=90)


def avatar(name, c1, c2, letter, size=400):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(c1, c2, y / size))
    font = None
    for f in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        try:
            font = ImageFont.truetype(f, 190)
            break
        except OSError:
            pass
    d.text((size / 2, size / 2), letter, fill=(255, 255, 255), font=font, anchor="mm")
    img.save(OUT / name, quality=90)


landscape("sunrise.jpg", (255, 170, 120), (255, 225, 170), (255, 245, 210), [(236, 140, 120), (190, 100, 120), (110, 70, 110)], (60, 40, 70), 1)
landscape("lake.jpg", (90, 150, 220), (200, 230, 250), (255, 255, 240), [(120, 170, 210), (70, 130, 170), (40, 90, 120)], (25, 60, 80), 2)
landscape("forest.jpg", (130, 190, 200), (230, 240, 210), (255, 250, 200), [(150, 200, 160), (90, 160, 120), (50, 110, 80)], (30, 70, 50), 3)
landscape("dusk.jpg", (60, 50, 120), (240, 130, 140), (255, 210, 160), [(150, 90, 140), (100, 60, 120), (55, 40, 85)], (30, 25, 55), 4)

avatar("mio.jpg", (255, 140, 140), (255, 190, 120), "M")
avatar("kenta.jpg", (90, 150, 240), (110, 220, 220), "K")
avatar("sora.jpg", (150, 120, 240), (240, 140, 210), "S")
avatar("hina.jpg", (110, 200, 140), (210, 230, 120), "H")
print("assets:", sorted(p.name for p in OUT.iterdir()))
