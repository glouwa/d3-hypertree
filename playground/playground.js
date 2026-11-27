// d3-hypertree playground: every option of the library in a UI (docs/dev/PLAYGROUND.md).
//
// The state is the data source and a stack of named overlays over the library defaults
// (presets, own presets, the "url" entry); the URL holds it in the format of the test
// harness (../test/config.js), so a configuration can be shared as a link and opened as
// a test. The controls are built from the option descriptors (options.js); a control
// change goes into the editing entry of the stack and is applied live with
// ht.configure(). Only the data, the stack and the theme rebuild the component.
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
    const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
    const clone = v => Array.isArray(v) ? v.map(clone) : isPlain(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const get = (o, path) => path.split('.').reduce((a, k) => (a === null || a === undefined ? undefined : a[k]), o)
    const set = (o, path, v) => {
        const keys = path.split('.')
        let t = o
        for (const k of keys.slice(0, -1)) { if (!isPlain(t[k])) t[k] = {}; t = t[k] }
        t[keys[keys.length - 1]] = v
        return o
    }
    // deletes the path and the plain objects it leaves empty
    const del = (o, path) => {
        const keys = path.split('.')
        const walk = (t, i) => {
            if (!isPlain(t)) return
            if (i === keys.length - 1) delete t[keys[i]]
            else { walk(t[keys[i]], i + 1); if (isPlain(t[keys[i]]) && !Object.keys(t[keys[i]]).length) delete t[keys[i]] }
        }
        walk(o, 0)
        return o
    }
    const fmt = v => typeof v === 'number' ? +v.toFixed(4) : v
    const show = v => typeof v === 'function' ? 'ƒ' : v === undefined ? 'default' : v === null ? 'off'
        : hytOptions.isScaleSpec(v) ? `scale(${v['@scale'].value}, ${v['@scale'].scale || 'sqrt'})`
        : typeof v === 'string' && v.startsWith('@') ? v.slice(1)
        : typeof v === 'object' ? JSON.stringify(v) : String(fmt(v))
    const O = hytOptions, CFG = hypertreeConfig

    // ---------------------------------------------------------------------------------
    // state

    const DATA_DEFAULTS = { source: 'gen:nTree', depth: 10, childs: 2, n: 250, arms: 4, armDepth: 30, lang: false, labels: true, multiline: false, iconPercent: 10, values: false }
    const DEFAULT_STACK = () => [{ name: 'playground' }, { name: 'url', overlay: {} }]
    const STORE = 'hyt-playground-presets'   // own presets, by name
    const state = { data: Object.assign({}, DATA_DEFAULTS), stack: DEFAULT_STACK(), editing: 'url', theme: 'light', ripple: false }

    const entry = name => state.stack.find(e => e.name === name)
    const editing = () => entry(state.editing) || entry('url')
    const kindOf = e => CFG.entryKind(e)
    const editable = e => kindOf(e) === 'own' || kindOf(e) === 'url'
    const stored = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') } catch { return {} } }
    const store = () => {
        const s = stored()
        for (const e of state.stack) if (kindOf(e) === 'own') s[e.name] = e.overlay
        try { localStorage.setItem(STORE, JSON.stringify(s)) } catch { /* no storage */ }
    }

    function toParams(forHarness = false) {
        const p = new URLSearchParams()
        const d = state.data
        const [kind, value] = d.source.split(':')
        if (kind === 'file') p.set('file', value)
        else {
            p.set('gen', value)
            if (value === 'nTree') { p.set('depth', d.depth); p.set('childs', d.childs) }
            if (value === 'star' || value === 'path' || value === 'fan') p.set('n', d.n)
            if (value === 'fan') p.set('depth', d.childs)
            if (value === 'deepStar') { p.set('arms', d.arms); p.set('depth', d.armDepth) }
        }
        if (d.lang && d.source === 'file:fixtures/small.d3.json') p.set('lang', 'fixtures/small.lang.json')
        // generated trees have no names: number them; data with names shows its names
        if (d.labels && !d.lang) p.set('labels', kind === 'gen' && value !== 'data' && value !== 'fan' ? '1' : 'name')
        if (d.multiline && (d.labels || d.lang)) p.set('multiline', '1')
        if (d.iconPercent > 0) { p.set('icons', '1'); if (d.iconPercent !== 100) p.set('iconPercent', d.iconPercent) }
        if (d.values) p.set('values', '1')
        // the stack: presets by name (with options), own entries with their overlay, the url entry
        const stack = state.stack.map(e => {
            const o = { name: e.name }
            if (e.options) o.options = e.options
            if (e.enabled === false) o.enabled = false
            if (kindOf(e) === 'own') { o.own = true; o.overlay = e.overlay }
            if (kindOf(e) === 'url') o.overlay = e.overlay
            return o
        }).filter(e => !(e.name === 'url' && !Object.keys(e.overlay || {}).length))
        p.set('stack', JSON.stringify(stack))
        if (state.theme !== 'light') p.set('theme', state.theme)
        if (!forHarness && state.ripple) p.set('ripple', '1')
        return p
    }

    function fromParams(p) {
        const d = Object.assign({}, DATA_DEFAULTS)
        const num = (k, v) => (p.has(k) ? Number(p.get(k)) : v)
        if (p.get('file')) d.source = 'file:' + p.get('file')
        else if (p.get('gen')) d.source = 'gen:' + p.get('gen')
        d.depth = num('depth', d.depth); d.childs = num('childs', d.childs); d.n = num('n', d.n); d.arms = num('arms', d.arms)
        if (d.source === 'gen:deepStar') { d.armDepth = d.depth; d.depth = DATA_DEFAULTS.depth }
        if (d.source === 'gen:fan') { d.childs = p.has('depth') ? Number(p.get('depth')) : 3; d.depth = DATA_DEFAULTS.depth }
        d.lang = p.has('lang')
        d.labels = p.get('labels') === '1' || p.get('labels') === 'name'
        d.multiline = p.get('multiline') === '1'
        d.values = p.get('values') === '1'
        // icons: share of the nodes with an icon; a link without icons has none
        d.iconPercent = p.get('icons') === '1' ? num('iconPercent', 100) : ([...p.keys()].length ? 0 : DATA_DEFAULTS.iconPercent)
        if (![...p.keys()].length) d.labels = DATA_DEFAULTS.labels   // a URL without any parameter: the defaults with labels
        state.data = d
        // the stack: older links (and test URLs) without one start from the playground preset
        const parsed = CFG.parseStack(p)
        state.stack = p.has('stack') ? parsed : [{ name: 'playground' }, ...parsed]
        for (const e of state.stack) if (e.own && !e.overlay) e.overlay = stored()[e.name] || {}
        state.editing = 'url'
        state.theme = p.get('theme') || 'light'
        state.ripple = p.get('ripple') === '1'
    }

    // ---------------------------------------------------------------------------------
    // the component and the resolved model (base: the stack over the defaults)

    let ht = null
    let base = null            // { model, provenance } of the stack
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
            if (n && state.ripple && layer && layer.ripple) layer.ripple(n, m, () => {})
        },
        onNodeHold:         n => addLog('onNodeHold', nodeName(n)),
        onNodeHover:        n => addLog('onNodeHover', nodeName(n)),
        onNodeSelect:       (n, s) => addLog('onNodeSelect', `${nodeName(n)} ${s ? 'selected' : 'deselected'}`),
        onCenterNodeChange: n => addLog('onCenterNodeChange', nodeName(n)),
    }

    function currentStack() {
        try { return CFG.buildStack(toParams(), { fileBase: '../test/', interaction: callbacks }) }
        catch (e) { addLog('error', e.message); return null }
    }
    function resolveBase(stack) { base = hyt.resolveModel(hyt.defaults(), stack) }
    const whence = path => hyt.whence(base.provenance, path) || 'defaults'
    // the value of an option: the resolved model's (reassigned while a layer option
    // control refreshes: the layer's effective value, see layerOptionControl)
    let value = path => get(base.model, path)

    function updateURL() { history.replaceState(null, '', '?' + toParams().toString()) }

    function rebuild() {
        updateURL()
        $('#theme').href = `../dist/d3-hypertree-${state.theme}.css`
        document.body.classList.toggle('dark', state.theme === 'dark')
        const stack = currentStack()
        if (!stack) return
        resolveBase(stack)
        document.body.classList.toggle('halfplane', base.model.geometry.projection === 'cayley')   // a wide tree element (before the tree measures it)
        const tree = $('#tree')
        tree.innerHTML = ''
        updateTimes = []
        ht = new hyt.Hypertree({ parent: tree }, stack)
        window.ht = ht // for the console
        ht.initPromise.then(() => {
            const u = ht.update, t = u.transformation
            u.transformation = (...a) => {
                const t0 = performance.now(); const r = t.apply(u, a)
                updateTimes.push(performance.now() - t0); if (updateTimes.length > 30) updateTimes.shift()
                return r
            }
            refreshControls()
        })
        refreshControls()
    }
    let timer = null
    const scheduleRebuild = () => { clearTimeout(timer); timer = setTimeout(rebuild, 200) }

    /**
     * A control change: the value goes into the editing entry (undefined removes the
     * path: the value below shows again), the URL and the resolved model are updated,
     * the live component gets the resolved value with configure().
     */
    const effectShown = {}    // path -> hide timer
    function change(path, v, badge) {
        const e = editing()
        if (v === undefined) del(e.overlay, path); else set(e.overlay, path, v)
        if (kindOf(e) === 'own') store()
        updateURL()
        const stack = currentStack()
        if (!stack) return
        resolveBase(stack)
        if (ht && ht.data) {
            const resolved = value(path)
            let effect
            if (resolved === undefined) {
                // nothing below sets the path (a layer option was removed): configure
                // cannot unset, so the model is edited and the effect applied directly
                del(ht.args, path)
                effect = hyt.effectOf(path)
                ht.applyEffect(effect)
            } else effect = ht.configure(set({}, path, resolved))
            addLog('configure', `${path} = ${show(v)} → ${effect}`)
            if (badge) {
                badge.textContent = effect; badge.classList.add('effect')
                clearTimeout(effectShown[path])
                effectShown[path] = setTimeout(() => { badge.classList.remove('effect'); refreshControls() }, 1500)
            }
            document.body.classList.toggle('halfplane', base.model.geometry.projection === 'cayley')
        }
        refreshControls()
    }

    // ---------------------------------------------------------------------------------
    // controls

    let controls = []          // { refresh() }: the panel's controls
    let layerControls = []     // the layer panel's, built again when the layer list changes
    let refreshLayerPanel = () => {}
    const refreshControls = () => { if (!base) return; for (const c of controls) c.refresh(); refreshLayerPanel() }

    function section(title, container = '#controls', open = false, changed = () => 0, doc = '') {
        const badge = el('span', { class: 'badge' })
        const d = el('details', open ? { open: true } : {}, el('summary', doc ? { title: doc } : {}, title, badge))
        const g = el('div', { class: 'group' })
        d.append(g)
        $(container).append(d)
        controls.push({ refresh: () => { const n = changed(); badge.textContent = n ? `${n} changed` : '' } })
        return g
    }
    const hint = (group, text) => group.append(el('p', { class: 'hint' }, text))
    // the paths the editable entries set within a section (its badge)
    const changedIn = patterns => () => {
        const paths = state.stack.filter(editable).flatMap(e => hyt.pathsOf(e.overlay))
        return new Set(paths.filter(p => patterns.some(pt => pt.endsWith('*') ? p.startsWith(pt.slice(0, -1)) : p === pt)).map(p => p.split('.').slice(0, 3).join('.'))).size
    }

    /** A labelled row: label (the option name, the doc as tooltip), provenance badge, reset, the control, an output. */
    function row(group, label, path, info, control, out) {
        const prov = el('span', { class: 'prov', title: 'where the value comes from' })
        const reset = el('button', { class: 'link reset', title: 'remove from this entry', onclick: () => change(path, undefined, prov) }, '↺')
        const r = el('div', { class: 'row opt', 'data-path': path, title: `${path}${info && info.doc ? '\n' + info.doc : ''}` },
            el('label', {}, label), control, el('span', { class: 'tail' }, out || null, prov, reset))
        group.append(r)
        controls.push({ refresh: () => {
            const from = whence(path)
            prov.textContent = from === 'defaults' ? '' : from
            prov.className = 'prov ' + (editable(entry(from) || {}) ? 'editable' : 'preset')
            const inEditing = get(editing().overlay, path) !== undefined
            reset.style.visibility = inEditing ? '' : 'hidden'
            r.classList.toggle('changed', inEditing)
        } })
        return { r, prov }
    }
    const applyTo = (path, prov) => v => change(path, v, prov)

    // --- controls by kind: each returns the control element and registers its refresh

    function numberControl(group, label, path, info, transform = { to: v => v, from: v => v, fmt: v => fmt(v) }) {
        const out = el('output')
        const slider = el('input', { type: 'range', min: transform.to(info.min), max: transform.to(info.max), step: transform.to(info.step) || 'any' })
        const on = info.nullable ? el('input', { type: 'checkbox', title: 'on (off: null)' }) : null
        const control = el('div', { class: 'check' }, on, slider)
        const { prov } = row(group, label, path, info, control, out)
        const apply = applyTo(path, prov)
        slider.addEventListener('input', () => { out.textContent = transform.fmt(transform.from(+slider.value)); if (!on || on.checked) apply(transform.from(+slider.value)) })
        if (on) on.addEventListener('change', () => apply(on.checked ? transform.from(+slider.value) : null))
        controls.push({ refresh: () => {
            const v = value(path)
            if (on) { on.checked = v !== null && v !== undefined; slider.disabled = !on.checked }
            if (typeof v === 'number') slider.value = transform.to(v)
            out.textContent = typeof v === 'number' ? transform.fmt(v) + (info.unit ? ' ' + info.unit : '') : 'off'
        } })
    }
    const angleControl = (group, label, path, info) => numberControl(group, label, path, info, { to: deg, from: rad, fmt: v => `${deg(v)}°` })

    function booleanControl(group, label, path, info) {
        const c = el('input', { type: 'checkbox' })
        const { prov } = row(group, label, path, info, el('div', { class: 'check' }, c))
        c.addEventListener('change', () => change(path, c.checked, prov))
        controls.push({ refresh: () => { c.checked = !!value(path) } })
    }
    // info.valueDocs: a tooltip per value (on the option and, for the chosen one, on the select)
    function enumControl(group, label, path, info) {
        const docOf = v => (info.valueDocs && info.valueDocs[v]) || ''
        const s = el('select', {}, ...info.values.map(v => el('option', Object.assign({ value: v }, docOf(v) ? { title: docOf(v) } : {}), v)))
        const { prov } = row(group, label, path, info, s)
        s.addEventListener('change', () => change(path, s.value, prov))
        controls.push({ refresh: () => { const v = value(path); s.value = typeof v === 'string' ? v : ''; s.title = typeof v === 'object' && v ? 'an object (a Projection)' : docOf(v) } })
    }
    function stringControl(group, label, path, info) {
        const t = el('input', { type: 'text' })
        const { prov } = row(group, label, path, info, t)
        t.addEventListener('change', () => change(path, t.value, prov))
        controls.push({ refresh: () => { t.value = value(path) || '' } })
    }
    // { min, max } or [a, b]: two number fields
    function twoNumbers(group, label, path, info, keys, make) {
        const inputs = keys.map(() => el('input', { type: 'number', min: info.min, max: info.max, step: info.step || 'any' }))
        const { prov } = row(group, label, path, info, el('div', { class: 'check' }, inputs[0], inputs[1]))
        for (const i of inputs) i.addEventListener('change', () => change(path, make(+inputs[0].value, +inputs[1].value), prov))
        controls.push({ refresh: () => { const v = value(path); if (v) keys.forEach((k, i) => { inputs[i].value = v[k] }) } })
    }
    const rangeControl = (g, l, p, i) => twoNumbers(g, l, p, i, ['min', 'max'], (a, b) => ({ min: a, max: b }))
    const pairControl = (g, l, p, i) => twoNumbers(g, l, p, i, [0, 1], (a, b) => [a, b])
    function pointControl(group, label, path, info) {
        const on = el('input', { type: 'checkbox', title: 'on (off: null)' })
        const sl = ['re', 'im'].map(() => el('input', { type: 'range', min: info.min, max: info.max, step: info.step }))
        const out = el('output')
        const { prov } = row(group, label, path, info, el('div', { class: 'check' }, on, sl[0], sl[1]), out)
        const apply = () => change(path, on.checked ? { re: +sl[0].value, im: +sl[1].value } : null, prov)
        on.addEventListener('change', () => { if (on.checked && !value(path)) sl.forEach(s => { s.value = 0 }); apply() })
        for (const s of sl) s.addEventListener('input', () => { if (on.checked) apply() })
        controls.push({ refresh: () => {
            const v = value(path)
            on.checked = !!v; sl.forEach(s => { s.disabled = !v })
            if (v) { sl[0].value = v.re; sl[1].value = v.im }
            out.textContent = v ? `${fmt(v.re)}, ${fmt(v.im)}` : 'off'
        } })
    }
    // a nullable object (filter.weightFilter): on / off
    function objectControl(group, label, path, info) {
        const c = el('input', { type: 'checkbox', title: 'on (off: null)' })
        const { prov } = row(group, label, path, info, el('div', { class: 'check' }, c, el('span', { class: 'hint' }, 'on')))
        c.addEventListener('change', () => change(path, c.checked ? undefined : null, prov))
        controls.push({ refresh: () => { c.checked = value(path) !== null } })
    }

    /**
     * A function option: its mode (default, a constant, a scale, a named value) with
     * the sub-controls of the mode (options.js, section 3.3 of the concept). raw() is
     * the value in the editing entry; the resolved function is not shown.
     */
    function functionControl(group, label, path, info, raw) {
        const named = Object.keys(O.namedFor(path))
        const numeric = info.returns === 'number', color = info.returns === 'color', bool = info.returns === 'boolean'
        const modes = [['', 'default']]
        if (numeric || color || bool) modes.push(['constant', 'constant'])
        if (numeric || color) modes.push(['scale', 'scale (d3)'])
        for (const n of named) modes.push(['@' + n, n])
        modes.push(['fn', 'function (from the link)'])
        const mode = el('select', {}, ...modes.map(([v, t]) => el('option', { value: v, hidden: v === 'fn' }, t)))
        // constant
        const slider = numeric ? el('input', { type: 'range', min: info.min !== undefined ? info.min : 0, max: info.max !== undefined ? info.max : 1, step: info.step || 'any' }) : null
        const colorIn = color ? el('input', { type: 'color', value: '#1e88e5' }) : null
        const boolIn = bool ? el('select', {}, el('option', { value: 'true' }, 'on'), el('option', { value: 'false' }, 'off')) : null
        // scale
        const sValue = el('select', { class: 'scale' }, ...O.valueNames().map(v => el('option', { value: v }, v)), el('option', { value: 'data.' }, 'data.<key>'))
        const sKey = el('input', { type: 'text', class: 'scale key', placeholder: 'key', hidden: true })
        const sType = el('select', { class: 'scale' }, ...O.scaleTypes.map(v => el('option', { value: v }, v)))
        const sInterp = color ? el('select', { class: 'scale' }, ...O.interpolators.map(v => el('option', { value: v }, v))) : null
        const sOpacity = color ? el('input', { type: 'range', min: 0, max: 1, step: .05, value: 1, title: 'opacity' }) : null
        const sRange = numeric ? [0, 1].map(() => el('input', { type: 'number', step: 'any', class: 'scale' })) : null
        const out = el('output')
        const sub = el('div', { class: 'sub' }, slider, colorIn, boolIn, sValue, sKey, sType, sInterp, sOpacity, ...(sRange || []))
        const control = el('div', { class: 'fn' }, mode, sub)
        const { prov } = row(group, label, path, info, control, out)
        const apply = applyTo(path, prov)
        const scaleSpec = () => {
            const spec = { value: sValue.value === 'data.' ? 'data.' + sKey.value : sValue.value, scale: sType.value }
            if (color) { spec.interpolator = sInterp.value; spec.opacity = +sOpacity.value }
            else spec.range = [+sRange[0].value, +sRange[1].value]
            return { '@scale': spec }
        }
        const emit = () => {
            const m = mode.value
            if (m === '') apply(undefined)
            else if (m === 'constant') apply(numeric ? +slider.value : color ? colorIn.value : boolIn.value === 'true')
            else if (m === 'scale') apply(scaleSpec())
            else if (m.startsWith('@')) apply(m)
        }
        mode.addEventListener('change', () => {
            if (mode.value === 'scale') {   // the scale's defaults (as the library's colorBy / sizeBy)
                sValue.value = 'weight'; sType.value = 'sqrt'
                if (sInterp) { sInterp.value = 'Viridis'; sOpacity.value = 1 }
                if (sRange) { sRange[0].value = info.min !== undefined ? info.min : 0; sRange[1].value = info.max !== undefined ? info.max : 1 }
            }
            emit()
        })
        for (const i of [slider, colorIn, boolIn, sValue, sKey, sType, sInterp, sOpacity, ...(sRange || [])].filter(Boolean))
            i.addEventListener(i.type === 'range' || i.type === 'color' ? 'input' : 'change', emit)
        controls.push({ refresh: () => {
            const v = raw()
            const m = v === undefined ? '' : typeof v === 'function' ? 'fn' : typeof v === 'string' && v.startsWith('@') ? v : O.isScaleSpec(v) ? 'scale' : 'constant'
            mode.value = m
            mode.querySelector('option[value=fn]').hidden = m !== 'fn'
            for (const i of sub.children) i.hidden = true
            if (m === 'constant') {
                if (slider) { slider.hidden = false; slider.value = v }
                if (colorIn) { colorIn.hidden = false; if (/^#[0-9a-f]{6}$/i.test(v)) colorIn.value = v }
                if (boolIn) { boolIn.hidden = false; boolIn.value = String(!!v) }
            }
            if (m === 'scale') {
                const s = v['@scale']
                const isData = typeof s.value === 'string' && s.value.startsWith('data.')
                sValue.hidden = false; sValue.value = isData ? 'data.' : (s.value || 'weight')
                sKey.hidden = !isData; if (isData) sKey.value = s.value.slice(5)
                sType.hidden = false; sType.value = s.scale || 'sqrt'
                if (sInterp) { sInterp.hidden = false; sInterp.value = s.interpolator || 'Viridis'; sOpacity.hidden = false; sOpacity.value = s.opacity === undefined ? 1 : s.opacity }
                if (sRange && s.range) { sRange.forEach((r, i) => { r.hidden = false; r.value = s.range[i] }) }
            }
            out.textContent = m === '' ? (typeof value(path) === 'function' ? 'ƒ' : show(value(path))) : m === 'constant' ? show(v) : ''
        } })
    }

    /** The control of an option by its descriptor (core options: the path in the model). */
    function optionControl(group, path, info, label = path.split('.').pop()) {
        const raw = () => get(editing().overlay, path)
        switch (info.kind) {
            case 'number':   return numberControl(group, label, path, info)
            case 'angle':    return angleControl(group, label, path, info)
            case 'boolean':  return booleanControl(group, label, path, info)
            case 'enum':     return enumControl(group, label, path, info)
            case 'string':   return stringControl(group, label, path, info)
            case 'range':    return rangeControl(group, label, path, info)
            case 'pair':     return pairControl(group, label, path, info)
            case 'point':    return pointControl(group, label, path, info)
            case 'function': return functionControl(group, label, path, info, raw)
            case 'object':   return info.nullable ? objectControl(group, label, path, info) : undefined
            default:         return undefined   // callback, state, layers, data: no control of their own
        }
    }
    const WITHOUT_CONTROL = ['callback', 'state', 'layers', 'data']
    const hasControl = info => !WITHOUT_CONTROL.includes(info.kind) && !(info.kind === 'object' && !info.nullable) && !info.internal

    /** The controls of every described option matching the patterns ('layout.*'), in the order of the table. */
    function optionControls(group, patterns, used) {
        for (const [path, info] of Object.entries(O.options)) {
            if (!patterns.some(pt => pt.endsWith('*') ? path.startsWith(pt.slice(0, -1)) : path === pt)) continue
            used.add(path)
            if (hasControl(info)) optionControl(group, path, info)
        }
    }

    // ---------------------------------------------------------------------------------
    // the panel

    function buildControls() {
        const used = new Set()
        const isGen = g => () => state.data.source === 'gen:' + g
        const dataRow = (label, input, when) => {
            const r = el('div', { class: 'row two' }, el('label', {}, label), input)
            if (when) controls.push({ refresh: () => { r.style.display = when() ? '' : 'none' } })
            return r
        }
        const dataSelect = (group, label, key, options, when) => {
            const s = el('select', { onchange: e => { state.data[key] = e.target.value; scheduleRebuild() } }, ...options.map(([v, t]) => el('option', { value: v }, t)))
            controls.push({ refresh: () => { s.value = state.data[key] } })
            group.append(dataRow(label, s, when))
        }
        const dataNumber = (group, label, key, min, max, when) => {
            const i = el('input', { type: 'number', min, max, step: 1, onchange: e => { state.data[key] = +e.target.value; scheduleRebuild() } })
            controls.push({ refresh: () => { i.value = state.data[key] } })
            group.append(dataRow(label, i, when))
        }
        const dataCheck = (group, label, key, when, note) => {
            const c = el('input', { type: 'checkbox', onchange: e => { state.data[key] = e.target.checked; scheduleRebuild() } })
            const wrap = el('div', {}, el('label', Object.assign({ class: 'check' }, note ? { title: note } : {}), c, label))
            group.append(wrap)
            controls.push({ refresh: () => { c.checked = !!state.data[key]; if (when) wrap.style.display = when() ? '' : 'none' } })
        }

        // --- Data
        let g = section('Data', '#controls', true, () => Object.keys(DATA_DEFAULTS).filter(k => state.data[k] !== DATA_DEFAULTS[k]).length)
        dataSelect(g, 'Source', 'source', CFG.SOURCES)
        dataNumber(g, 'Depth', 'depth', 1, 16, isGen('nTree'))
        dataNumber(g, 'Children', 'childs', 1, 20, isGen('nTree'))
        dataNumber(g, 'Nodes', 'n', 2, 2000, () => ['gen:star', 'gen:path'].includes(state.data.source))
        dataNumber(g, 'Fan leaves', 'n', 2, 5000, isGen('fan'))
        dataNumber(g, 'Binary depth', 'childs', 1, 12, isGen('fan'))
        dataNumber(g, 'Arms', 'arms', 1, 20, isGen('deepStar'))
        dataNumber(g, 'Arm depth', 'armDepth', 1, 200, isGen('deepStar'))
        const theme = el('select', { onchange: e => { state.theme = e.target.value; scheduleRebuild() } }, el('option', { value: 'light' }, 'light'), el('option', { value: 'dark' }, 'dark'))
        controls.push({ refresh: () => { theme.value = state.theme } })
        g.append(dataRow('Theme (CSS)', theme))
        hint(g, 'Deep trees (e.g. deep star with arm depth > 40) show the known deep-tree bug when navigating far down.')

        // --- Presets: the stack
        buildStackSection()

        // --- Initialization: what the library does when a model is set, in this order
        // (hypertree.ts: setModel, initData, findInitλ), with the option of each step and its current
        // value. The explanations are tooltips (of the section title and of each step title).
        g = section('Initialization', '#controls', false, () => ['lang', 'labels', 'multiline', 'iconPercent', 'values'].filter(k => state.data[k] !== DATA_DEFAULTS[k]).length,
            'What happens when the tree is set up, in this order. Steps with an option can be configured by the application; here the data entry of the stack sets them. A preset may replace these callbacks with its own (e.g. infovisFiles: labels with the folder size). Hover a step for its description.')
        const steps = el('ol', { class: 'init-steps' })
        g.append(steps)
        const step = (title, option, text, current) => {
            const now = el('p', { class: 'now' })
            const li = el('li', {}, el('div', { class: 'step-title', title: text }, title, option ? el('code', {}, option) : null), now)
            steps.append(li)
            if (current) controls.push({ refresh: () => { now.textContent = 'here: ' + current() } })
            else now.remove()
            return li
        }
        const d = state.data, gen = () => d.source.split(':')
        step('Load the tree', 'dataloader',
            'Loads the data and calls back with a d3 hierarchy (generators, fromData, fromFile for JSON, CSV, SKOS, TreeML).',
            () => { const [k, v] = gen()
                return k === 'file' ? `hyt.fromFile('${v}')`
                    : v === 'nTree' ? `hyt.nTree(depth ${d.depth}, ${d.childs} children)`
                    : v === 'star' || v === 'path' ? `hyt.${v}_(${d.n})`
                    : v === 'fan' ? `hyt.fromData(fan of ${d.n}, binary depth ${d.childs})`
                    : v === 'deepStar' ? `hyt.deepStar(${d.arms} arms, depth ${d.armDepth})`
                    : 'hyt.fromData(small inline tree)' })
        const langStep = step('Load the language map', 'langloader',
            'Loads a map from node names to display texts, used by langInitBFS. Runs in parallel to the data loader.',
            () => d.lang ? "hyt.fromLangFile('fixtures/small.lang.json')" : 'none (empty map)')
        dataCheck(langStep, 'Language file small.lang.json', 'lang', () => d.source === 'file:fixtures/small.d3.json')
        step('Set up the nodes', null, 'Internal: ids, empty precalc, the root wedge from layout.rootWedge (see Layout).')
        step('Sum the weights', 'layout.weight, filter.weightFilter.weight',
            'Weights per node, summed over each subtree: the layout weight shares the space among children, the culling weight decides what the filter hides (both in Layout and Filter).',
            () => `layout: ${show(get(editing().overlay, 'layout.weight') || 'leaves 1')}; filter: ${show(get(editing().overlay, 'filter.weightFilter.weight') || 'leaves 1, inner nodes height²')}`)
        const dataStep = step('Node data', 'dataInitBFS',
            'Called for every node: icon (emoji), imageHref, clickable, cell. Default: clickable and cell true, no icon or image.',
            () => (d.iconPercent === 0 ? 'no icons' : `icon: an emoji for ${d.iconPercent === 100 ? 'every node' : d.iconPercent + ' % of the nodes, evenly spread'} (shown by the emojis layer, off in the playground preset)`)
                + (d.values ? '; n.data.value 1..100' : ''))
        const icons = el('input', { type: 'range', min: 0, max: 100, step: 5, oninput: e => { state.data.iconPercent = +e.target.value; iconsOut.textContent = e.target.value + ' %'; scheduleRebuild() } })
        const iconsOut = el('output')
        controls.push({ refresh: () => { icons.value = d.iconPercent; iconsOut.textContent = d.iconPercent + ' %' } })
        dataStep.append(el('div', { class: 'row' }, el('label', {}, 'Nodes with icon'), icons, iconsOut))
        dataCheck(dataStep, 'Example values (n.data.value 1..100)', 'values', null, 'Generated trees have no data of their own; this gives every node a value for the infovis presets and the scales.')
        const labelStep = step('Node texts', 'langInitBFS',
            'Called for every node after both loaders: label (and wiki). Called again when the language changes.',
            () => d.lang ? 'label from the language map'
                : !d.labels ? 'none (library default: no labels)'
                : gen()[0] === 'gen' && gen()[1] !== 'data' && gen()[1] !== 'fan' ? 'label: Node 0, Node 1, … (generated trees have no names)' : 'label: the node name')
        dataCheck(labelStep, 'Labels', 'labels', () => !d.lang)
        dataCheck(labelStep, 'Multi-line labels', 'multiline', () => d.labels || d.lang,
            'Puts a \\n into each label (at the first space, long words in the middle); the label layers draw one line per \\n.')
        step('Measure the texts', null, 'Internal: width of every label and icon in geometry.captionFont, for placing captions.')
        step('Find the start zoom', 'layout.initSize, interaction.λbounds',
            'Internal: grows λ until the outermost visible node reaches layout.initSize of the radius, then limits it to λbounds.',
            () => `initSize ${value('layout.initSize')}, λbounds [${value('interaction.λbounds').map(v => +v.toFixed(3)).join(', ')}]`)

        // --- the model's options, by section
        g = section('Layout', '#controls', false, changedIn(['layout.*']))
        optionControls(g, ['layout.*'], used)
        hint(g, 'Hover an option for its description. The badge says which entry of the stack set the value; ↺ removes it from the editing entry.')

        g = section('Filter', '#controls', false, changedIn(['filter.*']))
        optionControls(g, ['filter.*'], used)
        hint(g, 'Inside the focus radius the filter hides nothing: a node is hidden only if it is beyond cullingRadius or below the weight threshold and it and its parent are both outside the focus circle. Outside it, a node with hidden children gets a disk (nodeFilter).')

        g = section('Geometry', '#controls', false, changedIn(['geometry.*']))
        hint(g, 'Options that apply to several layers. Options of a single layer are in the layer list on the right (▸).')
        optionControls(g, ['geometry.*'], used)

        g = section('Interaction', '#controls', false, changedIn(['interaction.*']))
        hint(g, 'Strategies set the node state (hovered, selected); the layers only decide how they show it (e.g. cells › hover, selection).')
        optionControls(g, ['interaction.*'], used)
        // shortcuts for layer display options, and the playground's ripple
        const HOVER_PATH_LAYERS = ['path-arcs', 'link-arcs', 'nodes', 'symbols']
        const layerOpt = (n, k) => get(editing().overlay, `geometry.layerOptions.${n}.${k}`)
        const pointer = () => value('interaction.highlightNode') !== 'none'
        layerCheck(g, 'Hover path', 'the path from the hovered node to the root (layers path-arcs, link-arcs, nodes, symbols: option hover)',
            () => HOVER_PATH_LAYERS.every(n => layerOpt(n, 'hover') !== 'none'),
            on => HOVER_PATH_LAYERS.forEach(n => change(`geometry.layerOptions.${n}.hover`, on ? undefined : 'none')), pointer)
        layerCheck(g, 'Hover cell', 'the voronoi cell under the mouse (layer cells: visible, option hover)',
            () => !layerArgs('cells').invisible && layerArgs('cells').hover !== false,
            on => { change('geometry.layerOptions.cells.invisible', on ? false : undefined); change('geometry.layerOptions.cells.hover', on ? undefined : false) }, pointer)
        layerCheck(g, 'Highlight marker', 'a disk on the highlighted node that moves along the tree to the next one (layer highlight-marker: visible)',
            () => !layerArgs('highlight-marker').invisible,
            on => change('geometry.layerOptions.highlight-marker.invisible', on ? false : undefined), pointer)
        function layerCheck(group, label, title, isOn, apply, when) {
            const c = el('input', { type: 'checkbox', onchange: e => apply(e.target.checked) })
            const wrap = el('div', { title }, el('label', { class: 'check' }, c, label))
            group.append(wrap)
            controls.push({ refresh: () => { c.checked = isOn(); wrap.style.display = when() ? '' : 'none' } })
        }
        const ripple = el('input', { type: 'checkbox', onchange: e => { state.ripple = e.target.checked; updateURL() } })
        controls.push({ refresh: () => { ripple.checked = state.ripple } })
        g.append(el('div', { title: 'playground only: layer.ripple(n, m) in onNodeClick' }, el('label', { class: 'check' }, ripple, 'Ripple on click (in addition)')))

        // --- Other: described options no section claims (a test asserts there are none)
        const other = Object.entries(O.options).filter(([p, info]) => !used.has(p) && hasControl(info))
        if (other.length) {
            g = section('Other', '#controls')
            for (const [p, info] of other) optionControl(g, p, info)
        }

        // --- API
        g = section('API')
        const lambda = el('input', { type: 'range', min: 0.02, max: 0.9, step: 0.01, value: 0.3 })
        const lambdaOut = el('output', {}, '0.30')
        lambda.addEventListener('input', () => { lambdaOut.textContent = (+lambda.value).toFixed(2) })
        g.append(el('div', { class: 'row' }, el('label', {}, 'λ for gotoλ'), lambda, lambdaOut))
        const query = el('input', { type: 'text', placeholder: 'name contains… (Enter)', onkeydown: e => {
            if (e.key === 'Enter') { ht.api.selectQuery(e.target.value, 'name'); addLog('api', `selectQuery("${e.target.value}")`) }
        } })
        g.append(el('div', { class: 'row two' }, el('label', {}, 'selectQuery'), query))
        const api = (label, fn) => el('button', { class: 'secondary', onclick: () => { addLog('api', label); fn() } }, label)
        g.append(el('div', { class: 'buttons' },
            api('gotoHome', () => ht.api.gotoHome()),
            api('gotoλ', () => ht.api.gotoλ(+lambda.value)),
            api('gotoNode (random)', () => {
                const ns = ht.unitdisk.cache.unculledNodes
                const n = ns[Math.floor(Math.random() * ns.length)]
                ht.api.gotoNode(n).then(() => ht.drawDetailFrame())
            }),
            api('gotoOverview', () => ht.api.gotoOverview()),
            api('animateUp', () => new Promise((ok, err) => ht.animateUp(ok, err))),
            api('drawDetailFrame', () => ht.drawDetailFrame()),
            api('clear selection', () => ht.api.clearSelection()),
        ))
        hint(g, 'The global "ht" in the browser console is the current component; ht.args is the resolved model, ht.configure({...}) changes it.')

        buildLayerPanel()
    }

    // ---------------------------------------------------------------------------------
    // the stack

    function buildStackSection() {
        const g = section('Presets', '#controls', true, () => state.stack.filter(e => kindOf(e) !== 'url' && e.name !== 'playground').length)
        hint(g, 'The overlays over the library defaults, applied top to bottom like an application composes them. Switch entries off, reorder them, or save your changes as an own preset and build the next on top.')
        const list = el('div', { class: 'stack' })
        g.append(list)
        const add = el('select')
        const addBtn = el('button', { class: 'secondary', onclick: () => {
            if (!add.value) return
            const own = stored()[add.value]
            const e = own ? { name: add.value, own: true, overlay: clone(own) } : { name: add.value }
            // before the url entry (the url is always last)
            state.stack.splice(state.stack.length - 1, 0, e)
            scheduleRebuild()
        } }, '+ add')
        g.append(el('div', { class: 'row two' }, el('label', {}, 'Add preset'), el('div', { class: 'check' }, add, addBtn)))
        const save = el('button', { class: 'secondary', onclick: () => {
            const url = entry('url')
            if (!Object.keys(url.overlay).length) { toast('No changes in the url entry to save'); return }
            const name = prompt('Name of the preset', '')
            if (!name || name === 'url' || entry(name) || CFG.presetFactory(name)) { if (name) toast('Name taken'); return }
            state.stack.splice(state.stack.length - 1, 0, { name, own: true, overlay: url.overlay })
            url.overlay = {}
            store()
            scheduleRebuild()
        } }, 'Save url changes as preset…')
        const imp = el('button', { class: 'secondary', onclick: () => {
            const text = prompt('Overlay as JSON (functions as their modes: "@name", a scale spec, a constant)')
            if (!text) return
            try { const name = prompt('Name', 'imported'); if (name) { state.stack.splice(state.stack.length - 1, 0, { name, own: true, overlay: JSON.parse(text) }); store(); scheduleRebuild() } }
            catch (e) { toast('Not valid JSON: ' + e.message) }
        } }, 'Import…')
        g.append(el('div', { class: 'buttons' }, save, imp))
        hint(g, 'Own presets are kept in this browser (localStorage) under their name and in the link. "Import" takes an overlay as JSON, e.g. copied from another entry.')

        controls.push({ refresh: () => {
            const names = CFG.presetNames()
            const own = Object.keys(stored())
            add.innerHTML = ''
            add.append(el('option', { value: '' }, 'choose…'))
            const group = (label, items) => { if (items.length) { const og = el('optgroup', { label }); for (const n of items) og.append(el('option', { value: n, disabled: !!entry(n) }, n)); add.append(og) } }
            group('library', names.library); group('application', names.app); group('own', own)
            renderStack(list)
        } })
    }

    // the paths an entry sets, with the entry overriding each later ("overridden by")
    function entryPaths(e) {
        const kind = kindOf(e)
        const overlay = kind === 'library' || kind === 'app' ? CFG.presetFactory(e.name)(e.options) : e.overlay || {}
        return { overlay, paths: hyt.pathsOf(overlay) }
    }
    const openEntries = new Set()
    function renderStack(list) {
        list.innerHTML = ''
        list.append(el('div', { class: 'entry defaults', 'data-entry': 'defaults' }, el('span', { class: 'name' }, 'defaults'), el('span', { class: 'kind' }, 'library')))
        const infos = state.stack.map(e => Object.assign({ e }, entryPaths(e)))
        infos.forEach((info, i) => {
            const { e, overlay, paths } = info
            const kind = kindOf(e)
            const enabled = e.enabled !== false
            const on = el('input', { type: 'checkbox', checked: enabled, title: 'applied', onchange: () => { e.enabled = on.checked ? undefined : false; scheduleRebuild() } })
            const toggle = el('button', { class: 'link expander', onclick: () => { openEntries.has(e.name) ? openEntries.delete(e.name) : openEntries.add(e.name); refreshControls() } }, openEntries.has(e.name) ? '▾' : '▸')
            const edit = editable(e) ? el('button', { class: 'link' + (state.editing === e.name ? ' active' : ''), title: 'edit this entry: control changes go here', onclick: () => { state.editing = e.name; refreshControls() } }, '✎') : el('span', { class: 'spacer' })
            const move = (dir) => el('button', { class: 'link', title: dir < 0 ? 'up' : 'down', onclick: () => {
                const j = i + dir
                if (j < 0 || j >= state.stack.length || state.stack[j].name === 'url' || kind === 'url') return
                state.stack.splice(i, 1); state.stack.splice(j, 0, e); scheduleRebuild()
            } }, dir < 0 ? '↑' : '↓')
            const remove = kind === 'url' ? el('span', { class: 'spacer' }) : el('button', { class: 'link', title: 'remove from the stack', onclick: () => {
                state.stack.splice(i, 1)
                if (state.editing === e.name) state.editing = 'url'
                scheduleRebuild()
            } }, '✕')
            const copy = el('button', { class: 'link', title: 'copy as JSON (an overlay with the modes of its function options)', onclick: () => {
                const json = JSON.stringify(overlay, (k, v) => typeof v === 'function' ? 'ƒ (a function of the preset)' : v, 2)
                navigator.clipboard.writeText(json).then(() => toast('Copied'))
            } }, '⎘')
            const rowEl = el('div', { class: `entry ${kind}${enabled ? '' : ' off'}${state.editing === e.name ? ' editing' : ''}`, 'data-entry': e.name },
                toggle, on, el('span', { class: 'name' }, e.name), el('span', { class: 'kind' }, kind === 'url' ? 'this link' : kind),
                el('span', { class: 'count' }, `${paths.length} option${paths.length === 1 ? '' : 's'}`), edit, move(-1), move(1), copy, remove)
            list.append(rowEl)
            if (!openEntries.has(e.name)) return
            const details = el('div', { class: 'entry-details' })
            if (kind === 'library' || kind === 'app') {
                const opts = el('input', { type: 'text', value: e.options ? JSON.stringify(e.options) : '', placeholder: 'options of the preset as JSON, e.g. {"value":"depth"}' })
                opts.addEventListener('change', () => { try { e.options = opts.value ? JSON.parse(opts.value) : undefined; scheduleRebuild() } catch (err) { toast('Not valid JSON') } })
                details.append(el('div', { class: 'row two' }, el('label', {}, 'options'), opts))
            }
            if (!paths.length) details.append(el('p', { class: 'hint' }, 'sets nothing'))
            for (const p of paths) {
                const later = infos.slice(i + 1).filter(o => o.e.enabled !== false && o.paths.some(q => q === p || q.startsWith(p + '.') || p.startsWith(q + '.'))).map(o => o.e.name)
                details.append(el('div', { class: 'path' + (later.length ? ' overridden' : '') },
                    el('code', {}, p), ' = ', el('span', { class: 'val' }, show(get(overlay, p))),
                    later.length ? el('span', { class: 'by' }, ` overridden by ${later.join(', ')}`) : null))
            }
            list.append(details)
        })
    }

    // ---------------------------------------------------------------------------------
    // the layer panel: the resolved stack (geometry.layers) with the options of each
    // layer's type; structural changes write geometry.layers, options geometry.layerOptions

    const defaultSpecs = () => hyt.defaultLayers()
    const specOf = s => typeof s === 'string' ? defaultSpecs().find(d => d.name === s) : s
    const nameOf = s => typeof s === 'string' ? s : (s.name || s.type)
    const layerList = () => base.model.geometry.layers.map(specOf).filter(Boolean)
    const layerArgs = name => (ht && ht.unitdisk && ht.unitdisk.layerStack && ht.unitdisk.layerStack.layers[name] && ht.unitdisk.layerStack.layers[name].args) || {}
    const openLayers = new Set(), openGroups = new Set()
    // Playground only: related layers form collapsible groups, shown where their first
    // layer is. A layer belongs to the first group that matches it.
    const GROUPS = [
        { name: 'Indicators', test: n => /-r(-|$)/.test(n) || n === 'λ', note: 'circles that show radii of the filter and the interaction, and the zoom λ' },
        { name: 'Labels', test: n => /^labels/.test(n), note: 'the label layers: labels, force-placed and map-placed labels' },
        { name: 'Links', test: n => /-arcs?$/.test(n), note: 'the edges between nodes: all links, the hover and selection paths, and the stem to the root' },
        { name: 'Nodes', test: n => ['nodes', 'symbols', 'images', 'emoji-backgrounds', 'emojis'].includes(n), note: 'what is drawn at a node: disk, symbol, image, emoji and the disk under it' },
        { name: 'Root', test: n => n === '(0,0)' || n === 'center-node', note: 'the origin (0,0) and the disk behind the node next to it' },
    ]
    const groupOf = name => GROUPS.find(gr => gr.test(name))
    const LAYER_ALIASES = { 'cells': 'voronoi', 'λ': 'zoom', '(0,0)': 'origin' }

    /** Writes the layer list (structural change): default layers by name; the default order and set removes the path. */
    function writeLayers(list) {
        const defaults = defaultSpecs()
        const out = list.map(s => {
            const d = defaults.find(x => x.name === nameOf(s))
            return d && (typeof s === 'string' || (s.type === d.type && eq(Object.keys(s.options || {}), Object.keys(d.options || {})))) ? nameOf(s) : s
        })
        change('geometry.layers', eq(out, defaults.map(d => d.name)) ? undefined : out)
    }
    const layerChanged = name => state.stack.filter(editable).some(e => get(e.overlay, `geometry.layerOptions.${name}`) !== undefined)

    function buildLayerPanel() {
        const g = section('Layers', '#layer-controls', true, () => {
            const names = new Set(state.stack.filter(editable).flatMap(e => Object.keys(get(e.overlay, 'geometry.layerOptions') || {})))
            return names.size + (state.stack.filter(editable).some(e => get(e.overlay, 'geometry.layers')) ? 1 : 0)
        })
        const table = el('table', { class: 'layers' },
            el('thead', {}, el('tr', {}, el('th', {}, 'layer'), el('th', {}, 'visible'), el('th', {}, 'hide on drag'), el('th', {}, ''))))
        const tbody = el('tbody')
        table.append(tbody)
        g.append(table)
        // add a layer: a type (with a name) or a default layer that is not in the list
        const type = el('select')
        const name = el('input', { type: 'text', placeholder: 'name' })
        const addBtn = el('button', { class: 'secondary', onclick: () => {
            if (!type.value) return
            const list = base.model.geometry.layers.slice()
            if (type.value.startsWith('default:')) list.push(type.value.slice(8))
            else {
                const n = name.value.trim() || type.value
                if (layerList().some(s => nameOf(s) === n)) { toast('A layer with this name exists'); return }
                list.push({ type: type.value, name: n })
            }
            name.value = ''
            writeLayers(list)
        } }, '+ add')
        g.append(el('div', { class: 'row two' }, el('label', {}, 'Add layer'), el('div', { class: 'check' }, type, name, addBtn)))
        hint(g, '▸ shows the options of a layer (hover an option for its description). "hide on drag" hides a layer while dragging, pinching or animating. ↑ ↓ ✕ change the stack itself.')
        controls.push({ refresh: () => {
            const present = new Set(layerList().map(nameOf))
            type.innerHTML = ''
            type.append(el('option', { value: '' }, 'choose…'))
            const og = el('optgroup', { label: 'a new layer of type' })
            for (const t of Object.keys(hyt.layerTypes)) og.append(el('option', { value: t, title: O.layerDocs[t] || '' }, t))
            type.append(og)
            const missing = defaultSpecs().filter(d => !present.has(d.name))
            if (missing.length) { const og2 = el('optgroup', { label: 'a default layer' }); for (const d of missing) og2.append(el('option', { value: 'default:' + d.name }, d.name)); type.append(og2) }
        } })
        // the table is built again only when the list or what is open changes; else its controls refresh
        let signature = ''
        refreshLayerPanel = () => {
            const sig = JSON.stringify([layerList().map(s => [nameOf(s), s.type]), [...openLayers], [...openGroups]])
            if (sig !== signature) { signature = sig; renderLayers(tbody) }
            for (const c of layerControls) c.refresh()
        }
    }

    function renderLayers(tbody) {
        tbody.innerHTML = ''
        const saved = controls
        controls = layerControls = []            // the rows register their refreshes here
        const list = layerList()
        const rendered = new Set()
        list.forEach((spec, i) => {
            const n = nameOf(spec)
            const gr = groupOf(n)
            if (gr && !rendered.has(gr.name)) { rendered.add(gr.name); renderGroupRow(tbody, gr, list.filter(s => groupOf(nameOf(s)) === gr)) }
            renderLayerRow(tbody, spec, i, list, gr)
        })
        controls = saved
    }
    const optPath = (n, k) => `geometry.layerOptions.${n}.${k}`
    // the effective value of a layer option: the live layer's args, else the spec, else the type's default (unknown here)
    const layerValue = (spec, k) => { const a = layerArgs(nameOf(spec)); return k in a ? a[k] : spec.options ? spec.options[k] : undefined }

    function renderGroupRow(tbody, gr, members) {
        const names = members.map(nameOf)
        const setAll = (k, v) => names.forEach(n => change(optPath(n, k), v))
        const visBox = el('input', { type: 'checkbox', onchange: e => setAll('invisible', !e.target.checked) })
        const hodBox = el('input', { type: 'checkbox', onchange: e => setAll('hideOnDrag', e.target.checked) })
        const open = openGroups.has(gr.name)
        const tr = el('tr', { class: 'layer-group expandable', 'data-group': gr.name, title: gr.note },
            el('td', {}, el('button', { class: 'link expander' }, open ? '▾' : '▸'), ' ', gr.name, el('span', { class: 'alias' }, ` ${members.length} layers`)),
            el('td', { class: 'c' }, visBox), el('td', { class: 'c' }, hodBox), el('td'))
        tr.addEventListener('click', e => { if (e.target.closest('input, label')) return; open ? openGroups.delete(gr.name) : openGroups.add(gr.name); refreshControls() })
        tbody.append(tr)
        controls.push({ refresh: () => {
            const vis = members.map(s => !layerValue(s, 'invisible')), hod = members.map(s => !!layerValue(s, 'hideOnDrag'))
            visBox.checked = vis.every(Boolean); visBox.indeterminate = !visBox.checked && vis.some(Boolean)
            hodBox.checked = hod.every(Boolean); hodBox.indeterminate = !hodBox.checked && hod.some(Boolean)
            tr.classList.toggle('changed', names.some(layerChanged))
        } })
    }

    function renderLayerRow(tbody, spec, i, list, gr) {
        const n = nameOf(spec), type = spec.type
        const infos = O.layerOptionInfos(type)
        const hidden = gr && !openGroups.has(gr.name)
        const open = openLayers.has(n)
        const vis = el('input', { type: 'checkbox', onchange: e => change(optPath(n, 'invisible'), !e.target.checked) })
        const hod = el('input', { type: 'checkbox', onchange: e => change(optPath(n, 'hideOnDrag'), e.target.checked) })
        const toggle = el('button', { class: 'link expander', title: 'layer options' }, open ? '▾' : '▸')
        const move = dir => el('button', { class: 'link', title: dir < 0 ? 'draw earlier (below)' : 'draw later (above)', onclick: e => {
            e.stopPropagation()
            const j = i + dir
            if (j < 0 || j >= list.length) return
            const raw = base.model.geometry.layers.slice()
            const [s] = raw.splice(i, 1); raw.splice(j, 0, s)
            writeLayers(raw)
        } }, dir < 0 ? '↑' : '↓')
        const remove = el('button', { class: 'link', title: 'remove from the stack', onclick: e => { e.stopPropagation(); writeLayers(base.model.geometry.layers.filter((_, k) => k !== i)) } }, '✕')
        const tr = el('tr', { class: 'expandable' + (gr ? ' in-group' : ''), 'data-layer': n, hidden },
            el('td', {}, toggle, ' ', n, LAYER_ALIASES[n] ? el('span', { class: 'alias' }, ' ' + LAYER_ALIASES[n]) : null),
            el('td', { class: 'c' }, vis), el('td', { class: 'c' }, hod), el('td', { class: 'tools' }, move(-1), move(1), remove))
        tr.addEventListener('click', e => { if (e.target.closest('input, label, .tools')) return; open ? openLayers.delete(n) : openLayers.add(n); refreshControls() })
        tbody.append(tr)
        controls.push({ refresh: () => {
            vis.checked = !layerValue(spec, 'invisible'); hod.checked = !!layerValue(spec, 'hideOnDrag')
            tr.classList.toggle('changed', layerChanged(n))
        } })
        if (!open) return
        const optRow = el('tr', { class: 'layer-options' + (gr ? ' in-group' : ''), 'data-layer-options': n, hidden })
        const cell = el('td', { colspan: 4 })
        optRow.append(cell)
        tbody.append(optRow)
        const data = spec.data !== undefined ? spec.data : layerValue(spec, 'data')
        cell.append(el('p', { class: 'hint' }, el('code', {}, `type ${type}`), typeof data === 'string' ? el('code', {}, ` data ${data}`) : typeof data === 'function' ? el('code', {}, ' data ƒ') : null, ' ', O.layerDocs[type] || ''))
        const group = el('div', { class: 'group' })
        cell.append(group)
        for (const [k, info] of Object.entries(infos)) {
            if (info.internal || info.kind === 'data' || k === 'removed') continue
            const path = optPath(n, k)
            const raw = () => get(editing().overlay, path)
            // the controls read the resolved model; a layer option's effective value is the layer's
            const valueOf = () => { const v = get(base.model, path); return v !== undefined ? v : layerValue(spec, k) }
            layerOptionControl(group, k, path, info, raw, valueOf)
        }
    }

    // a layer option control: like optionControl, but the value shown is the layer's effective one
    function layerOptionControl(group, label, path, info, raw, valueOf) {
        const resolved = value
        // the controls read value(path) from the resolved model; for a layer option the layer's args are the truth
        const patched = p => (p === path ? valueOf() : resolved(p))
        const ctl = { number: numberControl, angle: angleControl, boolean: booleanControl, enum: enumControl, string: stringControl, range: rangeControl, pair: pairControl, point: pointControl }[info.kind]
        const before = controls.length
        if (info.kind === 'function') functionControl(group, label, path, info, raw)
        else if (ctl) ctl(group, label, path, info)
        else return
        // wrap the refreshes registered by the control so they see the layer's value
        for (let i = before; i < controls.length; i++) {
            const r = controls[i].refresh
            controls[i].refresh = () => { value = patched; try { r() } finally { value = resolved } }
        }
    }

    // ---------------------------------------------------------------------------------
    // info panel

    function renderLog() {
        const ol = $('#log')
        ol.innerHTML = ''
        for (const e of log.slice(0, 60))
            ol.append(el('li', { class: e.type === 'configure' ? 'conf' : '' }, el('span', { class: 't' }, e.t), el('b', {}, e.type), e.text))
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

    $('#btn-reset').addEventListener('click', () => { fromParams(new URLSearchParams()); rebuild() })
    $('#btn-link').addEventListener('click', () => navigator.clipboard.writeText(location.href).then(() => toast('Link copied')))
    $('#btn-harness').addEventListener('click', () => window.open('../test/harness.html?' + toParams(true), '_blank'))
    $('#btn-clear-log').addEventListener('click', () => { log.length = 0; renderLog() })

    fromParams(new URLSearchParams(location.search))
    const stack0 = currentStack()
    if (stack0) resolveBase(stack0)
    buildControls()
    rebuild()
    setInterval(renderStats, 300)
    window.playground = { state, toParams, get base() { return base } }
})()
