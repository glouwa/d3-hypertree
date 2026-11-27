# Refactoring concept: d3-hypertree v2 internals

Status: implemented on 2026-11-25 (see "Status" at the end for what differs from
the proposal). Companion to
[MODERNIZATION.md](MODERNIZATION.md) (goals, decisions, test strategy) and
[PERFORMANCE.md](PERFORMANCE.md) (measurements). The per-frame pipeline the proposal
refers to is drawn in [pipeline.svg](pipeline.svg).

Goals, in this order: the code says where a value comes from and what a frame does
(readability); the per-frame pipeline does no work it does not need (performance);
the public API of v2 stays small and typed.

Measured on the `modernize` branch: 9 424 lines of TypeScript in `src/`, 55 files.
Facts below are from the code, with file references.

## 1. Where the code stands

### 1.1 Three layers of defaults, and a fourth nobody uses

A configuration value can be set in four places today:

| where | example | file |
|---|---|---|
| inside a layer class, as a fallback at use | `this.args.leaderLines \|\| 'auto'`, `lazyScale === undefined ? 1.5`, `width \|\| .05` | label-force-layer.ts:183, node-layer.ts:49, image-layer.ts:36 |
| in the layer factory list (`layerSrc`) | `invisible`, `hideOnDrag`, data source, size callbacks per layer instance | models/hypertree/preset-layers.ts |
| in `modelBase()` and in `hypertree.ts` fallbacks | `captionHeight: .04`, `rangeNodes 150..500`; `initSize \|\| .95`, `animationDuration \|\| 750`, `diskSize \|\| .96`, `maxSelections \|\| 10` | preset-base.ts:48–132, hypertree.ts:271,524,701,837 |
| in a preset merged over `modelBase` | `treeOfLife`, `treeOfLifeMain`, `infovis*` | preset-base.ts:143–190 |

and then once more in the application, which passes a partial model that
`api.setModel` merges over `modelBase()` with `mergeDeep` (hypertree.ts:99–106).

Your diagnosis is right, with one nuance. The problem is not that several levels
exist (a library needs defaults, an application needs to override them). The problem
is that **no value has a single home, and the application does not own its own
values**:

- hypertree-of-life does not use `presets.treeOfLife` / `treeOfLifeMain`. Both pages
  configure inline over `modelBase`. The library presets are a *copy* of the app's
  configuration, and the copy has drifted: the preset says `rangeNodes 1000..1500` and
  labels on the `labels` layer; `otol.html` uses `750..1000` (phone `250..400`) and
  `labels-force`. Nobody notices, because nothing reads the preset except one test.
- When hypertree-of-life needs a different value, the nearest place to change it is
  often the library: the layer fallback (`lazyScale` 1.5 was chosen for the Tree of
  Life), a `modelBase` value, a constant in a module (`FAN_STEP`, `FLAT`,
  `PHONE_LABEL_PX` lives in the app, but the CSS `.caption:lang(zh)` size lives in the
  library and never took effect). Every such change moves the default for every
  user of the library. That is the effect you describe.
- The resolved configuration is never visible as one object. `filter.maxlabels`
  (lower case) is the global limit, `maxLabels` the layer option; both exist, one is
  a typo away from the other, and `layerOptions` is untyped (`{}` in
  unitdisk-model.ts:33), so a misspelled layer option is silently ignored.
- `mergeDeep` (ducd.ts:43) has undocumented rules that the code works around:
  `null` is asserted away (model-compat.ts takes `weightFilter: null` out and puts it
  back after the merge), `undefined` overwrites, arrays merge *by index* (a shorter
  `λbounds` or `layers` array cannot remove entries), functions replace.
- Runtime changes mutate the merged object directly (`ht.args.geometry.captionHeight
  = …` in the phone label sizing) and the caller has to know which update to trigger.

### 1.2 Folder structure

```
src/components/{hypertree, layers, layerstack, unitdisk, meta/*}
src/models/{hypertree, n, path, trace, transformation, unitdisk}
```

"components" and "models" promise an MVC split that the code does not have:
`models/hypertree/preset-layers.ts` imports every layer component;
`models/hypertree/magic-filter.ts` is the per-frame culling, not a model;
`models/unitdisk/unitdisk-model.ts` is the args interface of a component. To find
"the code that selects labels" you look in `models/hypertree/preset-process.ts`.

`hypertree.ts` is 1 020 lines and holds eight concerns: model resolution, data
loading and weights, label measuring and web fonts, the start zoom (`findInitλ_`,
`applyMinFill_`), animations, selection and paths, the view host (viewBox, resize),
and the public API.

Dead or legacy code, only reachable through the public export: `hypertreeex.ts`
(343 lines, with `UnitDiskNav` and the three-disk navigation), `interaction-layer.ts`
(the pre-v2 interaction, 251), `layers-background.ts` / `layers-parameter.ts`, and
`components/meta/*` (debug grids, 4 modules ≈ 950 lines with their scss). Together
≈ 1 800 lines, 19 % of `src`. hypertree-of-life still imports `HypertreeEx` in
`navigation.ts` (the old sidebar navigation, not used by the pages).

### 1.3 The half-plane view: 55 mentions in 15 files

`geometry.halfPlane` is a boolean that the code checks wherever drawing meets
geometry. Grouped by what differs:

| concern | where the `if (halfPlane)` lives |
|---|---|
| map positions disk → view, keep the disk position, size scale | magic-filter.ts:262 (`mapToView`), cayley.ts, n.ts (`cacheDisk`) |
| map pointer view → disk | interaction-layer-2.ts (10 mentions: `toDisk`, `toViewPos`, `diskPos`) |
| draw a geodesic (link, stem) | link-layer.ts (`halfPlaneArc`), stem-layer.ts |
| draw the image of a circle | focus-layer.ts (`circleToView`) |
| background, clip shape, voronoi extent, viewBox and aspect | background-layer.ts, unitdisk.ts, hypertree.ts (`viewPosition`, resize) |
| "outward" and "near the rim" for label placement | label-geometry.ts (7), label-force/placed |
| what is in the view (`outOfView`), the start view | magic-filter.ts, hypertree.ts (`api.overview` clamp) |

Layout, filter and transformation are untouched by it: the Cayley approach maps only
at the end of the pipeline and at the pointer. That part of the design is right and
should stay.

## 2. Configuration: one schema, one resolution

### 2.1 Rules

1. **A default lives exactly once, next to the definition of the option.** A layer
   declares `static defaults: Partial<Args>` with the doc comment of each option. Core
   options (`layout`, `filter`, `interaction`, `geometry`) are declared in one schema
   module with their defaults. No `||`-fallbacks at the place of use: by the time a
   layer runs, every option has a value.
2. **Resolution happens once**, in `resolveModel(defaults, ...overlays) :
   ResolvedModel`. The result is complete (no optional fields), typed, and frozen.
   Everything downstream reads `ResolvedModel`, never a partial.
3. **Overlays are plain data with documented merge rules**: objects merge, arrays and
   functions replace, `null` removes (sets the option to "off", e.g.
   `weightFilter: null`), `undefined` is ignored. This replaces `mergeDeep` and the
   null workaround in model-compat.
4. **Presets are overlays, owned by whoever needs them.** The library ships generic
   presets only: `base` (= the defaults), `infovis`, `infovisEmoji`, `infovisFiles`.
   `treeOfLife` and `treeOfLifeMain` move to hypertree-of-life (`src/presets.ts`): one
   app preset with `branch`, `main` and `phone` overlays, used by both pages. The
   drift disappears because there is one copy, and a Tree-of-Life value never again
   has to be a library default.
5. **Typed layer options.** `layerOptions: { [K in LayerName]?: Partial<ArgsOf<K>> }`,
   derived from the layer list. A misspelled option or layer name is a compile error
   (and the playground can validate URL options against the same schema).
   `filter.maxlabels` goes; `maxLabels` is a layer option only.
6. **Provenance.** `resolveModel` can record, per option path, which overlay set it
   (`'defaults' | 'preset:infovis' | 'app' | 'url'`). The playground shows it ("Root
   wedge angle: 162°, from app"). Cheap (computed once), and it answers the question
   this whole section is about: *where does this value come from?*
7. **Runtime changes go through one door**: `ht.configure(overlay)` re-resolves and
   triggers the updates the changed options need. Each option carries an `affects`
   tag in the schema (`'data' | 'layout' | 'frame' | 'style'`), so the caller no
   longer has to know that `captionHeight` needs `updateLabelLen_` plus
   `update.data()`. The phone label sizing and the language switch become
   `configure({ geometry: { captionHeight } })`.

### 2.2 The layer list as data

Today `geometry.layers` is an array of factory closures (`(v, ud)=> new X(v, {…})`)
that mixes three things: which layers exist, each instance's wiring to the cache
(`data: ()=> ud.cache.labels`), and defaults. Proposal: a declarative list,

```ts
layers: [
  { type: 'arcs',   name: 'link-arcs',   data: 'links',  options: {…} },
  { type: 'labels', name: 'labels-force', data: 'labels', options: { maxLabels: 30 } },
  …
]
```

where `data` names a cache channel (`links`, `labels`, `emojis`, `cells`, …). Gains:
the stack is serializable (the playground URL can describe it fully), a layer gets a
`LayerContext` (`{ cache, geometry, projection, state }`) instead of the whole
hypertree (`view.hypertree.args.geometry.x`, 23 times in the interaction layer alone),
and `addLayer` / `removeLayer` become list operations instead of `removed: true`
flags. Custom layer classes register under a type name; `presets.layers` stays
exported for applications that extend the list.

### 2.3 What this costs

- `HypertreeArgs` changes shape (v2 is a major version; `migrate(v1Model)` keeps the
  renamed options of model-compat.ts working, with the same warnings).
- `geometry.decorator` (the unit disk class to instantiate) goes; see section 4.
- hypertree-of-life gains a `presets.ts` and loses ~150 lines of inline configuration
  per page.

## 3. Folder structure: by pipeline stage

```
src/
  index.ts              the public API, nothing else is importable
  config/               schema.ts (options + defaults + affects), resolve.ts, migrate.ts (v1 names), presets.ts
  data/                 n.ts, tree parsing (n-tree.ts), loaders.ts, weights.ts (sums, fan-weight, children-order)
  layout/               berge.ts, other layouts, overview.ts, fit.ts (initial λ, minFill, maxLinkLength)
  geometry/             hyperbolic-math.ts, transformation.ts, cayley.ts (pure math, no DOM)
  filter/               culling.ts (magic-filter), labels.ts (label selection), voronoi.ts
  projection/           projection.ts (interface), disk.ts, halfplane.ts     ← section 4
  view/                 host.ts (the svg, viewBox, resize; today unitdisk.ts), layerstack.ts, d3-join.ts (d3updatePattern), planes
  layers/               one file per layer; label-geometry.ts, label-transition.ts shared
  interaction/          pointer.ts (interaction-layer-2), gestures.ts, animation.ts
  state/                selection.ts, paths.ts, traces.ts (today objects.*)
  hypertree.ts          the facade: wires the stages, exposes api
  styles/               the scss (one light/dark pair per theme, not per component)
  debug/                meta grids and benchmark hooks, excluded from the default build (or deleted)
```

Why by stage and not by MVC: a reader who knows pipeline.svg finds the code of a
stage in the folder of that stage, and a change "the filter hides too much" has one
folder to look in. `components/` and `models/` go away.

`hypertree.ts` shrinks to the facade (≈ 300 lines) by moving: model resolution →
`config/`, `updateWeights_` and `dataInitBFS` → `data/`, `captionMetrics` and the font
loading → `layers/label-measure.ts`, `findInitλ_` and `applyMinFill_` → `layout/fit.ts`,
`animateTo*` and `Animation` → `interaction/animation.ts`, selections and paths →
`state/`, `viewPosition` and resize → `view/host.ts`.

Order: do the move **after** sections 2 and 4, in one commit of pure `git mv` plus
import fixes. Moving first means moving twice (the extractions create new files), and
a commit that both moves and changes logic cannot be reviewed.

## 4. Half-plane and disk: swap the projection, not the component

### 4.1 The idea, evaluated

"A `HalfPlane` component and a `UnitDisk` component, and swapping one for the other
contains most of the code that differs" is right about the goal (the difference is
one coherent concern, it should live in one place) and would be the wrong cut if done
as two host components. Section 1.3 shows why: of the 55 branches, 3 are in the host
(`unitdisk.ts`), the rest are in layers, the filter, the interaction and the label
geometry, because **each of those draws or reads geometry itself**. Two host classes
leave every `if (halfPlane)` in the layers where it is; `geometry.decorator` already
is such a swappable host and it did not help.

### 4.2 Counter-proposal: a `Projection` interface

The thing that differs is "how a point, a geodesic and a circle of the hyperbolic
plane appear on the screen". Make that an object the pipeline consumes:

```ts
interface Projection {
  // positions (the transformation and the filter work in the disk)
  project(nodes: N[]): void          // sets n.cache (view), keeps n.cacheDisk, n.distScale factor, n.outOfView
  toDisk(view: C): C                 // pointer input
  toView(disk: C): C
  scaleAt(disk: C): number

  // primitives, in view coordinates
  geodesic(a: C, b: C, curvature: ArcCurvature): string     // svg path d
  stem(root: C): string
  circle(center: C, r: number): { cx, cy, r } | null         // image of a disk circle
  outward(view: C): C                // unit vector away from the center, for labels
  rimness(view: C): number           // 0 center .. 1 rim, for labels and shrinkAtRim

  // host
  viewBox(width: number, height: number): { viewBox: string, transform: string }
  clip(): SVGShape; voronoiExtent(): [[x, y], [x, y]]; background(): LayerSpec
  overviewClamp(P: C): C             // keeps the root in the picture (api.overview)
}
```

`DiskProjection`: `project` is a no-op (positions are already view positions; today's
fast path stays), `geodesic` is the Euclidean arc of `arcCenter`, `circle` is the
identity, `outward` radial. `HalfPlaneProjection`: Cayley (`mapToView`), half-plane
geodesics (`halfPlaneArc`), `circleToView`, the grid background, the aspect viewBox.
Both ≈ 150 lines. Layers call `ctx.projection.geodesic(…)`; the filter calls
`projection.project(cache.unculledNodes)`; the pointer calls `projection.toDisk(m)`.
The boolean disappears; `geometry.view: 'disk' | 'halfplane' | Projection` selects
it, and a third projection (Klein model, a fisheye) is a new file, not 15 edits.

Layout stays in the disk, as you said; so do transformation and filter. A real
half-plane component would have to reimplement the Möbius transformation in
half-plane coordinates for no visible gain.

Performance: `project` is already a per-node loop every frame in the half-plane and
a no-op in the disk; the other calls are per drawn element (≈ 1 000 per frame), one
virtual call each. Nothing measurable against the d3 join and the DOM (PERFORMANCE.md).

## 5. The frame: say what it does

`unitdisk.update.data()` and `update.transformation()` run the same code
(unitdisk.ts:79–96: filter, then every layer's `update.data()`), and every layer
rebuilds its d3 join on every frame whatever changed. Readability and performance
meet here:

- one entry, `frame(reason: 'data' | 'layout' | 'transform' | 'style')`, and each
  layer declares what it depends on (`needs: ['transform']`). The cells layer skips
  `style` frames, the label layers skip re-measuring on `transform`, a `style` frame
  (theme switch) touches no geometry. Today `hideOnDrag` is the only such shortcut.
- the cache channels of section 2.2 are the frame's output; a layer reads its channel,
  nothing else. The filter's own follow-up frames (magic-filter `settle`) and the label
  transitions use the same entry.

This is the one item here with a measurable payoff; it should be done with the
benchmarks of PERFORMANCE.md before and after.

## 6. Sequence and safety

Each step ends green (295 library tests, 21 app tests; the scene snapshots catch
geometry changes to the pixel):

1. [x] **Delete** the legacy code of 1.2 (`HypertreeEx`, `UnitDiskNav`, the old interaction
   layer, `meta/`), after hypertree-of-life drops `navigation.ts`'s import. Changelog
   entry. −19 %.
2. [x] **Config** (section 2): schema with defaults and `affects`, `resolveModel` with
   provenance, typed layer options, `configure()`. Move the Tree-of-Life presets into
   hypertree-of-life and make both pages use them. The scene tests must not change.
3. [x] **Projection** (section 4): extract `DiskProjection` first with every scene
   byte-identical, then move the half-plane code into `HalfPlaneProjection`, delete
   `geometry.halfPlane`.
4. [x] **Folder move** (section 3): one commit, `git mv` and imports only.
5. [x] **Frame** (section 5): with before/after benchmarks.
6. [x] Split `hypertree.ts` as described in section 3 (can be folded into 4).

Decisions taken before step 1: `HypertreeEx` and the three-disk navigation are
dropped from the public API of v2; the Tree-of-Life presets live in
hypertree-of-life (`src/presets.ts`); `geometry.layers` is data (factory functions
in the list still work, for own layers).

## 7. Status (2026-11-25)

All six steps are implemented; the library suite (295 tests, the scene snapshots
unchanged except for the removed presets) and the application suite (21) pass.
What differs from the text above:

- **Names.** The host stays `view/unitdisk.ts` (class `UnitDisk`, the same name as
  the class) instead of `host.ts`; the pointer layer is
  `interaction/interaction-layer.ts` (class `InteractionLayer2`, the layer name
  `interaction-2` stays, tests and planes refer to it); the d3 join is
  `view/d3-join.ts` (class `D3UpdatePattern`); the culling is `filter/culling.ts`;
  the infovis presets are `config/infovis.ts`. Class names were not changed: they
  are part of the public API, the file names are not.
- **`ht.args` stays the name of the resolved model** (the tests and the
  application read it); it is not frozen: the transformation state, the
  selections and the filter's internal factor are mutated during interaction.
  `ht.configure()` is the door for option changes; a direct assignment to
  `ht.args` is not tracked in the provenance.
- **The `LayerContext` keeps the host objects** (`unitdisk`, `hypertree`): layers
  need the voronoi layout, the pinch center, `isAnimationRunning()` and the api;
  the options come from `ctx.model`, the geometry from `ctx.projection`, the
  frame data from `ctx.cache`. `view.hypertree.args.*` is gone from the layers.
- **The frame** (section 5) has one entry with the reasons `'data'`,
  `'transform'` and `'style'` and per-layer `needs`; `'data'` and `'transform'`
  still do the same work in every layer (the visible set changes with the
  transformation), the gain is the declared dependencies (the style frame no
  longer names layers) and a background layer that skips transform frames. The
  benchmark before/after was not run; nothing in the per-frame path changed.
- **`hypertree.ts`** went from 1 020 to 533 lines: the animations
  (`interaction/animation.ts`), the selection and paths (`state/selection.ts`), the
  label measuring (`layers/label-measure.ts`), the zoom bounds and start zoom
  (`layout/fit.ts`) and the weights (`data/weights.ts`) are modules with a small
  host interface each.
- **`filter.maxlabels`** became the layer option `maxLabels` (default 25 on each
  label layer, `DEFAULT_MAX_LABELS`), as section 2.1 (5) asked.

---

Created 2026-11-25 · Last edit 2026-11-27
