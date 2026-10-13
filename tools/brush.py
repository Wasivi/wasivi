# Generates two rough brushstroke shapes as SVG (white on transparent) for use
# as CSS masks: a horizontal stroke and a vertical one. Deterministic.
import math, random, sys, urllib.parse

def stroke(L, T, seed, bend, horizontal, symmetric=False):
    """L = length, T = max thickness (in viewBox units). Built from bristle
    bands that each have ragged edges and break up near the tail (dry brush)."""
    rnd = random.Random(seed)
    bands = 9
    paths = []
    steps = 140
    def env(t):  # thickness envelope
        if symmetric:  # full in the middle, tapering evenly at both ends
            return math.sin(math.pi * t) ** 0.45
        a = min(1, t / 0.06)  # quick attack, long taper to a point
        return a * (1 - t) ** 0.55
    for b in range(bands):
        lo = b / bands; hi = (b + 1) / bands
        # each band ends somewhere in the tail; outer bands give out first
        edge = abs((b + 0.5) / bands - 0.5) * 2
        if symmetric:
            start = rnd.uniform(0.0, 0.03) + edge * rnd.uniform(0.02, 0.1)
            end = 1 - rnd.uniform(0.0, 0.03) - edge * rnd.uniform(0.02, 0.1)
        else:
            start = 0
            end = 1 - rnd.uniform(0.02, 0.08) - edge * rnd.uniform(0.05, 0.22)
        # a couple of dry gaps along the band
        gaps = [(g, g + rnd.uniform(0.01, 0.04)) for g in (rnd.uniform(start, end) for _ in range(rnd.randint(0, 3)))]
        segs = []; cur = []
        for i in range(steps + 1):
            t = start + i / steps * (end - start)
            if any(g0 < t < g1 for g0, g1 in gaps):
                if cur: segs.append(cur); cur = []
                continue
            cur.append(t)
        if cur: segs.append(cur)
        for seg in segs:
            if len(seg) < 3: continue
            top = []; bot = []
            for t in seg:
                w = env(t) * T
                c = bend * math.sin(math.pi * t) + (rnd.random() - 0.5) * 0.4
                n1 = (rnd.random() - 0.5) * 0.08 * T
                n2 = (rnd.random() - 0.5) * 0.08 * T
                y1 = c + (lo - 0.5) * w + n1
                y2 = c + (hi - 0.5) * w - 0.02 * T + n2
                x = t * L
                top.append((x, y1)); bot.append((x, y2))
            pts = top + bot[::-1]
            if horizontal:
                d = 'M' + ' L'.join(f'{x:.1f},{y + T:.2f}' for x, y in pts) + 'Z'
            else:
                d = 'M' + ' L'.join(f'{y + T:.2f},{x:.1f}' for x, y in pts) + 'Z'
            paths.append(d)
    if horizontal:
        vb = f'0 0 {L} {2*T}'
    else:
        vb = f'0 0 {2*T} {L}'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" preserveAspectRatio="none"><g fill="#fff">' + ''.join(f'<path d="{d}"/>' for d in paths) + '</g></svg>'
    return svg

def uri(svg):
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe='') + '")'

# Horizontal: starts at the left (the W), tapers out to the right; a slight
# sag in the middle. Vertical: starts at the top, tapers down; slight bow.
h = stroke(1000, 10, 7, 1.6, True, symmetric=True)
v = stroke(1000, 10, 21, 3.2, False)  # a clear hand-pulled bow, not ruler-straight
open(sys.argv[1], 'w').write(uri(h) + '\n' + uri(v) + '\n')
open(sys.argv[1] + '.h.svg', 'w').write(h)
open(sys.argv[1] + '.v.svg', 'w').write(v)
print(len(uri(h)), len(uri(v)))
