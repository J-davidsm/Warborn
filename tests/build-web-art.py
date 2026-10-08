"""Create same-resolution web artwork; retain PNG originals for future editing.

Requires cwebp. Sprites/indicators are lossless so faction masks and alpha remain exact.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess

root = Path(__file__).resolve().parents[1]
sources = list((root / 'assets').glob('*.png'))
for folder in ['leaders', 'ui', 'doctrines', 'settlements', 'indicators']:
    sources.extend((root / 'assets' / folder).glob('*.png'))

def encode(source):
    target = source.with_suffix('.webp')
    painted = source.parent.name in ['leaders', 'ui', 'doctrines']
    options = ['-q', '88'] if painted else ['-lossless', '-exact']
    subprocess.run(['cwebp', '-quiet', '-m', '6', *options, str(source), '-o', str(target)], check=True)
    return source.stat().st_size, target.stat().st_size

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        sizes = list(pool.map(encode, sources))
    before, after = map(sum, zip(*sizes))
    print(f'{len(sizes)} images: {before:,} → {after:,} bytes ({100*(1-after/before):.1f}% smaller)')
