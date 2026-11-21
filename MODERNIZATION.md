# Modernization plan: d3-hypertree v2

d3-hypertree is a generic hyperbolic tree visualization with real users (~200
npm downloads/month, 90 stars). This plan covers the library only. The
Hyperbolic Tree of Life application has its own plan in its repository.

Work happens on the `modernize` branch. Every phase ends in a working, tested state.

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

### Phase 3: Render performance (priority)

Driven by the per-layer benchmark below. Candidates, in order of expected gain:

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
| **Zooming in right after load doesn't work.** The default start zoom (λ ≈ 0.48) is outside the default `interaction.λbounds` [1/40, 0.45]; the wheel handler rejects every zoom that ends outside the bounds. | Covered by an expected-to-fail test |
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
node bench-layers.mjs --cpu 4 --tree "gen=nTree&depth=10&childs=2"
```

The harness ([`test/harness.html`](test/harness.html)) takes the generator
and options as URL parameters, e.g.
`harness.html?gen=nTree&depth=5&childs=8&labels=1&icons=1`.
