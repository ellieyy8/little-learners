"""Draw the app icons with PIL (no text). Run from the site root: python3 tools/make_icons.py"""
import math
from PIL import Image, ImageDraw

BG = (247, 243, 234)       # same cream as the app background
RED = (255, 90, 95); BLUE = (59, 130, 246); YELLOW = (250, 204, 21); GREEN = (34, 197, 94)

def star_pts(cx, cy, r_out, r_in, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def draw(size, safe):
    """safe = fraction of the canvas the artwork may occupy (centered)."""
    S = 1024
    im = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(im)
    pad = S * (1 - safe) / 2
    u = (S - 2 * pad) / 100.0          # artwork unit: 100 x 100 box
    X = lambda v: pad + v * u
    # red circle (top-left)
    d.ellipse([X(4), X(4), X(46), X(46)], fill=RED)
    # blue rounded square (top-right)
    d.rounded_rectangle([X(55), X(6), X(95), X(46)], radius=6 * u, fill=BLUE)
    # green triangle (bottom-left)
    d.polygon([(X(25), X(54)), (X(47), X(95)), (X(3), X(95))], fill=GREEN)
    # yellow star (bottom-right)
    d.polygon(star_pts(X(75), X(76), 24 * u, 10 * u), fill=YELLOW)
    return im.resize((size, size), Image.LANCZOS)

draw(180, 0.80).save("icons/apple-touch-icon.png")
draw(192, 0.80).save("icons/icon-192.png")
draw(512, 0.80).save("icons/icon-512.png")
draw(512, 0.62).save("icons/icon-maskable-512.png")   # artwork inside the 80% maskable safe zone
draw(32, 0.92).save("icons/favicon-32.png")
print("icons written")
