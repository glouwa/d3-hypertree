# Concept: a playground built on the configuration model

Status: concept of 2026-11-25, revised the same day after review (option descriptors
in the playground, not the library; the preset stack as the main control; d3-scales
in the function controls). Builds on the configuration of
[REFACTORING.md](REFACTORING.md) section 2 (defaults, overlays, provenance,
`configure()`, layers as data). Section 9 says what is implemented.

## 1. Where the playground stood

The old playground kept its own state object `cfg` with ~60 hand-written keys
(`rangeNodesMin`, `shortRoot`, `halfPlane`, `maxlabels`, …), two hand-written
translations (`toParams`: cfg → URL parameters, `fromParams`: back), and
`test/config.js` translated the URL parameters into a model a third time
(`buildModel`). Every option appeared in four places; a new library option was a
change in all four. The defaults were read from `hyt.presets.modelBase()` and compared
by hand. A preset was a select that rebuilt the tree; nothing showed what the preset
changed. Every control change rebuilt the whole component.

What it did well and is kept: every option live with a hint, the URL as the complete
description (shareable, "Open as test" gives the same tree in the harness), the
callback log, the stats, the layer list with per-layer options, and the Playwright
tests of the playground itself.

## 2. Principle: the state is a stack of overlays

The playground's state is a list of named overlays (`ModelOverlay`) plus the data
source (which is not part of the model), nothing else. The tree is
`resolveModel(defaults(), stack)`; a control change is `ht.configure(delta)`.

```
URL:  ?gen=nTree&depth=6&childs=3  &stack=[{"name":"infovis"},{"name":"my-labels","overlay":{…}},{"name":"url","overlay":{…}}]

defaults()  ──▶  infovis (library)  ──▶  my-labels (own)  ──▶  url (this link)  ──▶  live edits (configure)
```

This deletes `cfg`, `toParams`, `fromParams` and most of `config.js`: the playground
no longer knows the options by name. Three things remain to be written by hand: the
data sources, the option descriptors with the named function values (section 3), and
the layout of the panel (which section an option goes in). Everything else is derived.

## 3. Controls derived from option descriptors

### 3.1 Where the descriptors live

The schema (`config/schema.ts`) has the defaults and the types, but no runtime
description a UI could use. The descriptors are documentation strings and bounds that
no application needs at runtime, so they stay out of the library bundle: they live in
`playground/options.js`, one table for the core options (by path) and one per layer
type (by option name), loaded by the playground and by the test harness.

A test keeps both in sync: every default of the library (every leaf of
`coreDefaults()` and every option of every layer type) must have a descriptor, and
every descriptor must describe an existing option. A new option in the code fails
that test until it is described.

```js
// playground/options.js
options = {
    'filter.cullingRadius':            { kind: 'number', min: .5, max: 1, step: .01, doc: 'nodes beyond this radius are hidden' },
    'filter.weightFilter.rangeNodes':  { kind: 'range', min: 0, max: 5000, step: 10, doc: '…' },
    'layout.childOrder':               { kind: 'enum', values: ['data', 'balanced'], doc: '…' },
    'geometry.nodeRadius':             { kind: 'function', returns: 'number', min: .002, max: .06, doc: '…' },
    'interaction.onNodeClick':         { kind: 'callback', doc: '…' },
    …
}
layerOptions = {
    '*':      { invisible: { kind: 'boolean', … }, hideOnDrag: …, plane: …, data: …, className: … },
    'nodes':  { show: { kind: 'enum', values: ['leaves', 'all'] }, fill: { kind: 'function', returns: 'color' }, … },
    'labels': { maxLabels: { kind: 'number', min: 0, max: 200 }, … },
    …
}
```

A descriptor is found by the longest described prefix of the option path, so
`filter.weightFilter.rangeNodes` (kind `range`) also describes `…rangeNodes.min`.

### 3.2 The kinds

| kind | value | control |
|---|---|---|
| `number` | a number in min..max (step); `nullable`: null switches off | slider with the value; nullable: a checkbox "on" |
| `angle` | radians | slider in degrees |
| `boolean` | | checkbox |
| `enum` | one of `values` | select |
| `string` | | text field |
| `range` | `{ min, max }` | two number fields |
| `pair` | `[a, b]` | two number fields |
| `point` | `{ re, im }`, nullable | two sliders, checkbox if nullable |
| `function` | a function of the node (or the layer context); `returns` says what | select of modes: default, constant, scale, named values (3.3) |
| `callback` | called by the component | no control; the log shows it firing |
| `object` | an object with its own options; nullable possible | no control of its own; nullable: a checkbox "on" |
| `layers` | the layer stack | the layer panel |
| `data` | a cache channel or a function of the layer | select of the channels |
| `state` | runtime state | no control; the stats |

Other fields: `doc` (the hint), `min/max/step`, `values`, `nullable`, `returns`
(`number`, `color`, `boolean`, `string`, `point`, `any`), `unit`, `internal` (set by
the library, e.g. an arc layer's `role`).

### 3.3 Function options: constants, scales and named values

Many options are functions (`nodeRadius`, `linkWidth`, `fill`, `labelScore`,
`layout.weight`). A URL cannot hold them and the playground does not edit code. The
function control offers modes; the overlay stores a plain value per mode and
`config.js` turns it into the function before the model is resolved (`resolveNamed`):

| mode | in the overlay | resolved to |
|---|---|---|
| default | the path is not in the overlay | the preset's or the library's function |
| constant | a number or a color string | a constant function |
| scale | `{ "@scale": { value, scale, interpolator, opacity } }` (color) or `{ "@scale": { value, scale, range } }` (number) | `hyt.colorBy` / `hyt.sizeBy` over the tree's range |
| named | `"@by depth"` | a function of the playground's registry for that path |

The scale UI: the value (`weight`, `depth`, `height`, `value` from `hyt.nodeValues`,
or `data.<key>` of the node's own data), the scale type (`linear`, `sqrt`, `log`), for
colors a d3 interpolator (Viridis, Inferno, Turbo, Blues, …) and an opacity, for
numbers the output range (preset from the descriptor's min and max). This is the
infovis preset's machinery made clickable per option, so a color-by-value or
size-by-value can be tried on any layer without a preset.

The named registry is keyed by path patterns (`geometry.layerOptions.*.fill`) and
holds what cannot be a constant or a scale: the layout functions, `uniform` weights,
`by depth` palette colors, `root only` label backgrounds. A function a preset brought
(e.g. infovis colors) shows as that preset and is replaced by choosing another mode.

### 3.4 Panel layout

The panel is a list of sections naming path patterns, the only hand-written part:

```js
sections = [
    { title: 'Data' },            // the data source and its options (not model options, section 4)
    { title: 'Presets' },         // the stack (section 5)
    { title: 'Initialization' },  // the steps the data goes through, with their current values
    { title: 'Layout',      paths: ['layout.*'] },
    { title: 'Filter',      paths: ['filter.*'] },
    { title: 'Geometry',    paths: ['geometry.*'] },      // layers and layerOptions go to the layer panel
    { title: 'Interaction', paths: ['interaction.*'] },
    { title: 'API' },
]
```

A pattern pulls every matching described option; an option without a section goes
into "Other" so nothing is silently missing (a test asserts "Other" does not exist).
Every control shows the option's last path segment, its hint, a provenance badge
(section 5) and a reset arrow when the value comes from an editable entry.

The layer panel is built from the resolved `geometry.layers`: one row per spec with
its type, data channel and the type's options; a layer can be added from
`layerTypes` (type and name), removed and moved. Since the stack is data, a
structural change writes `geometry.layers` as a list into the overlay, where a
default layer is written as its name (`"nodes"`) and an added layer as its spec;
option changes go to `geometry.layerOptions[name]` as before.

## 4. The data source and the initialization

The data (generated tree, fixture file, language file, which nodes get a label or an
icon) is not part of the model; it stays in `config.js` (`gen=`, `file=`, `labels=`,
`icons=`, `lang=`), written as its own URL parameters, and still rebuilds the
component when changed. The "Initialization" section (the steps the data goes
through: dataInitBFS, langInitBFS, weights, start zoom, with their current values)
stays; it is the one place that reads the hypertree's internals rather than the model.

## 5. The preset stack

The "Presets" section is the main control for the configuration. It shows the stack
in the order of the overlays, as an application composes them (hypertree-of-life:
`base` → `branch` → `phone`):

```
defaults
☑ infovis          library     12 options    ▸ ↑ ↓ ✕
☑ my-labels        own          4 options    ▸ ↑ ↓ ✕   ✎ editing
☑ url              this link    2 options    ▸
```

- **Entries** are library presets (`hyt.presets`), application presets (section 5.1)
  and own presets. Each can be switched off (kept in the stack, not applied), moved,
  removed and expanded to the options it sets, each with its value
  (`pathsOf(overlay)`).
- **Own presets:** "Save as preset" turns the url entry into a named own entry and
  starts a fresh url entry. One entry is the *editing target* (default: url): control
  changes go into it. So a second preset can be built on top of the first, and the
  combination tested by switching entries on and off or reordering them.
- **Provenance:** every control carries a badge with the entry that set its value
  (`defaults`, `infovis`, `my-labels`, `url`), from the provenance of the resolved
  stack, and a reset arrow when that entry is editable: the path is removed from the
  entry and the value below shows again.
- **Conflicts:** an expanded entry marks the options that a later entry overrides
  ("overridden by url") and the ones it overrides itself, so "why does my preset not
  take effect" is answered where the question is asked.
- **Export:** an entry can be copied as JSON (as it is in the URL) or as a TypeScript
  overlay for an application's presets file; function values appear as their mode
  (`'@by depth'`, a scale spec) with a comment.
- The whole stack is in the URL (`stack=`); own presets are also kept in
  localStorage under their name, so they survive beyond one link.

### 5.1 Application presets

The hypertree-of-life presets are built in its `src/presets.ts` with functions in
them, so the playground cannot read them as JSON. Two ways in, both small:

- a page of the application that includes the playground script registers them
  (`window.hytPresets = { 'treeOfLife.branch': ()=> treeOfLife.branch(), … }`), or
- an "Import" field takes a JSON overlay (functions as their modes), e.g. exported from
  the application with the same `stack=` format.

The first needs no copy and is the one implemented when the application wants it; the
second works without the application running.

## 6. Live changes

A control change calls `ht.configure({ path: value })` on the resolved model and
shows the effect it had (`labels`, `layers`, `frame`, …) for a moment in the
control's badge; only a data source or a stack change rebuilds the component. The log
keeps the callbacks and adds one line per configure call
(`configure geometry.captionHeight = .1 → labels`), so the log is a transcript of
the session.

"Copy link" writes the URL; "Open as test" opens the harness with the same
parameters, so a test and a playground state remain one string.

## 7. What the library needs for it

- `new Hypertree(view, stack)`: the constructor also takes a list of named overlays
  (`[{ name, overlay }]`), so the provenance names the entry that set a value
  (until now every value of the application's model was `app`).
- `geometry.layers` entries by name: a string in the list stands for the default spec
  of that name, so a reordered or extended stack can be written as data without the
  functions some default specs carry.
- `ScaleType` `linear` in `colorBy` / `sizeBy` (infovis.ts), next to `sqrt` and `log`.
- Nothing else: `resolveModel`, `whence`, `pathsOf`, `composeOverlays`, `configure`,
  `layerTypes`, `defaultLayers`, `colorBy`, `sizeBy`, `nodeValues` exist. The
  descriptors are the playground's (3.1).

## 8. config.js

`test/config.js` shrinks to: the data sources, `resolveNamed` (modes of section
3.3), the presets and `buildStack(params)` → the named overlays for the constructor.
The old parameters of the existing tests (`filterOpt=`, `layout=`, `geometry=`,
`layers=`, `layoutType=`, `filter=off`, `weight=uniform`, `colors=1`, `preset=`)
keep working: they are translated into one more entry of the stack, so every old
test URL is also a valid playground URL and shows up in the stack as "url".

## 9. Status

Implemented 2026-11-25 (see the commit): sections 2 to 8 as described, with
the old playground replaced. Not implemented: the application presets' registration
in hypertree-of-life (5.1, the page side), the readme cheat sheet generated from the
descriptors (an open decision of the first draft).

---

Created 2026-11-25 · Last edit 2026-11-25
