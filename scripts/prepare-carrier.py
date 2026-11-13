"""Export the original carrier sprite, preserving alpha, proportions and painted detail."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / "art-source" / "carrier-original.png"
target = root / "public" / "assets" / "fleet-carrier.webp"
image = Image.open(source).convert("RGBA")
bounds = image.getchannel("A").getbbox()
if not bounds:
    raise ValueError("Carrier image has no visible pixels")
image = image.crop(bounds)
padding = max(4, round(image.width * 0.015))
canvas = Image.new("RGBA", (image.width + padding * 2, image.height + padding * 2))
canvas.alpha_composite(image, (padding, padding))
canvas = canvas.resize((1024, round(canvas.height * 1024 / canvas.width)), Image.Resampling.LANCZOS)
canvas.save(target, "WEBP", quality=92, method=6, exact=True)
print(f"Exported {target.name}: {canvas.width}x{canvas.height}, {target.stat().st_size:,} bytes")
