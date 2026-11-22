# Changelog

## Unreleased (2.0.0)

A modernization of d3-hypertree: new build, many fixes, documented features that
had stopped working are back, and zooming, dragging and pinching got faster.
Most configurations keep working unchanged; the behavior changes you may notice
are listed first.

### Changed behavior

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
  - `maxLabels` on `labels` and `labels-force`: a label limit per layer (default
    `filter.maxlabels`);
  - `show` on `nodes`: `'leaves'` (default), `'all'` (a disk for every visible
    node) or a function `n => boolean`;
  - `shrinkAtRim` on `labels`, `labels-force`, `emojis`: scale with the distance
    to the center like the links;
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
- Browser test suite (`test/`, Playwright), lint (`npm run lint`), CI on every push.

## 1.1.3 and earlier

See the git history.
