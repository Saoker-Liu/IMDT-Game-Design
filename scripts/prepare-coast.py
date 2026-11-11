"""Encode the edited continuous sea scenes and crop matching shallow-water swatches."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets'
scenes = {}
for side in ('west', 'east'):
    source = Image.open(ROOT / 'art-source' / f'coast-{side}-v2.png').convert('RGB')
    if abs(source.width / source.height - 1) > .02:
        raise ValueError(f'{side} coast must be a square chart')
    scenes[side] = source
    encoded = source.copy()
    encoded.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    target = OUT / f'coast-{side}-v2.webp'
    encoded.save(target, quality=82, method=6)
    print(f'{target.name}: {target.stat().st_size:,} bytes')

# Four non-repeating detail crops from the same painted shallow sea, not a different material.
source = scenes['west']
swatches = Image.new('RGB', (640, 160))
for col, center_y in enumerate((.15, .38, .62, .85)):
    tile = source.crop((round(source.width * .02), round(source.height * (center_y - .09)),
                        round(source.width * .20), round(source.height * (center_y + .09))))
    tile = tile.resize((160, 160), Image.Resampling.LANCZOS)
    swatches.paste(tile, (col * 160, 0))
target = OUT / 'shoal-variants-v2.webp'
swatches.save(target, quality=86, method=6)
print(f'{target.name}: {target.stat().st_size:,} bytes, four matching shallow-water details')
