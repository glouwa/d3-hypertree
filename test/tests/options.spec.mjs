import { test, expect } from '@playwright/test'

// The option descriptors (playground/options.js) and the library's defaults must
// match: every default of the core options and of every layer type is described,
// every descriptor describes an existing option (docs/dev/PLAYGROUND.md, 3.1).

test('every core default has a descriptor, every core descriptor an option', async ({ page }) => {
    await page.goto('harness.html?gen=data')
    await page.waitForFunction(() => window.harness && window.hytOptions)
    const r = await page.evaluate(() => {
        const defaults = hyt.coreDefaults()
        const paths = hyt.pathsOf(defaults)
        const undescribed = paths.filter(p => !hytOptions.optionInfo(p))
        // a described path must exist in the defaults (or be an option that is undefined by default)
        const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
        const undefinedByDefault = ['langmap', 'iconmap', 'dataloader', 'filter.weightFilter.magic']
        const has = (o, p) => { const keys = p.split('.'); const parent = keys.length > 1 ? get(o, keys.slice(0, -1).join('.')) : o; return parent != null && typeof parent === 'object' && keys[keys.length - 1] in parent }
        const stale = Object.keys(hytOptions.options).filter(p => !undefinedByDefault.includes(p) && !has(defaults, p))
        return { undescribed, stale, described: Object.keys(hytOptions.options).length }
    })
    expect(r.undescribed).toEqual([])
    expect(r.stale).toEqual([])
    expect(r.described).toBeGreaterThan(50)
})

test('every option of every layer type has a descriptor, and the other way round', async ({ page }) => {
    await page.goto('harness.html?gen=nTree&depth=3&childs=2')
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    const r = await page.evaluate(() => {
        const problems = []
        const layers = harness.ht.unitdisk.layerStack.layers
        const types = Object.fromEntries(hyt.defaultLayers().map(s => [s.name, s.type]))
        const seen = new Set()
        for (const [name, layer] of Object.entries(layers)) {
            const type = types[name]
            seen.add(type)
            const infos = hytOptions.layerOptionInfos(type)
            for (const k of Object.keys(layer.args)) if (!infos[k]) problems.push(`${type}.${k} (layer ${name}) is not described`)
            for (const k of Object.keys(hytOptions.layerOptions[type] || {})) if (!(k in layer.args)) problems.push(`${type}.${k} is described but not an option`)
        }
        const undescribedTypes = Object.keys(hyt.layerTypes).filter(t => !hytOptions.layerOptions[t] || !hytOptions.layerDocs[t])
        return { problems, undescribedTypes, kinds: new Set(Object.values(hytOptions.options).map(o => o.kind)).size }
    })
    expect(r.problems).toEqual([])
    expect(r.undescribedTypes).toEqual([])
})

test('resolveNamed: a constant, a named value and a scale become functions; booleans and enums stay', async ({ page }) => {
    await page.goto('harness.html?gen=nTree&depth=3&childs=2&values=1')
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    const r = await page.evaluate(() => {
        const o = hytOptions.resolveNamed({
            layout: { type: '@spiral', childOrder: 'balanced' },
            filter: { weightFilter: { weight: '@uniform' } },
            geometry: {
                nodeRadius: .02,
                linkWidth: { '@scale': { value: 'depth', scale: 'linear', range: [.001, .01] } },
                layerOptions: {
                    'nodes': { fill: '@by depth', show: 'all', hover: 'none' },
                    'cells': { fill: { '@scale': { value: 'value', interpolator: 'Turbo', opacity: .5 } }, hover: false },
                    'labels': { background: true, maxLabels: 7, color: '#ff0000' },
                    'stem-arc': { width: .01 },
                },
                layers: ['background', { type: 'nodes', name: 'big', options: { r: .05, fill: '@by depth' } }],
            },
        })
        const root = harness.ht.data, leaf = root.leaves()[0]
        return {
            type: o.layout.type === hyt.layouts.layoutSpiral, childOrder: o.layout.childOrder,
            weight: o.filter.weightFilter.weight(leaf), radius: o.geometry.nodeRadius(null, leaf),
            widthRoot: o.geometry.linkWidth(root), widthLeaf: o.geometry.linkWidth(leaf),
            fill: typeof o.geometry.layerOptions.nodes.fill(leaf), show: o.geometry.layerOptions.nodes.show, hover: o.geometry.layerOptions.nodes.hover,
            cellFill: o.geometry.layerOptions.cells.fill(leaf), cellHover: o.geometry.layerOptions.cells.hover,
            background: o.geometry.layerOptions.labels.background, maxLabels: o.geometry.layerOptions.labels.maxLabels, color: o.geometry.layerOptions.labels.color(leaf),
            stem: o.geometry.layerOptions['stem-arc'].width(leaf),
            layers: [o.geometry.layers[0], typeof o.geometry.layers[1].options.r, o.geometry.layers[1].options.r(leaf), typeof o.geometry.layers[1].options.fill],
        }
    })
    expect(r.type).toBe(true)
    expect(r.childOrder).toBe('balanced')
    expect(r.weight).toBe(1)
    expect(r.radius).toBe(.02)
    expect(r.widthRoot).toBeCloseTo(.001, 5)        // depth 0 -> the start of the range
    expect(r.widthLeaf).toBeCloseTo(.01, 5)         // the deepest -> the end
    expect(r.fill).toBe('string')
    expect(r.show).toBe('all')
    expect(r.hover).toBe('none')
    expect(r.cellFill).toMatch(/^rgba\(/)           // opacity .5
    expect(r.cellHover).toBe(false)
    expect(r.background).toBe(true)
    expect(r.maxLabels).toBe(7)
    expect(r.color).toBe('#ff0000')
    expect(r.stem).toBe(.01)
    expect(r.layers).toEqual(['background', 'function', .05, 'function'])
})

test('the harness builds a named stack: data, presets, url, harness', async ({ page }) => {
    await page.goto(`harness.html?gen=nTree&depth=3&childs=2&preset=infovis&stack=${encodeURIComponent(JSON.stringify([{ name: 'mine', own: true, overlay: { filter: { cullingRadius: .7 } } }]))}&filterOpt=${encodeURIComponent('{"focusExtension":2}')}`)
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    const r = await page.evaluate(() => {
        const ht = harness.ht, w = p => hyt.whence(ht.provenance, p)
        return {
            names: hypertreeConfig.parseStack(new URLSearchParams(location.search)).map(e => e.name),
            from: [w('dataloader'), w('geometry.shrinkAtRim'), w('filter.cullingRadius'), w('filter.focusExtension'), w('interaction.onNodeClick'), w('filter.alpha')],
            cullingRadius: ht.args.filter.cullingRadius, focusExtension: ht.args.filter.focusExtension,
        }
    })
    expect(r.names).toEqual(['infovis', 'mine', 'url'])
    expect(r.from).toEqual(['data', 'infovis', 'mine', 'url', 'harness', 'defaults'])   // an unknown path: its branch is the defaults'
    expect(r.cullingRadius).toBe(.7)
    expect(r.focusExtension).toBe(2)
})

test('geometry.layers by name: a default layer\'s name stands for its spec', async ({ page }) => {
    await page.goto('harness.html?gen=nTree&depth=4&childs=2')
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    const r = await page.evaluate(() => {
        harness.ht.configure({ geometry: { layers: ['background', 'link-arcs', { type: 'nodes', name: 'nodes', options: { show: 'all' } }, 'labels', 'interaction-2'] } })
        return { names: Object.keys(harness.ht.unitdisk.layerStack.layers), circles: document.querySelectorAll('[id="nodes"] circle').length, visible: harness.ht.unitdisk.cache.unculledNodes.length }
    })
    expect(r.names).toEqual(['background', 'link-arcs', 'nodes', 'labels', 'interaction-2'])
    expect(r.circles).toBe(r.visible)
})
