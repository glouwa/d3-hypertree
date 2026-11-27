# Changelog

## Unreleased (2.0.0)

A modernization of d3-hypertree: new build, many fixes, documented features that
had stopped working are back, and zooming, dragging and pinching got faster.
Most configurations keep working unchanged; the behavior changes you may notice
are listed first.

### Changed behavior

- **Hover labels count in `maxLabels`** (filter/labels.ts `labelsWithHover`, all label
  layers). The label of the node under the mouse (`hoverLabel`) is always shown and
  counts; then the path to the root (`hoverPathLabels`), nearest first, as far as the
  limit goes; the other labels get what is left. Before, the hover labels came on top
  of the limit. A layer that showed only hover labels with `maxLabels: 0` needs a limit
  now (the path's length).
- **`layout.childOrder: 'balanced'` keeps trunks straight** (data/children-order.ts).
  The turns of a trunk (the path of the heaviest children) are summed up; where the
  next one would lean it further to the same side, the sides of that node are swapped.
  Before, only the depth decided the side, and a trunk could lean 15-30° to one side
  (the beetles of the Tree of Life). Side branches start their own trunk. Trees with
  `'balanced'` look a little different.
- **The model is an overlay over the defaults** (config/schema.ts). The object
  given to the constructor is merged into the complete defaults with fixed rules:
  plain objects merge, arrays and functions replace, `null` switches an option
  off (`filter.weightFilter: null`), `undefined` is ignored. `ht.args` is the
  resolved model (every option has a value, no fallbacks at the place of use);
  `ht.provenance` says where a value came from (`'defaults'`, `'app'`,
  `'configure'`, `hyt.whence(ht.provenance, 'interaction.wheelFactor')`). Until v1
  `mergeDeep` merged arrays by index and class instances key by key, and could
  not express `null`.
- **Layers are data.** `geometry.layers` is a list of specs `{ type, name, data,
  options }` over the layer types in `hyt.layerTypes` (`'nodes'`, `'arcs'`,
  `'labels-force'`, …); `hyt.defaultLayers()` is the default stack. A layer's
  defaults live in its class; the spec's options and `geometry.layerOptions[name]`
  are merged over them. An own layer is a spec with an own type (added to
  `layerTypes`) or, as before, a factory function in the list.
- **The label limit is a layer option.** `maxLabels` on `labels`, `labels-force`
  and `labels-placed` (default 25 each, `hyt.DEFAULT_MAX_LABELS`); the common
  `filter.maxlabels` is gone (deprecated: it sets the three).
- **Force labels (`labels-force`)** are placed by a relaxation: pulled to a rest
  place above their node in the center and outward toward the rim, pushed apart
  as rectangles of their real size (giving way outward), and kept between frames.
  They used to restart from their node on every update (175 simulation steps with
  fixed circles): labels jumped, long ones overlapped. The line to the node is
  only drawn for labels pushed away (option `leaderLines`). Labels that appear
  grow from size 0, labels that disappear shrink to 0, and the labels giving way
  move smoothly (option `transition`, 250 ms; `0` switches it off).
- **High-degree nodes need less angle (`layout.multirowHighDegreeNodes`).**
  The leaf children of a node are drawn in several rows (a staircase: runs of
  leaves, each a row further out). Leaves in the same row of different runs lie
  at the same distance a whole run apart, so such a node now gets the angle of
  its runs (columns), not of its leaves (default `true`; 100 leaves: 10 runs). A
  big unresolved fan (a polytomy, e.g. 7577 species directly under one node)
  used to take most of the angle and squeeze its resolved siblings. The first
  row stays at the link length, every further row 0.15 link lengths out (was
  0.1, with the leaves an angle apart); the staircase runs over the leaf
  children only. With one or two leaf children nothing changes. The weights for
  the filter and the labels still count the leaves; `childOrder: 'balanced'`
  balances the angles. `false`: one row, every leaf its own angle.
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

- **`geometry.projection: 'schwarz-christoffel'`** (named `geometry.view` until 2026-11-27; the old name is migrated with a warning): the rectangular view as the conformal image of the
  whole disk (the Schwarz–Christoffel map, geometry/schwarz-christoffel.ts,
  projection/rectangle.ts). The rim of the disk becomes the edge of the rectangle,
  so every node, the root and the path to it are always in the picture, as in the
  disk; fans keep their angles; the gap of the root wedge goes to the middle of the
  bottom edge; the aspect ratio follows the drawn element (the map's modulus is set
  from it, a resize draws a frame). Links are quadratic curves through the image of
  the midpoint of their disk arc. Unlike `'halfplane'` (kept), which sends one rim
  point to infinity, nothing leaves the view. `interaction.keepTreeInView` works
  here too.
- **`interaction.highlightNode: 'mousehover' | 'center' | 'none'`** (replaces the
  v2 preview's `interaction.hover: 'pointer' | 'none'`, migrated with a warning).
  Which node is highlighted (`n.hovered`, the hover path, the hover label,
  `onNodeHover` / `onHoverNodeChange`): the node under the mouse (default), or the
  node nearest to the center, for touch screens without a mouse. `'center'` follows
  the center node in every frame, also while dragging, pinching and animating (the
  hysteresis of the center node keeps it from flickering); the mouse does not change
  it. Both go through one place (state/highlight.ts, `ht.highlighting`). With
  `'mousehover'`, mouse moves inside one cell no longer redraw the paths (they did on
  every move).
- **`interaction.highlightUpdate: 'live' | 'settled'` and `highlightDelay`** (ms).
  `'live'` (default) sets the highlight at once; `'settled'` when the view stands still
  (no drag, pinch, wheel or animation) and the mouse or the center node rested
  `highlightDelay` ms: no flickering when sweeping over the tree, less work on slow
  devices.
- **`interaction.highlightLabelFallback: 'ancestor'`**: a highlighted node without a
  label shows the label of its nearest ancestor with one, only as the hover label (it
  gets its own back when the highlight moves on).
- **Layer `highlight-marker`** (off by default): a disk on the highlighted node. When
  the highlight moves on, it moves there along the tree (up to the common ancestor and
  down, straight lines between the nodes, option `duration`, 250 ms) and goes on from
  where it is when the target changes on the way. Its animation draws only itself.
  Options `r` (times the rim factor of `geometry.shrinkAtRim`), `duration`.
- **`interaction.keepTreeInView` (default true)**: the center of the view never lies
  beyond the tip of the tree. root*: where the line from the center through the root
  meets the unit circle. The node nearest to the center decides: a tip (a leaf whose
  branch lies behind it, seen from the center) must lie outside the circle with the
  diameter center–root*; a node the tree passes through (a trunk beside the center)
  is always fine. And the center never lies in the root's stem gap (the part of the
  circle `layout.rootWedge` leaves free): the root can't pass the center in the tree's
  direction. Dragging, pinching and
  the wheel correct the translation by the smallest shift that makes the view valid
  (the tree slides along the boundary); the zoom and animations (goto, the start
  view) are not limited; the disk view only. Before, a view could end up as empty
  disk with the tree bunched at the rim.
- **Presets `highlightCell` and `highlightDisk({ size, duration })`**: how the
  highlighted node is shown, its voronoi cell (the theme's `.hovered.cell`) or the disk
  of the layer `highlight-marker`, `size` label fonts high in the center (default 3);
  with the disk the cells keep their own colors. The marker's `fill` and `stroke` are
  lambdas of the highlighted node (e.g. another color over a link).
- **Labels, emojis and the highlight marker grow with the tree while it zooms up**
  (`animateUp`, the start animation: `ht.growth`); they were full size on a tree that
  was still a dot. With a `startView` the first frame already shows the tree as a
  point.
- **`geometry.startView: 'overview' | { P, λ }` and `api.gotoStart()`.** The tree zooms
  up to the start view and moves there at the start (`ht.startPromise`); `gotoStart`
  goes back (a home button). `'overview'` is `api.overview()`, computed once per tree.
  Without a start view `gotoStart` goes to the view of the initialization.
- **`layout.childOrder: 'alternating'`**: the children as given on odd heights,
  reversed on even ones (applications did it in `dataInitBFS`). Every child order now
  starts from the data's order, so changing the option with `configure` (also back to
  `'data'`) works.
- **`geometry.captionPx` and `captionRatio`: labels in screen pixels.** In the units of
  the disk a label is as large as the disk (4 px on a phone). With `captionPx` the font
  of the labels is scaled so a caption has that size on the screen, `captionHeight` is
  set to `captionRatio` (1.25) times the font; kept when the tree's element changes its
  size (ResizeObserver) and changed with `configure` (e.g. a script that needs larger
  text). Measured with a large font, so a browser's minimum font size does not falsify
  it.
- **A detail frame after every animation** (goto, gotoλ, gotoNode, gotoHome,
  gotoOverview, gotoStart, animateUp): the frames of an animation have the low detail;
  the library now draws the detail frame when it reaches its target (not when the next
  animation follows at once or a pointer took over). Applications drew it themselves
  (`.then(()=> ht.drawDetailFrame())`); that still works, it is only redundant.
- **The box of the hovered label is computed, not measured**: from the widths measured
  at the initialization (`precalc.<layer>len`) and the line box, instead of `getBBox`
  for every newly highlighted label (a forced layout; with `highlightNode: 'center'` on
  every change of the center node while dragging). The same for every
  `geometry.shrinkAtRim`: the scale is in the label's transform.
- **`labels-force` options `color` and `hoverTransition`.** `color(n)`: the text color
  (undefined: the theme's), as on `labels`. `hoverTransition: false`: the label of the
  node under the mouse appears and goes at once, the other labels keep their growing
  and gliding (`transition`).
- **`interaction.animationEasing(t)`**: the curve of goto, gotoNode, gotoHome, gotoλ
  and gotoOverview (share of the way at share t of the time). Default: the symmetric
  tanh sigmoid as before.
- **`ht.configure(overlay)`**: changes options at runtime. Each option declares
  what a change affects (`hyt.affects`, `hyt.effectOf(path)`): the data is loaded
  again, the layout, the label measures, the layer stack, a frame, or the styles;
  configure applies the strongest effect of the changed options and returns it.
- **`geometry.projection`** selects the projection of the hyperbolic plane onto the
  screen: `'poincare'` (default), `'cayley'` (the half-plane view), `'schwarz-christoffel'` (the rectangle) or an own
  `Projection` (`hyt.PoincareProjection`, `hyt.CayleyProjection`,
  `hyt.SchwarzChristoffelProjection`, `hyt.createProjection`). The layers ask the
  projection for geodesics, circles, the outward direction and the view box; the
  filter maps the positions, the pointer is mapped back. A further view is a new
  projection, not a change of the layers. The projections are named after their
  maps, not their shapes: until 2026-11-27 the option was `geometry.view` with the
  values `'disk'`, `'halfplane'`, `'rectangle'`; both are migrated with a warning.
- **Configuration helpers** in the API: `hyt.defaults()`, `hyt.coreDefaults()`,
  `hyt.resolveModel`, `hyt.composeOverlays`, `hyt.mergeInto`, `hyt.migrate` (v1
  option names), `hyt.whence`, `hyt.pathsOf`.
- **A stack of named overlays** in the constructor: `new Hypertree(view, [{ name,
  overlay }, …])` applies the overlays in order and `ht.provenance` names the entry
  that set each value (e.g. a preset, then the application's own options). A single
  overlay is still accepted (its name is `app`).
- **`geometry.layers` entries by name**: a string in the list stands for the default
  layer of that name, so a reordered or extended stack can be written as data
  (`['background', 'link-arcs', { type: 'nodes', name: 'big', options: {…} }]`).
- **`'linear'`** as a scale type of `hyt.colorBy` / `hyt.sizeBy`, next to `sqrt`
  and `log`.
- **Layer `emoji-backgrounds`** (off by default, below `emojis`): a disk with a
  border under every emoji, centered on the node and as large as the emoji (option
  `padding`, colors from the theme or the options `fill` and `stroke`; transparent
  like the label backgrounds).
- **Layer `labels-placed`** (off by default): labels on candidate positions like
  on a map, above their node in the center and outward toward the rim; drawn
  labels never overlap, a label without a free place is left out. Labels grow and
  shrink when they come and go, a label that changes its place glides there
  (option `transition`).
- **`interaction.minFill`** and **`interaction.maxLinkLength`**: the λ bounds
  computed per tree after loading. `minFill` (e.g. `.9`): the lower bound at which
  the visible tree, root in the middle, still reaches that share of the disk radius.
  `maxLinkLength` (e.g. `.5`): the upper bound at which a link whose parent is in the
  middle is that long (in `layoutBergé` such a link is λ long; leaves staggered
  outward among many siblings are longer and do not count). They replace
  `λbounds[0]` / `λbounds[1]`.
- **Nodes with hidden children** (class `lazy`, red in the themes) are drawn 1.5
  times as large (`nodes` layer option `lazyScale`); the class follows the view (it
  was only set when a disk was created, so a node that got or lost hidden children
  kept its color).
- **`filter.labelScore`**: the weight of a node when the label layers choose which
  nodes get a label (times the squared display scale), e.g. a felt importance from
  the data; default the subtree weight, as before. `undefined` or `null` for a node
  falls back to the subtree weight. Also used by `labels-placed` for its order.
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
- **Rectangular view** (`geometry.halfPlane`, prototype): the half-plane model via
  the Cayley transform. The disk border becomes the top edge and the gap of the
  root wedge goes to infinity below, so it looks like the disk: the root at the
  bottom with its stem, the tree growing up to the border. Links are arcs
  centered on the border, the view fills the drawn rectangle (and follows its
  size, also when only the element changes, e.g. with a splitter). A grid in
  half-plane coordinates in the background ((0,0) on the border, (0,−1) the disk
  center); the indicator circles (λ, focus, …) are mapped for any center; the
  start view of `api.overview` keeps the root in the picture. Layout, filter and
  interaction work as in the disk.
- **`interaction.animationDuration`**: the duration of the `goto` animations
  (`goto`, `gotoNode`, `gotoHome`, `gotoλ`, `gotoOverview`) in ms, default 750 as
  before.
- **`geometry.diskSize`**: the diameter of the disk in the square view (default
  `.96`, as before); above 1 the disk reaches beyond the view and is cut at its
  edges (e.g. `1.05` on a phone, where every pixel counts).
- **`layout.rootLinkLength`** (Bergé layout): shorter links near the root. The
  root's children get this part of a link (e.g. `.1`), the links to the leaves
  the whole one, growing linearly in between (by the place between root and
  leaves). Default off: the root's children half, all other links whole.
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

- **Zooming in deep in the tree no longer empties the view** (filter/culling.ts
  `pathToLastVisible`, hypertree.ts `updateLayoutPath_`). A wheel or pinch step changes
  λ and relays only the ancestors of the node under the pointer. The next frame's path
  search started at the last center node, often in another branch, and laid it out from
  its parent that still had the old λ. In hyperbolic space that mix displaces a deep
  node by far more than the λ change (Tree of Life, Mammalia at depth 41: from the
  center to r .9975), so the center lay beyond the culling radius, the path was empty,
  nothing was selected, the root became the center and kept the path empty: the tree
  was gone until a reload, in the disk and the rectangle view alike, from depth ~30 on.
  Now the whole chain root → center is laid out top-down before it is transformed, the
  path is never empty (the nearest node of the chain, else of the last visible set,
  else the root starts the selection, so the view refills as nodes come in), and after
  a wheel or pinch step the search starts at the preserved node. See
  docs/dev/FOCUS-ROOTED-LAYOUT.md for the depth limits of the layout behind it.
- **The cells are joined by their node** (view/d3-join.ts). The join keyed every
  element by `mergeId`, but a voronoi polygon carries its node in `data`: every cell
  got the key `undefined`, so d3 removed and recreated every cell on every frame (ten
  thousand DOM writes per frame on the Tree of Life, the cells layer a third to a half
  of the frame's script time). Measured while dragging: main thread per step −35 to
  −58 % (Mammalia desktop 67 → 28 ms, main page 25 → 17 ms, Mammalia phone ×6
  237 → 176 ms, with the two items below).
- **The weight filter settles in one frame** (filter/culling.ts `settle`). After a
  wheel burst or a drag its remaining steps toward `rangeNodes` ran one per frame,
  each a full frame with every layer: 10–18 frames, 0.5–0.8 s of main thread on a
  desktop, 1.8 s on a phone. When the view stands still they now run at once without
  drawing (as before the first frame), then one frame (Mammalia desktop: 12 → 4 frames
  after a wheel burst).
- **No frames of their own for the label transitions while the view moves**
  (layers/label-transition.ts). `labels-force` and `labels-placed` requested an
  animation frame for their growing, shrinking and gliding labels also while dragging,
  where the hypertree draws every frame anyway: the relaxation and the join ran twice
  per frame. A drawn offset within .0005 of its target snaps (was 1e-4: seven more
  redraws for nothing visible). The invisible `labels-placed` layer no longer computes
  its placement (2–3 ms per frame on a phone).
- **A style frame keeps the visible set** (filter/culling.ts `cacheUpdateStyle`,
  view/unitdisk.ts). A hover or selection change drew a frame that ran the full
  filter: the DFS over the tree with all its transformations and the voronoi diagram,
  although the view had not moved. When the transformation, the data, the filter and
  the selection paths are those of the last full update, the frame keeps its visible
  set, cells and positions and only selects the labels and the links on paths again.
  Hover change on the Tree of Life: 55 → 21 ms of script at CPU ×6 (filter 39 → 4 ms),
  2.4 ms on a desktop, no long tasks while sweeping the mouse.
- **One probe per caption class for the emoji bitmaps** (layers/label-layer.ts
  `textImage`). Every new emoji was measured as SVG text with `getBBox`, a forced
  layout per emoji (9 ms each on a phone, dozens in a frame while dragging); the
  font and its scale are now measured once per class and svg font size.
- **Colors and state classes are written only when they change** (view/dom-write.ts;
  the cell, node, link and label layers, `markHoveredLabel`). The data join runs
  `updateColor` on every element on every frame while dragging (the visible nodes
  change); d3's `classed()`/`style()` write to the DOM even when nothing changes, and
  those writes and the style recalculation they caused cost about a third of a frame on
  a phone. The values are still computed every frame (a color function may depend on
  anything), only unchanged ones are not written. Frames while dragging: -30 % (phone
  emulation, Coleoptera).
- **`api.overview()` 7-17 times faster** (layout/overview.ts). Its bisections laid out
  the whole tree up to ~150 times; now only the 300 heaviest inner nodes and their
  ancestors (the children of the other inner nodes are hidden meanwhile). Same result;
  on a phone 4-15 s less for a branch page of the Tree of Life.
- **The hovered label's box is not measured on every frame** (layers/label-layer.ts
  `markHoveredLabel`): `getBBox` once per text, class and font size. It forced a layout
  on every frame, a quarter of the time while dragging on a phone.
- **Label widths are measured in the labels' font.** The computed style of the probe
  caption was read after removing it (it is live: every value was empty), so the canvas
  font was invalid and every width was measured in the canvas default 10px sans-serif;
  scripts Roboto lacks (Chinese, ...) were off the most.
- **Label backgrounds are centered on their text** (measured with the widths) and their
  paddings grow with `geometry.captionHeight` (`paddingsFor`). They were centered on a
  point a fixed .01 above the baseline: a larger font sat high in its box.
- **The weight filter no longer empties the view when dragging.** The nodes in the focus
  circle and their children (shown whatever their weight) counted against
  `rangeNodes`; a fan in the focus filled the range alone, magic hid everything else,
  and dragging the fan out of the focus left almost nothing until magic recovered over
  many frames. They no longer count, and the other nodes keep at least a quarter of
  the range.
- **Half-plane view: the root is projected.** It was drawn at its disk position when it
  was outside the culling radius: a node, a stem and a piece of path in the middle of
  the view, connected to nothing.
- **Emojis sit with their middle on their node.** The offset `bboxCenter` was applied
  before the emoji's double scale and the bitmap included the glyph's side bearings,
  so emojis sat up to 10 px right of and above their node. The bitmap now holds only
  the emoji's ink and is centered on the node (as text: `text-anchor: middle`,
  `dominant-baseline: central`); the emoji layer's default `delta` is zero.
- **Label widths** (label backgrounds, force label spacing, placement): measured with
  the font the labels are drawn with (family, weight and size from the CSS, also the
  larger `:lang(zh)` size), calibrated against an SVG text; they were divided by
  `devicePixelRatio` and measured with weight 400 instead of 300, so on scaled screens
  (125 %, 150 %) backgrounds were too small and text stuck out. Measured again when the
  web font has loaded. The box of the hovered label takes the shape of the label's
  background and covers it; its border is always 1 screen pixel.
- **An empty tree after moving away from the center** (flat trees zoomed out):
  nodes inside the focus circle are never hidden, so with more of them than
  `rangeNodes.max` the internal factor of the filter sank on every update toward 0;
  moved away, every node was too light and nothing was drawn. A step that hides
  nothing now stops it, and the first node of the filter's path is always drawn.
  That stop holds only for the view (λ, position) it was found in: zoomed fully in
  and out again, it kept the number of nodes above `rangeNodes.max`.
- **Far too many (or too few) nodes after zooming fully in and out again.** The
  filter takes one step per update and stopped with the last update of an
  interaction (zooming ends at the λ bound); its limits against flickering,
  learned zoomed in, held after zooming out. Zoomed in, dragged and zoomed out,
  Mammalia showed 1699 nodes of 750..1000, a test tree all 8191 of 300..400. Now
  the filter requests further updates by itself until the count is in
  `rangeNodes` (then it stops: no updates at rest), and a limit holds only while
  the count and λ are close to the state it was learned in. Each selection
  records where the next node would be hidden or shown: a step that would change
  nothing jumps there (many nodes share one weight: fully zoomed out it took a
  factor of 27 before the first node went), and "nothing can change" is known
  exactly instead of guessed from steps that hid nothing. When a step jumps over
  the whole range, the filter still ends below it (fewer nodes rather than too
  many). The start zoom is unchanged.
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
| `geometry.halfPlane: true` | `geometry.projection: 'cayley'` |
| `filter.maxlabels` | the layer option `maxLabels` of `labels`, `labels-force`, `labels-placed` |
| `geometry.decorator` (the unit disk class) | `geometry.projection` (a `Projection`); dropped |
| `geometry.cacheUpdate` (the frame function) | nothing: the frame is not an option; dropped |

### Removed

- `HypertreeEx` and the three-disk navigation (`UnitDiskNav`, the navigation
  background and parameter disks), the pre-v2 interaction layer and the debug
  grids (`components/meta`): about a fifth of the code, reachable only through
  the exports, used by nothing.
- The Tree of Life presets `treeOfLife` and `treeOfLifeMain`, and the presets
  until v1 (`otolModel`, `mainModel`, `generatorModel`, `generatorSpiralModel`,
  `stackoverflowModel`, `acmflareModel`, `fsModel`): the library ships generic
  presets only (`modelBase`, `infovis`, `infovisEmoji`, `infovisFiles`); an
  application's presets live with the application (hypertree-of-life:
  `src/presets.ts`).
- The exports `layerSrc`, `labeloffsets` and `cacheUpdate` (see "Layers are
  data"; `labelOffset`, `bboxCenter`, `bboxOval`, `sizeAt`, `rimScale` and the
  label selection `labelsWithHover` / `labelsFor` are exported instead).
- `filter.type` (there was only `'magic'`).
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

- **Two real trees as playground examples** (`test/fixtures/primates.d3.json`, 1.1k
  nodes, and `embryophyta.d3.json`, 46k nodes, depth 88): the primates and the land
  plants of the Open Tree of Life synthesis 16.1 as the hypertree-of-life pipeline
  writes them. In the playground's data sources and the loader tests.
- **Performance suite** (`test/perf/run.mjs`, `npm run perf`): generated trees in the
  test harness in headless Edge; load, idle, drag, settling, wheel, pinch, hover, the
  render time per layer, the cost of single options and of the presets, as mean ± sd
  over iterations. Three generated result files with one schema in
  `docs/dev/performance/` (`longterm`, `last-commit`, `last-run`) and `npm run
  perf:compare` for before/after comparisons without stashing old code
  (`docs/dev/PERFORMANCE-SUITE.md`).
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
- **The playground** (`playground/`) is built on the configuration model: its state
  is the data source and a stack of overlays (library presets, own presets, the
  link's changes), the controls come from option descriptors
  (`playground/options.js`; a test keeps them complete), a change is applied live
  with `configure()` and shows which entry set a value. Function options take a
  constant, a d3-scale (value, scale type, interpolator) or a named value; the
  stack is the URL (`stack=`), the older parameters still work. See
  [docs/dev/PLAYGROUND.md](docs/dev/PLAYGROUND.md).
- **The sources are arranged by pipeline stage** (`src/config`, `data`, `layout`,
  `geometry`, `filter`, `projection`, `view`, `layers`, `interaction`, `state`,
  `styles`; `src/hypertree.ts` the facade, `src/index.ts` the public API) instead
  of `components/` and `models/`; a frame has one entry (`unitdisk.frame(reason)`)
  and every layer declares the frames it needs (`needs`). See
  [docs/dev/REFACTORING.md](docs/dev/REFACTORING.md).

## 1.1.3 and earlier

See the git history.

---

Created 2026-11-22 · Last edit 2026-11-27
