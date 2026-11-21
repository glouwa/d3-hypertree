# Modernization plan: d3-hypertree v2

d3-hypertree is a generic hyperbolic tree visualization with real users (~200
npm downloads/month, 90 stars). This plan covers the library only. The
Hyperbolic Tree of Life application has its own plan in its repository.

Work happens on the `modernize` branch. Every phase ends in a working, tested state.

**Main goal: pleasant zooming, pinching and dragging.** That means both fast
rendering (DOM, browser) and a fast update pipeline (layout, filter) on every
interaction step.

## Decisions

- **Stays generic.** No application-specific logic (Open Tree of Life,
  Wikipedia, language maps). When an application needs something new, it goes
  in as a generic extension point (callback, layer option), never as a special case.
- **New major version.** Backward compatibility isn't required. Prereleases
  ship as `2.0.0-alpha.x` under the npm dist-tag `next`, so `latest` (1.1.3)
  stays untouched until v2 is stable. v2 comes with a migration guide.
- **Clear public API.** Applications import only from `d3-hypertree`, never from
  internal paths.
- **No ducd dependency.** The few helpers d3-hypertree uses from ducd become an
  internal, unexported copy.
- **Own test suite.** Tests use generated trees (`nTree`, `star`, `path`,
  `deepStar`) and no application data.

## Phases

### Phase 0: Safety net ✅

- [x] Legacy build runs again (Node 10, `natives` fix, `ducd` declared as dependency)
- [x] Browser tests in [`test/`](test) using generated trees: binary tree,
      wide tree with labels and icons, star, path, deep star, drag, wheel zoom,
      showing/hiding layers, screenshots, no console errors
- [x] Per-layer render benchmark: [`test/bench-layers.mjs`](test/bench-layers.mjs)
- [x] Interaction benchmark (drag, wheel, pinch) with the update pipeline split
      into layout, filter, labels, voronoi, layer DOM updates and browser work:
      [`test/bench-interaction.mjs`](test/bench-interaction.mjs)
- [x] Commit to the `modernize` branch

### Phase 1: Modern build

- [ ] Vite library build (ESM + UMD), TypeScript 5, dart-sass; drop Gulp and Webpack
- [ ] Current Node LTS
- [ ] Internal copy of the used ducd helpers
- [ ] Done when: tests and screenshots unchanged

### Phase 2: Bugs and code quality

- [ ] Fix the ~20 type errors (e.g. `bboxCenter` imported from the wrong
      module, implicit `M` (Materialize) global in the meta views)
- [ ] Remove debug output (`console.log` in hot paths such as the layer stack)
- [ ] Fix the known bugs below (the deep-tree bug comes after the modernization)
- [ ] Triage the open GitHub issues (currently only Dependabot PRs)

### Phase 3: Interaction performance (priority)

Target: every drag, pinch and wheel step within one frame (16.7 ms) on a
mid-range machine, measured with `bench-interaction.mjs` and `bench-layers.mjs`
at CPU 1× and 4×.

Update pipeline (layout, filter):

- [ ] **Don't re-run the layout while dragging.** The layout only depends on
      the zoom λ; panning only changes the transformation. Yet the filter calls
      `layout.type(n, λ)` for every visited node on every update (~4 ms of
      ~18 ms per drag step on the wide test tree). Cache the layout while λ
      stays the same
- [ ] **Treat wheel zoom like drag and pinch.** Wheel steps don't count as an
      animation, so every step runs in full detail and recomputes the voronoi
      cells (3.4 ms per step at 1×, 18 ms at 4×). Use low detail while zooming
      and compute voronoi and labels once zooming settles
- [ ] **Faster layout for zoom changes.** On pinch and wheel the layout
      really changes and is the largest JavaScript cost (~6 ms of ~14 ms per
      pinch step). Options: fewer chained Möbius transformations per node,
      incremental updates, typed arrays
- [ ] Remove `console.warn`/`console.log` from hot paths (e.g. every touch move)

Rendering (DOM, browser), in order of expected gain:

- [ ] **Emoji layer.** Emojis drawn as SVG `<text>` are by far the most
      expensive layer: their glyphs get re-rasterized on every update. Render
      each distinct emoji once into a bitmap and reuse it (SVG `<image>` with
      a cached data URL, or canvas)
- [ ] **Text layers.** Same problem on a smaller scale (text shaping on every update)
- [ ] **Redundant DOM writes.** `updateColor`/`updateTransform` run on every
      element on every update; ~65% of attribute writes set an unchanged value
      (`class`, `r`, `stroke-linecap`). Write only on enter or on change
- [ ] **Compositor layers.** Every layer group has `transform: translateZ(0)`,
      so every layer is its own compositor layer; check whether that pays off
- [ ] Coalesce interaction updates to one per animation frame (today every
      mousemove schedules its own full update)
- [ ] Canvas renderer for nodes and links if SVG stays the bottleneck after the above
- [ ] Upgrade d3 v4 → v7

### Phase 4: v2 release

- [ ] API review, migration guide, updated docs and examples
- [ ] Prereleases on npm `next`, then `latest`

## Known bugs

| Bug | Status |
|-----|--------|
| **Deep trees break down far from the origin.** Navigating down a long branch makes the view jump: the area around the focus stays empty and only a node far away remains visible. No NaN occurs; the values just stop being usable for the transformation. Node positions are global Poincaré-disk coordinates composed from parent to child, so deep nodes end up very close to the boundary. Reproduced with `deepStar` (8 arms × 80 levels): the jump happens when going to a node at depth 48. | Confirmed by the author. Covered by an expected-to-fail test. **Deferred until after the modernization; until then, avoid trees this deep.** See "Analysis" below |
| **Mouse-wheel zoom blocked right after load.** The computed start zoom can lie outside the default `interaction.λbounds` [1/40, 0.45], and the wheel handler rejects every step that ends outside the bounds. With the binary test tree (λ ≈ 0.48) zooming in is blocked; with wider trees the start zoom is so far out that zooming *out* is blocked too, so the wheel does nothing at all. | Covered by an expected-to-fail test; benchmarks start from λ = 0.3 to work around it |
| **Crash when nodes have an icon but no label.** `preset-process.ts` calls `precalc.label.startsWith(...)` without checking that a label exists. | Found while writing the benchmark |

### Analysis of the deep-tree bug (for later)

Measurements with the generated `deepStar` tree, going repeatedly to the
deepest visible node:

| Step | Went to depth | 1 − \|z\| of that node | Visible nodes afterwards |
|-----:|--------------:|-----------------------:|-------------------------:|
| 0    | 22            | 2.9e-2                 | 9 (depths 0–19 and 48)   |
| 1    | 48            | 1.8e-4                 | 1 (depth 73)             |
| 2    | 73            | 1.4e-6                 | 1 (depth 81)             |

The jump already happens at 1 − |z| ≈ 1.8e-4, far from double precision
(~1e-16): even amplified by 1/(1 − |z|)² the rounding error would be ~1e-9.
So the root cause is probably not (only) the raw precision of the stored
coordinates. Before the jump, depths 20–47 were already missing between
visible nodes at depth 19 and 48. Candidates to investigate:

- intermediate calculations losing precision (`Clog`, angles, `h2e` chains)
- the filter/culling deciding visibility from stale cached radii
- the lazy layout only computing part of the path

Fix options, depending on the cause:

1. **Re-center the coordinate origin (recommended).** When the focus node gets
   close to the boundary, make it the new origin: recompute the layout of the
   visible part of the tree relative to the focus node and reset the view
   transformation. Coordinates near the view then always stay near 0, where
   doubles are precise. d3-hypertree already lays out lazily and re-lays out
   the path to the center on zoom (`updateLayoutPath_`), so this builds on
   existing mechanisms. Medium effort; fits phase 2 or 3.
2. **Store positions relative to the parent** (local frames) and compose them
   from the focus outward when rendering. Robust at any depth, but a bigger
   change to the layout and filter code.
3. **Mitigation only:** detect collapsed or non-finite positions and cull those
   nodes instead of drawing garbage. Prevents broken pictures but doesn't make
   deep regions reachable.

## Benchmark: interaction (phase 0 baseline)

`node bench-interaction.mjs`: generated trees without labels or emojis,
starting at λ = 0.3, ~3 s per gesture, headless Edge 900×900. Values are ms
per tree update; the JavaScript split comes from a CPU profile attributed by
call stack. Budget for 60 fps: 16.7 ms.

| Tree (visible nodes) | Gesture | CPU 1× | CPU 4× | Layout | Filter | Voronoi | Layers (DOM) | Browser |
|----------------------|---------|-------:|-------:|-------:|-------:|--------:|-------------:|--------:|
| binary (129)         | drag    | 4.9    | 23.2   | 0.7    | 0.3    | 0.0     | 1.7          | 1.4     |
| binary (129)         | wheel   | 8.8    | 42.6   | 1.1    | 0.6    | 0.9     | 2.3          | 1.9     |
| binary (129)         | pinch   | 5.0    | 24.8   | 0.7    | 0.4    | 0.0     | 1.8          | 1.5     |
| wide 8^5 (513)       | drag    | 18.1   | 93.5   | 4.1    | 1.9    | 0.0     | 6.4          | 5.1     |
| wide 8^5 (513)       | wheel   | 29.4   | 146.9  | 5.4    | 2.5    | 3.4     | 8.2          | 6.5     |
| wide 8^5 (513)       | pinch   | 14.2   | 66.4   | 5.9    | 1.9    | 0.0     | 3.3          | 2.7     |
| large 6^6 (217)      | drag    | 9.4    | 46.6   | 2.5    | 1.1    | 0.0     | 2.9          | 2.4     |
| large 6^6 (217)      | wheel   | 23.3   | 152.5  | 2.9    | 2.0    | 2.3     | 6.9          | 5.1     |
| large 6^6 (217)      | pinch   | 6.0    | 32.0   | 1.9    | 0.8    | 0.0     | 1.4          | 1.4     |

(Layout to Browser columns: CPU 1×.) Reading: with ~500 visible nodes no
gesture fits the frame budget even on a fast machine without throttling; at
4× it's 7–15 fps. Wheel steps are the most expensive because they run in full
detail (voronoi). Layout is a large share in every gesture, including drag,
where it wouldn't need to run at all.

## Benchmark: render cost per layer (phase 0 baseline)

Generated tree `nTree` depth 5, 8 children (37,449 nodes; ~513 visible), with
labels and icons. Per tree update while dragging, headless Edge 900×900, CPU 1×.
`isolated` = only this layer visible, minus "interaction only".

| Configuration | ms / update |
|---------------|------------:|
| interaction only (math, filter, layout of the tree model) | 3.9 |
| all default layers (1,726 SVG elements) | 468.7 |

| Layer        | Elements | Isolated ms | of which style+layout | of which paint+composite | JS ms (all layers on) |
|--------------|---------:|------------:|----------------------:|-------------------------:|----------------------:|
| emojis       | 586      | 454.9       | 102.7                 | 18.2                     | 0.4                   |
| labels-force | 2        | 3.7         | 0.2                   | 0.2                      | 0.0                   |
| nodes        | 513      | 2.1         | 0.4                   | 0.4                      | 0.5                   |
| cells        | 585      | 1.9         | 0.2                   | 0.2                      | 0.0                   |
| link-arcs    | 584      | 1.4         | 0.4                   | 0.2                      | 0.8                   |
| all others   | ≤ 2      | < 1 each    |                       |                          |                       |

Reading: nodes, links and cells are cheap even at 500+ elements. The emoji
layer alone accounts for almost all of the frame time. A trace shows the time
going into glyph rasterization (`GpuRasterBuffer::Playback`, with the main
thread blocked in `WaitForCommitCompletion`) and text shaping
(`ShapeTextIncludingFirstLine`). Headless Edge rasterizes without a real GPU,
so absolute numbers are likely exaggerated; the ranking needs confirming on a
real GPU.

## Running the tests

The `test/` package needs a current Node (≥ 18) and the locally installed
Microsoft Edge. It serves the repo root and loads the built
`dist/d3-hypertree.js`, so build first.

```bash
cd test
npm install
npm test                 # browser tests (~20 s)
npm run test:update      # accept intended visual changes as the new reference
npm run bench            # per-layer render benchmark -> bench-layers.json
npm run bench:interaction  # drag/wheel/pinch pipeline benchmark -> bench-interaction.json
node bench-layers.mjs --cpu 4 --tree "gen=nTree&depth=10&childs=2"
```

The harness ([`test/harness.html`](test/harness.html)) takes the generator
and options as URL parameters, e.g.
`harness.html?gen=nTree&depth=5&childs=8&labels=1&icons=1`.
