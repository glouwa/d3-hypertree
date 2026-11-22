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
  `deepStar`) and small fixed fixture files, no application data.

## Test strategy

Every feature and interaction is checked on up to three levels:

1. **State and plausibility** (hard assertions): the gesture changed the
   transformation or λ in the expected direction, the node under the pointer
   followed it, callbacks got the right node, all coordinates are finite and
   inside the disk, no `NaN` in the SVG, no console errors.
2. **Scene snapshot**: a compact JSON of what's drawn (visible node ids,
   screen positions, radii, element count per layer, labels, paths), compared
   with tolerances (e.g. ≥ 90% of nodes in both, median position error < 2 px).
   Robust against antialiasing and font rendering, sensitive to real
   regressions. Only possible here because the input is constant: generated
   trees and fixture files committed to this repo.
   **The filter is part of the input**, because it decides which nodes are
   visible:
   - layout and transformation are snapshotted with the filter off (small
     trees, all nodes visible), so they're tested independently of filtering
   - each filter option (`cullingRadius`, `weightFilter`, `maxlabels`,
     `focusExtension`, …) gets its own snapshots, varying one option at a time
3. **Coarse image comparison**: downscaled screenshot with a generous
   tolerance, catching broken CSS or empty renders. Never the only check: a
   loose pixel comparison alone missed hidden labels in phase 0.

The reference snapshots are taken from the legacy build and are the baseline
the modernization is measured against. Intended changes get accepted with
`npm run test:update`, which shows up as a readable JSON diff.

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

### Phase 0b: Extended safety net

Tests for all existing features, following the test strategy above:

- [x] Callbacks (`test/tests/callbacks.spec.mjs`): `onNodeClick` (click, tap, drag is no
      click), `onNodeHold` (mouse, touch, cancelled by moving), `onNodeHover`/`onHoverNodeChange`,
      `onNodeSelect`, `onCenterNodeChange`
- [x] Hover cell highlight, wheel/pinch zoom at the λbounds edge
- [ ] Interaction with scene snapshots: drag, wheel, pinch, one-finger pan, hover path, ripple
- [ ] API: `gotoNode`, `gotoHome`, `goto`, `gotoλ`, `animateUp`,
      `toggleSelection`, `setPathHead`, `selectQuery`
- [ ] Data: `fromData`, `fromFile` (`.d3.json`, CSV, SKOS, TreeML fixtures),
      `fromLangFile`, `dataInitBFS`/`langInitBFS`, generators
- [ ] Configuration: layer options (visibility, color callbacks,
      `linkCurvature`, …), layout options (`rootWedge`, `weight`, `linklen`,
      alternative layouts), one snapshot set per filter option
- [ ] Presets load and render as before
- [ ] Verify that the tests catch deliberately broken features

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
at CPU 1× and 4× (see [PERFORMANCE.md](PERFORMANCE.md) for method and current numbers).

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
| **Mouse-wheel zoom blocked right after load.** The computed start zoom ignores `interaction.λbounds` [1/40, 0.45 by default], and wheel and pinch rejected every step ending outside the bounds, even steps back towards them. On wider trees (start λ ≈ 0.71) the wheel did nothing at all, and small pinches were ignored. | **Fixed:** steps that move towards the bounds are allowed (`isλStepAllowed` in `interaction-layer-2.ts`); covered by tests. **Open decision:** should the start zoom itself be clamped to `λbounds`? That would change the initial view of many trees |
| **Declared callbacks never called.** `onNodeHold`, `onNodeHover`, `onHoverNodeChange` and (in the plain `Hypertree`) `onNodeSelect` were declared but never invoked. | **Implemented:** hover fires when the hovered node changes (undefined on leaving); hold fires after `interaction.holdDuration` (default 500 ms) without moving and suppresses the click; `api.toggleSelection` fires `onNodeSelect(n, selected)`. Covered by tests. `onWikiCenterNodeChange` is still never called |
| **Hovered voronoi cells aren't highlighted.** `cell-layer.ts` checks `d.data.isPartOfAnyHoverPath`, which no longer exists (now `d.data.pathes.isPartOfAnyHoverPath`, as the node layer uses), and the `.hovered.cell` CSS rule is commented out in both themes since the CSS split-up. Verified: with the cells layer on, 6 cells belong to hover-path nodes, none gets the `hovered` class. Also, hovering only refreshed the path layers, never the cells. | **Fixed:** correct property for `hovered` and `selected`, cells refresh on hover (`LayerStack.updatePath`), CSS rule re-enabled (the dark theme's old rule was invisible, now mirrors the light one); covered by a test |
| **Hover highlights stay after the pointer leaves the tree.** Both the hover path and the hovered cells remain highlighted after moving the mouse out of the component. | Observed while fixing the cell highlight; not yet analyzed |
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

## Performance measurements

Benchmarks, method, current numbers and findings: [PERFORMANCE.md](PERFORMANCE.md).

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
