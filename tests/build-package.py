"""Build a portable, deterministic WordPress plugin ZIP. No external dependencies."""
import argparse
import hashlib
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, default=root / 'test-artifacts')
args = parser.parse_args()
version = re.search(r'^ \* Version: ([\d.]+)$', (root / 'untappd-atlas.php').read_text(encoding='utf-8'), re.M).group(1)
args.output_dir.mkdir(parents=True, exist_ok=True)
archive = args.output_dir / f'untappd-atlas-{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    files = [(root / 'untappd-atlas.php', 'untappd-atlas/untappd-atlas.php')]
    files += [(path, path.relative_to(root).as_posix()) for path in sorted((root / 'untappd-atlas').rglob('*'))]
    for path, archive_path in files:
        if not path.is_file():
            continue
        entry = zipfile.ZipInfo(archive_path, (2020, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        package.writestr(entry, path.read_bytes())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert b'Plugin Name: Untappd Atlas' in package.read('untappd-atlas/untappd-atlas.php')[:8192]
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{checksum}  {archive.name}\n', encoding='ascii')
print(f'{archive}: {checksum}')
