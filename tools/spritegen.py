#!/usr/bin/env python
# ===================================================================================================
#  SPRITEGEN -- MAKE NEW SPRITES OUT OF THE SPRITES WE ALREADY HAVE
# ---------------------------------------------------------------------------------------------------
#  WHAT THIS IS FOR. There are 9,229 PNGs in assets/ and every one of them cost a PixelLab generation
#  to make. The game's content is much wider than that art: twelve mob archetypes have to carry
#  fifteen provinces and fifty levels, and "another golem, but this one is a FROST golem" is not a
#  drawing problem -- it is a palette problem. This turns one drawing into a family.
#
#  THIS IS NOT A NEW IDEA IN THIS REPO, it is an existing one moved to build time. projSprite() in
#  08_render.js already does exactly this at runtime: it takes the 24 PixelLab projectile PNGs, hue-
#  shifts each one's pixels, and gets hundreds of distinct projectile looks out of two dozen files.
#  The maths here is deliberately THE SAME maths -- the same HSL conversion, the same saturation-
#  weighted dominant-hue measurement, the same "leave low-saturation pixels alone" rule -- so a
#  variant baked here and a variant tinted at runtime agree about what "hue 205" means.
#
#  WHY BAKE INSTEAD OF TINT AT RUNTIME, given that path exists. Three reasons, and they only apply to
#  characters and creatures, not to projectiles:
#    1. A mob variant is not one image, it is a SET -- idle x9 and attack x9, or four facings x three
#       animations. Tinting that on load is 18 canvas passes per variant per boot, on a phone.
#    2. Baked art can be OPENED AND FIXED. A hue shift that turns a golem's eyes the wrong colour is
#       a two-minute edit on a file; at runtime it is unreachable.
#    3. The ops here are not all pointwise. Rim glows and outlines are neighbourhood operations and
#       want to happen once, not sixty times a second.
#
#  EVERYTHING IT WRITES IS DISPOSABLE AND KNOWN. Every output is recorded in assets/_derived.json
#  with the recipe that made it, so derived art can never be mistaken for hand-generated art,
#  `--clean` can remove exactly the derived files and nothing else, and a re-run with an unchanged
#  recipe is a no-op. Source files are never written to. Nothing outside assets/ is ever touched.
#
#  THE CONTACT-SHEET RULE (HANDOFF.md). Five of the twelve SD reagents were wrong and every failure
#  was invisible until the set was tiled into one image. So `--sheet` is not a nicety: generate a
#  family, look at the sheet, and only then decide it is good. Sheets go to _shots/spritegen_*.png.
#
#  USAGE
#    python tools/spritegen.py --list                  what recipes exist, and what they'd write
#    python tools/spritegen.py --dry                   full run, report only, write nothing
#    python tools/spritegen.py mob_frost               build one recipe
#    python tools/spritegen.py --all                   build every recipe in the file
#    python tools/spritegen.py mob_frost --sheet       build it and tile it into _shots/ to look at
#    python tools/spritegen.py --force mob_frost       rebuild even if up to date
#    python tools/spritegen.py --clean                 delete every derived file, per the manifest
#    python tools/spritegen.py --clean mob_frost       delete just this recipe's output
#
#  NAMING IS YOURS, at all three levels -- see the SETS AND NAMING block further down for the detail.
#    `to`      names the set and where it lands ({v} = the variant name)
#    `as`      renames variants of one recipe without touching the shared table they came from
#    `rename`  names the individual frames: a pattern over {stem} {base} {n} {v} {set} {ext},
#              or an explicit map {"idle_0.png": "sleep_0.png"} for full per-file control
#  and from the command line, without editing a recipe first:
#    python tools/spritegen.py anim_golem_frost --to assets/mobs/anim/rimewrought
#    python tools/spritegen.py anim_golem_frost --rename "{base}_{v}_{n}{ext}"
#    python tools/spritegen.py anim_golem_frost --show-names     every source -> output name, no writes
#
#  Recipes live in tools/sprite_recipes.json so a batch is reproducible and reviewable without
#  digging through a chat log -- the same contract install_sd_art.py holds its job ids under.
#
#  AFTER A RUN THAT ADDS OR REPLACES ART, BUMP ART_CACHE in sw.js. Nothing here needs a file list
#  (isArt() in sw.js keys on the extension, not on a manifest), but ART_CACHE is the only thing that
#  tells a phone its cached copy is stale.
#
#  Interpreter is Python312 by full path; `py` is broken on this machine. See HANDOFF.md.
# ===================================================================================================

import argparse
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
SHOTS = os.path.join(ROOT, "_shots")
RECIPES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sprite_recipes.json")
MANIFEST = os.path.join(ASSETS, "_derived.json")

# The saturation floor from projSprite(): a pixel below this keeps its colour untouched. It is what
# stops a hue shift from turning black outlines and grey steel into coloured mush, and it is the
# single most important number in the file -- every op that moves hue honours it.
KEEP_SAT = 0.14


# ---------------------------------------------------------------------------------------------------
# PIXEL MATHS. Vectorised ports of _rgb2hsl / _hsl2rgb / _domHue in 08_render.js. Same formulas,
# whole-array at a time; a 92x92 frame is 8,464 pixels and a full run is millions of them.
# ---------------------------------------------------------------------------------------------------

def rgb2hsl(rgb):
    """rgb float array (...,3) in 0..1 -> (h 0..360, s 0..1, l 0..1)."""
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    d = mx - mn
    l = (mx + mn) / 2.0
    s = np.zeros_like(l)
    nz = d > 1e-9
    s[nz] = np.where(l[nz] > 0.5, d[nz] / np.maximum(2.0 - mx[nz] - mn[nz], 1e-9),
                     d[nz] / np.maximum(mx[nz] + mn[nz], 1e-9))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(l)
    dd = np.where(nz, d, 1.0)
    hr = ((g - b) / dd) % 6.0
    hg = (b - r) / dd + 2.0
    hb = (r - g) / dd + 4.0
    h = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60.0
    h = np.where(nz, h, 0.0)
    return h, s, l


def hsl2rgb(h, s, l):
    """(h 0..360, s, l) -> rgb float array (...,3) in 0..1."""
    h = (h % 360.0) / 360.0
    q = np.where(l < 0.5, l * (1.0 + s), l + s - l * s)
    p = 2.0 * l - q

    def chan(t):
        t = t % 1.0
        out = np.empty_like(t)
        a = t < 1.0 / 6.0
        b = (~a) & (t < 0.5)
        c = (~a) & (~b) & (t < 2.0 / 3.0)
        d = ~(a | b | c)
        out[a] = p[a] + (q[a] - p[a]) * 6.0 * t[a]
        out[b] = q[b]
        out[c] = p[c] + (q[c] - p[c]) * (2.0 / 3.0 - t[c]) * 6.0
        out[d] = p[d]
        return out

    return np.stack([chan(h + 1.0 / 3.0), chan(h), chan(h - 1.0 / 3.0)], axis=-1)


def dom_hue(px, only=None):
    """Saturation-weighted circular mean hue of the opaque, coloured pixels -- _domHue()'s method.

    A plain average of hues is wrong on a colour wheel (350 and 10 average to 180, the opposite
    colour), which is why this sums unit vectors instead. Grey and near-transparent pixels are
    excluded so a mostly-steel sprite reports the hue of its accents, which is the thing a viewer
    actually reads as its colour."""
    a = px[..., 3]
    rgb = px[..., :3].astype(np.float64) / 255.0
    h, s, _ = rgb2hsl(rgb)
    m = (a >= 40) & (s >= 0.2) & band_mask(h, only)
    if not m.any():
        return 0.0
    ang = np.deg2rad(h[m])
    vx = float((np.cos(ang) * s[m]).sum())
    vy = float((np.sin(ang) * s[m]).sum())
    if vx == 0.0 and vy == 0.0:
        return 0.0
    return float(np.degrees(np.arctan2(vy, vx)) % 360.0)


def band_mask(h, only):
    """Pixels whose hue falls in the [lo,hi] degree band, wrapping through 0.

    THIS IS THE OP THAT MAKES BICHROMATIC SOURCES WORKABLE, and most of the good art here is
    bichromatic. arch_golem measures a dominant hue of 324 degrees, which is a colour it does not
    contain: it is 1,042 violet pixels (the energy core) and 937 warm ones (the stone) averaging to
    a magenta that is in neither. One delta across both moved the red trim to yellow while the core
    went blue -- so a variant of a two-colour sprite is TWO hue ops, one per band, and `--probe`
    exists to tell you where the bands are."""
    if not only:
        return np.ones_like(h, dtype=bool)
    lo, hi = float(only[0]) % 360.0, float(only[1]) % 360.0
    hh = h % 360.0
    return (hh >= lo) & (hh <= hi) if lo <= hi else (hh >= lo) | (hh <= hi)


# ---------------------------------------------------------------------------------------------------
# THE TWO NEIGHBOURHOOD KERNELS, WRITTEN OUT RATHER THAN TAKEN FROM PIL.
#
# These used to be ImageFilter.GaussianBlur and ImageFilter.MaxFilter, which were correct and one
# line each. They are spelled out here because _spritelab.js has to reproduce them EXACTLY in a
# browser: Pillow's Gaussian is three box passes with its own radius-to-window rule, canvas's
# `filter: blur()` is a different Gaussian again, and a preview that does not match the file it is
# previewing is worse than having no preview at all -- you would tune against one image and ship
# another. Defined here, both sides agree by construction instead of by luck.
#
# "Blur radius r" therefore means, precisely: three passes of an edge-clamped moving average with a
# window of 2r+1, horizontally then vertically each time.
# ---------------------------------------------------------------------------------------------------

def _box1(a, r, axis):
    """One edge-clamped moving average of window 2r+1 along `axis`."""
    if r < 1:
        return a
    pad = [(r, r) if i == axis else (0, 0) for i in range(a.ndim)]
    ap = np.pad(a, pad, mode="edge")
    cs = np.cumsum(ap, axis=axis)
    lead = list(cs.shape)
    lead[axis] = 1
    cs = np.concatenate([np.zeros(lead, dtype=cs.dtype), cs], axis=axis)
    n = a.shape[axis]
    hi = np.take(cs, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(cs, np.arange(0, n), axis=axis)
    return (hi - lo) / float(2 * r + 1)


def box_blur3(a, r):
    """Three box passes each way -- the blur `glow` means. Mirrored exactly in _spritelab.js."""
    r = int(r)
    out = a.astype(np.float64)
    for _ in range(3):
        out = _box1(out, r, 1)
        out = _box1(out, r, 0)
    return out


def max_filter(a, r):
    """Edge-clamped maximum over a (2r+1)x(2r+1) window -- the dilation `outline` means."""
    r = int(r)
    if r < 1:
        return a
    ap = np.pad(a, ((r, r), (r, r)), mode="edge")
    out = np.zeros_like(a)
    h, w = a.shape
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            out = np.maximum(out, ap[dy:dy + h, dx:dx + w])
    return out


def _col(v):
    """Accept '#rrggbb', [r,g,b] or [r,g,b,a] -> float triple 0..255."""
    if isinstance(v, str):
        v = v.lstrip("#")
        return np.array([int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)], dtype=np.float64)
    return np.array(v[:3], dtype=np.float64)


# ---------------------------------------------------------------------------------------------------
# THE OPS. Each takes an HxWx4 uint8 array and returns one. `ctx` carries the things an op may need
# to look outside its own pixels: the frame's filename (so `layer` can find the matching frame in
# another set) and the set's measured source hue (so a whole set shifts together -- see op_hue).
# ---------------------------------------------------------------------------------------------------

def op_hue(px, ctx, by=None, to=None, only=None, keep_sat=KEEP_SAT):
    """Rotate hue. `by` is a delta in degrees; `to` is a target hue for the pixels being moved.
    `only` restricts the move to a hue band -- see band_mask, and use `--probe` to find the bands.

    `to` IS MEASURED ONCE PER SET, NOT PER FRAME (ctx['set_hue']). Measuring per frame looks more
    careful and is in fact the bug: an attack frame lit by its own muzzle flash reports a different
    dominant hue from the idle beside it, so each frame gets a different correction and the finished
    animation strobes. One delta for the whole set is what keeps it stable.

    With `only`, the reference is the BAND's own dominant hue, not the sprite's -- "take the violet
    core to 22" has to mean the violet, or the correction is measured against a colour that is not
    being moved. That reference is also per-set for the same anti-strobe reason."""
    if by is None and to is None:
        return px
    out = px.copy()
    rgb = out[..., :3].astype(np.float64) / 255.0
    h, s, l = rgb2hsl(rgb)
    m = (out[..., 3] >= 8) & (s >= keep_sat)          # outlines and greys are left exactly alone
    m &= band_mask(h, only)
    if not m.any():
        return out
    if by is not None:
        delta = float(by)
    else:
        ref = ctx["band_hue"](tuple(only)) if only else ctx["set_hue"]
        delta = float(to) - ref
    if abs(delta) <= 0.5:
        return px
    nr = hsl2rgb(h[m] + delta, s[m], l[m])
    out[..., :3][m] = np.clip(nr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return out


def op_sat(px, ctx, mul=1.0, add=0.0, only=None):
    """Scale/offset saturation. mul<1 drains a variant toward ash; mul>1 pushes it toward poster."""
    out = px.copy()
    rgb = out[..., :3].astype(np.float64) / 255.0
    h, s, l = rgb2hsl(rgb)
    m = (out[..., 3] >= 8) & band_mask(h, only)
    if not m.any():
        return out
    ns = np.clip(s[m] * float(mul) + float(add), 0.0, 1.0)
    nr = hsl2rgb(h[m], ns, l[m])
    out[..., :3][m] = np.clip(nr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return out


def op_light(px, ctx, mul=1.0, add=0.0, only=None):
    """Scale/offset lightness. Use small numbers: this is the op that most easily flattens a sprite."""
    out = px.copy()
    rgb = out[..., :3].astype(np.float64) / 255.0
    h, s, l = rgb2hsl(rgb)
    m = (out[..., 3] >= 8) & band_mask(h, only)
    if not m.any():
        return out
    nl = np.clip(l[m] * float(mul) + float(add), 0.0, 1.0)
    nr = hsl2rgb(h[m], s[m], nl)
    out[..., :3][m] = np.clip(nr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return out


def op_ramp(px, ctx, shadow=(20, 20, 20), high=(230, 230, 230), span=0.8, mix=1.0):
    """Remap every pixel onto a shadow->highlight ramp by its own luminance. repaint_terrain.py's
    curve, generalised.

    POINTWISE ON PURPOSE: a pixel's new colour depends only on its own luminance and never on its
    neighbours, so this cannot disturb a seamless tile's wrap or soften an outline. `span` below 1.0
    holds back from the ends of the ramp -- mapping a low-variance sprite across the full ramp turns
    its fine dither into static. `mix` blends the result back over the original, so 0.35 reads as
    "this golem has been out in the frost" rather than "this golem is now a blue silhouette"."""
    out = px.copy()
    sh, hi = _col(shadow), _col(high)
    rgb = out[..., :3].astype(np.float64)
    m = out[..., 3] >= 8
    if not m.any():
        return out
    luma = (rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722)[m]
    lo, hiq = float(luma.mean() - 2.5 * luma.std()), float(luma.mean() + 2.5 * luma.std())
    if hiq - lo < 1e-6:
        hiq = lo + 1.0
    t = np.clip((luma - lo) / (hiq - lo), 0.0, 1.0)
    t = 0.5 + (t - 0.5) * float(span)
    ramped = sh[None, :] + (hi - sh)[None, :] * t[:, None]
    k = float(mix)
    out[..., :3][m] = np.clip(rgb[m] * (1.0 - k) + ramped * k + 0.5, 0, 255).astype(np.uint8)
    return out


def op_tint(px, ctx, color="#ffffff", amount=0.3, only=None):
    """Blend flat toward a colour. Blunter than `hue` and that is sometimes the point -- a poison
    variant wants everything pulled green, including the greys `hue` deliberately protects."""
    out = px.copy()
    c = _col(color)
    m = out[..., 3] >= 8
    if only:
        h, _, _ = rgb2hsl(out[..., :3].astype(np.float64) / 255.0)
        m &= band_mask(h, only)
    if not m.any():
        return out
    k = float(amount)
    out[..., :3][m] = np.clip(out[..., :3][m].astype(np.float64) * (1.0 - k) + c[None, :] * k + 0.5,
                              0, 255).astype(np.uint8)
    return out


def op_alpha(px, ctx, mul=1.0):
    """Scale alpha. This is the whole of the phantom/spectral treatment."""
    out = px.copy()
    out[..., 3] = np.clip(out[..., 3].astype(np.float64) * float(mul) + 0.5, 0, 255).astype(np.uint8)
    return out


def op_outline(px, ctx, color="#ffd76a", px_width=1, alpha=255):
    """Draw a hard outline hugging the silhouette, INSIDE the existing canvas.

    Staying inside the canvas is deliberate: these sets are blitted base-anchored at a size the
    renderer already knows, and a frame that grew by two pixels sits two pixels wrong. Use `pad`
    first if the sprite touches its own edge and you need the room."""
    out = px.copy()
    grown = max_filter(out[..., 3], int(px_width))
    ring = (grown.astype(np.int16) - out[..., 3].astype(np.int16)) > 40
    if not ring.any():
        return out
    c = _col(color)
    out[..., 0][ring], out[..., 1][ring], out[..., 2][ring] = c[0], c[1], c[2]
    out[..., 3][ring] = int(alpha)
    return out


def op_glow(px, ctx, color=None, hue=None, radius=4, strength=0.6):
    """A soft coloured halo BEHIND the sprite -- the elite/awakened treatment.

    Behind, not over: a halo painted on top of the art dulls exactly the detail that says which
    creature this is. Built from the blurred alpha so it follows the silhouette, and clipped to the
    canvas for the same anchoring reason as `outline`."""
    if color is None:
        color = "#ffffff" if hue is None else None
    c = _col(color) if color is not None else (_col("#ffffff"))
    if hue is not None:
        rgbv = hsl2rgb(np.array([float(hue)]), np.array([0.85]), np.array([0.62]))[0]
        c = np.clip(rgbv * 255.0, 0, 255).astype(np.float64)
    halo = box_blur3(px[..., 3], radius) / 255.0 * float(strength)
    halo = np.clip(halo, 0.0, 1.0)

    src_a = px[..., 3].astype(np.float64) / 255.0
    out_a = src_a + halo * (1.0 - src_a)                      # sprite over halo, straight alpha
    out = np.zeros_like(px, dtype=np.float64)
    safe = np.maximum(out_a, 1e-6)
    for i in range(3):
        out[..., i] = (px[..., i].astype(np.float64) * src_a + c[i] * halo * (1.0 - src_a)) / safe
    out[..., 3] = out_a * 255.0
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def op_pad(px, ctx, px_amount=4):
    """Grow the canvas on all sides, sprite centred. Every frame in a set must get the same pad or
    the animation will jitter -- so pad in the recipe, never conditionally."""
    n = int(px_amount)
    h, w = px.shape[0], px.shape[1]
    out = np.zeros((h + 2 * n, w + 2 * n, 4), dtype=np.uint8)
    out[n:n + h, n:n + w] = px
    return out


def op_scale(px, ctx, factor=1.0):
    """Nearest-neighbour resize. Nearest is not laziness -- anything smoother puts intermediate
    colours between pixel-art clusters and the result stops reading as pixel art."""
    f = float(factor)
    im = Image.fromarray(px, mode="RGBA")
    w, h = max(1, int(round(im.width * f))), max(1, int(round(im.height * f)))
    return np.asarray(im.resize((w, h), Image.NEAREST)).copy()


def op_flip(px, ctx):
    """Mirror horizontally."""
    return px[:, ::-1].copy()


def op_layer(px, ctx, src=None, dx=0, dy=0, scale=1.0, under=False, opacity=1.0):
    """Composite another sprite over (or under) this one.

    `src` may be a FILE -- used on every frame -- or a DIRECTORY, in which case the frame with the
    SAME FILENAME is used. That is what makes a per-frame overlay possible: an eight-direction mount
    and an eight-direction rider line up by name, which is precisely how the mount/rider art in this
    repo is already organised (assets/riders/<cls>/ride_<d>.png against assets/mounts/<arch>/)."""
    if not src:
        return px
    p = os.path.join(ROOT, src)
    if os.path.isdir(p):
        p = os.path.join(p, ctx["name"])
        if not os.path.exists(p):
            return px                                          # no matching frame: leave it alone
    if not os.path.exists(p):
        raise SystemExit("layer source not found: %s" % src)
    lay = load_rgba(p)
    if float(scale) != 1.0:
        lay = op_scale(lay, ctx, factor=scale)
    if float(opacity) != 1.0:
        lay = op_alpha(lay, ctx, mul=opacity)

    base = px.astype(np.float64) / 255.0
    over = np.zeros_like(base)
    H, W = base.shape[0], base.shape[1]
    lh, lw = lay.shape[0], lay.shape[1]
    ox = int(round((W - lw) / 2.0 + float(dx)))                # centred, then offset
    oy = int(round((H - lh) / 2.0 + float(dy)))
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(W, ox + lw), min(H, oy + lh)
    if x0 >= x1 or y0 >= y1:
        return px                                              # entirely off-canvas
    over[y0:y1, x0:x1] = lay[y0 - oy:y1 - oy, x0 - ox:x1 - ox].astype(np.float64) / 255.0

    top, bot = (base, over) if under else (over, base)
    ta, ba = top[..., 3:4], bot[..., 3:4]
    oa = ta + ba * (1.0 - ta)
    safe = np.maximum(oa, 1e-6)
    rgb = (top[..., :3] * ta + bot[..., :3] * ba * (1.0 - ta)) / safe
    return np.clip(np.concatenate([rgb, oa], axis=-1) * 255.0 + 0.5, 0, 255).astype(np.uint8)


OPS = {
    "hue": op_hue, "sat": op_sat, "light": op_light, "ramp": op_ramp, "tint": op_tint,
    "alpha": op_alpha, "outline": op_outline, "glow": op_glow, "pad": op_pad,
    "scale": op_scale, "flip": op_flip, "layer": op_layer,
}
# Recipes name these with friendlier keys than the python signatures allow.
ALIAS = {"width": "px_width", "amount": "px_amount", "px": "px_width"}


def apply_ops(px, ops, ctx):
    for spec in ops:
        spec = dict(spec)
        name = spec.pop("op")
        fn = OPS.get(name)
        if fn is None:
            raise SystemExit("unknown op %r (have: %s)" % (name, ", ".join(sorted(OPS))))
        kw = {}
        for k, v in spec.items():
            if name == "tint" and k == "amount":
                kw["amount"] = v                               # tint's own `amount` is not a pad
            else:
                kw[ALIAS.get(k, k)] = v
        px = fn(px, ctx, **kw)
    return px


# ---------------------------------------------------------------------------------------------------
# SETS AND NAMING. A recipe reads a source (one PNG, or a directory of frames) and writes a
# destination. By DEFAULT the frames keep the source's filenames, because that is the whole trick for
# wiring: 08c_embersprites.js probes for `idle_<d>.png` / `walk_<d>_<n>.png` / `attack_<d>_<n>.png`
# and mob anims for `{idle,attack}_<n>.png`, so a directory that keeps those names is loadable by the
# code that already exists.
#
# THE DEFAULT IS A DEFAULT, NOT A RULE. Every name is yours to set, at three levels:
#
#   1. THE SET       `to` is the output path, and it is the only thing that decides where a set lands
#                    and what it is called. `{v}` in it is replaced by the variant name.
#   2. THE VARIANT   `as` renames variants coming out of a shared table, per recipe:
#                        "as": {"frost": "rime", "venom": "blight"}
#                    so `still_golem` can call its frost family "rime" without the golem's rename
#                    reaching the eleven other archetypes that share the same element definitions.
#                    A variant may also be written long-hand as an object with its own `name`/`to`,
#                    which lets one variant of a family land somewhere else entirely.
#   3. THE FRAME     `rename` renames the individual files. Either a PATTERN over these tokens
#                        {stem} source name without .png     {ext}  ".png"
#                        {v}    variant name                 {set}  recipe name
#                        {n}    trailing frame number, if the source name ends in one
#                        {base} source name with any trailing _<n> removed
#                    e.g.  "rename": "{base}_{v}_{n}{ext}"   ->  idle_3.png -> idle_frost_3.png
#                    or an explicit MAP for full control, one entry per file:
#                        "rename": {"idle_0.png": "sleep_0.png", "attack_0.png": "lunge_0.png"}
#                    Unlisted files keep their names, so a map can rename just the two you care about.
#
# `--to` and `--rename` do the same two things from the command line for a one-off build, so naming
# something new never requires editing the recipe file first.
#
# RENAMING IS CHECKED, NOT TRUSTED: two frames colliding on one output name is refused outright
# rather than silently letting the last one win, and a rename that breaks the loaders' expected
# pattern is called out as a warning -- you may well mean it (a codex portrait, an item icon, a
# stitched sheet), so it does not stop the build.
# ---------------------------------------------------------------------------------------------------

# What the probing loaders in 08c_embersprites.js will actually look for. Used only to warn.
LOADER_PATTERNS = ("idle_", "walk_", "attack_", "ride_")


def load_rgba(path):
    """Open a PNG as RGBA, with the colour under fully transparent pixels zeroed.

    WHY THE ZEROING. A canvas stores premultiplied alpha, so a browser reading a PNG back gets
    (0,0,0,0) wherever alpha is 0, while Pillow hands back whatever RGB the file happened to store
    under those invisible pixels. Nothing renders differently either way -- the game blits nearest-
    neighbour, so no filter ever bleeds that colour in -- but it made _spritelab.js and this file
    disagree byte-for-byte on `flip` and `scale`, which move pixels without touching colour and so
    could not have been the cause. Normalising on load makes both sides start from the same input,
    which is what lets tools/labparity.py assert IDENTICAL rather than 'close enough'."""
    px = np.asarray(Image.open(path).convert("RGBA")).copy()
    px[..., :3][px[..., 3] == 0] = 0
    return px


def frames_of(src_abs):
    if os.path.isdir(src_abs):
        return sorted(f for f in os.listdir(src_abs) if f.lower().endswith(".png"))
    return [os.path.basename(src_abs)]


def rename_frame(fn, rec):
    """Apply a recipe's `rename` to one source filename. No rename -> the source name, unchanged."""
    ren = rec.get("rename")
    if not ren:
        return fn
    if isinstance(ren, dict):
        return ren.get(fn, fn)                       # an explicit map only renames what it lists
    stem, ext = os.path.splitext(fn)
    n, base = "", stem
    tail = stem.rsplit("_", 1)
    if len(tail) == 2 and tail[1].isdigit():
        base, n = tail[0], tail[1]
    # Straight token substitution rather than str.format: a stray brace in a filename should not
    # raise, and there are no other braces we want interpreted.
    out = ren
    for tok, val in (("{stem}", stem), ("{ext}", ext), ("{v}", rec.get("v", "")),
                     ("{set}", rec.get("set", "")), ("{n}", n), ("{base}", base)):
        out = out.replace(tok, val)
    return out


def resolve_names(names, rec):
    """Map every source frame to its output name, refusing collisions.

    A collision is refused rather than warned about because the failure is otherwise invisible: two
    frames writing to one path leaves a set that is short by one, with no error and nothing on disk
    to show which one won."""
    pairs = [(fn, rename_frame(fn, rec)) for fn in names]
    seen = {}
    for src, dst in pairs:
        if dst in seen:
            raise SystemExit("[%s] rename collision: %s and %s both -> %s"
                             % (rec.get("set", "?"), seen[dst], src, dst))
        seen[dst] = src
    return pairs


def load_recipes(path=RECIPES):
    if not os.path.exists(path):
        raise SystemExit("no recipe file at %s" % path)
    with open(path, "r", encoding="utf-8") as f:
        doc = json.load(f)
    shared = doc.get("shared", {})
    out = {}
    for name, r in doc.get("recipes", {}).items():
        # `variants` is the leverage: one entry, one source, N outputs. Twelve archetypes times four
        # elements is 48 families written as 12 lines, and the elements stay consistent across them
        # because they are literally the same numbers -- `variants_from` points at one shared table
        # so that stays true by construction rather than by everyone remembering to copy the edit.
        if "variants_from" in r:
            key = r["variants_from"]
            if key not in shared:
                raise SystemExit("recipe %s wants shared table %r, which is not defined" % (name, key))
            r = dict(r, variants=shared[key])
        if "variants" in r:
            # `as` renames the variants of THIS recipe only. That is the point of it: the element
            # definitions are shared across twelve archetypes on purpose, so a rename must not travel
            # back up into the table and drag the other eleven along with it.
            aliases = r.get("as") or {}
            for vname, vspec in r["variants"].items():
                if isinstance(vspec, dict):                    # long-hand: this variant names itself
                    label = vspec.get("name", aliases.get(vname, vname))
                    vto = vspec.get("to") or r["to"].replace("{v}", label)
                    vops = vspec.get("ops") or []
                    vren = vspec.get("rename", r.get("rename"))
                else:
                    label = aliases.get(vname, vname)
                    vto = r["to"].replace("{v}", label)
                    vops = vspec
                    vren = r.get("rename")
                key = "%s_%s" % (name, label)                  # the CLI name follows the output name
                if key in out:
                    raise SystemExit("two variants of %s both resolve to the name %r" % (name, label))
                out[key] = {"from": r["from"], "to": vto, "ops": (r.get("ops") or []) + vops,
                            "note": r.get("note", ""), "v": label, "set": key, "rename": vren}
        else:
            out[name] = {"from": r["from"], "to": r["to"], "ops": r.get("ops") or [],
                         "note": r.get("note", ""), "v": "", "set": name, "rename": r.get("rename")}
    for k in out:
        if out[k].get("rename") is None:
            out[k].pop("rename", None)                          # keep the manifest key tidy
    return out


def read_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"_note": "Written by tools/spritegen.py. Every file listed here is DERIVED from other "
                     "art in this repo and can be regenerated or deleted; nothing here was drawn. "
                     "--clean removes exactly these files.",
            "sets": {}}


def write_manifest(man):
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(man, f, indent=1, sort_keys=True)
        f.write("\n")


def inside_assets(p):
    return os.path.abspath(p).startswith(os.path.abspath(ASSETS) + os.sep)


def build(name, rec, force=False, dry=False):
    src = os.path.join(ROOT, rec["from"])
    dst = os.path.join(ROOT, rec["to"])
    if not os.path.exists(src):
        raise SystemExit("[%s] source not found: %s" % (name, rec["from"]))
    if not inside_assets(dst):
        raise SystemExit("[%s] refusing to write outside assets/: %s" % (name, rec["to"]))
    if os.path.abspath(src) == os.path.abspath(dst):
        raise SystemExit("[%s] source and destination are the same path" % name)

    names = frames_of(src)
    if not names:
        raise SystemExit("[%s] source has no PNGs: %s" % (name, rec["from"]))

    # One dominant hue for the whole set, measured off the first frame. See op_hue for why per-frame
    # measurement is wrong.
    first = os.path.join(src, names[0]) if os.path.isdir(src) else src
    ref_px = load_rgba(first)
    set_hue = dom_hue(ref_px)
    _band_cache = {}

    def band_hue(band):
        if band not in _band_cache:
            _band_cache[band] = dom_hue(ref_px, only=band)
        return _band_cache[band]

    key = json.dumps(rec, sort_keys=True)
    man = read_manifest()
    prev = man["sets"].get(name)
    if prev and prev.get("key") == key and not force:
        have = all(os.path.exists(os.path.join(ROOT, f)) for f in prev.get("files", []))
        if have:
            return {"name": name, "skipped": True, "count": len(prev.get("files", []))}

    # For a DIRECTORY source `to` is the folder and each frame is named by `rename` (default: keep the
    # source name). For a SINGLE FILE source `to` already names the file outright, so rename has
    # nothing left to decide and is not consulted.
    pairs = resolve_names(names, rec) if os.path.isdir(src) else [(names[0], os.path.basename(dst))]

    warn = None
    if os.path.isdir(src) and rec.get("rename"):
        broke = [d for _, d in pairs if not d.startswith(LOADER_PATTERNS)]
        if broke:
            warn = ("%d frame(s) renamed off the loader's pattern (e.g. %s) -- fine if deliberate, "
                    "but 08c_embersprites.js will not find them by probing" % (len(broke), broke[0]))

    written = []
    for fn, outfn in pairs:
        s = os.path.join(src, fn) if os.path.isdir(src) else src
        d = os.path.join(dst, outfn) if os.path.isdir(src) else dst
        if dry:
            written.append(os.path.relpath(d, ROOT).replace("\\", "/"))
            continue
        px = load_rgba(s)
        px = apply_ops(px, rec["ops"], {"name": fn, "set_hue": set_hue, "set": name,
                                        "band_hue": band_hue})
        os.makedirs(os.path.dirname(d), exist_ok=True)
        Image.fromarray(px, mode="RGBA").save(d, optimize=True)
        written.append(os.path.relpath(d, ROOT).replace("\\", "/"))

    if not dry:
        man["sets"][name] = {"key": key, "from": rec["from"], "to": rec["to"],
                             "ops": rec["ops"], "files": written}
        write_manifest(man)
    return {"name": name, "skipped": False, "count": len(written), "files": written,
            "hue": round(set_hue, 1), "warn": warn}


def clean(only=None):
    man = read_manifest()
    gone = 0
    for name in list(man["sets"]):
        if only and name != only:
            continue
        ent = man["sets"].pop(name)
        for rel in ent.get("files", []):
            p = os.path.join(ROOT, rel)
            if os.path.exists(p) and inside_assets(p):
                os.remove(p)
                gone += 1
        d = os.path.join(ROOT, ent["to"])
        if os.path.isdir(d) and inside_assets(d) and not os.listdir(d):
            shutil.rmtree(d)
    if man["sets"]:
        write_manifest(man)
    elif os.path.exists(MANIFEST):
        os.remove(MANIFEST)        # nothing derived left: leave no trace in the tree either
    return gone


def contact_sheet(sets, out_name, cols=0):
    """Tile every frame of the given sets into one PNG, THE SOURCE FIRST. The point is to see a family
    at once -- individually each of the five bad SD reagents looked fine.

    The source tile is not decoration. Nearly every judgement about a derived sprite is comparative
    ("is this still readable as a golem", "did the eyes survive"), and a sheet of four variants with
    nothing to compare them to answers none of it."""
    man = read_manifest()
    # Group by SOURCE: one row per source, that source's frame first and its variants after it.
    # A flat tiling of 48 variants is unreadable for the one question a sheet has to answer, which is
    # always "how does this compare to the one it came from".
    groups = []                                   # [(source_frame, [variant frames...])]
    index = {}
    for n in sets:
        ent = man["sets"].get(n, {})
        s = os.path.join(ROOT, ent.get("from", ""))
        if not ent.get("from") or not os.path.exists(s):
            continue
        head = os.path.join(s, frames_of(s)[0]) if os.path.isdir(s) else s
        if head not in index:
            index[head] = len(groups)
            groups.append((head, []))
        fs = [os.path.join(ROOT, f) for f in ent.get("files", [])]
        # one representative frame per set, so a 4-element family is 4 tiles and not 72
        fs = [f for f in fs if os.path.exists(f)]
        if fs:
            groups[index[head]][1].append(fs[0])
    groups = [g for g in groups if g[1]]
    if not groups:
        return None

    rowsimg = [[Image.open(g[0]).convert("RGBA")] + [Image.open(f).convert("RGBA") for f in g[1]]
               for g in groups]
    cols = cols or max(len(r) for r in rowsimg)
    cw = max(i.width for r in rowsimg for i in r) + 6
    ch = max(i.height for r in rowsimg for i in r) + 6
    sheet = Image.new("RGBA", (cols * cw, len(rowsimg) * ch), (26, 22, 28, 255))
    for ry, r in enumerate(rowsimg):
        for cx, im in enumerate(r[:cols]):
            sheet.alpha_composite(im, (cx * cw + (cw - im.width) // 2,
                                       ry * ch + (ch - im.height) // 2))
    os.makedirs(SHOTS, exist_ok=True)
    p = os.path.join(SHOTS, "spritegen_%s.png" % out_name)
    sheet.save(p)
    return p


def probe(path):
    """Print where a sprite's colour actually lives. Run this BEFORE writing a recipe.

    The dominant hue alone is a trap on any sprite with two colour families -- it reports the
    circular mean, which for arch_golem is a magenta the sprite does not contain. The histogram is
    what tells you there are two bands and what to put in `only`."""
    p = os.path.join(ROOT, path) if not os.path.isabs(path) else path
    if os.path.isdir(p):
        p = os.path.join(p, frames_of(p)[0])
    px = load_rgba(p)
    rgb = px[..., :3].astype(np.float64) / 255.0
    h, s, _ = rgb2hsl(rgb)
    m = (px[..., 3] >= 40) & (s >= 0.2)
    n = int(m.sum())
    print("%s   %dx%d   %d coloured px (alpha>=40, sat>=0.2)" % (
        os.path.relpath(p, ROOT).replace("\\", "/"), px.shape[1], px.shape[0], n))
    if not n:
        print("  no coloured pixels -- this sprite is greyscale; `hue` will do nothing to it.")
        print("  use `ramp` or `tint` instead, which do not need existing hue to work.")
        return 0
    hist, _ = np.histogram(h[m], bins=24, range=(0.0, 360.0))
    peak = hist.max()
    for i, c in enumerate(hist):
        if not c:
            continue
        bar = "#" * max(1, int(round(30.0 * c / peak)))
        print("  %3d-%3d  %6d  %s" % (i * 15, (i + 1) * 15, c, bar))
    print("  dominant hue (saturation-weighted circular mean): %.1f deg" % dom_hue(px))
    # Name the bands that carry real mass, so the recipe can address them directly.
    big = [(i * 15, (i + 1) * 15, int(c)) for i, c in enumerate(hist) if c >= 0.15 * peak]
    if big:
        merged = []
        for lo, hi, c in big:
            if merged and lo - merged[-1][1] <= 15:
                merged[-1] = (merged[-1][0], hi, merged[-1][2] + c)
            else:
                merged.append((lo, hi, c))
        print("  bands worth addressing:")
        for lo, hi, c in merged:
            print("    \"only\": [%d, %d]   %d px   band hue %.1f" % (
                lo, hi, c, dom_hue(px, only=(lo, hi))))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Derive new sprite sets from the art already in assets/.")
    ap.add_argument("names", nargs="*", help="recipe names to build (default: none; use --all)")
    ap.add_argument("--all", action="store_true", help="build every recipe")
    ap.add_argument("--list", action="store_true", help="list recipes and what they would write")
    ap.add_argument("--dry", action="store_true", help="report only, write nothing")
    ap.add_argument("--force", action="store_true", help="rebuild even when up to date")
    ap.add_argument("--clean", action="store_true", help="delete derived files (all, or the named one)")
    ap.add_argument("--sheet", action="store_true", help="tile the built sets into _shots/ to look at")
    ap.add_argument("--recipes", default=RECIPES, help="recipe file (default tools/sprite_recipes.json)")
    ap.add_argument("--probe", metavar="PATH", help="report a sprite's hue bands; run before writing a recipe")
    ap.add_argument("--to", metavar="PATH", help="override the output path for a single recipe (one-off naming)")
    ap.add_argument("--rename", metavar="PATTERN",
                    help="override output frame names, e.g. '{base}_{v}_{n}{ext}' (one recipe at a time)")
    # NOT `--names`: the positional argument is already `names`, and argparse would quietly have the
    # flag overwrite the list of recipes to build.
    ap.add_argument("--show-names", action="store_true", dest="show_names",
                    help="print the exact source -> output filename for every frame, and write nothing")
    a = ap.parse_args()

    if a.probe:
        return probe(a.probe)

    recs = load_recipes(a.recipes)

    # One-off naming from the command line. Restricted to a single recipe on purpose: `--to` names one
    # destination, and quietly pointing eleven recipes at it would have them overwrite each other.
    if a.to or a.rename:
        if len(a.names) != 1 or a.all:
            raise SystemExit("--to/--rename name a single output, so give exactly one recipe name")
        if a.names[0] not in recs:
            raise SystemExit("unknown recipe: %s (try --list)" % a.names[0])
        recs = dict(recs)
        r = dict(recs[a.names[0]])
        if a.to:
            r["to"] = a.to.replace("{v}", r.get("v", ""))
        if a.rename:
            r["rename"] = a.rename
        recs[a.names[0]] = r

    if a.show_names:
        todo = sorted(recs) if a.all else a.names
        if not todo:
            raise SystemExit("--show-names needs a recipe name, or --all")
        for n in todo:
            if n not in recs:
                raise SystemExit("unknown recipe: %s (try --list)" % n)
            r = recs[n]
            src = os.path.join(ROOT, r["from"])
            if not os.path.exists(src):
                print("! %s: source missing (%s)" % (n, r["from"]))
                continue
            fs = frames_of(src)
            print("%s  ->  %s" % (n, r["to"]))
            if os.path.isdir(src):
                for s, d in resolve_names(fs, r):
                    print("    %-24s -> %s%s" % (s, d, "" if s == d else "   (renamed)"))
            else:
                print("    %-24s -> %s" % (fs[0], os.path.basename(r["to"])))
        return 0

    if a.clean:
        n = clean(a.names[0] if a.names else None)
        print("removed %d derived file(s)" % n)
        return 0

    if a.list:
        print("%d recipe(s) in %s\n" % (len(recs), os.path.relpath(a.recipes, ROOT)))
        for n in sorted(recs):
            r = recs[n]
            src = os.path.join(ROOT, r["from"])
            cnt = len(frames_of(src)) if os.path.exists(src) else 0
            mark = " " if os.path.exists(src) else "!"
            print("%s %-28s %-42s -> %-42s %3d frame(s)" % (mark, n, r["from"], r["to"], cnt))
            if r.get("note"):
                print("  %s" % r["note"])
        print("\n! = source missing")
        return 0

    todo = sorted(recs) if a.all else a.names
    if not todo:
        ap.print_help()
        return 2
    unknown = [n for n in todo if n not in recs]
    if unknown:
        raise SystemExit("unknown recipe(s): %s\n(try --list)" % ", ".join(unknown))

    total = 0
    for n in todo:
        r = build(n, recs[n], force=a.force, dry=a.dry)
        if r["skipped"]:
            print("  = %-30s up to date (%d files)" % (n, r["count"]))
        else:
            total += r["count"]
            print("  %s %-30s %d file(s)%s" % ("~" if a.dry else "+", n, r["count"],
                  "" if a.dry else "  src hue %.0f deg" % r["hue"]))
            if r.get("warn"):
                print("    note: %s" % r["warn"])
    print("\n%s %d file(s) across %d set(s)" % ("would write" if a.dry else "wrote", total, len(todo)))

    if a.sheet and not a.dry:
        p = contact_sheet(todo, todo[0] if len(todo) == 1 else "batch")
        if p:
            print("contact sheet: %s" % os.path.relpath(p, ROOT))
            print("LOOK AT IT before believing the set is good.")
    if total and not a.dry:
        print("art changed -- bump ART_CACHE in sw.js.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
