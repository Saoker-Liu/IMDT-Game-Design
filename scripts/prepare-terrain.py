"""Resize the original 4x4 atlas for the board, retaining all generated tile variants."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'art-source' / 'terrain-atlas-original.png').convert('RGB')
# Normalize each tile separately so a fractional source boundary never bleeds into a neighbor.
atlas = Image.new('RGB', (512, 512))
for row in range(4):
    for col in range(4):
        tile = source.crop((round(col * source.width / 4), round(row * source.height / 4),
                            round((col + 1) * source.width / 4), round((row + 1) * source.height / 4)))
        tile = tile.resize((128, 128), Image.Resampling.LANCZOS)
        atlas.paste(tile, (col * 128, row * 128))
destination = ROOT / 'public' / 'assets' / 'terrain-atlas.webp'
atlas.save(destination, quality=86, method=6)
print(f'{destination.name}: {destination.stat().st_size:,} bytes, 16 tile variants')
