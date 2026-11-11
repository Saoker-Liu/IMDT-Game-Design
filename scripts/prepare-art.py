"""Mechanically slice the generated atlas and encode web assets; retain original pixels/alpha."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
atlas = Image.open(ROOT / 'art-source' / 'fleet-atlas.png').convert('RGBA')
bands = [('battleship', 0, 278, 512), ('cruiser', 278, 539, 512),
         ('destroyer', 539, 782, 384), ('frigate', 782, 1024, 256)]
for name, top, bottom, width in bands:
    sprite = atlas.crop((0, top, atlas.width, bottom))
    # Ignore nearly invisible alpha noise only when measuring the crop. Preserve alpha itself.
    box = sprite.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if box is None:
        raise RuntimeError(f'Empty sprite: {name}')
    sprite = sprite.crop(box)
    # At the largest board, this provides at least two source pixels per CSS pixel.
    sprite.thumbnail((width, 256), Image.Resampling.LANCZOS)
    sprite.save(OUT / f'fleet-{name}.webp', quality=87, method=6)
    print(name, sprite.size)
ocean = Image.open(ROOT / 'art-source' / 'ocean-original.png').convert('RGB')
ocean.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
ocean.save(OUT / 'ocean-chart.webp', quality=78, method=6)
print('Ocean', ocean.size)

impact = Image.open(ROOT / 'art-source' / 'impact-original.png').convert('RGBA')
box = impact.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
if box is None:
    raise RuntimeError('Empty fire sprite')
impact = impact.crop(box)
impact.thumbnail((192, 280), Image.Resampling.LANCZOS)
impact.save(OUT / 'impact-fire.webp', quality=85, method=6)
print('Fire', impact.size)
