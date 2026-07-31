# ===================================================================================================
#  INSTALL A PIXELLAB OBJECT BUNDLE AS A MOUNT ARCHETYPE
# ---------------------------------------------------------------------------------------------------
#  PixelLab hands back a zip shaped like
#      rotations/<direction>.png                       one static frame per direction
#      animations/<slug>/<direction>/frame_00N.png     the clip
#  and the game wants
#      assets/mounts/<arch>/idle_<d>.png               the STATIC reference, used to scale the animal
#      assets/mounts/<arch>/<clip>_<d>_N.png           the clip, `idle` for a flyer, `walk` for a walker
#      assets/mounts/<arch>.png                        the flat fallback sprite
#  where <d> is the game's short direction (e, se, s, sw, w, nw, n, ne).
#
#  WHY THE STATIC FRAME MATTERS MORE THAN IT LOOKS. mountDrawUnder measures idle_<d>.png and scales
#  EVERY frame of that direction by what it finds, so the whole clip inherits the static frame's
#  proportions. Getting these two out of step is what makes an animal visibly pulse as it moves.
#
#  The old set is moved to assets/mounts/_old/<arch>-<n>/ rather than deleted, because an art swap
#  is the one change a selftest cannot judge for you.
#
#  Usage:  mountinstall.py <arch> <bundle.zip|dir> [--clip idle|walk] [--dry]
#  Interpreter is Python312 by full path; `py` is broken on this machine.
# ===================================================================================================
import io
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOUNTS = os.path.join(ROOT, 'assets', 'mounts')

# PixelLab's direction names -> the game's
DIRS = {'east': 'e', 'south-east': 'se', 'south': 's', 'south-west': 'sw',
        'west': 'w', 'north-west': 'nw', 'north': 'n', 'north-east': 'ne'}


def entries(src):
    """(relpath, bytes) for every png in a zip or a directory."""
    out = []
    if os.path.isdir(src):
        for dp, _d, fs in os.walk(src):
            for f in fs:
                if f.endswith('.png'):
                    p = os.path.join(dp, f)
                    out.append((os.path.relpath(p, src).replace('\\', '/'), io.open(p, 'rb').read()))
    else:
        z = zipfile.ZipFile(src)
        for n in z.namelist():
            if n.endswith('.png'):
                out.append((n, z.read(n)))
    return out


def plan(items, clip):
    """Map bundle paths onto game filenames. Returns {dest: bytes} plus what was skipped."""
    dest, skipped = {}, []
    for rel, data in items:
        parts = rel.split('/')
        if parts[0] == 'rotations' and len(parts) == 2:
            d = DIRS.get(parts[1][:-4])
            if not d:
                skipped.append(rel)
                continue
            dest['idle_%s.png' % d] = data
        elif parts[0] == 'animations' and len(parts) == 4:
            d = DIRS.get(parts[2])
            m = re.search(r'(\d+)\.png$', parts[3])
            if not d or not m:
                skipped.append(rel)
                continue
            dest['%s_%s_%d.png' % (clip, d, int(m.group(1)))] = data
        else:
            skipped.append(rel)
    return dest, skipped


def main(argv):
    if len(argv) < 3:
        print(__doc__ or '')
        print('usage: mountinstall.py <arch> <bundle.zip|dir> [--clip idle|walk] [--dry]')
        return 2
    arch, src = argv[1], argv[2]
    clip = 'idle'
    if '--clip' in argv:
        clip = argv[argv.index('--clip') + 1]
    dry = '--dry' in argv
    if clip not in ('idle', 'walk'):
        print('clip must be idle or walk'); return 2

    target = os.path.join(MOUNTS, arch)
    items = entries(src)
    dest, skipped = plan(items, clip)
    if not dest:
        print('nothing to install from %s' % src); return 1

    have = set(os.listdir(target)) if os.path.isdir(target) else set()
    new = set(dest)
    print('%s: bundle has %d pngs -> %d game files (clip=%s)' % (arch, len(items), len(dest), clip))
    print('  currently on disk: %d' % len(have))
    print('  written:  %d' % len(new))
    missing = sorted(h for h in have if h not in new)
    extra = sorted(n for n in new if n not in have)
    if missing:
        print('  NOT REPLACED (%d) -- these existed and the bundle has no equivalent:' % len(missing))
        print('    ' + ', '.join(missing[:12]) + (' ...' if len(missing) > 12 else ''))
    if extra:
        print('  NEW NAMES (%d): %s%s' % (len(extra), ', '.join(extra[:12]),
                                          ' ...' if len(extra) > 12 else ''))
    if skipped:
        print('  skipped %d bundle entries that are not rotations or frames' % len(skipped))
    if dry:
        print('  --dry, nothing written')
        return 0

    # keep the old set: an art swap is the one change no selftest can judge
    if os.path.isdir(target):
        n = 1
        while os.path.isdir(os.path.join(MOUNTS, '_old', '%s-%d' % (arch, n))):
            n += 1
        bak = os.path.join(MOUNTS, '_old', '%s-%d' % (arch, n))
        os.makedirs(os.path.dirname(bak), exist_ok=True)
        shutil.move(target, bak)
        print('  old set kept at %s' % os.path.relpath(bak, ROOT))
    os.makedirs(target, exist_ok=True)
    for name, data in sorted(dest.items()):
        io.open(os.path.join(target, name), 'wb').write(data)

    # the flat fallback sprite is the south rotation
    flat = dest.get('idle_s.png')
    if flat:
        fp = os.path.join(MOUNTS, arch + '.png')
        if os.path.exists(fp):
            os.makedirs(os.path.join(MOUNTS, '_old'), exist_ok=True)
            shutil.copy2(fp, os.path.join(MOUNTS, '_old', arch + '-flat.png'))
        io.open(fp, 'wb').write(flat)
        print('  flat sprite %s.png <- the south rotation' % arch)
    print('  installed %d files into %s' % (len(dest), os.path.relpath(target, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
