# Performance measurements

How d3-hypertree's interaction performance is measured, where the results
live, and what the current numbers are. The goal behind all of it:
**pleasant zooming, pinching and dragging**, i.e. every interaction step
within one frame (16.7 ms at 60 fps).

The benchmarks use generated trees only, no application data.

## Overview

| Benchmark | Question it answers | Result file | Command | Runtime |
|-----------|---------------------|-------------|---------|--------:|
| [`test/bench-interaction.mjs`](test/bench-interaction.mjs) | How long does one update take while dragging, wheel-zooming and pinching, and which part of the pipeline (layout, filter, labels, voronoi, layer DOM updates, browser) costs what? | [`test/bench-interaction.json`](test/bench-interaction.json) | `npm run bench:interaction` | ~5 min |
| [`test/bench-layers.mjs`](test/bench-layers.mjs) | What does each layer cost to render while dragging? | [`test/bench-layers.json`](test/bench-layers.json) | `npm run bench` | ~3 min |

Both write their result as JSON (committed, so changes show up in `git diff`)
and print a summary table.

## Running

Requirements: Node ≥ 18 and Microsoft Edge installed (the benchmarks drive the
local Edge through Playwright; no browser download).

```bash
# 1. build the library: the benchmarks load dist/d3-hypertree.js
npm run build

# 2. run
cd test
npm install
npm run bench:interaction
npm run bench
```

Options:

```bash
node bench-interaction.mjs --cpu 1,4 --out bench-interaction.json   # CPU throttling factors
node bench-layers.mjs --cpu 4 --tree "gen=nTree&depth=10&childs=2" --out bench-layers.json
```

Each benchmark starts its own static server and its own headless Edge; no dev
server needs to run.

## Method

### Test trees

The trees come from the library's generators, rendered by
[`test/harness.html`](test/harness.html) (URL parameters select generator and options):

| Name in results | Harness query | Nodes | Visible at λ = 0.3 |
|-----------------|---------------|------:|-------------------:|
| binary          | `gen=nTree&depth=10&childs=2` | 2,047  | 129 |
| wide 8^5        | `gen=nTree&depth=5&childs=8`  | 37,449 | 513 |
| large 6^6       | `gen=nTree&depth=6&childs=6`  | 55,987 | 217 |

`bench-layers.mjs` uses the wide tree with `&labels=1&icons=1`, so the label
and emoji layers have content.

### Gestures

Each gesture lasts ~3 s and is driven like a user would: mouse events for drag
and wheel, two simulated touch points (CDP `Input.dispatchTouchEvent`) for pinch.

- **drag**: half circle with 181 mouse moves at ~60 Hz. It ends away from the
  start point, because ending on it counts as a click.
- **wheel**: 20 steps zooming out, then 20 zooming in, 60 ms apart.
- **pinch**: two fingers move from 300 px apart to 120 px and back.

`bench-interaction.mjs` first animates to λ = 0.3, so every tree starts from
the same, valid zoom. (Originally a workaround for a start zoom outside `interaction.λbounds`; now λ is clamped to the bounds, and the fixed start zoom keeps results comparable with the baseline.)

### Metrics

- **ms / update**: renderer main-thread time during the gesture, divided by the
  number of tree updates (`update.transformation()` calls). Taken from a Chrome
  trace: self time of all main-thread events between two `performance.mark`s.
- **Browser**: the browser-native part of it: style, layout, paint, compositing
  and waiting for rasterization.
- **JavaScript split** (bench-interaction): from a separate run with the V8
  CPU profiler (100 µs sampling). Each sample is attributed to a pipeline phase
  by its call stack:

  | Phase   | Functions on the stack |
  |---------|------------------------|
  | layout  | `layoutBergé`, `layoutNode`, `setZ`, `wedgeTranslate` (runs lazily inside the filter) |
  | filter  | `cacheUpdate`, `pathToLastVisible`, `collectNodesByWeight`, `peocessNode*` |
  | labels  | `doLabelStuff` |
  | voronoi | `doVoronoiStuff` |
  | layers  | `updateData`, `updateTransform`, `updateColor` (d3 update pattern writing to the DOM) |
  | other JS, gc | everything else (event handling, interaction math), garbage collection |

  Timers inside the library aren't usable for this: browsers clamp
  `performance.now()` to 100 µs.
- **Isolated layer cost** (bench-layers): the page is loaded once per
  configuration with exactly one layer visible (plus the interaction layers,
  which receive the mouse events), and "interaction only" is subtracted. That
  includes the layer's style, layout and paint cost, which a trace alone can't
  attribute to a layer. "JS in all" is the layer stack's own per-layer timing
  with all default layers on.
- **CPU 4×**: Chrome's CPU throttling, roughly a weaker laptop or tablet.

### Caveats

- **Headless Edge renders without a real GPU.** Rasterization-heavy work
  (emojis, text) is likely exaggerated in absolute terms; the ranking should
  hold. Confirm important results on a real GPU.
- **Noise.** Repeated runs differ, on the order of 10–30% for single values
  (seen in the application's benchmark: dragging one page measured 40 ms and
  61 ms per update in two runs). Only treat large differences as real, and
  re-run before concluding.
- The two passes of `bench-interaction.mjs` (trace and profile) are separate
  runs, so their update counts can differ slightly; the profiler adds some overhead.

## Current results (phase 0 baseline, 2026-11-21)

Legacy build (d3-hypertree 1.1.3 source, Gulp/Webpack/TypeScript 2.9), headless Edge 900×900.

### Interaction pipeline

ms per tree update. Layout to Browser columns at CPU 1×.

| Tree (visible) | Gesture | CPU 1× | CPU 4× | Layout | Filter | Voronoi | Layers (DOM) | Browser |
|----------------|---------|-------:|-------:|-------:|-------:|--------:|-------------:|--------:|
| binary (129)   | drag    | 4.9    | 23.2   | 0.7    | 0.3    | 0.0     | 1.7          | 1.4     |
| binary (129)   | wheel   | 8.8    | 42.6   | 1.1    | 0.6    | 0.9     | 2.3          | 1.9     |
| binary (129)   | pinch   | 5.0    | 24.8   | 0.7    | 0.4    | 0.0     | 1.8          | 1.5     |
| wide 8^5 (513) | drag    | 18.1   | 93.5   | 4.1    | 1.9    | 0.0     | 6.4          | 5.1     |
| wide 8^5 (513) | wheel   | 29.4   | 146.9  | 5.4    | 2.5    | 3.4     | 8.2          | 6.5     |
| wide 8^5 (513) | pinch   | 14.2   | 66.4   | 5.9    | 1.9    | 0.0     | 3.3          | 2.7     |
| large 6^6 (217)| drag    | 9.4    | 46.6   | 2.5    | 1.1    | 0.0     | 2.9          | 2.4     |
| large 6^6 (217)| wheel   | 23.3   | 152.5  | 2.9    | 2.0    | 2.3     | 6.9          | 5.1     |
| large 6^6 (217)| pinch   | 6.0    | 32.0   | 1.9    | 0.8    | 0.0     | 1.4          | 1.4     |

### Render cost per layer

Wide tree with labels and icons (1,726 SVG elements with all default layers),
dragging, CPU 1×.

| Configuration | ms / update |
|---------------|------------:|
| interaction only (math, filter, layout of the tree model) | 3.9 |
| all default layers | 468.7 |

| Layer        | Elements | Isolated ms | of which style+layout | of which paint+composite | JS ms (all layers on) |
|--------------|---------:|------------:|----------------------:|-------------------------:|----------------------:|
| emojis       | 586      | 454.9       | 102.7                 | 18.2                     | 0.4                   |
| labels-force | 2        | 3.7         | 0.2                   | 0.2                      | 0.0                   |
| nodes        | 513      | 2.1         | 0.4                   | 0.4                      | 0.5                   |
| cells        | 585      | 1.9         | 0.2                   | 0.2                      | 0.0                   |
| link-arcs    | 584      | 1.4         | 0.4                   | 0.2                      | 0.8                   |
| all others   | ≤ 2      | < 1 each    |                       |                          |                       |

### Findings

1. **No gesture fits the frame budget with ~500 visible nodes**, even at CPU 1×
   (14–29 ms per update); at 4× it's 7–15 fps.
2. **The emoji layer dominates rendering.** 586 emojis as SVG `<text>` cost
   ~455 ms per update. A trace shows glyph rasterization
   (`GpuRasterBuffer::Playback`, main thread blocked in
   `WaitForCommitCompletion`) and text shaping (`ShapeTextIncludingFirstLine`).
   Nodes, links and cells cost only 1.4–2 ms each at 500+ elements, so SVG
   geometry itself isn't the problem.
3. **The layout runs on every drag step although it can't change.** It
   depends only on λ; dragging only changes the transformation (~4 ms of 18 ms
   on the wide tree).
4. **Wheel steps run in full detail**: unlike drag and pinch, they rebuild the
   voronoi cells every step (3.4 ms at 1×, 18 ms at 4× on the wide tree).
5. **Layout is the largest JavaScript cost when zooming** (pinch: ~6 of 14 ms).
6. **Redundant DOM writes.** Every layer rewrites all attributes of all its
   elements on every update; about 65% of the writes set an unchanged value
   (measured in the application).

What to do about each of these is planned in [MODERNIZATION.md](MODERNIZATION.md), phase 3.

## Phase 1 check: Vite build (2026-11-22)

Old (Gulp/Webpack/TypeScript 2.9) and new (Vite 8, TypeScript 6) bundle of the
same source, measured back to back:

- **Interaction pipeline** (`bench-interaction.mjs`): the new bundle is as fast
  or faster in 17 of 18 cases (e.g. wide 8⁵ wheel, 4× CPU: 147 → 122 ms per
  update); only large 6⁶ drag at 4× CPU was slower (47 → 54 ms), within the noise.
- **Render cost per layer** (`bench-layers.mjs`): equal within the noise (all
  layers 2175 → 2241 ms per update, emojis 2552 → 2543 ms).

Absolute layer times were about 4× higher than the phase 0 baseline above for
*both* bundles: emoji rendering on this machine got slower between the two days,
not the code. So compare only runs from the same session; the baseline JSON
files are kept as they were.

## Phase 3: update pipeline (2026-11-22)

Before (end of phase 2) and after, each from its own snapshot of `dist/` and
`test/` measured back to back (the development watcher rebuilds `dist/` on every
change, so a benchmark must not load the working copy's `dist/` while editing).
`bench-interaction.mjs`, ms per tree update; *layout* and *voronoi* are the
JavaScript time in those phases.

| Tree, gesture, CPU | total before → after | layout | voronoi |
|--------------------|---------------------:|-------:|--------:|
| wide 8⁵ drag 1×    | 18.8 → 16.8   | 3.98 → 0.24 | – |
| wide 8⁵ drag 4×    | 129 → 106     | 26.3 → 1.05 | – |
| large 6⁶ drag 1×   | 11.9 → 9.2    | 2.70 → 0.17 | – |
| wide 8⁵ wheel 1×   | 30.4 → 21.0   | 4.72 → 3.96 | 2.66 → 0.09 |
| large 6⁶ wheel 1×  | 29.3 → 17.9   | 3.21 → 2.47 | 2.31 → 0.10 |
| wide 8⁵ wheel 4×   | 198 → 162     | 32.7 → 18.3 | 19.7 → 11.2 |
| large 6⁶ wheel 4×  | 160 → 115     | 18.5 → 12.3 | 13.9 → 8.9 |
| wide 8⁵ pinch 1×   | 14.1 → 17.0   | 6.09 → 6.24 | – |
| wide 8⁵ pinch 4×   | 92.0 → 93.2   | 34.0 → 35.6 | – |

- **Drag:** the layout is cached while λ stays the same (`layoutNode` in
  `magic-filter.ts`): almost no layout cost left; 10–22% less per update.
- **Wheel:** a wheel burst runs in low detail like dragging (no voronoi, no
  labels) with one full frame 150 ms after the last wheel event; the node kept
  under the pointer is found by a nearest-node search instead of a separate
  voronoi diagram per step: 19–39% less per update. The remaining voronoi time at
  4× is the settle frame.
- **Pinch:** unchanged within the noise. The layout really changes there; skipping
  the wedge translation for leaves didn't show, most visible nodes are inner
  nodes with hidden children. A faster layout for zoom changes is still open.

## Comparing after a change

1. Rebuild `dist/`, run the benchmark, commit nothing yet.
2. `git diff test/bench-interaction.json` (or `bench-layers.json`) shows old
   and new values side by side.
3. Re-run once more if a change looks small; given the noise, only differences
   well beyond ~30% are reliable from a single run.
4. Commit the new JSON together with the change and update the tables above.
