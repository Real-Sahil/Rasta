#!/usr/bin/env python3
"""Generate square PWA/favicon icons from the brand mockup in design/app-icon-mockup.png.
The mockup is a 1376x768 presentation image; the icon is the green rounded square in the middle.
Run: python3 scripts/make-icons.py   (needs Pillow). Output: public/icons/*"""
from PIL import Image, ImageStat
import os

SRC = os.path.join(os.path.dirname(__file__), '..', 'design', 'app-icon-mockup.png')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
# Green square spans x 548..964, y 222..639; inset 32px to drop the rounded corners and get a full-bleed square.
core = im.crop((580, 255, 932, 607))  # 352 x 352

border = [core.crop(b) for b in [(0, 0, 352, 6), (0, 346, 352, 352), (0, 0, 6, 352), (346, 0, 352, 352)]]
bg = tuple(int(sum(ImageStat.Stat(b).mean[i] for b in border) / 4) for i in range(3))

def full_bleed(size):  # purpose "any": logo fills the tile
    return core.resize((size, size), Image.LANCZOS)

def maskable(size, scale=0.62):  # logo inside the 80% safe zone, solid brand colour to the edges
    canvas = Image.new('RGB', (size, size), bg)
    inner = core.resize((int(size * scale),) * 2, Image.LANCZOS)
    o = (size - inner.width) // 2
    canvas.paste(inner, (o, o))
    return canvas

full_bleed(192).save(f'{OUT}/icon-192.png', optimize=True)
full_bleed(512).save(f'{OUT}/icon-512.png', optimize=True)
maskable(512).save(f'{OUT}/icon-512-maskable.png', optimize=True)
full_bleed(180).save(f'{OUT}/apple-touch-icon.png', optimize=True)  # iOS rounds the corners itself
full_bleed(48).save(f'{OUT}/favicon-48.png', optimize=True)
full_bleed(256).save(f'{OUT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('background', bg)
