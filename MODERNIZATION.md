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
- [x] Hover cell highlight; λ (zoom) clamped to `λbounds` everywhere (start zoom, wheel, pinch, `gotoλ`)
- [x] Interaction with scene snapshots (filter off and default): drag, wheel, pinch, one-finger pan, hover path, hideOnDrag (`interaction.spec.mjs`)
- [x] API (`api.spec.mjs`): `gotoNode`, `gotoHome`, `goto`, `gotoλ`, `animateUp`, `drawDetailFrame`, `toggleSelection`, `setPathHead`, `selectQuery`, `ripple`
- [x] Data (`data.spec.mjs`): generators, `fromData`, `fromFile` (`.d3.json`, CSV, SKOS, TreeML fixtures), `fromLangFile`, `dataInitBFS`/`langInitBFS`
- [x] Configuration (`config.spec.mjs`): every layer on its own, traces while
      touching, color callbacks, link curvature `+`/`-`/`l`, dark theme (coarse
      image check), `rootWedge` variants, all layout types
- [x] Filter (`filter.spec.mjs`): one snapshot set per option (`cullingRadius`,
      `rangeNodes`, `rangeCullingWeight`, `focusExtension`, `maxFocusRadius`,
      `maxlabels`, uniform weights), each compared after the filter has settled
- [x] Presets (`config.spec.mjs`): all seven presets load and render as before
- [x] Documented features (`documented.spec.mjs`): every feature from readme.md
      and docs/readme.md, expected-to-fail where it no longer works (list below)
- [x] Verify that the tests catch deliberately broken features: six mutations of
      the built bundle (layout, wheel direction, hover path, node radius, labels,
      perimeter culling) are each caught

- [x] Playground ([`playground/`](playground)): every data source and option in a UI, callback log, live stats; the configuration lives in the URL in the test harness format, so "Open as test" reproduces it in `test/harness.html` (shared model building in `test/config.js`). Run `npm run playground` (Node 10 for now) → http://localhost:3100/playground/. Smoke-tested in `playground.spec.mjs`. Later: publish on GitHub Pages as the public demo

**Documented features that no longer work** (to restore in v2, each has an
expected-to-fail test): `nodeColor`/`linkColor` (readme example; the code reads
`fill`/`stroke`), `interaction.wheelSensitivity` (now `wheelFactor`),
`layout.linklen`, `filter.weightFilter: null`, layers `link-lines` and
`path-lines` (partly replaced by `linkCurvature: 'l'`), `geometry.addLayer` /
`removeLayer`, `geometry.animateUpRadius`, `iconmap`, `langmap`,
`filter.cullingWeight`, `filter.transformation.P`.

**How the filter behaves** (learned while writing the filter tests): it adapts
`weightFilter.magic` by `alpha` on every update, so the visible node set kept
changing for a few frames after loading and after each interaction (fixed in
phase 2 step 4: magic settles at initialization);
`cullingRadius` only removes nodes whose parent lies outside the focus area;
`rangeNodes` is bounded by `rangeCullingWeight`.

**How the start value of magic is computed** (phase 2 step 4, `settleMagic` in
`src/models/hypertree/magic-filter.ts`):

- *What magic does.* Every node has a culling weight, its weight summed over its
  subtree (default: leaves 1, inner nodes height²). A node is hidden when its
  culling weight is at most *weight of the first node on the path to the focus ÷
  magic*. A larger magic hides less, so more nodes are visible. The number of
  visible nodes grows monotonically with magic.
- *The rule* (unchanged, `adjustMagic`): on every update, if more than
  `rangeNodes.max` nodes are visible, magic is divided by `alpha` (1.05); if fewer
  than `rangeNodes.min`, it is multiplied by `alpha`; magic stays within
  `rangeCullingWeight` [4, 500].
- *Before:* `resetData()` set magic to 20 and the rule ran once per update. Without
  interaction there are hardly any updates, so after loading the tree stayed far
  below the configured range (e.g. 28 visible nodes of a binary tree, range
  150–500) and nodes appeared bit by bit while the user dragged.
- *Now:* after the start zoom is found (`findInitλ_`), `settleMagic` repeats the
  same rule right away, without drawing: one rule step plus a node selection
  (`collectNodesByWeight`) per iteration, starting at 20, until magic doesn't
  change any more. That happens when the visible count lies within `rangeNodes`, or
  magic reached a bound of `rangeCullingWeight`, or every node is visible already
  (then a larger magic can't show more, so it stops early). At most 1000 steps;
  each step is one selection pass over the visible nodes, at α = 1.05 the way from
  20 to the bound 500 takes 66 steps.
- *Result:* the first frame shows the set the frame-by-frame adaptation would have
  reached eventually, and the rule keeps the count in range while navigating, as
  before. The binary tree above now shows 82 nodes at once (magic reaches its upper
  bound 500 there; the tree has too few heavy nodes near the focus for 150).
- Why not a closed formula or a binary search: the visible count depends on the
  layout, the transformation and the culling radius, so it's only known by
  running the selection; repeating the existing rule reproduces exactly the state
  users already got after interacting, with the same `alpha` and bounds.

### Phase 1: Modern build

- [x] Vite library build (ESM + UMD), dart-sass; Gulp and Webpack removed.
      TypeScript 6 instead of 5 (current at the time; 7 is the native compiler).
      Oxc only supports `const` exports in namespaces: `layers` and `generators`
      export `const` instead of `var`. Two imports the old build tolerated were
      fixed (`HypertreeArgs` as a type export, `bboxCenter` from the right module).
- [x] Current Node LTS (Node 26; `engines: >= 20.19`)
- [x] Internal copy of the used ducd helpers (`src/ducd.ts`), ducd dependency removed
- [x] `package.json`: `main` (UMD), `module` (ESM), `types` (was `.d.js`), `exports`
- [x] Done when: tests and screenshots unchanged: all 152 library tests pass with
      the unchanged references; benchmarks equal (see PERFORMANCE.md); the
      application builds and its smoke tests pass.
- Note: the declarations are written by TypeScript 6 and use syntax older
  TypeScript versions can't read (`export type`, `unknown`, accessors; TS < 3.8).
  Fine for v2; the application gets TypeScript 6 in its own phase 1.

### Phase 2: Bugs and code quality

Planned on 2026-11-22. Small steps, one commit each, all tests green after each.
A bug or feature counts as done when its expected-to-fail test becomes a normal test.

1. [x] **Type errors** (40 with TypeScript 6): missing options in the layer
       interfaces (`fill`, `stroke`, `color`, `background`, ...), `console.assert`
       with non-boolean values, the Materialize global `M` in the meta views, wrong
       signatures. Done: no type errors; the build fails on type errors.
2. [x] **Debug output** removed (`console.log` on every layer stack update,
       `console.debug` on every configuration merge, traces in a layout, ...). The
       file loaders report errors with `console.error`. A test checks that loading
       and interacting print nothing.
3. [x] **Known bugs** (all fixed, see the table below):
       - hover highlight stays after the pointer leaves the tree (analyze first)
       - `goto(p, λ)` ignores the zoom
       - animations stop ~0.3% short of the target
       - `linkCurvature: '0'` crashes; it means straight lines (SVG path), like `'l'`
         (SVG line). Values: `'-'` (default, hyperbolic geodesic), `'+'` (arc
         bending the other way), `'0'`, `'l'`
4. [x] **Filter: only the range is configured.** `weightFilter.magic` is
       internal: the library computes the start value so that the number of visible
       nodes is within `rangeNodes` from the first frame (no settling over several
       frames). A configured `magic` is ignored with a warning. How the start value
       is computed: see "How the start value of magic is computed" below.
5. [ ] **Documented features back** (expected-to-fail tests in `documented.spec.mjs`):
       - renamed, alias with a deprecation warning: `nodeColor`/`linkColor`
         (→ `fill`/`stroke`), `interaction.wheelSensitivity` (→ `wheelFactor`),
         layers `link-lines`/`path-lines` (→ `link-arcs`/`path-arcs` with straight
         lines), `geometry.animateUpRadius` (→ `layout.initSize`),
         `filter.cullingWeight` (→ `weightFilter.rangeNodes`),
         `filter.transformation.P` (→ start position)
       - new: `filter.weightFilter: null` (no weight culling), `geometry.addLayer` /
         `removeLayer` (by name), `iconmap` (emoji per node name) and `langmap`
         (translations) as objects in the model. Both are applied once at
         initialization into `precalc.icon` / `precalc.label` (no lookup per frame)
       - `layout.linklen`: left out for now (the zoom λ is the link length in this
         layout); removed from the docs, mentioned in the migration guide
6. [ ] **Node layer option `show`**: `'leaves'` (default as today: leaves, root,
       nodes with hidden children), `'all'` (a small disk for every visible node,
       inner nodes scaled by weight) or a function `n => boolean`.
       `geometry.nodeFilter` stays as an alias. Playground: option of the nodes layer.
7. [ ] **Multi-line labels**: a `\n` in `precalc.label` gives several lines (text
       measuring, offset, background, `labels-force`). The layer `labels2` (an
       unfinished copy of `labels`) is removed.
8. [ ] **Hover and selection**: separate node state, interaction strategy and
       display (see "Design: hover and selection" below)
9. [ ] **Dead code**: the old `InteractionLayer` (invisible in the default layer
       stack, but still handles events), commented-out blocks. Public exports stay
       until the API review in phase 4.
10. [ ] **ESLint** with a few useful rules (no mass reformatting)
11. [ ] **GitHub Action**: build and all tests on every push (Windows runner, the
        tests use Edge)
12. [ ] Triage the open GitHub issues

Not in phase 2: performance (phase 3), the deep-tree bug (after the modernization).

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
| **Mouse-wheel zoom blocked right after load.** The computed start zoom ignored `interaction.λbounds` [1/40, 0.45 by default], and wheel and pinch rejected every step ending outside the bounds. On wider trees (start λ ≈ 0.71) the wheel did nothing at all, small pinches were ignored, and once zoomed in the start view could not be reached again. | **Fixed (v2, changes the initial view):** λ is limited to `[min, max]` everywhere. The start zoom is set to the nearest bound when the fitted value lies outside, so wide trees start more compact and no longer fill the disk. Wheel and pinch stop at the bounds instead of rejecting the step, `gotoλ` clamps its target (`Hypertree.clampλ`). Covered by tests |
| **Declared callbacks never called.** `onNodeHold`, `onNodeHover`, `onHoverNodeChange` and (in the plain `Hypertree`) `onNodeSelect` were declared but never invoked. | **Implemented:** hover fires when the hovered node changes (undefined on leaving); hold fires after `interaction.holdDuration` (default 500 ms) without moving and suppresses the click; `api.toggleSelection` fires `onNodeSelect(n, selected)`. Covered by tests. `onWikiCenterNodeChange` is still never called |
| **Hovered voronoi cells aren't highlighted.** `cell-layer.ts` checks `d.data.isPartOfAnyHoverPath`, which no longer exists (now `d.data.pathes.isPartOfAnyHoverPath`, as the node layer uses), and the `.hovered.cell` CSS rule is commented out in both themes since the CSS split-up. Verified: with the cells layer on, 6 cells belong to hover-path nodes, none gets the `hovered` class. Also, hovering only refreshed the path layers, never the cells. | **Fixed:** only the cell of the node under the mouse gets `hovered` (not every cell on its path), only cells of selected nodes get `selected`; cells refresh on hover (`LayerStack.updatePath`); CSS rule re-enabled (the dark theme's old rule was invisible, now mirrors the light one); covered by tests |
| **Hover highlights stay after the pointer leaves the tree.** Both the hover path and the hovered cells remain highlighted after moving the mouse out of the component. | **Fixed:** the mouse capture circle (r = 5) reaches far beyond the disk and the voronoi cells are unbounded, so outside the disk the nearest node stayed hovered (and changed while moving). Outside the disk nothing is hovered now; test in `generated.spec.mjs` |
| **Files loaded asynchronously weren't drawn.** Rendering only happened in the language loader's callback; the default language loader is synchronous, so data arriving later (every `fromFile` format: `.d3.json`, CSV, SKOS, TreeML) was laid out but not drawn until the first interaction, although `initPromise` had resolved. | **Fixed:** the data callback renders when the language map is already there; covered by tests for every loader (they fail on the old code) |
| **Hover and selection classes of nodes and symbols lagged.** Path changes (hover, `toggleSelection`, `selectQuery`) only refreshed the path layers, so `.hovered`/`.selected` node styles and query colors appeared only with the next transformation. | **Fixed:** `LayerStack.updatePath` also refreshes nodes, symbols and cells; covered by tests |
| **`goto(p, λ)` ignores the zoom.** `animateTo` never uses its `newλ` argument. | **Fixed:** the zoom is animated together with the translation (limited to `λbounds`); tests in `api.spec.mjs` |
| **Animations stop slightly short of the target.** `animateTo` interpolates with `1 − sigmoid(progress)`, and `sigmoid(1) < 1`, so ~0.3% of the way remains (e.g. `gotoHome` ends at \| **Fixed:** `sigmoid01`, the easing scaled to end exactly at 1; tests now require the exact target |
| **`weightFilter.magic` can't be configured.** `resetData()` always sets it to 20 (presets say 160); afterwards the filter adapts it to keep the visible node count within `rangeNodes`. | **Decided: internal.** Settled at initialization (`settleMagic`), so the visible count is within `rangeNodes` from the first frame; a configured value is ignored with a warning |
| **Documented option names that don't exist.** The readme example uses `nodeColor`/`linkColor`; the code reads `fill`/`stroke`/`strokeWidth`. More documented-only features in phase 0b. | See phase 0b, documented features |
| **Link curvature `'0'` crashes.** Mentioned in a comment in `preset-layers.ts` (not in the docs): "Cannot read properties of undefined (reading 'nodePosStr')". | **Fixed:** the path function lost its `this`; `'0'` draws straight lines as SVG paths. Tests in `config.spec.mjs`, option in the playground |
| **Crash when nodes have an icon but no label.** `preset-process.ts` calls `precalc.label.startsWith(...)` without checking that a label exists. | **Fixed:** checks the label first; covered by `data.spec.mjs` and the playground test |
| **Invisible layers appear while dragging.** `d3updatePattern.ts` and `label-force-layer.ts` only checked `hideOnDrag` during drags and animations, so a layer with `invisible: true, hideOnDrag: false` was drawn while dragging. No default layer has this combination; found in the playground. | **Fixed:** `invisible` always hides, `hideOnDrag` additionally while dragging; covered by `interaction.spec.mjs` |
| **Hover and selection highlight of the cells could not be turned off.** The cell layer always showed the interaction state. | **Added:** layer options `hover` and `selection` (default true) on `cells`; events, callbacks and the hover path are unaffected. Same pattern possible for `nodes`, arcs and symbols |

### Design: hover and selection (for Phase 2)

Agreed on 2026-11-22, to be implemented after Phase 1. Idea: every node has the
states *hovered* and *selected*; the interaction defines how they are set, the
layers only define how they are shown.

**Today**

- *Hover* is set by `interaction-layer-2.ts` (node under the mouse via the voronoi
  cells, `api.setPathHead(HoverPath, n)`) and stored as a path in `objects.pathes`
  plus `pathes.isPartOfAnyHoverPath` on the ancestors. Each layer finds the hovered
  node itself (`cells` searches the head of the HoverPath).
- *Selection* is changed only by `api.toggleSelection(n)`: multi selection with a
  hidden limit (once there are more than 11 paths, hover path included, the oldest
  selection is dropped). Stored three times: `objects.selections`, a
  `SelectionPath` per node, `isPartOfAnySelectionPath` on the ancestors.
- Clicking selects only if the application's `onNodeClick` calls `toggleSelection`.
  The `onClick: toggleSelection` given to `InteractionLayer2` in `preset-layers.ts`
  is never called (only the old, invisible `InteractionLayer` calls its `onClick`).
- Display differs per layer: `cells` the node's own cell (options `hover`,
  `selection`), `nodes` the whole path, `symbols` the selection path without the
  root, `link-arcs`/`path-arcs` the path.

**Target**

1. *State on the node* (single source): `n.hovered`, `n.selected`, derived
   `n.onHoverPath`, `n.onSelectionPath` for path layers. `objects.selections` stays
   as the list in selection order, maintained by the same code.
2. *Strategies set the state* (`model.interaction`, not the layers):
   - `interaction.hover`: `'pointer'` (today) | `'none'`, more later
   - `interaction.selection`: `'none'` | `'single'` (a new selection replaces the
     old one) | `'multi'` with `maxSelections` (today implicitly 10)
   - `interaction.clickAction`: e.g. `'select'` | `'goto'` | `'none'`; `onNodeClick`
     stays as an additional callback
   - the API goes through the same strategy: `api.select`, `api.deselect`,
     `api.clearSelection`, `api.toggleSelection`; the strategy fires `onNodeSelect`
     and `onNodeHover`, so nothing can select around it
3. *Layers only display*: `cells` keeps `hover`/`selection` (later a style choice
   instead of on/off); `nodes`, `symbols` and the arcs get the same options with
   `'node' | 'path' | false`, defaults as today.

**Compatibility**: the defaults reproduce today's behavior (`hover: 'pointer'`,
`selection: 'multi'`, `maxSelections: 10`, click only via `onNodeClick`);
`objects.selections` and `toggleSelection` remain.

**Playground**: Interaction gets Hover, Selection (none/single/multi, maximum) and
Click; the layers keep their display options.

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

## Building

Node ≥ 20.19 (developed with Node 26 LTS).

```bash
npm install
npm run build            # dist/: d3-hypertree.js (UMD, global hyt), d3-hypertree.mjs (ESM),
                         # d3-hypertree-light.css, d3-hypertree-dark.css, d/ (type declarations)
npm run dev              # rebuild on every change + playground on http://localhost:3100/playground/
npm run watch            # rebuild on every change only
npm run typecheck        # TypeScript errors (known ones are fixed in Phase 2)
```

The JavaScript is built by Vite (`vite.config.mjs`), the theme CSS by
`build/css.mjs` (dart-sass), the declarations by `build/types.mjs` (tsc).

## Running the tests

The `test/` package needs a current Node (≥ 18) and the locally installed
Microsoft Edge. It serves the repo root and loads the built
`dist/d3-hypertree.js`, so build first.

```bash
cd test
npm install
npm test                 # all browser tests (~5 min)
npx playwright test tests/api.spec.mjs   # one group
npm run test:update      # accept intended changes as the new reference (scenes and screenshots)
npm run bench            # per-layer render benchmark -> bench-layers.json
npm run bench:interaction  # drag/wheel/pinch pipeline benchmark -> bench-interaction.json
```

| Spec | Covers |
|------|--------|
| `generated.spec.mjs` | generated trees render, drag, λ clamped to λbounds (start, wheel, pinch, gotoλ), deep-tree bug, hover cells, layer toggling |
| `callbacks.spec.mjs` | `onNodeClick`, `onNodeHold`, `onNodeHover`/`onHoverNodeChange`, `onNodeSelect`, `onCenterNodeChange` |
| `interaction.spec.mjs` | drag, wheel, pinch, one-finger pan, hover path, `hideOnDrag`; filter off and default |
| `api.spec.mjs` | `goto*`, `animateUp`, `drawDetailFrame`, selection, paths, query, ripple; filter off and default |
| `data.spec.mjs` | every loader and file format, language file, init callbacks |
| `config.spec.mjs` | every layer on its own, traces, colors, curvature, theme, root wedge, layout types, presets |
| `filter.spec.mjs` | one snapshot set per filter option |
| `documented.spec.mjs` | features promised by the docs |

Scene references live in `test/tests/__scenes__/`, screenshots in
`test/tests/__screenshots__/`. A failing scene comparison names what differs,
e.g. "node 8 off by 12.3 px" or "layer link-arcs: 0 elements vs expected 62".

The harness ([`test/harness.html`](test/harness.html)) takes the data source and
every option as URL parameters (documented at the top of the file), e.g.
`harness.html?gen=nTree&depth=5&childs=8&labels=1&icons=1` or
`harness.html?file=fixtures/flare.csv&filterOpt={"maxlabels":3}`.
