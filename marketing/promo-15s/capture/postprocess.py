"""Crops the kosakata scroll strip and its fixed header / bottom nav (run after capture*.cjs)."""
from pathlib import Path
from PIL import Image
img = Path(__file__).resolve().parent.parent / 'composition' / 'img'
Image.open(img / 'deck_full_raw.png').crop((0, 0, 1170, 1700 * 3)).save(img / 'deck_full.png')
g = Image.open(img / 'deck_grid.png')
g.crop((0, 0, 1170, 65 * 3)).save(img / 'deck_header.png')
g.crop((0, 782 * 3, 1170, 844 * 3)).save(img / 'deck_nav.png')
(img / 'deck_full_raw.png').unlink()
print('ok')
