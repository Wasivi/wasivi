#!/usr/bin/env python3
"""Fit a sharper render of the How We Work sculpture onto the site's maps.

channels.png and skin.png (the gold and silver pour, the bronze skeleton and
the outline) were traced from the first artwork. A newer render is the same
design drawn slightly differently, so this bends the new render gently until
its lines sit on those maps, then writes it as the site's artwork. The maps,
the outline and every slide's placement stay exactly as they are. It lines the
render up against the current artwork.jpg, which already fits the maps.

Run from the repo root:

    python3 tools/sculpture_art.py <render.png> <out.jpg> [--scale 2] [--check dir]

--scale sets the output size as a multiple of the 1672 x 941 maps. Give it the
largest render available; it is resized here if it is too small for the scale.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

MAPS = 'public/images/How_We_Work/'
OLD_ART = MAPS + 'artwork.jpg'
SKIN = MAPS + 'skin.png'
CHANNELS = MAPS + 'channels.png'

# (scale, patch, search, step, smoothing in grid cells), coarse to fine. Sizes
# are in pixels at that scale.
LEVELS = [
    (0.25, 32, 10, 8, 3.0),
    (0.25, 32, 6, 8, 2.5),
    (0.5, 40, 8, 12, 3.0),
    (1.0, 48, 6, 16, 3.0),
]


def blur(a, sigma):
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    falloff = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.fft.irfft2(np.fft.rfft2(a) * falloff, s=a.shape)


def sample(a, x, y):
    h, w = a.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0 = x.astype(np.int32)
    y0 = y.astype(np.int32)
    fx = (x - x0).astype(np.float32)
    fy = (y - y0).astype(np.float32)
    if a.ndim == 3:
        fx = fx[..., None]
        fy = fy[..., None]
    return (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy)
            + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy)


def local_contrast(g, sigma):
    """Evens out the lighting, so the two renders compare by line, not shade."""
    detail = g - blur(g, sigma)
    return detail / (np.sqrt(np.maximum(blur(detail * detail, sigma * 1.5), 0)) + 0.01)


def silhouette(g, level=0.05):
    """The solid shape of the object: each row and column filled end to end."""
    bright = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))) > level * 255
    rows = np.logical_and(np.maximum.accumulate(bright, 1), np.maximum.accumulate(bright[:, ::-1], 1)[:, ::-1])
    cols = np.logical_and(np.maximum.accumulate(bright, 0), np.maximum.accumulate(bright[::-1], 0)[::-1])
    return blur((rows & cols).astype(np.float32), 3) > 0.5


def bbox(mask):
    ys, xs = np.where(mask)
    return xs.min(), ys.min(), xs.max(), ys.max()


def match(a, b, mask, step, patch, search):
    """Where each patch of a turns up in b: points, shifts and match quality."""
    p, r = patch // 2, search
    h, w = a.shape
    win = np.outer(np.hanning(patch), np.hanning(patch))
    found = []
    for y in range(p + r, h - p - r, step):
        for x in range(p + r, w - p - r, step):
            if not mask[y, x]:
                continue
            ap = a[y - p:y + p, x - p:x + p] * win
            ap = ap - ap.mean()
            region = b[y - p - r:y + p + r, x - p - r:x + p + r]
            corr = np.fft.irfft2(np.fft.rfft2(region) * np.conj(np.fft.rfft2(ap, s=region.shape)), s=region.shape)
            dy, dx = np.unravel_index(corr[:2 * r + 1, :2 * r + 1].argmax(), (2 * r + 1, 2 * r + 1))
            bp = b[y + dy - r - p:y + dy - r + p, x + dx - r - p:x + dx - r + p] * win
            bp = bp - bp.mean()
            ncc = (ap * bp).sum() / (np.linalg.norm(ap) * np.linalg.norm(bp) + 1e-6)
            found.append((x, y, dx - r, dy - r, ncc))
    return np.array(found, dtype=np.float32).reshape(-1, 5)


def spread(pts, vals, weights, shape, cell, sigma):
    """Smooth field through scattered values, on a grid of the given cell size."""
    h, w = shape
    gh, gw = h // cell + 2, w // cell + 2
    gy = np.clip((pts[:, 1] / cell).astype(int), 0, gh - 1)
    gx = np.clip((pts[:, 0] / cell).astype(int), 0, gw - 1)
    acc = np.zeros((gh, gw), np.float64)
    wgt = np.zeros((gh, gw), np.float64)
    np.add.at(acc, (gy, gx), vals * weights)
    np.add.at(wgt, (gy, gx), weights)
    return blur(acc, sigma) / np.maximum(blur(wgt, sigma), 1e-4)


def main():
    args = sys.argv[1:]
    scale = int(args[args.index('--scale') + 1]) if '--scale' in args else 2
    check = args[args.index('--check') + 1] if '--check' in args else None
    src_path, out_path = args[0], args[1]

    skin = Image.open(SKIN).convert('RGB')
    w, h = skin.size
    old = np.asarray(Image.open(OLD_ART).convert('L').resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
    old_mask = np.asarray(skin)[..., 0] > 217
    src = Image.open(src_path).convert('RGB')
    new = np.asarray(src.convert('L'), dtype=np.float32) / 255
    new_mask = silhouette(new)

    # A straight fit of one outline onto the other to start from.
    ox0, oy0, ox1, oy1 = bbox(old_mask)
    nx0, ny0, nx1, ny1 = bbox(new_mask)
    sx, sy = (nx1 - nx0) / (ox1 - ox0), (ny1 - ny0) / (oy1 - oy0)
    print(f'old object {ox1 - ox0}x{oy1 - oy0}, new {nx1 - nx0}x{ny1 - ny0}, scale {sx:.3f} {sy:.3f}')

    # The bend: an offset in source pixels at every map pixel, kept at 1/4 size.
    cell = 4
    fh, fw = h // cell + 2, w // cell + 2
    fx = np.zeros((fh, fw), np.float32)
    fy = np.zeros((fh, fw), np.float32)

    def source_xy(x, y):
        ox = sample(fx, x / cell, y / cell)
        oy = sample(fy, x / cell, y / cell)
        return nx0 + (x - ox0) * sx + ox, ny0 + (y - oy0) * sy + oy

    grid_y, grid_x = np.mgrid[0:h, 0:w].astype(np.float32)

    def bent(image):
        return sample(image, *source_xy(grid_x, grid_y))

    def score():
        a, b = local_contrast(old, 6), local_contrast(bent(new), 6)
        return float(np.corrcoef(a[old_mask], b[old_mask])[0, 1])

    print(f'line match, straight fit: {score():.3f}')
    for lv, patch, search, step, smooth in LEVELS:
        size = (int(w * lv), int(h * lv))
        small = lambda arr: np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).resize(size, Image.LANCZOS), dtype=np.float32) / 255
        sigma = 8 * lv + 1.5
        a = local_contrast(small(old), sigma)
        b = local_contrast(small(bent(new)), sigma)
        m = np.asarray(Image.fromarray(old_mask.astype(np.uint8) * 255).resize(size, Image.NEAREST)) > 0
        found = match(a, b, m, step, patch, search)
        good = found[found[:, 4] > 0.3]
        print(f'level {lv}: {len(good)}/{len(found)} patches matched')
        if len(good) < 12:
            continue
        pts = good[:, :2] / lv
        for _ in range(3):  # fit, drop the patches that disagree, fit again
            weights = good[:, 4] ** 2
            cx = spread(pts, good[:, 2] / lv, weights, (h, w), int(step / lv), smooth)
            cy = spread(pts, good[:, 3] / lv, weights, (h, w), int(step / lv), smooth)
            gc = step / lv
            rx = sample(cx.astype(np.float32), pts[:, 0] / gc, pts[:, 1] / gc) - good[:, 2] / lv
            ry = sample(cy.astype(np.float32), pts[:, 0] / gc, pts[:, 1] / gc) - good[:, 3] / lv
            res = np.hypot(rx, ry)
            keep = res < max(3 / lv, 2.5 * np.median(res))
            good, pts = good[keep], pts[keep]
        cg_y, cg_x = np.mgrid[0:fh, 0:fw].astype(np.float32)
        fx += sample(cx.astype(np.float32), cg_x * cell / gc, cg_y * cell / gc) * sx
        fy += sample(cy.astype(np.float32), cg_x * cell / gc, cg_y * cell / gc) * sy
        print(f'  line match: {score():.3f}')

    # Bring the new outline onto the locked one, so the edge is never cut
    # short or left with black showing: each ray from the centre is matched.
    cx0, cy0 = (ox0 + ox1) / 2, (oy0 + oy1) / 2
    for _ in range(3):
        fitted = bent(new_mask.astype(np.float32)) > 0.5
        angles = np.linspace(0, 2 * np.pi, 720, endpoint=False)
        radii = np.arange(40, 900, dtype=np.float32)
        def edge(mask):
            xs = np.clip((cx0 + np.outer(radii, np.cos(angles))).astype(int), 0, w - 1)
            ys = np.clip((cy0 + np.outer(radii, np.sin(angles))).astype(int), 0, h - 1)
            inside = mask[ys, xs]
            return radii[inside.shape[0] - 1 - inside[::-1].argmax(0)]
        r_old, r_new = edge(old_mask), edge(fitted)
        gap = np.fft.irfft(np.fft.rfft(r_new - r_old) * np.exp(-np.arange(361) ** 2 / 3000.0), 720)
        # Falls away over 60 pixels in from the edge, so the design holds.
        cg_y, cg_x = np.mgrid[0:fh, 0:fw].astype(np.float32)
        px, py = cg_x * cell - cx0, cg_y * cell - cy0
        th = np.mod(np.arctan2(py, px), 2 * np.pi)
        idx = (th / (2 * np.pi) * 720).astype(int) % 720
        rad = np.hypot(px, py)
        reach = np.clip(1 - (r_old[idx] - rad) / 60, 0, 1)
        reach = reach * reach * (3 - 2 * reach)
        fx += gap[idx] * reach * np.cos(th) * sx
        fy += gap[idx] * reach * np.sin(th) * sy
        print(f'outline gap, mean {np.abs(r_new - r_old).mean():.1f}px, worst {np.abs(r_new - r_old).max():.1f}px')
    print(f'line match, final: {score():.3f}')

    # Enlarge first, so the bend never reads between coarse pixels.
    out_w, out_h = w * scale, h * scale
    k = 3 if src.width < w * scale else 1
    big = src.resize((src.width * k, src.height * k), Image.LANCZOS)
    big = np.asarray(big, dtype=np.float32) / 255
    rows = []
    for top in range(0, out_h, 256):  # a strip at a time, to keep memory down
        y, x = np.mgrid[top:min(top + 256, out_h), 0:out_w].astype(np.float32)
        sx_, sy_ = source_xy((x + 0.5) / scale - 0.5, (y + 0.5) / scale - 0.5)
        rows.append(sample(big, (sx_ + 0.5) * k - 0.5, (sy_ + 0.5) * k - 0.5))
    art = np.concatenate(rows)

    # Black stays true black behind the piece, whatever the render's ground.
    outside = np.asarray(Image.fromarray((blur(old_mask.astype(np.float32), 6) > 0.02).astype(np.uint8) * 255).resize((out_w, out_h), Image.BILINEAR), dtype=np.float32)[..., None] / 255
    art = art * outside
    Image.fromarray((np.clip(art, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out_path, quality=92, subsampling=0, optimize=True)
    print(f'wrote {out_path} {out_w}x{out_h}')

    if check:
        chan = np.asarray(Image.open(CHANNELS).convert('RGB'))[..., 1] > 0
        small = np.asarray(Image.fromarray((np.clip(art, 0, 1) * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).copy()
        lines = chan ^ np.roll(chan, 1, 0) | chan ^ np.roll(chan, 1, 1)
        small[lines] = (255, 60, 40)
        Image.fromarray(small).save(f'{check}/fit-channels.png')
        outline = old_mask ^ np.roll(old_mask, 1, 0) | old_mask ^ np.roll(old_mask, 1, 1)
        plain = np.asarray(Image.fromarray((np.clip(art, 0, 1) * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).copy()
        plain[outline] = (60, 255, 80)
        Image.fromarray(plain).save(f'{check}/fit-outline.png')


if __name__ == '__main__':
    main()
