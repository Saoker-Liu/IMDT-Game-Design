"""Encode complete map paintings; no tile extraction or per-cell texturing."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
for map_id in ('archipelago', 'undertow'):
    for side in (0, 1):
        stem = f'chart-{map_id}-{side}-v3'
        source = Image.open(ROOT / 'art-source' / f'{stem}.png').convert('RGB')
        if source.width != source.height:
            raise ValueError(f'{stem} must be a complete square chart')
        source.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        target = ROOT / 'public' / 'assets' / f'{stem}.webp'
        source.save(target, quality=84, method=6)
        print(f'{target.name}: {target.stat().st_size:,} bytes')
