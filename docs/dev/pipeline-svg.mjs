// Generates docs/dev/pipeline.svg: the data flow of d3-hypertree, sankey style.
// Usage (from the repository root): node docs/dev/pipeline-svg.mjs docs/dev/pipeline.svg
import { writeFileSync } from 'node:fs'

const W = 1940, H = 1180
const COL = [20, 330, 640, 950, 1270, 1640]
const BW = [230, 230, 230, 250, 270, 270]
const C = { data: '#43a047', config: '#1e88e5', pointer: '#fb8c00', frame: '#8e24aa', state: '#6d4c41' }

// boxes: id -> { col, y, h, title, lines, color }
const boxes = {}
const box = (id, col, y, h, color, title, lines = []) => (boxes[id] = { id, col, y, h, color, title, lines, out: 0, in: 0 })

box('play',   0,  70, 130, C.config, 'Playground', ['every control is a URL parameter', '(test/config.js builds the model)'])
box('preset', 0, 240, 110, C.config, 'Presets', ['modelBase, treeOfLife(Main),', 'infovis, infovisEmoji'])
box('app',    0, 390, 130, C.data,   'Application', ['data files, langmap / iconmap,', 'callbacks (onNodeClick, …)'])
box('ptr',    0, 760, 110, C.pointer,'Pointer input', ['mouse, touch, wheel'])
box('api',    0, 910, 90,  C.pointer,'API calls', ['goto, gotoλ, select, toggleSelection'])

box('mData',  1,  60, 150, C.data,   'model: data', ['dataloader, langloader,', 'dataInitBFS, langInitBFS'])
box('mLayout',1, 230, 70,  C.config, 'model.layout', ['type, weight, rootWedge, initSize'])
box('mFilter',1, 320, 90,  C.config, 'model.filter', ['cullingRadius, weightFilter,', 'focusExtension, maxFocusRadius,', 'maxlabels'])
box('mGeom',  1, 430, 150, C.config, 'model.geometry', ['nodeRadius, nodeScale, linkWidth,', 'linkCurvature, shrinkAtRim, captions,', 'layerOptions (per layer)'])
box('mInter', 1, 600, 110, C.config, 'model.interaction', ['hover, selection, clickAction,', 'λbounds, wheelFactor, callbacks'])
box('queue',  1, 760, 110, C.pointer,'interaction-2 layer', ['events → queue,', 'flushed once per frame'])

box('init',   2,  60, 300, C.data,   'Initialization (once)', ['1 load the tree (d3 hierarchy)', '2 load the language map', '3 dataInitBFS: icon, image, clickable', '4 sum weights: visWeight, cullingWeight', '5 langInitBFS: label, wiki', '6 measure texts (caption widths)', '7 start λ (fits layout.initSize,', '   clamped to λbounds), settle magic'])
box('strat',  2, 720, 300, C.pointer,'Interaction strategies', ['pan: P (drag, one finger)', 'pinch / wheel: λ (wheel burst', '   = low detail until it settles)', 'hover: node under the pointer', 'click: clickAction (goto / select)', '   + onNodeClick', 'selection: none / single / multi', 'animations: goto, gotoλ'])

box('tree',   3,  60, 230, C.data,   'Tree (N nodes)', ['data, depth, height, parent', 'precalc: label, icon, imageHref,', '  clickable, visWeight, weightScale,', '  cullingWeight, caption widths'])
box('trans',  3, 420, 150, C.state,  'Transformation state', ['P (translation), θ, λ (zoom)'])
box('nstate', 3, 620, 170, C.state,  'Node state', ['hovered, selected,', 'paths: HoverPath, SelectionPath', '(isPartOfAny…, finalcolor)'])
box('largs',  3, 840, 140, C.config, 'Layer args', ['preset layer + layerOptions:', 'invisible, hideOnDrag, plane,', 'scale, background, hover, …'])

box('layout', 4,  60, 110, C.frame,  'layoutNode', ['n.layout.z for λ', '(cached per λ and parent)'])
box('disk',   4, 190, 120, C.frame,  'into the disk', ['n.cache = transform(z)', 'cachep, distScale,', 'dampedDistScale'])
box('filter', 4, 330, 150, C.frame,  'magic filter', ['focusR = min(λ·focusExt., maxFocusR)', 'weight threshold (magic, rangeNodes)', 'cullingRadius → unculledNodes'])
box('sets',   4, 500, 520, C.frame,  'per-frame sets', ['links = unculled without root', 'paths = links on a path', 'leafOrLazy (nodeFilter)', 'emojis (precalc.icon)', 'images (precalc.imageHref)', 'cells = voronoi (d3-delaunay)', '   (skipped while dragging)', 'labels = labelsFor(maxLabels):', '   weight × distScale²', 'centerNode, spezialNodes'])

const layerList = [
    ['cells', 'cells (voronoi)'], ['link-arcs', 'link-arcs'], ['path-arcs', 'path-arcs'], ['stem-arc', 'stem-arc'],
    ['nodes', 'nodes'], ['symbols', 'symbols'], ['images', 'images'], ['emojis', 'emojis'],
    ['labels', 'labels'], ['labels-force', 'labels-force'], ['center-node', 'center-node'],
    ['indicators', 'indicators (radii, λ, origin)'], ['traces', 'traces'], ['interaction', 'interaction-2'],
]
layerList.forEach(([id, title], i) => box('L:' + id, 5, 40 + i * 80, 58, C.frame, title))

// flows: [from, to, width, color, label]
const flows = [
    ['play', 'mData', 8, C.config], ['play', 'mLayout', 6, C.config], ['play', 'mFilter', 6, C.config],
    ['play', 'mGeom', 10, C.config], ['play', 'mInter', 8, C.config],
    ['preset', 'mLayout', 6, C.config], ['preset', 'mFilter', 6, C.config], ['preset', 'mGeom', 14, C.config], ['preset', 'mInter', 8, C.config],
    ['app', 'mData', 20, C.data], ['app', 'mInter', 6, C.data],
    ['ptr', 'queue', 24, C.pointer], ['queue', 'strat', 24, C.pointer], ['api', 'strat', 12, C.pointer],
    ['mData', 'init', 28, C.data], ['mLayout', 'init', 8, C.config], ['mFilter', 'init', 6, C.config], ['mInter', 'init', 4, C.config],
    ['mInter', 'strat', 14, C.config], ['mGeom', 'largs', 16, C.config],
    ['init', 'tree', 30, C.data], ['init', 'trans', 8, C.state],
    ['strat', 'trans', 16, C.pointer], ['strat', 'nstate', 14, C.pointer],
    ['tree', 'layout', 16, C.data], ['trans', 'layout', 6, C.state], ['trans', 'disk', 10, C.state],
    ['mLayout', 'layout', 6, C.config], ['mFilter', 'filter', 10, C.config],
    ['layout', 'disk', 16, C.frame], ['disk', 'filter', 22, C.frame], ['filter', 'sets', 28, C.frame], ['nstate', 'sets', 8, C.state],
    ['sets', 'L:cells', 8, C.frame], ['sets', 'L:link-arcs', 10, C.frame], ['sets', 'L:path-arcs', 6, C.frame],
    ['sets', 'L:nodes', 10, C.frame], ['sets', 'L:symbols', 4, C.frame], ['sets', 'L:images', 5, C.frame],
    ['sets', 'L:emojis', 7, C.frame], ['sets', 'L:labels', 8, C.frame], ['sets', 'L:labels-force', 8, C.frame],
    ['sets', 'L:center-node', 4, C.frame], ['sets', 'L:interaction', 6, C.frame],
    ['filter', 'L:indicators', 5, C.frame], ['trans', 'L:indicators', 4, C.state], ['strat', 'L:traces', 5, C.pointer],
    ['tree', 'L:stem-arc', 3, C.data],
    ['nstate', 'L:nodes', 4, C.state], ['nstate', 'L:link-arcs', 4, C.state], ['nstate', 'L:cells', 3, C.state],
    ['largs', 'L:cells', 2, C.config], ['largs', 'L:link-arcs', 2, C.config], ['largs', 'L:path-arcs', 2, C.config],
    ['largs', 'L:nodes', 2, C.config], ['largs', 'L:emojis', 2, C.config], ['largs', 'L:labels', 2, C.config],
    ['largs', 'L:labels-force', 2, C.config], ['largs', 'L:images', 2, C.config], ['largs', 'L:indicators', 2, C.config],
]

// stack the bands along the box edges in the order of the flows
const xOut = b => COL[b.col] + BW[b.col], xIn = b => COL[b.col]
const pad = 6
const paths = flows.map(([f, t, w, color]) => {
    const a = boxes[f], b = boxes[t]
    const y1 = a.y + pad + a.out, y2 = b.y + pad + b.in
    a.out += w + 2; b.in += w + 2
    const x1 = xOut(a), x2 = xIn(b), xm = (x1 + x2) / 2
    return `<path d="M${x1} ${y1} C${xm} ${y1} ${xm} ${y2} ${x2} ${y2} L${x2} ${y2 + w} C${xm} ${y2 + w} ${xm} ${y1 + w} ${x1} ${y1 + w} Z" fill="${color}" fill-opacity=".28"/>`
})

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const boxSvg = Object.values(boxes).map(b => {
    const x = COL[b.col], w = BW[b.col]
    const lines = b.lines.map((l, i) => `<text x="${x + 10}" y="${b.y + 40 + i * 17}" class="t">${esc(l)}</text>`).join('')
    const titleY = b.lines.length ? b.y + 21 : b.y + b.h / 2 + 5
    return `<g><rect x="${x}" y="${b.y}" width="${w}" height="${b.h}" rx="6" fill="#fff" stroke="${b.color}" stroke-width="2"/>`
         + `<rect x="${x}" y="${b.y}" width="6" height="${b.h}" rx="3" fill="${b.color}"/>`
         + `<text x="${x + 12}" y="${titleY}" class="h">${esc(b.title)}</text>${lines}</g>`
}).join('\n')

const heads = ['Inputs', 'Model', 'Initialization / interaction', 'State', 'Update pipeline (every frame)', 'Layers (their data)']
const headSvg = heads.map((h, i) => `<text x="${COL[i]}" y="26" class="col">${h}</text>`).join('')
const legend = [['data', C.data], ['configuration', C.config], ['pointer / API', C.pointer], ['state', C.state], ['per frame', C.frame]]
    .map(([l, c], i) => `<rect x="${20 + i * 170}" y="${H - 34}" width="18" height="12" fill="${c}" fill-opacity=".5"/><text x="${44 + i * 170}" y="${H - 24}" class="t">${l}</text>`).join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Roboto, sans-serif">
<title>d3-hypertree data flow</title>
<style>.h{font-size:15px;font-weight:600;fill:#222}.t{font-size:12.5px;fill:#444}.col{font-size:17px;font-weight:700;fill:#333}</style>
<rect width="${W}" height="${H}" fill="#fafafa"/>
${headSvg}
${paths.join('\n')}
${boxSvg}
${legend}
<text x="${W - 20}" y="${H - 24}" text-anchor="end" class="t">Band width: rough amount of information, not measured. Generated by docs/dev/pipeline-svg.mjs.</text>
</svg>
`
writeFileSync(process.argv[2], svg)
console.log('written', process.argv[2])
