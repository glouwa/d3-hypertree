// d3-hypertree playground: every option of the library in a UI.
//
// The state is kept as URL parameters in the same format as the test harness
// (see ../test/config.js), so a configuration can be shared as a link and opened
// as a test. Defaults are read from the library at startup (presets.modelBase()
// and a hidden probe instance for the layer set), not hard-coded here.
(function () {
    'use strict'
    const π = Math.PI
    const deg = r => Math.round(r * 180 / π)
    const rad = d => d * π / 180
    const $ = sel => document.querySelector(sel)
    const el = (tag, attrs = {}, ...children) => {
        const e = document.createElement(tag)
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') e.className = v
            else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
            else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v)
        }
        for (const c of children) if (c !== null && c !== undefined) e.append(c)
        return e
    }

    // ---------------------------------------------------------------------------------
    // defaults from the library

    const base = hyt.presets.modelBase()
    const DEFAULTS = {
        source: 'gen:nTree', depth: 10, childs: 2, n: 250, arms: 4, armDepth: 30,
        lang: false, labels: true, iconPercent: 10, preset: '', theme: 'light',
        // geometry: options that apply to several layers
        linkCurvature: base.geometry.linkCurvature,
        captionFontPx: parseFloat(base.geometry.captionFont),
        captionHeight: base.geometry.captionHeight,
        nodeRadius: null,     // null: library default (a function of the node)
        linkWidth: null,
        layoutType: 'berge',
        wedgeOrientation: deg(base.layout.rootWedge.orientation),
        wedgeAngle: deg(base.layout.rootWedge.angle),
        filterOff: false, weightUniform: false,
        cullingRadius: base.filter.cullingRadius,
        rangeNodesMin: base.filter.weightFilter.rangeNodes.min,
        rangeNodesMax: base.filter.weightFilter.rangeNodes.max,
        rcwMin: base.filter.weightFilter.rangeCullingWeight.min,
        rcwMax: base.filter.weightFilter.rangeCullingWeight.max,
        focusExtension: base.filter.focusExtension,
        maxFocusRadius: base.filter.maxFocusRadius,
        maxlabels: base.filter.maxlabels,
        λmin: base.interaction.λbounds[0],
        λmax: base.interaction.λbounds[1],
        wheelFactor: base.interaction.wheelFactor,
        holdDuration: base.interaction.holdDuration || 500,
        mouseRadius: base.interaction.mouseRadius,
        hover: 'pointer', selection: 'multi', maxSelections: 10,   // interaction strategies
        // overrides: name -> { invisible, hideOnDrag, <layer options> }. The emoji layer is the
        // slowest one: off by default here (generating icons is a one-off, see iconPercent).
        layers: { emojis: { invisible: true } },
        click: 'goto',        // playground only: what a click on a node does
    }
    const PRESETS = Object.keys(hyt.presets).filter(p => p !== 'modelBase')
    const SOURCES = [
        ['gen:nTree', 'Generator: n-ary tree'],
        ['gen:star', 'Generator: star'],
        ['gen:path', 'Generator: path'],
        ['gen:deepStar', 'Generator: deep star'],
        ['gen:data', 'fromData: small inline tree'],
        ['file:fixtures/small.d3.json', 'File: small.d3.json (d3 hierarchy)'],
        ['file:fixtures/flare.csv', 'File: flare.csv (CSV, dot paths)'],
        ['file:fixtures/animals.skos.xml', 'File: animals.skos.xml (SKOS)'],
        ['file:fixtures/primates.treeml.xml', 'File: primates.treeml.xml (TreeML)'],
    ]

    // Options each layer reads (from the default layer set in preset-layers.ts).
    // color: function of the node -> default / constant / by depth
    // number: constant (function options get a constant function)
    // curvature: '-', '+', '0', 'l'; default = geometry.linkCurvature
    const LAYER_OPTIONS = {
        'cells':       [['hover', 'bool'], ['selection', 'bool'], ['fill', 'color'], ['stroke', 'color'], ['strokeWidth', 'number', 0, 0.02, 0.0005]],
        'center-node': [['fill', 'color'], ['stroke', 'color'], ['strokeWidth', 'number', 0, 0.02, 0.0005], ['r', 'number', 0.01, 0.3, 0.005]],
        'path-arcs':   [['curvature', 'curvature'], ['stroke', 'color'], ['strokeWidth', 'number', 0.001, 0.05, 0.0005]],
        'link-arcs':   [['curvature', 'curvature'], ['hover', 'choice', ['path', 'node', 'none']], ['selection', 'choice', ['path', 'node', 'none']], ['stroke', 'color'], ['strokeWidth', 'number', 0.001, 0.05, 0.0005]],
        'stem-arc':    [['curvature', 'curvature'], ['width', 'number', 0.001, 0.05, 0.0005]],
        'nodes':       [['show', 'choice', ['leaves', 'all']], ['hover', 'choice', ['path', 'node', 'none']], ['selection', 'choice', ['path', 'node', 'none']], ['fill', 'color'], ['stroke', 'color'], ['strokeWidth', 'number', 0, 0.02, 0.0005], ['r', 'number', 0.002, 0.06, 0.001]],
        'images':      [['width', 'number', 0.01, 0.3, 0.005], ['height', 'number', 0.01, 0.3, 0.005]],
        'emojis':      [['shrinkAtRim', 'bool'], ['color', 'color'], ['background', 'bool']],
        'labels':      [['shrinkAtRim', 'bool'], ['color', 'color'], ['background', 'bool']],
        'labels-force':[['shrinkAtRim', 'bool'], ['background', 'bool']],
    }
    // what a layer shows, when its name doesn't say it
    const LAYER_ALIASES = { 'cells': 'voronoi', 'λ': 'zoom', '(0,0)': 'origin' }
    const LAYER_NOTES = {
        'cells': 'Voronoi cells of the visible nodes: hover and selection highlight a cell (options hover, selection; the events and callbacks fire either way). The cells are always computed (hover and click find the node under the pointer with them); this layer only draws them.',
        'culling-r': 'circle at filter.cullingRadius',
        'mouse-r': 'circle at interaction.mouseRadius',
        'focus-r': 'circle at the filter\'s focus radius',
        'labels-r-𝐖': 'circle at filter.wikiRadius',
        'λ': 'circle at the zoom λ (pinch center while pinching)',
        '(0,0)': 'the origin',
        'symbols': 'root and start node symbols',
        'emojis': 'the icons (share of nodes set in Initialization › Node data); off by default, the slowest layer to render',
        'images': 'needs n.precalc.imageHref (not set by the playground data)',
        'traces': 'touch traces while touching',
        'interaction-2': 'active interaction layer: mouse, touch, wheel',
    }

    // layer set and per-layer defaults from a hidden probe instance
    let LAYER_DEFAULTS = {}
    function probeLayers() {
        return new Promise(ok => {
            const div = el('div', { style: 'position:absolute;left:-10000px;width:300px;height:300px' })
            document.body.append(div)
            const probe = new hyt.Hypertree({ parent: div }, { dataloader: hyt.fromData({ name: 'r', children: [{ name: 'a' }] }) })
            probe.initPromise.then(() => {
                const ls = probe.unitdisk.layerStack
                for (const [name, l] of Object.entries(ls.layers))
                    LAYER_DEFAULTS[name] = { invisible: !!l.args.invisible, hideOnDrag: !!l.args.hideOnDrag }
                div.remove()
                ok()
            })
        })
    }

    // ---------------------------------------------------------------------------------
    // state <-> URL parameters (harness format)

    let cfg = JSON.parse(JSON.stringify(DEFAULTS))

    function toParams(c, forHarness = false) {
        const p = new URLSearchParams()
        const [kind, value] = c.source.split(':')
        if (kind === 'file') p.set('file', value)
        else {
            p.set('gen', value)
            if (value === 'nTree') { p.set('depth', c.depth); p.set('childs', c.childs) }
            if (value === 'star' || value === 'path') p.set('n', c.n)
            if (value === 'deepStar') { p.set('arms', c.arms); p.set('depth', c.armDepth) }
        }
        if (c.lang && c.source === 'file:fixtures/small.d3.json') p.set('lang', 'fixtures/small.lang.json')
        // generated trees have no names: number them; data with names shows its names
        if (c.labels && !c.lang) p.set('labels', kind === 'gen' && value !== 'data' ? '1' : 'name')
        if (c.iconPercent > 0) { p.set('icons', '1'); if (c.iconPercent !== 100) p.set('iconPercent', c.iconPercent) }
        if (c.preset) p.set('preset', c.preset)
        if (c.theme !== 'light') p.set('theme', c.theme)
        if (c.layoutType !== 'berge') p.set('layoutType', c.layoutType)
        if (c.wedgeOrientation !== DEFAULTS.wedgeOrientation || c.wedgeAngle !== DEFAULTS.wedgeAngle)
            p.set('layout', JSON.stringify({ rootWedge: { orientation: rad(c.wedgeOrientation), angle: rad(c.wedgeAngle) } }))
        if (c.filterOff) p.set('filter', 'off')
        if (c.weightUniform) p.set('weight', 'uniform')

        const f = {}, wf = {}
        if (c.cullingRadius !== DEFAULTS.cullingRadius) f.cullingRadius = c.cullingRadius
        if (c.focusExtension !== DEFAULTS.focusExtension) f.focusExtension = c.focusExtension
        if (c.maxFocusRadius !== DEFAULTS.maxFocusRadius) f.maxFocusRadius = c.maxFocusRadius
        if (c.maxlabels !== DEFAULTS.maxlabels) f.maxlabels = c.maxlabels
        if (c.rangeNodesMin !== DEFAULTS.rangeNodesMin || c.rangeNodesMax !== DEFAULTS.rangeNodesMax)
            wf.rangeNodes = { min: c.rangeNodesMin, max: c.rangeNodesMax }
        if (c.rcwMin !== DEFAULTS.rcwMin || c.rcwMax !== DEFAULTS.rcwMax)
            wf.rangeCullingWeight = { min: c.rcwMin, max: c.rcwMax }
        if (Object.keys(wf).length) f.weightFilter = wf
        if (Object.keys(f).length && !c.filterOff) p.set('filterOpt', JSON.stringify(f))

        const i = {}
        if (c.λmin !== DEFAULTS.λmin || c.λmax !== DEFAULTS.λmax) i.λbounds = [c.λmin, c.λmax]
        if (c.wheelFactor !== DEFAULTS.wheelFactor) i.wheelFactor = c.wheelFactor
        if (c.holdDuration !== DEFAULTS.holdDuration) i.holdDuration = c.holdDuration
        if (c.mouseRadius !== DEFAULTS.mouseRadius) i.mouseRadius = c.mouseRadius
        for (const k of ['hover', 'selection', 'maxSelections']) if (c[k] !== DEFAULTS[k]) i[k] = c[k]
        if (Object.keys(i).length) p.set('interaction', JSON.stringify(i))

        const g = {}
        if (c.linkCurvature !== DEFAULTS.linkCurvature) g.linkCurvature = c.linkCurvature
        if (c.captionFontPx !== DEFAULTS.captionFontPx) g.captionFont = `${c.captionFontPx}px Roboto`
        if (c.captionHeight !== DEFAULTS.captionHeight) g.captionHeight = c.captionHeight
        if (c.nodeRadius !== null) g.nodeRadius = c.nodeRadius
        if (c.linkWidth !== null) g.linkWidth = c.linkWidth
        if (Object.keys(g).length) p.set('geometry', JSON.stringify(g))

        // also written when empty but different from the playground defaults (emojis on: layers={})
        if (Object.keys(c.layers).length || JSON.stringify(c.layers) !== JSON.stringify(DEFAULTS.layers)) p.set('layers', JSON.stringify(c.layers))

        if (!forHarness && c.click !== DEFAULTS.click) p.set('click', c.click)
        return p
    }

    function fromParams(p) {
        const c = JSON.parse(JSON.stringify(DEFAULTS))
        const num = (k, d) => (p.has(k) ? Number(p.get(k)) : d)
        if (p.get('file')) c.source = 'file:' + p.get('file')
        else if (p.get('gen')) c.source = 'gen:' + p.get('gen')
        c.depth = num('depth', c.depth); c.childs = num('childs', c.childs); c.n = num('n', c.n)
        c.arms = num('arms', c.arms); if (c.source === 'gen:deepStar') { c.armDepth = c.depth; c.depth = DEFAULTS.depth }
        c.lang = p.has('lang')
        c.labels = p.get('labels') === '1' || p.get('labels') === 'name'
        c.preset = p.get('preset') || ''
        c.theme = p.get('theme') || 'light'
        c.layoutType = p.get('layoutType') || 'berge'
        if (p.get('layout')) {
            const w = JSON.parse(p.get('layout')).rootWedge || {}
            if (w.orientation !== undefined) c.wedgeOrientation = deg(w.orientation)
            if (w.angle !== undefined) c.wedgeAngle = deg(w.angle)
        }
        c.filterOff = p.get('filter') === 'off'
        c.weightUniform = p.get('weight') === 'uniform'
        if (p.get('filterOpt')) {
            const f = JSON.parse(p.get('filterOpt')), wf = f.weightFilter || {}
            for (const k of ['cullingRadius', 'focusExtension', 'maxFocusRadius', 'maxlabels']) if (f[k] !== undefined) c[k] = f[k]
            if (wf.rangeNodes) { c.rangeNodesMin = wf.rangeNodes.min; c.rangeNodesMax = wf.rangeNodes.max }
            if (wf.rangeCullingWeight) { c.rcwMin = wf.rangeCullingWeight.min; c.rcwMax = wf.rangeCullingWeight.max }
        }
        if (p.get('interaction')) {
            const i = JSON.parse(p.get('interaction'))
            if (i.λbounds) { c.λmin = i.λbounds[0]; c.λmax = i.λbounds[1] }
            for (const k of ['wheelFactor', 'holdDuration', 'mouseRadius', 'hover', 'selection', 'maxSelections']) if (i[k] !== undefined) c[k] = i[k]
        }
        if (p.get('geometry')) {
            const g = JSON.parse(p.get('geometry'))
            if (g.linkCurvature) c.linkCurvature = g.linkCurvature
            if (g.captionFont) c.captionFontPx = parseFloat(g.captionFont)
            if (g.captionHeight !== undefined) c.captionHeight = g.captionHeight
            if (typeof g.nodeRadius === 'number') c.nodeRadius = g.nodeRadius
            if (typeof g.linkWidth === 'number') c.linkWidth = g.linkWidth
        }
        if (p.get('layers')) {
            const l = JSON.parse(p.get('layers'))
            c.layers = {}   // the link defines all layer overrides
            for (const [name, o] of Object.entries(l)) if (Object.keys(o).length) c.layers[name] = o
        }
        if (p.get('colors') === '1') { // older links: color callbacks by depth
            c.layers.nodes = Object.assign({}, c.layers.nodes, { fill: 'depth' })
            c.layers['link-arcs'] = Object.assign({}, c.layers['link-arcs'], { stroke: 'depth' })
        }
        // icons: share of the nodes with an icon; a link without icons has none
        c.iconPercent = p.get('icons') === '1' ? num('iconPercent', 100) : ([...p.keys()].length ? 0 : DEFAULTS.iconPercent)
        c.click = p.get('click') || DEFAULTS.click
        // a URL without any parameter shows the defaults with labels
        if (![...p.keys()].length) c.labels = DEFAULTS.labels
        return c
    }

    // ---------------------------------------------------------------------------------
    // the component

    let ht = null
    let updateTimes = []
    const log = []

    const nodeName = n => n ? (n.precalc && n.precalc.label) || (n.data && (n.data.name || n.data.id)) || `#${n.mergeId}` : '—'
    function addLog(type, text) {
        log.unshift({ t: new Date().toLocaleTimeString(), type, text })
        log.length = Math.min(log.length, 200)
        renderLog()
    }
    const callbacks = {
        onNodeClick: (n, m, layer) => {
            addLog('onNodeClick', nodeName(n))
            if (!n) return
            if (cfg.click === 'goto') ht.api.goto({ re: -n.layout.z.re, im: -n.layout.z.im }, null).then(() => ht.drawDetailFrame())
            if (cfg.click === 'select') ht.api.toggleSelection(n)
            if (cfg.click === 'ripple') layer.ripple(n, m, () => {})
        },
        onNodeHold:         n => addLog('onNodeHold', nodeName(n)),
        onNodeHover:        n => addLog('onNodeHover', nodeName(n)),
        onNodeSelect:       (n, s) => addLog('onNodeSelect', `${nodeName(n)} ${s ? 'selected' : 'deselected'}`),
        onCenterNodeChange: n => addLog('onCenterNodeChange', nodeName(n)),
    }

    function rebuild() {
        const params = toParams(cfg)
        history.replaceState(null, '', '?' + params.toString())
        $('#theme').href = `../dist/d3-hypertree-${cfg.theme}.css`
        document.body.classList.toggle('dark', cfg.theme === 'dark')

        const tree = $('#tree')
        tree.innerHTML = ''
        updateTimes = []
        let model
        try {
            model = hypertreeConfig.buildModel(params, { fileBase: '../test/', interaction: callbacks })
        } catch (e) {
            addLog('error', e.message)
            return
        }
        ht = new hyt.Hypertree({ parent: tree }, model)
        window.ht = ht // for the console
        ht.initPromise.then(() => {
            const u = ht.update, t = u.transformation
            u.transformation = (...a) => {
                const t0 = performance.now(); const r = t.apply(u, a)
                updateTimes.push(performance.now() - t0); if (updateTimes.length > 30) updateTimes.shift()
                return r
            }
        })
        refreshControls()
    }
    let timer = null
    const scheduleRebuild = () => { clearTimeout(timer); timer = setTimeout(rebuild, 200) }

    // ---------------------------------------------------------------------------------
    // controls

    const controls = []   // { el, refresh() }
    const get = k => cfg[k]
    const set = (k, v) => { cfg[k] = v; scheduleRebuild() }

    function section(title, keys, open = false) {
        const badge = el('span', { class: 'badge' })
        const d = el('details', open ? { open: true } : {}, el('summary', {}, title, badge))
        const g = el('div', { class: 'group' })
        d.append(g)
        $('#controls').append(d)
        controls.push({ refresh: () => {
            const n = typeof keys === 'function' ? keys() : keys.filter(k => JSON.stringify(cfg[k]) !== JSON.stringify(DEFAULTS[k])).length
            badge.textContent = n ? `${n} changed` : ''
        } })
        return g
    }
    function row(group, label, input, out, when) {
        const r = el('div', { class: out ? 'row' : 'row two' }, el('label', {}, label), input, out || null)
        group.append(r)
        if (when) controls.push({ refresh: () => { r.style.display = when() ? '' : 'none' } })
        return r
    }
    function select(group, label, key, options, when) {
        const s = el('select', { onchange: e => set(key, e.target.value) },
            ...options.map(([v, t]) => el('option', { value: v }, t)))
        controls.push({ refresh: () => { s.value = get(key) } })
        return row(group, label, s, null, when)
    }
    function range(group, label, key, min, max, step, when, fmt = v => v) {
        const out = el('output')
        const r = el('input', { type: 'range', min, max, step, oninput: e => { out.textContent = fmt(+e.target.value); set(key, +e.target.value) } })
        controls.push({ refresh: () => { r.value = get(key); out.textContent = fmt(get(key)) } })
        return row(group, label, r, out, when)
    }
    function number(group, label, key, min, max, step, when) {
        const i = el('input', { type: 'number', min, max, step, onchange: e => set(key, +e.target.value) })
        controls.push({ refresh: () => { i.value = get(key) } })
        return row(group, label, i, null, when)
    }
    function check(group, label, key, when, note) {
        const c = el('input', { type: 'checkbox', onchange: e => set(key, e.target.checked) })
        const l = el('label', { class: 'check' }, c, label)
        const wrap = el('div', {}, l, note ? el('p', { class: 'hint' }, note) : null)
        group.append(wrap)
        controls.push({ refresh: () => { c.checked = !!get(key); if (when) wrap.style.display = when() ? '' : 'none' } })
    }
    function hint(group, text) { group.append(el('p', { class: 'hint' }, text)) }

    // a number that is either the library default (null) or a custom constant
    function optionalNumber(group, label, key, min, max, step, start) {
        const on = el('input', { type: 'checkbox', title: 'custom value' })
        const out = el('output')
        const r = el('input', { type: 'range', min, max, step })
        on.addEventListener('change', () => set(key, on.checked ? (+r.value || start) : null))
        r.addEventListener('input', () => { out.textContent = r.value; if (on.checked) set(key, +r.value) })
        const wrap = el('div', { class: 'check' }, on, r)
        controls.push({ refresh: () => {
            const v = get(key)
            on.checked = v !== null; r.disabled = v === null
            r.value = v === null ? start : v; out.textContent = v === null ? 'default' : v
        } })
        return row(group, label, wrap, out)
    }

    // one option of one layer, stored in cfg.layers[name][key]
    function layerOptionControl(name, key, type, min, max, step, setLayer) {
        const cur = () => (cfg.layers[name] || {})[key]
        const label = el('label', {}, key)
        let input
        if (type === 'color') {
            const mode = el('select', {}, el('option', { value: '' }, 'default'), el('option', { value: 'const' }, 'color'), el('option', { value: 'depth' }, 'by depth'))
            const color = el('input', { type: 'color', value: '#1e88e5' })
            const apply = () => setLayer(key, mode.value === '' ? undefined : mode.value === 'depth' ? 'depth' : color.value)
            mode.addEventListener('change', apply)
            color.addEventListener('input', () => { if (mode.value === 'const') apply() })
            controls.push({ refresh: () => {
                const v = cur()
                mode.value = v === undefined ? '' : v === 'depth' ? 'depth' : 'const'
                if (v && v !== 'depth') color.value = v
                color.style.visibility = mode.value === 'const' ? '' : 'hidden'
            } })
            input = el('div', { class: 'check' }, mode, color)
        } else if (type === 'number') {
            const on = el('input', { type: 'checkbox', title: 'custom value' })
            const out = el('output')
            const r = el('input', { type: 'range', min, max, step })
            const start = +(min + (max - min) * 0.25).toFixed(4)   // a sensible first custom value
            r.value = start
            on.addEventListener('change', () => setLayer(key, on.checked ? +r.value : undefined))
            r.addEventListener('input', () => { out.textContent = r.value; if (on.checked) setLayer(key, +r.value) })
            controls.push({ refresh: () => {
                const v = cur()
                on.checked = v !== undefined; r.disabled = v === undefined
                if (v !== undefined) r.value = v
                out.textContent = v === undefined ? 'default' : v
            } })
            input = el('div', { class: 'check' }, on, r, out)
        } else if (type === 'curvature') {
            const sel = el('select', { onchange: e => setLayer(key, e.target.value || undefined) },
                el('option', { value: '' }, 'default (geometry)'), el('option', { value: '-' }, '−'), el('option', { value: '+' }, '+'), el('option', { value: '0' }, '0 (straight, path)'), el('option', { value: 'l' }, 'l (straight, line)'))
            controls.push({ refresh: () => { sel.value = cur() || '' } })
            input = sel
        } else if (type === 'bool') {
            const sel = el('select', { onchange: e => setLayer(key, e.target.value === '' ? undefined : e.target.value === 'on') },
                el('option', { value: '' }, 'default'), el('option', { value: 'on' }, 'on'), el('option', { value: 'off' }, 'off'))
            controls.push({ refresh: () => { const v = cur(); sel.value = v === undefined ? '' : v ? 'on' : 'off' } })
            input = sel
        } else if (type === 'choice') {   // min = list of values
            const sel = el('select', { onchange: e => setLayer(key, e.target.value || undefined) },
                el('option', { value: '' }, 'default'), ...min.map(v => el('option', { value: v }, v)))
            controls.push({ refresh: () => { sel.value = cur() || '' } })
            input = sel
        }
        return el('div', { class: 'row two' }, label, input)
    }

    function buildControls() {
        const isGen = g => () => cfg.source === 'gen:' + g

        let g = section('Data', ['source', 'depth', 'childs', 'n', 'arms', 'armDepth', 'preset'], true)
        select(g, 'Source', 'source', SOURCES)
        number(g, 'Depth', 'depth', 1, 16, 1, isGen('nTree'))
        number(g, 'Children', 'childs', 1, 20, 1, isGen('nTree'))
        number(g, 'Nodes', 'n', 2, 2000, 1, () => cfg.source === 'gen:star' || cfg.source === 'gen:path')
        number(g, 'Arms', 'arms', 1, 20, 1, isGen('deepStar'))
        number(g, 'Arm depth', 'armDepth', 1, 200, 1, isGen('deepStar'))
        select(g, 'Preset', 'preset', [['', 'none (library defaults)'], ...PRESETS.map(p => [p, p])])
        hint(g, 'Deep trees (e.g. deep star with arm depth > 40) show the known deep-tree bug when navigating far down.')

        // What the library does when a model is set, in this order (hypertree.ts: setModel,
        // initData, findInitλ_), with the option that controls each step and its current value.
        g = section('Initialization', ['lang', 'labels', 'weightUniform', 'iconPercent'])
        hint(g, 'What happens when the tree is set up, in this order. Steps with an option can be configured by the application.')
        const steps = el('ol', { class: 'init-steps' })
        g.append(steps)
        const step = (title, option, text, current) => {
            const now = el('p', { class: 'now' })
            const li = el('li', {}, el('div', { class: 'step-title' }, title, option ? el('code', {}, option) : null), el('p', { class: 'hint' }, text), now)
            steps.append(li)
            if (current) controls.push({ refresh: () => { now.textContent = 'here: ' + current() } })
            else now.remove()
            return li
        }
        const gen = () => cfg.source.split(':')
        step('Load the tree', 'dataloader',
            'Loads the data and calls back with a d3 hierarchy (generators, fromData, fromFile for JSON, CSV, SKOS, TreeML).',
            () => { const [k, v] = gen()
                return k === 'file' ? `hyt.fromFile('${v}')`
                    : v === 'nTree' ? `hyt.nTree(depth ${cfg.depth}, ${cfg.childs} children)`
                    : v === 'star' || v === 'path' ? `hyt.${v}_(${cfg.n})`
                    : v === 'deepStar' ? `hyt.deepStar(${cfg.arms} arms, depth ${cfg.armDepth})`
                    : 'hyt.fromData(small inline tree)' })
        const langStep = step('Load the language map', 'langloader',
            'Loads a map from node names to display texts, used by langInitBFS. Runs in parallel to the data loader.',
            () => cfg.lang ? "hyt.fromLangFile('fixtures/small.lang.json')" : 'none (empty map)')
        check(langStep, 'Language file small.lang.json', 'lang', () => cfg.source === 'file:fixtures/small.d3.json')
        step('Set up the nodes', null,
            'Internal: ids, empty precalc, the root wedge from layout.rootWedge (see Layout).')
        const weightStep = step('Sum the weights', 'layout.weight, filter.weightFilter.weight',
            'Weights per node, summed over each subtree: layoutWeight shares the space among children, cullingWeight decides what the filter hides.',
            () => 'layout: leaves 1; filter: ' + (cfg.weightUniform ? 'every node 1' : 'leaves 1, inner nodes height²'))
        check(weightStep, 'Uniform filter weights', 'weightUniform', () => !cfg.filterOff)
        const dataStep = step('Node data', 'dataInitBFS',
            'Called for every node: icon (emoji), imageHref, clickable, cell. Default: clickable and cell true, no icon or image.',
            () => cfg.iconPercent === 0 ? 'no icons'
                : `icon: an emoji for ${cfg.iconPercent === 100 ? 'every node' : cfg.iconPercent + ' % of the nodes, evenly spread'} (shown by the emojis layer, off by default)`)
        range(dataStep, 'Nodes with icon', 'iconPercent', 0, 100, 5, null, v => v + ' %')
        const labelStep = step('Node texts', 'langInitBFS',
            'Called for every node after both loaders: label (and wiki). Called again when the language changes.',
            () => cfg.lang ? 'label from the language map'
                : !cfg.labels ? 'none (library default: no labels)'
                : gen()[0] === 'gen' && gen()[1] !== 'data' ? 'label: Node 0, Node 1, … (generated trees have no names)' : 'label: the node name')
        check(labelStep, 'Labels', 'labels', () => !cfg.lang)
        step('Measure the texts', null,
            'Internal: width of every label and icon in geometry.captionFont, for placing captions.')
        step('Find the start zoom', 'layout.initSize, interaction.λbounds',
            'Internal: grows λ until the outermost visible node reaches layout.initSize of the radius, then limits it to λbounds.',
            () => `initSize ${base.layout.initSize}, λbounds [${+cfg.λmin.toFixed(3)}, ${+cfg.λmax.toFixed(3)}]`)
        hint(g, 'A preset (Data) may replace these callbacks with its own.')

        g = section('Layout', ['layoutType', 'wedgeOrientation', 'wedgeAngle'])
        select(g, 'Type', 'layoutType', [['berge', 'Bergé (default, supports culling)'], ['spiral', 'spiral'], ['buchheim', 'Buchheim'], ['unitLines', 'unit lines'], ['unitVectors', 'unit vectors']])
        range(g, 'Root wedge dir.', 'wedgeOrientation', 0, 360, 1, null, v => `${v}°`)
        range(g, 'Root wedge angle', 'wedgeAngle', 10, 360, 1, null, v => `${v}°`)

        g = section('Filter', ['filterOff', 'cullingRadius', 'rangeNodesMin', 'rangeNodesMax', 'rcwMin', 'rcwMax', 'focusExtension', 'maxFocusRadius', 'maxlabels'])
        check(g, 'Filter off (every node visible)', 'filterOff', null, 'Fine for small trees; large trees get slow.')
        const on = () => !cfg.filterOff
        range(g, 'cullingRadius', 'cullingRadius', 0.5, 1, 0.01, on)
        number(g, 'rangeNodes min', 'rangeNodesMin', 0, 5000, 10, on)
        number(g, 'rangeNodes max', 'rangeNodesMax', 0, 5000, 10, on)
        number(g, 'cullingWeight min', 'rcwMin', 0, 10000, 1, on)
        number(g, 'cullingWeight max', 'rcwMax', 0, 10000, 10, on)
        range(g, 'focusExtension', 'focusExtension', 0.5, 4, 0.05, on)
        range(g, 'maxFocusRadius', 'maxFocusRadius', 0.1, 0.99, 0.01, on)
        number(g, 'maxlabels', 'maxlabels', 0, 200, 1, on)
        hint(g, 'The filter adapts its weight threshold a little on every update, so the visible set settles over a few frames after loading or interacting.')

        g = section('Geometry', ['linkCurvature', 'captionFontPx', 'captionHeight', 'nodeRadius', 'linkWidth', 'theme'])
        hint(g, 'Options that apply to several layers (model.geometry). Options of a single layer are in the layer list below (▸).')
        select(g, 'linkCurvature', 'linkCurvature', [['-', '− (default, hyperbolic geodesic)'], ['+', '+ (arc to the other side)'], ['0', '0 (straight, SVG path)'], ['l', 'l (straight, SVG line)']])
        hint(g, 'Default curvature of link-arcs and path-arcs; a layer can override it. 0 and l look the same; l is a little faster to draw.')
        range(g, 'caption font', 'captionFontPx', 3, 16, 0.5, null, v => `${v}px`)
        range(g, 'captionHeight', 'captionHeight', 0.01, 0.12, 0.005)
        optionalNumber(g, 'nodeRadius', 'nodeRadius', 0.002, 0.05, 0.001, 0.01)
        optionalNumber(g, 'linkWidth', 'linkWidth', 0.0005, 0.03, 0.0005, 0.005)
        hint(g, 'nodeRadius, nodeScale, linkWidth and nodeFilter are functions of the node by default; here you can replace nodeRadius and linkWidth by a constant.')
        select(g, 'Theme (CSS)', 'theme', [['light', 'light'], ['dark', 'dark']])

        // changed = different from the playground defaults (which hide the emoji layer)
        const layerChanged = name => JSON.stringify(cfg.layers[name] || {}) !== JSON.stringify(DEFAULTS.layers[name] || {})
        g = section('Layers', () => Object.keys(Object.assign({}, DEFAULTS.layers, cfg.layers)).filter(layerChanged).length)
        const table = el('table', { class: 'layers' },
            el('thead', {}, el('tr', {}, el('th', {}, 'layer'), el('th', {}, 'visible'), el('th', {}, 'hide on drag'))))
        const tbody = el('tbody')
        table.append(tbody)
        g.append(table)
        // Playground only: related layers form collapsible groups, shown where their first
        // layer is. A layer belongs to the first group that matches it.
        const GROUPS = [
            { name: 'Indicators', test: n => /-r(-|$)/.test(n) || n === 'λ',
              note: 'circles that show radii of the filter and the interaction, and the zoom λ' },
            { name: 'Labels', test: n => /^labels/.test(n),
              note: 'the label layers: labels, a second label set, and force-placed labels' },
        ]
        const groupOf = name => GROUPS.find(gr => gr.test(name))
        const groupRows = {}   // group name -> { rows: member rows, open }

        function addGroupRow(gr) {
            const members = Object.keys(LAYER_DEFAULTS).filter(n => groupOf(n) === gr)
            const effOf = n => Object.assign({}, LAYER_DEFAULTS[n], cfg.layers[n] || {})
            const setAll = (k, v) => {
                for (const n of members) {
                    const d = LAYER_DEFAULTS[n]
                    const o = Object.assign({}, cfg.layers[n] || {}, { [k]: v })
                    if (o[k] === d[k]) delete o[k]
                    if (Object.keys(o).length) cfg.layers[n] = o; else delete cfg.layers[n]
                }
                scheduleRebuild()
            }
            const vis = el('input', { type: 'checkbox', onchange: e => setAll('invisible', !e.target.checked) })
            const hod = el('input', { type: 'checkbox', onchange: e => setAll('hideOnDrag', e.target.checked) })
            const toggle = el('button', { class: 'link expander', title: 'group' }, '▸')
            const tr = el('tr', { class: 'layer-group expandable', 'data-group': gr.name, title: gr.note },
                el('td', {}, toggle, ' ', gr.name, el('span', { class: 'alias' }, ` ${members.length} layers`)),
                el('td', { class: 'c' }, vis), el('td', { class: 'c' }, hod))
            tbody.append(tr)
            const info = { rows: [], open: false }
            groupRows[gr.name] = info
            tr.addEventListener('click', e => {
                if (e.target.closest('input, label')) return
                info.open = !info.open
                toggle.textContent = info.open ? '▾' : '▸'
                // members show their own row; their option rows stay as they were
                for (const r of info.rows) r.tr.hidden = !info.open, r.optRow.hidden = !info.open || !r.optOpen()
            })
            controls.push({ refresh: () => {
                const visible = members.map(n => !effOf(n).invisible), hidden = members.map(n => !!effOf(n).hideOnDrag)
                vis.checked = visible.every(Boolean); vis.indeterminate = !vis.checked && visible.some(Boolean)
                hod.checked = hidden.every(Boolean); hod.indeterminate = !hod.checked && hidden.some(Boolean)
                tr.classList.toggle('changed', members.some(layerChanged))
            } })
        }

        for (const [name, d] of Object.entries(LAYER_DEFAULTS)) {
            const gr = groupOf(name)
            if (gr && !groupRows[gr.name]) addGroupRow(gr)
            const eff = () => Object.assign({}, d, cfg.layers[name] || {})
            const setLayer = (k, v) => {
                const o = Object.assign({}, cfg.layers[name] || {}, { [k]: v })
                for (const kk of Object.keys(o)) if (o[kk] === undefined || ((kk === 'invisible' || kk === 'hideOnDrag') && o[kk] === d[kk])) delete o[kk]
                if (Object.keys(o).length) cfg.layers[name] = o; else delete cfg.layers[name]
                scheduleRebuild()
            }
            const vis = el('input', { type: 'checkbox', onchange: e => setLayer('invisible', !e.target.checked) })
            const hod = el('input', { type: 'checkbox', onchange: e => setLayer('hideOnDrag', e.target.checked) })
            const opts = LAYER_OPTIONS[name] || []
            const toggle = el('button', { class: 'link expander', title: 'layer options' }, opts.length ? '▸' : '')
            const nameCell = el('td', {}, toggle, ' ', name, LAYER_ALIASES[name] ? el('span', { class: 'alias' }, ' ' + LAYER_ALIASES[name]) : null)
            const tr = el('tr', { 'data-layer': name }, nameCell, el('td', { class: 'c' }, vis), el('td', { class: 'c' }, hod))
            if (gr) { tr.classList.add('in-group'); tr.hidden = true }
            tbody.append(tr)

            const optRow = el('tr', { class: 'layer-options', 'data-layer-options': name, hidden: true })
            const optCell = el('td', { colspan: 3 })
            optRow.append(optCell)
            if (LAYER_NOTES[name]) optCell.append(el('p', { class: 'hint' }, LAYER_NOTES[name]))
            for (const [key, type, min, max, step] of opts)
                optCell.append(layerOptionControl(name, key, type, min, max, step, setLayer))
            if (gr && !(opts.length || LAYER_NOTES[name])) groupRows[gr.name].rows.push({ tr, optRow, optOpen: () => false })
            if (opts.length || LAYER_NOTES[name]) {
                tbody.append(optRow)
                let optOpen = false
                const open = () => { optOpen = !optOpen; optRow.hidden = !optOpen; toggle.textContent = optOpen ? '▾' : '▸' }
                if (gr) { optRow.classList.add('in-group'); groupRows[gr.name].rows.push({ tr, optRow, optOpen: () => optOpen }) }
                toggle.textContent = '▸'
                // the whole row toggles, except its checkboxes
                tr.classList.add('expandable')
                tr.addEventListener('click', e => { if (!e.target.closest('input, label')) open() })
            }
            controls.push({ refresh: () => {
                vis.checked = !eff().invisible; hod.checked = eff().hideOnDrag
                tr.classList.toggle('changed', layerChanged(name))
            } })
        }
        hint(g, '▸ shows the options of a layer. "hide on drag" hides a layer while dragging, pinching or animating.')

        g = section('Interaction', ['λmin', 'λmax', 'wheelFactor', 'holdDuration', 'mouseRadius', 'click', 'hover', 'selection', 'maxSelections'])
        hint(g, 'Strategies set the node state (hovered, selected); the layers only decide how they show it (e.g. cells › hover, selection).')
        select(g, 'Hover', 'hover', [['pointer', 'pointer: the node under the mouse'], ['none', 'none']])
        select(g, 'Selection', 'selection', [['multi', 'multi'], ['single', 'single: replaces the old one'], ['none', 'none']])
        number(g, 'maxSelections', 'maxSelections', 1, 100, 1, () => cfg.selection === 'multi')
        select(g, 'Click on a node', 'click', [['goto', 'animate it to the center'], ['select', 'toggle selection'], ['ripple', 'ripple'], ['none', 'nothing (log only)']])
        number(g, 'λbounds min', 'λmin', 0.001, 1, 0.005)
        number(g, 'λbounds max', 'λmax', 0.01, 1, 0.01)
        range(g, 'wheelFactor', 'wheelFactor', 1.01, 2, 0.005)
        number(g, 'holdDuration (ms)', 'holdDuration', 100, 3000, 50)
        range(g, 'mouseRadius', 'mouseRadius', 0.3, 1, 0.01)

        g = section('API', () => 0)
        const lambda = el('input', { type: 'range', min: 0.02, max: 0.9, step: 0.01, value: 0.3 })
        const lambdaOut = el('output', {}, '0.30')
        lambda.addEventListener('input', () => { lambdaOut.textContent = (+lambda.value).toFixed(2) })
        row(g, 'λ for gotoλ', lambda, lambdaOut)
        const query = el('input', { type: 'text', placeholder: 'name contains… (Enter)', onkeydown: e => {
            if (e.key === 'Enter') { ht.api.selectQuery(e.target.value, 'name'); addLog('api', `selectQuery("${e.target.value}")`) }
        } })
        row(g, 'selectQuery', query)
        const api = (label, fn) => el('button', { class: 'secondary', onclick: () => { addLog('api', label); fn() } }, label)
        g.append(el('div', { class: 'buttons' },
            api('gotoHome', () => ht.api.gotoHome()),
            api('gotoλ', () => ht.api.gotoλ(+lambda.value)),
            api('gotoNode (random)', () => {
                const ns = ht.unitdisk.cache.unculledNodes
                const n = ns[Math.floor(Math.random() * ns.length)]
                ht.api.gotoNode(n).then(() => ht.drawDetailFrame())
            }),
            api('animateUp', () => new Promise((ok, err) => ht.animateUp(ok, err))),
            api('drawDetailFrame', () => ht.drawDetailFrame()),
            api('clear selection', () => ht.args.objects.selections.slice().forEach(n => ht.api.toggleSelection(n))),
        ))
        hint(g, 'The global "ht" in the browser console is the current component.')
    }

    function refreshControls() { for (const c of controls) c.refresh() }

    // ---------------------------------------------------------------------------------
    // info panel

    function renderLog() {
        const ol = $('#log')
        ol.innerHTML = ''
        for (const e of log.slice(0, 60))
            ol.append(el('li', {}, el('span', { class: 't' }, e.t), el('b', {}, e.type), e.text))
    }
    function renderStats() {
        if (!ht || !ht.unitdisk || !ht.data) return
        const s = ht.unitdisk.args.transformation.state
        const cache = ht.unitdisk.cache
        const avg = updateTimes.length ? updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length : null
        const rows = [
            ['nodes in data', ht.data.descendants().length.toLocaleString()],
            ['visible (unculled)', cache.unculledNodes ? cache.unculledNodes.length : '—'],
            ['zoom λ', s.λ.toFixed(4)],
            ['translation P', `${s.P.re.toFixed(3)}, ${s.P.im.toFixed(3)}`],
            ['filter magic', ht.args.filter.weightFilter ? (+ht.args.filter.weightFilter.magic).toFixed(1) : '—'],
            ['center node', nodeName(cache.centerNode)],
            ['selections', ht.args.objects.selections.length],
            ['update (JS, avg)', avg === null ? 'interact to measure' : `${avg.toFixed(1)} ms`],
        ]
        const dl = $('#stats')
        dl.innerHTML = ''
        for (const [k, v] of rows) dl.append(el('dt', {}, k), el('dd', {}, String(v)))
    }

    function toast(text) {
        const t = el('div', { class: 'toast' }, text)
        document.body.append(t)
        requestAnimationFrame(() => t.classList.add('show'))
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300) }, 1600)
    }

    // ---------------------------------------------------------------------------------

    $('#btn-reset').addEventListener('click', () => { cfg = JSON.parse(JSON.stringify(DEFAULTS)); rebuild() })
    $('#btn-link').addEventListener('click', () => navigator.clipboard.writeText(location.href).then(() => toast('Link copied')))
    $('#btn-harness').addEventListener('click', () => window.open('../test/harness.html?' + toParams(cfg, true), '_blank'))
    $('#btn-clear-log').addEventListener('click', () => { log.length = 0; renderLog() })

    probeLayers().then(() => {
        cfg = fromParams(new URLSearchParams(location.search))
        buildControls()
        rebuild()
        setInterval(renderStats, 300)
    })
})()
