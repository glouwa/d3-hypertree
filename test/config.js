// Turns URL parameters into the stack of overlays of a d3-hypertree. Shared by the
// test harness (test/harness.html) and the playground (playground/index.html), so
// every configuration clicked together in the playground can be opened as a test.
// Needs hyt (../dist/d3-hypertree.js) and hytOptions (../playground/options.js).
//
// Data (one of):
//   gen=nTree&depth=10&childs=2   full n-ary tree (default: binary, depth 10 = 2047 nodes)
//   gen=star&n=250                one root with n children
//   gen=path&n=50                 a path of n nodes
//   gen=deepStar&arms=4&depth=30  root with arms, each a path
//   gen=data                      small inline tree via loaders.fromData
//   gen=fan&n=100&depth=3         root with a fan (node "fan" with n leaf children) and
//                                 a full binary subtree "binary" with 2^depth leaves
//   file=fixtures/flare.csv       loaders.fromFile (.d3.json, .csv, SKOS/TreeML .xml),
//                                 relative to the test folder
//   lang=fixtures/small.lang.json loaders.fromLangFile; labels from the language map
//
// Node content:
//   labels=1   deterministic label per node     labels=name  the node's own name
//   multiline=1  labels on two lines (break at the first space or in the middle)
//   icons=1   emoji per node     iconPercent=25  only that share of the nodes gets one
//             (spread evenly in breadth-first order; default 100)
//   values=1   example data: n.data.value 1..100 (for the infovis presets and scales)
//
// The configuration: a stack of named overlays over the library defaults, applied in
// order (docs/dev/PLAYGROUND.md). The provenance of every option names its entry.
//   stack=[{"name":"infovis","options":{...}},            a preset: hyt.presets[name](options)
//          {"name":"mine","own":true,"overlay":{...}},    an own preset of the playground
//          {"name":"url","overlay":{...}}]                 the overlay of this link
//   enabled:false keeps an entry in the stack without applying it.
// An overlay is JSON: a function option holds its mode (playground/options.js
// resolveNamed): a constant, "@name" (a named value), or a scale
// { "@scale": { value, scale, interpolator, opacity | range } }.
//
// The parameters of older links (and of the existing tests) are translated into the
// "url" entry of the stack:
//   preset=infovis&presetOpt={...}            -> an entry per preset (comma-separated names)
//   filter=off                    no culling at all: every node is visible
//   filterOpt={"cullingRadius":.9}            -> filter
//   layout={"rootWedge":{"angle":3.14}}       -> layout
//   layoutType=spiral|buchheim|unitLines|unitVectors|berge   -> layout.type "@name"
//   layers={"cells":{"invisible":false}}      -> geometry.layerOptions; per-node function
//                                 options accept "depth" (palette) or a constant, e.g.
//                                 {"nodes":{"fill":"#e53935","r":0.02}}
//   geometry={"linkCurvature":"+"}            -> geometry (options for all layers);
//                                 nodeRadius / linkWidth also as a constant, nodeRadius
//                                 also {"leaves":0.012,"inner":0.004|"leaves"}
//   interaction={"wheelFactor":1.5}           -> interaction
//   model={"iconmap":{}}                      -> the whole model (any documented option)
//   weight=uniform                every node weighs 1 in the culling filter
//   colors=1                      color callbacks for nodes and links (by depth)
//   docColors=1                   the readme example's option names (nodeColor / linkColor)
//   theme=dark                    (applied by the page, not part of the model)
(function () {
    const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
    const merge = (a, b) => {
        for (const [k, v] of Object.entries(b || {}))
            if (v !== undefined)
                a[k] = isPlain(v) && isPlain(a[k]) ? merge(a[k], v) : v
        return a
    }
    const json = (q, k) => (q.get(k) ? JSON.parse(q.get(k)) : undefined)
    const num = (q, k, d) => Number(q.get(k) || d)

    // ---------------------------------------------------------------------------------
    // the data

    const DATA_PARAMS = ['gen', 'depth', 'childs', 'n', 'arms', 'file', 'lang', 'labels', 'multiline', 'icons', 'iconPercent', 'values']
    const LEGACY_PARAMS = ['preset', 'presetOpt', 'filter', 'filterOpt', 'layout', 'layoutType', 'layers', 'geometry', 'interaction', 'model', 'weight', 'colors', 'docColors']
    const SOURCES = [
        ['gen:nTree', 'Generator: n-ary tree'],
        ['gen:star', 'Generator: star'],
        ['gen:path', 'Generator: path'],
        ['gen:deepStar', 'Generator: deep star'],
        ['gen:fan', 'Generator: fan and binary subtree'],
        ['gen:data', 'fromData: small inline tree'],
        ['file:fixtures/small.d3.json', 'File: small.d3.json (d3 hierarchy)'],
        ['file:fixtures/flare.csv', 'File: flare.csv (CSV, dot paths)'],
        ['file:fixtures/animals.skos.xml', 'File: animals.skos.xml (SKOS)'],
        ['file:fixtures/primates.treeml.xml', 'File: primates.treeml.xml (TreeML)'],
        ['file:fixtures/filesystem.d3.json', 'File: filesystem.d3.json (10k nodes, sizes; preset infovisFiles)'],
        ['file:fixtures/primates.d3.json', 'File: primates.d3.json (Tree of Life, 1.1k nodes, depth 19)'],
        ['file:fixtures/embryophyta.d3.json', 'File: embryophyta.d3.json (Tree of Life, land plants: 46k nodes, depth 88)'],
    ]

    const inlineData = {
        name: 'root', children: [
            { name: 'a', children: [{ name: 'a1' }, { name: 'a2' }] },
            { name: 'b', children: [{ name: 'b1' }, { name: 'b2' }, { name: 'b3' }] },
            { name: 'c' },
        ],
    }
    function fanData(n, depth) {
        const binary = (name, d) => (d ? { name, children: [binary(name + '0', d - 1), binary(name + '1', d - 1)] } : { name })
        return { name: 'root', children: [
            { name: 'fan', children: Array.from({ length: n }, (_, i) => ({ name: 'f' + i })) },
            binary('binary', depth),
        ] }
    }

    /** The data entry of the stack: the loaders and the initialization callbacks from the data parameters. */
    function dataOverlay(q, fileBase = '') {
        const gen = q.get('gen') || 'nTree'
        const loaders = {
            nTree:    ok => hyt.nTree(ok, num(q, 'depth', 10), num(q, 'childs', 2)),
            star:     hyt.star_(num(q, 'n', 250)),
            path:     hyt.path_(num(q, 'n', 50)),
            deepStar: ok => hyt.deepStar(ok, num(q, 'arms', 4), num(q, 'depth', 30)),
            data:     hyt.fromData(inlineData),
            fan:      ok => hyt.fromData(fanData(num(q, 'n', 100), num(q, 'depth', 3)))(ok),   // lazy: depth is also deepStar's
        }
        const dataloader = q.get('file') ? hyt.fromFile(fileBase + q.get('file')) : loaders[gen]
        if (!dataloader) throw new Error('unknown generator ' + gen)
        const model = { dataloader }

        if (q.get('lang')) {
            model.langloader = hyt.fromLangFile(fileBase + q.get('lang'))
            model.langInitBFS = (ht, n) => { n.precalc.label = ht.langMap && ht.langMap[n.data.name] }
        }
        if (q.get('labels') === '1') {
            let i = 0
            model.langInitBFS = (ht, n) => { n.precalc.label = 'Node ' + (i++) }
        }
        if (q.get('labels') === 'name') {
            // the node's own name (CSV ids are dot paths: use the last segment)
            model.langInitBFS = (ht, n) => {
                const d = n.data || {}
                n.precalc.label = d.name || (d.id !== undefined ? String(d.id).split('.').pop() : undefined)
            }
        }
        if (q.get('multiline') === '1' && model.langInitBFS) {
            // two-line labels: break at the first space, long single words in the middle
            const init = model.langInitBFS
            const twoLines = s => !s ? s
                : s.includes(' ') ? s.replace(' ', '\n')
                : s.length >= 8 ? s.slice(0, Math.ceil(s.length / 2)) + '\n' + s.slice(Math.ceil(s.length / 2))
                : s
            model.langInitBFS = (ht, n) => { init(ht, n); n.precalc.label = twoLines(n.precalc.label) }
        }
        if (q.get('icons') === '1') {
            const emojis = ['🌳', '🐟', '🐦', '🦎', '🐸', '🐭', '🦋', '🌸']
            // iconPercent: node i gets an icon when the running share crosses an integer,
            // so p% of the nodes get one, evenly spread and the same on every run
            const p = Math.max(0, Math.min(100, num(q, 'iconPercent', 100))) / 100
            let i = 0, k = 0
            model.dataInitBFS = (ht, n) => {
                const has = Math.floor((i + 1) * p) > Math.floor(i * p)
                i++
                n.precalc.icon = has ? emojis[(k++) % emojis.length] : undefined
            }
        }
        if (q.get('values') === '1') {
            // example data: n.data.value 1..100, the same on every run
            const prev = model.dataInitBFS
            let vi = 0
            model.dataInitBFS = (ht, n) => {
                if (prev) prev(ht, n)
                n.data = n.data || {}
                if (typeof n.data.value !== 'number') n.data.value = 1 + (Math.imul(vi++ + 1, 2654435761) >>> 0) % 100
            }
        }
        return model
    }

    // ---------------------------------------------------------------------------------
    // the stack

    /** The presets an entry can name: the library's (but modelBase) and the application's (window.hytPresets). */
    function presetNames() {
        const lib = Object.keys(hyt.presets).filter(p => p !== 'modelBase').concat(['playground'])
        const app = Object.keys(window.hytPresets || {})
        return { library: lib, app }
    }
    // the playground's own preset: fewer emojis (the slowest layer), more nodes, a click centers the node
    const playgroundPreset = () => ({
        filter:      { weightFilter: { rangeNodes: { min: 150, max: 750 } } },
        geometry:    { layerOptions: { emojis: { invisible: true } } },
        interaction: { clickAction: 'goto' },
    })
    // modelBase (the defaults; as an overlay it changes nothing) is not listed but accepted
    const presetFactory = name => (window.hytPresets && window.hytPresets[name]) || (name === 'playground' && playgroundPreset) || hyt.presets[name]

    /**
     * The overlay of the older parameters (JSON-able: modes instead of functions where
     * possible), merged into the url entry; undefined if there are none.
     */
    function legacyOverlay(q) {
        const o = {}
        if (q.get('filter') === 'off')
            // weightFilter.magic is internal: set at initialization so the visible node
            // count is within rangeNodes. Demanding an unreachable minimum makes it grow
            // until nothing is culled.
            merge(o, { filter: { cullingRadius: 1, weightFilter: { alpha: 2, rangeNodes: { min: 1e9, max: 1e10 } } } })
        if (q.get('weight') === 'uniform') merge(o, { filter: { weightFilter: { weight: '@uniform' } } })
        merge(o, json(q, 'model'))
        merge(o, { filter: json(q, 'filterOpt') })
        merge(o, { layout: json(q, 'layout') })
        merge(o, { interaction: json(q, 'interaction') })
        const g = json(q, 'geometry')
        if (g && g.nodeRadius && typeof g.nodeRadius === 'object') {
            // {leaves, inner}: a constant for both, else a function (not JSON-able; the harness only)
            const { leaves, inner } = g.nodeRadius
            if (typeof leaves === 'number' && inner === 'leaves') g.nodeRadius = leaves
            else if (leaves === .015 && inner === undefined) g.nodeRadius = '@leaves 0.015'
            else {
                const lib = hyt.coreDefaults().geometry.nodeRadius
                const leafR = typeof leaves === 'number' ? () => leaves : (ud, n) => lib(ud, Object.assign({}, n, { children: null }))
                const innerR = inner === 'leaves' ? leafR : typeof inner === 'number' ? () => inner : lib
                g.nodeRadius = (ud, n) => (n.children && n.children.length ? innerR : leafR)(ud, n)
            }
        }
        merge(o, { geometry: g })
        const layers = json(q, 'layers')
        if (layers) {
            for (const opts of Object.values(layers))
                for (const k of Object.keys(opts)) if (opts[k] === 'depth') opts[k] = '@by depth'
            merge(o, { geometry: { layerOptions: layers } })
        }
        if (q.get('layoutType')) merge(o, { layout: { type: '@' + q.get('layoutType') } })
        if (q.get('colors') === '1')
            merge(o, { geometry: { layerOptions: { 'nodes': { fill: '@by depth' }, 'link-arcs': { stroke: '@by depth' } } } })
        if (q.get('docColors') === '1')   // the readme example's names (migrated to fill / stroke by the library)
            merge(o, { geometry: { layerOptions: { 'nodes': { nodeColor: n => '#e53935' }, 'link-arcs': { linkColor: n => '#e53935' } } } })
        return Object.keys(o).length ? o : undefined
    }

    /**
     * The stack of the URL: [{ name, options?, own?, overlay?, enabled? }], the
     * presets of preset= in front, the older parameters folded into the url entry
     * (which is last and always present).
     */
    function parseStack(q) {
        const stack = []
        for (const name of (q.get('preset') || '').split(',').filter(Boolean))
            stack.push(Object.assign({ name }, q.get('presetOpt') ? { options: JSON.parse(q.get('presetOpt')) } : {}))
        for (const e of json(q, 'stack') || []) if (e && e.name) stack.push(e)
        let url = stack.find(e => e.name === 'url')
        if (!url) stack.push(url = { name: 'url', overlay: {} })
        url.overlay = url.overlay || {}
        const legacy = legacyOverlay(q)
        if (legacy) url.overlay = merge(legacy, url.overlay)
        return stack
    }

    /** The kind of an entry: a library or application preset, an own preset, the url. */
    const entryKind = e => e.name === 'url' ? 'url' : e.own || e.overlay ? 'own' : presetFactory(e.name) ? (window.hytPresets && window.hytPresets[e.name] ? 'app' : 'library') : 'unknown'

    /**
     * The named overlays for the constructor, with functions: the data, then the
     * stack's enabled entries (presets resolved from their factories, the own and url
     * entries' modes resolved by resolveNamed), then the harness callbacks.
     * @param options  { fileBase: prefix for file/lang paths (default ''),
     *                   interaction: callbacks to install (e.g. event recorders) }
     */
    function buildStack(q, options = {}) {
        const stack = parseStack(q)
        const out = [{ name: 'data', overlay: dataOverlay(q, options.fileBase || '') }]
        // the layer types by name, for the layer options of own entries (added layers)
        const types = {}
        const collect = o => { for (const s of (o && o.geometry && Array.isArray(o.geometry.layers) ? o.geometry.layers : [])) if (s && typeof s === 'object' && s.type) types[s.name || s.type] = s.type }
        for (const e of stack) {
            if (e.enabled === false) continue
            const kind = entryKind(e)
            let overlay
            if (kind === 'library' || kind === 'app') overlay = presetFactory(e.name)(e.options)
            else if (kind === 'own' || kind === 'url') { collect(e.overlay); overlay = hytOptions.resolveNamed(e.overlay || {}, n => types[n]) }
            else throw new Error('unknown preset ' + e.name)
            collect(overlay)
            out.push({ name: e.name, overlay })
        }
        if (options.interaction) out.push({ name: 'harness', overlay: { interaction: Object.assign({}, options.interaction) } })
        return out
    }

    /** The stack composed into one overlay (the harness; the same result as the stack in the constructor). */
    function buildModel(q, options = {}) {
        return hyt.composeOverlays(...buildStack(q, options).map(e => e.overlay))
    }

    window.hypertreeConfig = { buildModel, buildStack, parseStack, dataOverlay, legacyOverlay, presetNames, presetFactory, entryKind, merge, DATA_PARAMS, LEGACY_PARAMS, SOURCES }
})()
