// The schema of the result tables: the groups (one markdown table each), their row
// label and metric columns. The three result files (longterm, last-commit, last-run)
// and compare.mjs share it. A metric cell holds { n, mean, sd, values }.
export const GROUPS = [
    { key: 'load', title: 'Load (data, layout, first frame)', rowLabel: 'tree, mode', metrics: [
        { key: 'readyMs',  label: 'ready ms', digits: 0 },
        { key: 'nodes',    label: 'nodes', digits: 0 },
        { key: 'visible',  label: 'visible', digits: 0 },
    ] },
    { key: 'idle', title: 'Idle (3 s standing still)', rowLabel: 'tree, mode', metrics: [
        { key: 'frames',   label: 'frames', digits: 1 },
        { key: 'mainMs',   label: 'main thread ms', digits: 0 },
    ] },
    { key: 'drag', title: 'Drag (61 pointer steps)', rowLabel: 'tree, mode', metrics: [
        { key: 'mainPerStep', label: 'main thread ms/step', digits: 1 },
        { key: 'fps',         label: 'frames/sec (JS of the median frame)', digits: 0 },
        { key: 'filterMs',    label: 'filter ms/frame', digits: 1 },
        { key: 'frames',      label: 'frames during', digits: 0 },
        { key: 'visible',     label: 'visible', digits: 0 },
    ] },
    { key: 'afterDrag', title: 'After the drag (4 s)', rowLabel: 'tree, mode', metrics: [
        { key: 'frames',   label: 'frames', digits: 1 },
        { key: 'mainMs',   label: 'main thread ms', digits: 0 },
        { key: 'lastAt',   label: 'last frame at ms', digits: 0 },
    ] },
    { key: 'wheel', title: 'Wheel zoom (20 steps, desktop) and the 4 s after', rowLabel: 'tree, mode', metrics: [
        { key: 'mainPerStep',  label: 'main thread ms/step', digits: 1 },
        { key: 'framesDuring', label: 'frames during', digits: 0 },
        { key: 'framesAfter',  label: 'frames after', digits: 1 },
        { key: 'mainAfterMs',  label: 'main thread after ms', digits: 0 },
    ] },
    { key: 'pinch', title: 'Pinch (50 touch steps, slow mode)', rowLabel: 'tree, mode', metrics: [
        { key: 'mainPerStep', label: 'main thread ms/step', digits: 1 },
        { key: 'fps',         label: 'frames/sec (JS of the median frame)', digits: 0 },
        { key: 'frames',      label: 'frames during', digits: 0 },
    ] },
    { key: 'hover', title: 'Hover sweep (40 mouse positions, desktop)', rowLabel: 'tree, mode', metrics: [
        { key: 'mainPerStep',  label: 'main thread ms/position', digits: 1 },
        { key: 'fps',          label: 'frames/sec (JS of the median style frame)', digits: 0 },
        { key: 'styleFrames',  label: 'style frames', digits: 0 },
    ] },
    { key: 'layers', title: 'Layers: frames/sec each layer alone would allow during the drag (from its median ms per moving frame)', rowLabel: 'tree, mode, layer', metrics: [
        { key: 'fps', label: 'frames/sec if only this layer ran (1000 / its ms per frame)', digits: 0 },
    ] },
    { key: 'features', title: 'Features: a drag with one option changed (URL parameter or ht.configure after the load)', rowLabel: 'tree, mode, variant', metrics: [
        { key: 'mainPerStep', label: 'main thread ms/step', digits: 1 },
        { key: 'fps',         label: 'frames/sec (JS of the median frame)', digits: 0 },
        { key: 'frames',      label: 'frames during', digits: 0 },
        { key: 'visible',     label: 'visible', digits: 0 },
    ] },
    { key: 'presets', title: 'Presets: a drag with a library preset applied', rowLabel: 'tree, mode, preset', metrics: [
        { key: 'readyMs',     label: 'ready ms', digits: 0 },
        { key: 'mainPerStep', label: 'main thread ms/step', digits: 1 },
        { key: 'fps',         label: 'frames/sec (JS of the median frame)', digits: 0 },
        { key: 'visible',     label: 'visible', digits: 0 },
    ] },
]

// the layers reported (in this order); others are added when they cost something
export const LAYERS = ['cells', 'link-arcs', 'nodes', 'labels-force', 'labels-placed', 'labels', 'emojis', 'emoji-backgrounds', 'highlight-marker', 'path-arcs', 'symbols']

// the feature variants: `query` adds URL parameters of the harness (test/config.js),
// otherwise the object is a model overlay for ht.configure after the load
export const FEATURES = {
    base:             null,
    rectangle:        { query: 'geometry=' + encodeURIComponent('{"projection":"schwarz-christoffel"}') },
    halfplane:        { query: 'geometry=' + encodeURIComponent('{"projection":"cayley"}') },
    glatzhofer:       { query: 'geometry=' + encodeURIComponent('{"projection":"glatzhofer"}') },
    band:             { query: 'geometry=' + encodeURIComponent('{"projection":"band"}') },
    halfBand:         { query: 'geometry=' + encodeURIComponent('{"projection":"half-band"}') },
    icons:            { query: 'icons=1' },
    multiline:        { query: 'multiline=1' },
    filterOff:        { query: 'filter=off' },
    weightUniform:    { query: 'weight=uniform' },
    colors:           { query: 'colors=1' },
    noCells:          { geometry: { layerOptions: { cells: { invisible: true } } } },
    cellsHideOnDrag:  { geometry: { layerOptions: { cells: { hideOnDrag: true } } } },
    noLabels:         { geometry: { layerOptions: { 'labels-force': { invisible: true }, 'labels-placed': { invisible: true }, labels: { invisible: true } } } },
    labelsPlaced:     { geometry: { layerOptions: { 'labels-force': { invisible: true }, 'labels-placed': { invisible: false, hideOnDrag: false } } } },
    labelsPlain:      { geometry: { layerOptions: { 'labels-force': { invisible: true }, labels: { invisible: false, hideOnDrag: false } } } },
    noHighlight:      { interaction: { highlightNode: 'none' } },
    noMarker:         { geometry: { layerOptions: { 'highlight-marker': { invisible: true } } } },
    noKeepInView:     { interaction: { keepTreeInView: false } },
    straightLinks:    { geometry: { layerOptions: { 'link-arcs': { curvature: 'l' }, 'path-arcs': { curvature: 'l' } } } },
    noNodes:          { geometry: { layerOptions: { nodes: { invisible: true } } } },
    noLinks:          { geometry: { layerOptions: { 'link-arcs': { invisible: true } } } },
}

// the library's presets (src/config/presets.ts): URL parameters of the harness; `url`
// replaces the tree (infovisFiles needs the file system fixture)
export const PRESETS = {
    infovis:       { query: 'preset=infovis&values=1' },
    infovisEmoji:  { query: 'preset=infovisEmoji&values=1' },
    infovisFiles:  { url: 'file=fixtures/filesystem.d3.json&preset=infovisFiles' },
    highlightCell: { query: 'preset=highlightCell' },
    highlightDisk: { query: 'preset=highlightDisk' },
}
