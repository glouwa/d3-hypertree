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
        lang: false, labels: true, icons: true, colors: false, preset: '', theme: 'light',
        curvature: base.geometry.linkCurvature,
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
        layers: {},           // overrides: name -> { invisible, hideOnDrag }
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
        if (c.icons) p.set('icons', '1')
        if (c.colors) p.set('colors', '1')
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
        if (Object.keys(i).length) p.set('interaction', JSON.stringify(i))

        const layers = JSON.parse(JSON.stringify(c.layers))
        if (c.curvature !== DEFAULTS.curvature) layers['link-arcs'] = Object.assign(layers['link-arcs'] || {}, { curvature: c.curvature })
        if (Object.keys(layers).length) p.set('layers', JSON.stringify(layers))

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
        c.icons = p.get('icons') === '1'
        c.colors = p.get('colors') === '1'
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
            for (const k of ['wheelFactor', 'holdDuration', 'mouseRadius']) if (i[k] !== undefined) c[k] = i[k]
        }
        if (p.get('layers')) {
            const l = JSON.parse(p.get('layers'))
            if (l['link-arcs'] && l['link-arcs'].curvature) { c.curvature = l['link-arcs'].curvature; delete l['link-arcs'].curvature }
            for (const [name, o] of Object.entries(l)) if (Object.keys(o).length) c.layers[name] = o
        }
        c.click = p.get('click') || DEFAULTS.click
        // a URL without any parameter shows the defaults with labels and icons
        if (![...p.keys()].length) { c.labels = DEFAULTS.labels; c.icons = DEFAULTS.icons }
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

    function buildControls() {
        const isGen = g => () => cfg.source === 'gen:' + g

        let g = section('Data', ['source', 'depth', 'childs', 'n', 'arms', 'armDepth', 'lang', 'preset'], true)
        select(g, 'Source', 'source', SOURCES)
        number(g, 'Depth', 'depth', 1, 16, 1, isGen('nTree'))
        number(g, 'Children', 'childs', 1, 20, 1, isGen('nTree'))
        number(g, 'Nodes', 'n', 2, 2000, 1, () => cfg.source === 'gen:star' || cfg.source === 'gen:path')
        number(g, 'Arms', 'arms', 1, 20, 1, isGen('deepStar'))
        number(g, 'Arm depth', 'armDepth', 1, 200, 1, isGen('deepStar'))
        check(g, 'Labels from language file (small.lang.json)', 'lang', () => cfg.source === 'file:fixtures/small.d3.json')
        select(g, 'Preset', 'preset', [['', 'none (library defaults)'], ...PRESETS.map(p => [p, p])])
        hint(g, 'Deep trees (e.g. deep star with arm depth > 40) show the known deep-tree bug when navigating far down.')

        g = section('Node content', ['labels', 'icons', 'colors'])
        check(g, 'Labels (langInitBFS): node names, or numbers for generated trees', 'labels', () => !cfg.lang)
        check(g, 'Icons / emojis (dataInitBFS)', 'icons', null, 'Emojis are the most expensive layer to render. Icons without labels crash (known bug).')
        check(g, 'Color callbacks (nodes fill, link-arcs stroke by depth)', 'colors')

        g = section('Layers', () => Object.keys(cfg.layers).length)
        const table = el('table', { class: 'layers' },
            el('thead', {}, el('tr', {}, el('th', {}, 'layer'), el('th', {}, 'visible'), el('th', {}, 'hide on drag'))))
        const tbody = el('tbody')
        table.append(tbody)
        g.append(table)
        for (const [name, d] of Object.entries(LAYER_DEFAULTS)) {
            const eff = () => Object.assign({}, d, cfg.layers[name] || {})
            const setLayer = (k, v) => {
                const o = Object.assign({}, cfg.layers[name] || {}, { [k]: v })
                for (const kk of Object.keys(o)) if (o[kk] === d[kk]) delete o[kk]
                if (Object.keys(o).length) cfg.layers[name] = o; else delete cfg.layers[name]
                scheduleRebuild()
            }
            const vis = el('input', { type: 'checkbox', onchange: e => setLayer('invisible', !e.target.checked) })
            const hod = el('input', { type: 'checkbox', onchange: e => setLayer('hideOnDrag', e.target.checked) })
            const tr = el('tr', {}, el('td', {}, name), el('td', { class: 'c' }, vis), el('td', { class: 'c' }, hod))
            tbody.append(tr)
            controls.push({ refresh: () => {
                vis.checked = !eff().invisible; hod.checked = eff().hideOnDrag
                tr.classList.toggle('changed', !!cfg.layers[name])
            } })
        }
        hint(g, '"hide on drag" hides a layer while dragging, pinching or animating.')

        g = section('Appearance', ['curvature', 'theme'])
        select(g, 'Link curvature', 'curvature', [['-', '− (default)'], ['+', '+'], ['l', 'l (straight lines)']])
        select(g, 'Theme', 'theme', [['light', 'light'], ['dark', 'dark']])

        g = section('Layout', ['layoutType', 'wedgeOrientation', 'wedgeAngle'])
        select(g, 'Type', 'layoutType', [['berge', 'Bergé (default, supports culling)'], ['spiral', 'spiral'], ['buchheim', 'Buchheim'], ['unitLines', 'unit lines'], ['unitVectors', 'unit vectors']])
        range(g, 'Root wedge dir.', 'wedgeOrientation', 0, 360, 1, null, v => `${v}°`)
        range(g, 'Root wedge angle', 'wedgeAngle', 10, 360, 1, null, v => `${v}°`)

        g = section('Filter', ['filterOff', 'weightUniform', 'cullingRadius', 'rangeNodesMin', 'rangeNodesMax', 'rcwMin', 'rcwMax', 'focusExtension', 'maxFocusRadius', 'maxlabels'])
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
        check(g, 'Uniform node weights', 'weightUniform', on)
        hint(g, 'The filter adapts its weight threshold a little on every update, so the visible set settles over a few frames after loading or interacting.')

        g = section('Interaction', ['λmin', 'λmax', 'wheelFactor', 'holdDuration', 'mouseRadius', 'click'])
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
