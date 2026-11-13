"""Encode the continuous sea scenes. The v3.2 UI uses complete charts, without swatches."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets'
for side in ('west', 'east'):
    source = Image.open(ROOT / 'art-source' / f'coast-{side}-v2.png').convert('RGB')
    if abs(source.width / source.height - 1) > .02:
        raise ValueError(f'{side} coast must be a square chart')
    encoded = source.copy()
    encoded.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    target = OUT / f'coast-{side}-v2.webp'
    encoded.save(target, quality=82, method=6)
    print(f'{target.name}: {target.stat().st_size:,} bytes')
