# Changelog

## Unreleased (2.0.0)

A modernization of d3-hypertree: new build, many fixes, documented features that
had stopped working are back, and zooming, dragging and pinching got faster.
Most configurations keep working unchanged; the behavior changes you may notice
are listed first.

### Changed behavior

- **Force labels (`labels-force`)** are placed by a relaxation: pulled to a rest
  place above their node in the center and outward toward the rim, pushed apart
  as rectangles of their real size (giving way outward), and kept between frames.
  They used to restart from their node on every update (175 simulation steps with
  fixed circles): labels jumped, long ones overlapped. The line to the node is
  only drawn for labels pushed away (option `leaderLines`). Labels that appear
  grow from size 0, labels that disappear shrink to 0, and the labels giving way
  move smoothly (option `transition`, 250 ms; `0` switches it off).
- **`geometry.shrinkAtRim`** for labels, force labels and emojis toward the rim:
  `'none'` (constant), `'damped'` (default: 1 in the center to 0.5 at the rim, as
  labels and emojis before), `'full'` (like the links, to 0). Force labels used
  to keep a constant size; with the default they now get smaller toward the rim
  (`'none'` for the old look).
- **Node color** (light theme): disks filled with #5eb561 instead of the pale
  #a5d6a7, so the leaves are visible.
- **Default node radius** follows `geometry.linkWidth`: inner nodes half the width
  of their link (the disk never sticks out of it), leaves 1.5 times (a disk three
  times as wide as the link; they were nearly invisible at the end of their thin
  links). Was a constant 0.01 (inner nodes times their weight scale).
- **Which nodes get a label.** Until v1 only nodes inside the focus radius
  (λ × `focusExtension`, at most `maxFocusRadius`) were candidates, thinned out
  by weight, so `maxlabels` was often far from reached (a wide tree showed a
  single label). Now every visible node with a label is a candidate; the ones
  with the highest subtree weight × display scale² get a label (big subtrees
  near the center first), up to `maxlabels` (or the layer's `maxLabels`); the
  root always has one. `wikiRadius` no longer limits 𝐖 labels (it only draws
  the `labels-r-𝐖` circle).
- **More nodes are visible from the start.** The filter used to adapt its
  internal factor `weightFilter.magic` by one step per update, so after loading
  the tree stayed far below the configured `rangeNodes` until you interacted
  (e.g. 28 instead of 150–500 nodes). The factor now settles before the first
  frame. `weightFilter.magic` is internal; configure `rangeNodes` instead (a
  configured `magic` is ignored with a warning).
- **The start zoom is limited to `interaction.λbounds`** and fits the tree into
  `layout.initSize` exactly (it used to overshoot by one step). Wide trees start
  more compact; the start view can always be reached again with the wheel.
- **Long press.** The new `onNodeHold` fires after `interaction.holdDuration`
  (500 ms) without moving and suppresses the click that followed before.
- **Callbacks that were declared but never called are called now:**
  `onNodeHover`, `onHoverNodeChange`, `onNodeHold`; `onNodeSelect` fires for every
  selection change, also from `api.toggleSelection`.
- **Animations end exactly at their target** (they stopped ~0.3% short).
- **Hover:** outside the disk no node is hovered (the nearest node used to stay
  hovered); only the voronoi cell under the mouse is highlighted.
- **Emojis are drawn as bitmaps** (`<image>` instead of `<text>`); positions and
  sizes are the same, the white text halo is gone. Option `asImage: false` on the
  emoji layer brings back text.
- **Layer stack:** the old `InteractionLayer` is no longer in the default layer
  stack (it was invisible); the class is still exported.

### Added

- **Layer `labels-placed`** (off by default): labels on candidate positions like
  on a map, above their node in the center and outward toward the rim; drawn
  labels never overlap, a label without a free place is left out. Labels grow and
  shrink when they come and go, a label that changes its place glides there
  (option `transition`).
- **`api.overview()` / `api.gotoOverview()`**: a view with a good overview of the
  tree structure, `{ P, λ }`: the root moved down along the trunk axis until the
  centroid of the 300 heaviest inner nodes is in the middle, λ so that they fill the
  disk to radius 0.95 (alternating, settles in 2-3 rounds). `overview()` only
  computes, `gotoOverview()` animates there.
- **Labels can be pointed at**: hovering, clicking or holding a label acts on its
  node, as its voronoi cell does (labels sit beside their node, often over another
  node's cell). A node drawn right under the pointer (within 8 px) still wins over a
  label lying over it. The label of the hovered node is highlighted in every label
  layer: an opaque box with a border behind it (`rect.caption-hover`) and an opaque
  halo (`.caption-hovered`), styled in the light and dark theme.
- **`layout.childOrder`**: `'data'` (default, the order of the data) or
  `'balanced'`: the heaviest child of every node in the middle, the others each on
  the side that weighs less so far, heavier ones next to the middle. The heaviest
  path runs straight where the sides can be balanced, the tree looks like a spruce;
  where two big branches split it forks. Applied after `dataInitBFS`.
- **Layer option `leaderLines`** on `labels-force` and `labels-placed`: a line to
  the node for labels pushed away from it (`'auto'`, default), `'always'`, `'never'`.
- **Rectangular view** (`geometry.halfPlane`, prototype): the upper half-plane
  model via the Cayley transform. The disk border becomes the bottom edge, links
  are arcs centered on it, the view fills the element's rectangle. Layout,
  filter and interaction work as in the disk.
- **Presets** `treeOfLifeMain` and `treeOfLife` (the hypertree-of-life main and
  branch pages), `infovis` and `infovisEmoji`: a value per node (structure:
  `weight`, `depth`, `height`, or own data `n.data.value` / a function) mapped with
  d3-scales to node radius, link width, emoji size and to the colors of links,
  node disks, voronoi cells and label backgrounds (options `value`, `colorValue`,
  `interpolator`; per color target its own value and interpolator, log scales,
  `'data.<key>'` for own data). `infovisFiles` for file system trees (size as cell
  color and disk radius, number of files as link color and width, folder labels
  with their size), with a generated 10k node example (`test/fixtures`). The presets until v1 (`otolModel`, `mainModel`, `fsModel`,
  `acmflareModel`, `stackoverflowModel`, `generatorModel`,
  `generatorSpiralModel`) still work and warn that they are deprecated.
- **Label backgrounds in color:** the layer option `background` may be a function
  of the node returning a color.
- **Interaction strategies** (`model.interaction`): `hover` (`'pointer'` | `'none'`),
  `selection` (`'none'` | `'single'` | `'multi'`), `maxSelections` (default 10),
  `clickAction` (`'select'` | `'goto'` | `'none'`). Node state `n.hovered`,
  `n.selected`.
- **Selection API:** `api.select(n)`, `api.deselect(n)`, `api.clearSelection()`
  (and `api.toggleSelection(n)`), all through the selection strategy.
- **Layer options:**
  - `hover` / `selection` on `nodes`, `symbols`, `link-arcs` (`'path'` default,
    `'node'`, `'none'`), on `path-arcs` (`'none'` leaves out the hover path or the
    selection paths) and on `cells` (`true` / `false`): how a layer shows the
    state, independent of the events;
  - `transition` on `labels-force` and `labels-placed`: duration in ms of growing
    and shrinking labels; the others give way (`labels-force`) or glide to their
    new place (`labels-placed`) smoothly (default 250, `0`: none);
  - `maxLabels` on `labels` and `labels-force`: a label limit per layer (default
    `filter.maxlabels`);
  - `hoverLabel` / `hoverPathLabels` on `labels` and `labels-force`: always a
    label for the node under the mouse / for every node on the path from it to
    the root, on top of the limit (both on in the Tree of Life presets); a node
    with `precalc.labelOnHover` shows its label only this way;
  - `show` on `nodes`: `'leaves'` (default), `'all'` (a disk for every visible
    node) or a function `n => boolean`;
  - `scale` on `labels`, `labels-force`, `emojis`: size bound to the data (a
    number or a function of the node), times `geometry.shrinkAtRim`;
  - `asImage` on label layers (default on `emojis`);
  - `plane`: the compositor plane of a layer (see Performance).
- **Multi-line labels:** a `\n` in `precalc.label` gives several lines.
- **`linkCurvature: '0'`** draws straight lines (SVG paths); all values: `'-'`
  (default, hyperbolic geodesic), `'+'`, `'0'`, `'l'` (SVG lines).
- **`geometry.startPosition`**: initial translation.
- **Model options from the documentation that were missing:**
  `filter.weightFilter: null` (no culling by weight), `geometry.addLayer` /
  `removeLayer` (layer names), `iconmap` and `langmap` (applied once at
  initialization).
- **Playground** (`playground/`, `npm run dev`): every data source and option in
  a UI, with a callback log; the configuration lives in the URL.

### Fixed

- **An empty tree after moving away from the center** (flat trees zoomed out):
  nodes inside the focus circle are never hidden, so with more of them than
  `rangeNodes.max` the internal factor of the filter sank on every update toward 0;
  moved away, every node was too light and nothing was drawn. A step that hides
  nothing now stops it, and the first node of the filter's path is always drawn.
- **Flickering nodes while dragging or loading**:
  - a drag or wheel now stops a running animation (e.g. a `goto` after a click);
    both used to set the translation and the tree jumped between two states on
    every frame;
  - the filter no longer oscillates when one step shows or hides many nodes of
    the same weight at once (below `rangeNodes.min`, then above `max`, and back);
  - the center node has a hysteresis: two nodes about equally near the center no
    longer take turns, which changed the visible branches on every frame.
- Mouse wheel and pinch did nothing when the start zoom was outside `λbounds`.
- Hovered and selected voronoi cells weren't highlighted.
- Data loaded asynchronously (every `fromFile` format) wasn't drawn until the
  next interaction.
- Hover and selection styles of nodes and symbols lagged one update behind.
- `goto(p, λ)` ignored the zoom.
- `linkCurvature: '0'` crashed.
- Nodes with an icon but no label crashed; label layers got nodes with only an
  icon (NaN positions).
- Invisible layers appeared while dragging when they had `hideOnDrag: false`.
- The navigation background imported `bboxCenter` from the wrong module.
- Debug output on every update (layer stack, voronoi, configuration merge, …).

### Deprecated (still work, with a warning)

| Old name | Use |
|----------|-----|
| `layerOptions[…].nodeColor` / `linkColor` | `fill` / `stroke` |
| `interaction.wheelSensitivity` | `interaction.wheelFactor` |
| `geometry.animateUpRadius` | `layout.initSize` |
| `filter.cullingWeight` | `filter.weightFilter.rangeNodes` |
| `filter.transformation.P` | `geometry.startPosition` |
| `geometry.addLayer: ['link-lines' / 'path-lines']` | `link-arcs` / `path-arcs` with `geometry.linkCurvature: 'l'` |

### Removed

- `filter.weightFilter.rangeCullingWeight` (bounds of the internal factor
  `magic`, default 4..500): it stopped the filter before `rangeNodes` was
  reached, e.g. a small tree stayed far below `rangeNodes.min`. `rangeNodes`
  alone decides the number of visible nodes now; the internal bounds are only a
  safety net. A given `rangeCullingWeight` is ignored.
- Layer `labels2` (an unfinished copy of `labels`); use multi-line labels.
- Layers `link-lines` and `path-lines` (copies of `link-arcs` / `path-arcs` with
  straight lines, and slower). Use `geometry.linkCurvature: 'l'` or `'0'`;
  `addLayer` with the old names does that, with a warning.
- `layout.linklen` from the documentation (never implemented; the zoom λ is the
  link length in this layout).
- The dependency on `ducd` (fixes "Can't resolve 'ducd'", #28).

### Performance

Measured with `test/bench-interaction.mjs` and `test/bench-layers.mjs`, before
and after on the same machine (see [docs/dev/PERFORMANCE.md](docs/dev/PERFORMANCE.md)):

- Dragging no longer recomputes the layout (it only depends on the zoom):
  10–22% less time per update.
- A wheel burst runs in low detail like dragging, with one full frame when it
  settles: 19–39% less time per wheel step.
- Emojis as cached bitmaps: all layers of a test tree with 586 emojis from 2302
  to 17 ms per update.
- One update per animation frame instead of one per mouse or touch event; texts
  and constant attributes are no longer written again on every update.

### Packaging and development

- Built with Vite, TypeScript 6 and dart-sass; Node ≥ 20.19.
- `dist/d3-hypertree.js` (UMD, global `hyt`, self-contained),
  `dist/d3-hypertree.mjs` (ESM), `dist/d/` type declarations (`types` pointed to
  a wrong file before), theme CSS unchanged.
- The type declarations use TypeScript ≥ 3.8 syntax.
- **d3 v7** (was v4), bundled as before, so the d3 version of an application
  does not matter. The voronoi cells use d3-delaunay (d3 v7 has no `d3.voronoi`),
  the file loaders use `fetch` (d3-request is gone); `cache.voronoiDiagram` keeps
  its interface (`polygons()`, `find(x, y)`). Unused dependency
  `d3-force-gravity` removed, `xml2js` 0.6.
- Browser test suite (`test/`, Playwright), lint (`npm run lint`), CI on every push.

## 1.1.3 and earlier

See the git history.
