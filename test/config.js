// Turns URL parameters into a d3-hypertree model. Shared by the test harness
// (test/harness.html) and the playground (playground/index.html), so every
// configuration clicked together in the playground can be opened as a test.
//
// Data (one of):
//   gen=nTree&depth=10&childs=2   full n-ary tree (default: binary, depth 10 = 2047 nodes)
//   gen=star&n=250                one root with n children
//   gen=path&n=50                 a path of n nodes
//   gen=deepStar&arms=4&depth=30  root with arms, each a path
//   gen=data                      small inline tree via loaders.fromData
//   file=fixtures/flare.csv       loaders.fromFile (.d3.json, .csv, SKOS/TreeML .xml),
//                                 relative to the test folder
//   lang=fixtures/small.lang.json loaders.fromLangFile; labels from the language map
//
// Node content:
//   labels=1   deterministic label per node     labels=name  the node's own name
//   icons=1   emoji per node     iconPercent=25  only that share of the nodes gets one
//             (spread evenly in breadth-first order; default 100)
//   colors=1   color callbacks for nodes and links (by depth)
//   docColors=1  the readme example's option names (nodeColor / linkColor)
//
// Configuration (JSON, deep-merged into the model):
//   filter=off                    no culling at all: every node is visible
//   filterOpt={"cullingRadius":.9}            -> model.filter
//   layout={"rootWedge":{"angle":3.14}}       -> model.layout
//   layoutType=spiral|buchheim|unitLines|unitVectors|berge
//   layers={"cells":{"invisible":false}}      -> model.geometry.layerOptions; per-node function
//                                 options accept "depth" (palette) or a constant, e.g.
//                                 {"nodes":{"fill":"#e53935","r":0.02}}
//   geometry={"linkCurvature":"+"}            -> model.geometry (options for all layers)
//   interaction={"wheelFactor":1.5}           -> model.interaction
//   model={"iconmap":{}}                      -> the whole model (any documented option)
//   preset=otolModel              start from hyt.presets[preset]() instead of the defaults
//   weight=uniform                every node weighs 1 in the culling filter
//   theme=dark                    (applied by the page, not part of the model)
(function () {
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
    const merge = (a, b) => {
        for (const [k, v] of Object.entries(b || {}))
            if (v !== undefined)
                a[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v
        return a
    }

    const inlineData = {
        name: 'root', children: [
            { name: 'a', children: [{ name: 'a1' }, { name: 'a2' }] },
            { name: 'b', children: [{ name: 'b1' }, { name: 'b2' }, { name: 'b3' }] },
            { name: 'c' },
        ],
    }

    // Many layer options are functions of the node (fill: n => color). URL values
    // are converted: "depth" -> palette color by depth, any other string or number
    // -> constant. Which options are functions is defined by the layers' code.
    const palette = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1']
    const FUNCTION_OPTIONS = {
        '*':         ['fill', 'stroke', 'strokeWidth', 'color'],
        'nodes':       ['r'],
        'center-node': ['r'],
        'stem-arc':    ['width'],
    }
    const toFunction = v => typeof v === 'function' ? v
        : v === 'depth' ? (n => palette[(n.depth || 0) % palette.length])
        : () => v
    function layerOptions(layers) {
        if (!layers) return undefined
        for (const [name, opts] of Object.entries(layers))
            for (const key of Object.keys(opts))
                if (FUNCTION_OPTIONS['*'].includes(key) || (FUNCTION_OPTIONS[name] || []).includes(key))
                    opts[key] = toFunction(opts[key])
        return layers
    }
    //   geometry={"linkCurvature":"+","nodeRadius":0.012,"linkWidth":0.004,
    //             "captionFont":"8px Roboto","captionHeight":0.05}
    function geometryOptions(g) {
        if (!g) return undefined
        if (typeof g.nodeRadius === 'number') { const r = g.nodeRadius; g.nodeRadius = (ud, n) => r }
        if (typeof g.linkWidth === 'number') { const w = g.linkWidth; g.linkWidth = n => w }
        return g
    }

    /**
     * @param q          URLSearchParams
     * @param options    { fileBase: prefix for file/lang paths (default ''),
     *                     interaction: callbacks to install (e.g. event recorders) }
     */
    function buildModel(q, options = {}) {
        const fileBase = options.fileBase || ''
        const num = (k, d) => Number(q.get(k) || d)
        const json = k => q.get(k) ? JSON.parse(q.get(k)) : undefined

        const gen = q.get('gen') || 'nTree'
        const loaders = {
            nTree:    ok => hyt.nTree(ok, num('depth', 10), num('childs', 2)),
            star:     hyt.star_(num('n', 250)),
            path:     hyt.path_(num('n', 50)),
            deepStar: ok => hyt.deepStar(ok, num('arms', 4), num('depth', 30)),
            data:     hyt.fromData(inlineData),
        }
        const dataloader = q.get('file') ? hyt.fromFile(fileBase + q.get('file')) : loaders[gen]
        if (!dataloader) throw new Error('unknown generator ' + gen)
        const callbacks = options.interaction || {}

        let model
        if (q.get('preset')) {
            model = hyt.presets[q.get('preset')]()
            model.dataloader = dataloader
            if (!q.get('lang')) model.langloader = ok => ok({})   // presets may point to app files
            model.interaction = Object.assign({}, model.interaction, callbacks)
        } else {
            model = { dataloader, interaction: Object.assign({}, callbacks) }
        }

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
        if (q.get('icons') === '1') {
            const emojis = ['🌳', '🐟', '🐦', '🦎', '🐸', '🐭', '🦋', '🌸']
            // iconPercent: node i gets an icon when the running share crosses an integer,
            // so p% of the nodes get one, evenly spread and the same on every run
            const p = Math.max(0, Math.min(100, num('iconPercent', 100))) / 100
            let i = 0, k = 0
            model.dataInitBFS = (ht, n) => {
                const has = Math.floor((i + 1) * p) > Math.floor(i * p)
                i++
                n.precalc.icon = has ? emojis[(k++) % emojis.length] : undefined
            }
        }
        if (q.get('filter') === 'off') {
            // weightFilter.magic can't be configured: resetData() sets it to 20 and the
            // filter then adapts it until the visible node count is within rangeNodes.
            // Demanding an unreachable minimum makes it grow until nothing is culled.
            merge(model, { filter: {
                cullingRadius: 1,
                weightFilter: {
                    alpha: 2,
                    rangeCullingWeight: { min: 0, max: 1e300 },
                    rangeNodes: { min: 1e9, max: 1e10 },
                },
            } })
        }
        if (q.get('weight') === 'uniform') merge(model, { filter: { weightFilter: { weight: n => 1 } } })
        merge(model, json('model'))
        merge(model, { filter: json('filterOpt') })
        merge(model, { layout: json('layout') })
        merge(model, { interaction: json('interaction') })
        merge(model, { geometry: geometryOptions(json('geometry')) })
        merge(model, { geometry: { layerOptions: layerOptions(json('layers')) } })
        if (q.get('layoutType')) {
            const types = {
                berge: hyt.layouts.layoutBergé, spiral: hyt.layouts.layoutSpiral,
                buchheim: hyt.layouts.layoutBuchheim, unitLines: hyt.layouts.layoutUnitLines,
                unitVectors: hyt.layouts.layoutUnitVectors,
            }
            merge(model, { layout: { type: types[q.get('layoutType')] } })
        }
        if (q.get('colors') === '1') {
            const palette = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1']
            // option names as the code reads them (the readme example's nodeColor/linkColor don't exist)
            merge(model, { geometry: { layerOptions: {
                'nodes':     { fill:   n => palette[n.depth % palette.length] },
                'link-arcs': { stroke: n => palette[n.depth % palette.length] },
            } } })
        }
        if (q.get('docColors') === '1') {
            merge(model, { geometry: { layerOptions: {
                'nodes':     { nodeColor: n => '#e53935' },
                'link-arcs': { linkColor: n => '#e53935' },
            } } })
        }
        return model
    }

    window.hypertreeConfig = { buildModel, merge }
})()
