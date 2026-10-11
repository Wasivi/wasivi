# WASIVI — How We Work: Art Direction Brief

For Claude Code. The page is built (React Three Fiber, 11 scenes, scroll-driven,
color-accumulating sculpture). This brief fixes the composition, interactivity,
and motion. **Do not change the copy or the color-accumulation logic** — those are
locked. This is about how it's arranged, how it moves, and how it's lit.

---

## The core problem

Right now every scene is the same static arrangement: text block parked
left-of-center, sculpture parked right-of-center, both floating in empty black.
It never changes, so the page feels flat even though the pieces are beautiful.

Three things make it dynamic: **(1) the sculpture becomes interactive and
physically changes between scenes, (2) the text is placed intentionally per
scene instead of the same spot every time, (3) one restrained entrance animation
per scene.** Plus fixes to wasted space, the wordmark, and light mode.

---

## 1. Make the sculpture interactive

This is the payoff of real 3D. The visitor should be able to:

- **Drag to rotate** the sculpture freely (orbit control).
- **Scroll or pinch to scale** it — pull it closer, push it back.
- **Idle rotation** continues slowly on its own when the user isn't touching it.
- **Return-to-home**: after interaction, or on scene change, it eases back to
  that scene's intended position/scale so the layout never stays broken.

Guard against collision: the user can drag the sculpture over the text. Keep the
text on a readable layer (sculpture behind, or text in a panel that holds
legibility), and make sure the home position for each scene never overlaps the
headline.

## 2. Vary the composition per scene (the big one)

Break the centered left/right split. The sculpture should **physically move and
rescale between scenes**, and the text should sit in a different, intentional
place each time. Think magazine spread, not template. Use scale contrast — some
scenes the sculpture is huge and bleeds off-frame, some it's pulled back and
smaller. Let type and sculpture overlap at the edges rather than living in
separate columns.

### Storyboards (ASCII — composition only, not literal pixels)

```
INTRO (01)  — sculpture large, centered-high, text low and wide beneath it
┌─────────────────────────────────────────────┐
│ WASIVI                 HOME COMPANY ... ☀    │
│                                               │
│              ╱▓▓▓▓▓▓▓▓▓▓▓╲                    │
│            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
│            ▓▓▓▓ sculpture ▓▓▓  (large, dim)   │
│              ╲▓▓▓▓▓▓▓▓▓▓▓╱                    │
│                                               │
│   Every engagement follows the same path.     │
│   (wide, centered, calm)                      │
│                                      01 / 11  │
└─────────────────────────────────────────────┘
```

```
02 RESEARCH — sculpture pushed RIGHT and bleeds off-frame, text upper-left, big
┌─────────────────────────────────────────────┐
│ WASIVI                 HOME COMPANY ... ☀    │
│  RESEARCH                                     │
│  It starts before          ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  the first meeting.      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← bleeds off edge
│  (headline dominant)     ▓▓▓▓ sculpture ▓▓▓▓▓▓│
│  A study of your org...   ╲▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  YOU RECEIVE — ...                            │
│                                      02 / 11  │
└─────────────────────────────────────────────┘
```

```
04 RECOMMENDED DIRECTION — flip it: sculpture LEFT, text RIGHT, smaller object
┌─────────────────────────────────────────────┐
│ WASIVI                 HOME COMPANY ... ☀    │
│                                               │
│   ╱▓▓▓▓▓▓▓╲          RECOMMENDED DIRECTION    │
│  ▓▓▓▓▓▓▓▓▓▓▓         A clear direction,       │
│  ▓ sculpture ▓       weighed by impact...     │
│   ╲▓▓▓▓▓▓▓╱          YOU RECEIVE — ...         │
│   (smaller, left)                             │
│                                      04 / 11  │
└─────────────────────────────────────────────┘
```

```
05 FIRST VERSION — sculpture HUGE, text overlaps its dark lower-left edge
┌─────────────────────────────────────────────┐
│ WASIVI                 HOME COMPANY ... ☀    │
│          ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲             │
│       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           │
│   The one  ▓▓▓▓▓▓ sculpture (huge) ▓▓▓▓       │  ← headline sits
│   thing    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           │     over dark edge
│   worth proving first.  ╲▓▓▓▓▓▓▓▓▓╱           │
│   YOU RECEIVE — ...                           │
│                                      05 / 11  │
└─────────────────────────────────────────────┘
```

```
09 DIRECT LEADERSHIP (principle scene) — sculpture centered, full gold, text
   lower-center, quiet and symmetrical (principles feel different from steps)
┌─────────────────────────────────────────────┐
│ WASIVI                 HOME COMPANY ... ☀    │
│              ╱███████████╲                    │
│            ███████████████████  (full gold)   │
│            ████ sculpture █████                │
│              ╲███████████╱                    │
│       THROUGHOUT THE ENGAGEMENT               │
│       The person who understands your          │
│       problem is the person who builds it.     │
│                                      09 / 11  │
└─────────────────────────────────────────────┘
```

The point isn't these exact frames — it's that **no two consecutive scenes share
the same arrangement.** Alternate: object-right, object-left, object-huge,
object-centered. Move the text high, low, overlapping. The changing composition
is what makes scrolling feel alive.

Keep the two principle scenes (09 Leadership, 10 AI) visually calmer and more
centered/symmetrical than the numbered process scenes, so they read as "always
true," not as another step.

## 3. One entrance animation per scene — restrained

As each scene enters the viewport: headline, then body, then "you receive"
**rise up a few px and fade in once**, staggered by ~80ms, over ~0.5s total.
That's the whole animation budget for text.

**Do NOT** add continuous text motion, per-letter effects, words animating on
every scroll tick, or things sliding around constantly. The sculpture is the
moving element; it earns the motion. The text enters once, gracefully, then holds
still. Restraint next to the moving object is what reads as high-end.

Respect `prefers-reduced-motion`: no entrance animation, no idle spin, for users
who've asked to reduce motion.

## 4. Fill the wasted space

Current scenes have huge empty black bands across the top third and bottom third;
everything hugs the middle. Let the composition breathe into the full frame:
larger sculpture, headline pulled up to use vertical space, object allowed to
bleed off edges. The page should feel like it fills a large screen, not like a
small layout stretched onto one.

## 5. The WASIVI wordmark

It's tiny, top-left, same weight as the nav — reads as an afterthought. Give it
presence: larger, letter-spaced, and tied to the brand (a touch of the gold, or
matched to the actual logo treatment). It's the name; it should feel like it.

## 6. Light / dark mode (do this AFTER the composition is fixed)

There's a sun toggle top-right. Light mode must not drop the sculpture onto flat
white — it'll look pasted and harsh. **Adapt the sculpture and its ground to the
light theme**: a warm, pale background (bone / warm stone, not pure white), the
sculpture's own tones lifted and warmed so it blends into the light the way it
blends into the dark. Light mode should feel like a different time of day on the
same object — an experience, not an inverted color scheme. Keep the gold reading
as gold in both themes.

---

## Build order (so it's debuggable)

1. **Composition first** — get the per-scene placement and scale varying, dead
   space filled, wordmark fixed. Static, no new interactivity yet.
2. **Entrance animation** — add the one restrained text entrance.
3. **Interactivity** — drag-rotate, scroll/pinch-scale, idle spin, return-to-home.
4. **Light mode** — adapt the sculpture and ground last.

Perfect each stage before the next. Screenshot and review composition before
adding motion — a static frame that's well-composed is the foundation; motion on
a bad composition just makes a bad composition move.
