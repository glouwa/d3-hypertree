import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The configuration (src/config/): the defaults and the overlays resolved into one
// model with the provenance of every value, the merge rules, the migration of v1
// option names, and configure() at runtime (docs/dev/REFACTORING.md, section 2).

test('resolveModel: the defaults with the overlays applied, every value with its provenance', async ({ page }) => {
    await page.goto('harness.html?gen=data')
    const r = await page.evaluate(() => {
        const { model, provenance } = hyt.resolveModel(hyt.defaults(), [
            { name: 'preset', overlay: { filter: { cullingRadius: .5 }, interaction: { λbounds: [.1, .2] } } },
            { name: 'app',    overlay: { filter: { weightFilter: { rangeNodes: { min: 7, max: 9 } } }, interaction: { λbounds: [.3, .4] } } },
        ])
        return {
            cullingRadius: model.filter.cullingRadius, alpha: model.filter.weightFilter.alpha, range: model.filter.weightFilter.rangeNodes,
            λbounds: model.interaction.λbounds, layers: model.geometry.layers.length,
            whence: ['filter.cullingRadius', 'filter.weightFilter.alpha', 'filter.weightFilter.rangeNodes.min', 'interaction.λbounds', 'geometry.layers']
                .map(p => [p, hyt.whence(provenance, p)]),
        }
    })
    expect(r.cullingRadius).toBe(.5)
    expect(r.alpha).toBe(1.05)                    // a default next to an overridden sibling stays
    expect(r.range).toEqual({ min: 7, max: 9 })
    expect(r.λbounds).toEqual([.3, .4])           // arrays replace; the later overlay wins
    expect(r.layers).toBeGreaterThan(10)
    expect(r.whence).toEqual([
        ['filter.cullingRadius', 'preset'], ['filter.weightFilter.alpha', 'defaults'], ['filter.weightFilter.rangeNodes.min', 'app'],
        ['interaction.λbounds', 'app'], ['geometry.layers', 'defaults'],
    ])
})

test('merge rules: null switches off, undefined is ignored, functions and class instances replace', async ({ page }) => {
    await page.goto('harness.html?gen=data')
    const r = await page.evaluate(() => {
        const d = hyt.defaults()
        const t = d.geometry.transformation
        const { model } = hyt.resolveModel(d, [{ name: 'app', overlay: {
            filter: { weightFilter: null, cullingRadius: undefined },
            layout: { weight: n => 42 },
        } }])
        return { weightFilter: model.filter.weightFilter, cullingRadius: model.filter.cullingRadius,
                 weight: model.layout.weight({}), sameTransformation: model.geometry.transformation === t }
    })
    expect(r.weightFilter).toBeNull()
    expect(r.cullingRadius).toBe(.99)
    expect(r.weight).toBe(42)
    expect(r.sameTransformation).toBe(true)
})

test('migrate: v1 option names are translated with a warning', async ({ page }) => {
    const warnings = []
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()) })
    await page.goto('harness.html?gen=data')
    const r = await page.evaluate(() => hyt.migrate({
        geometry: { halfPlane: true, decorator: 1, addLayer: ['cells'] },
        filter: { maxlabels: 7, cullingWeight: { min: 1, max: 2 } },
        interaction: { wheelSensitivity: 2 },
    }))
    expect(r.geometry.view).toBe('halfplane')
    expect(r.geometry.decorator).toBeUndefined()
    expect(r.geometry.layerOptions.cells.invisible).toBe(false)
    expect(r.geometry.layerOptions['labels-force'].maxLabels).toBe(7)
    expect(r.filter.weightFilter.rangeNodes).toEqual({ min: 1, max: 2 })
    expect(r.interaction.wheelFactor).toBe(2)
    for (const old of ['geometry.halfPlane', 'geometry.decorator', 'filter.maxlabels', 'filter.cullingWeight', 'interaction.wheelSensitivity'])
        expect(warnings.some(w => w.includes(old) && w.includes('deprecated'))).toBe(true)
})

test('the model given to the component is an overlay: ht.args is the resolved model, ht.provenance says where a value came from', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, `gen=nTree&depth=4&childs=2&interaction=${encodeURIComponent(JSON.stringify({ wheelFactor: 1.5 }))}`)
    const r = await page.evaluate(() => ({
        wheelFactor: harness.ht.args.interaction.wheelFactor, holdDuration: harness.ht.args.interaction.holdDuration,
        from: [hyt.whence(harness.ht.provenance, 'interaction.wheelFactor'), hyt.whence(harness.ht.provenance, 'interaction.holdDuration')],
        layerArgs: harness.ht.unitdisk.layerStack.layers['nodes'].args.lazyScale,
    }))
    expect(r.wheelFactor).toBe(1.5)
    expect(r.holdDuration).toBe(500)
    expect(r.from).toEqual(['url', 'defaults'])     // the harness names its stack entries (config.js): the link's options are "url"
    expect(r.layerArgs).toBe(1.5)                   // a layer's default comes from the layer class
    expectNoErrors(errors)
})

test('configure(): changes options at runtime and updates what they affect', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, `gen=nTree&depth=5&childs=3&labels=1&layers=${encodeURIComponent(JSON.stringify({ labels: { background: true } }))}`)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const ht = harness.ht
        const heightBefore = document.querySelector('[id="labels"] rect.caption-background').getAttribute('height')
        const effects = [
            ht.configure({ geometry: { captionHeight: .1 } }),                       // labels: measured again, redrawn
            ht.configure({ interaction: { wheelFactor: 2 } }),                       // none: read at the next wheel
            ht.configure({ geometry: { layerOptions: { cells: { invisible: false } } } }),   // layers: the stack is built again
        ]
        const heightAfter = document.querySelector('[id="labels"] rect.caption-background').getAttribute('height')
        return { effects, heightBefore: +heightBefore, heightAfter: +heightAfter,
                 wheelFactor: ht.args.interaction.wheelFactor, from: hyt.whence(ht.provenance, 'interaction.wheelFactor'),
                 cells: document.querySelectorAll('[id="cells"] polygon').length }
    })
    expect(r.effects).toEqual(['labels', 'none', 'layers'])
    expect(r.heightAfter).toBeGreaterThan(r.heightBefore * 2)
    expect(r.wheelFactor).toBe(2)
    expect(r.from).toBe('configure')
    expect(r.cells).toBeGreaterThan(10)
    expectNoErrors(errors)
})

test('geometry.layers as data: an own stack with a spec per layer, options and removed', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('harness.html?gen=nTree&depth=4&childs=3&labels=1')
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    const r = await page.evaluate(() => {
        const ht = harness.ht
        ht.configure({ geometry: { layers: [
            { type: 'background' },
            { type: 'arcs', name: 'my-links', options: { curvature: '0' } },
            { type: 'nodes', name: 'nodes', options: { show: 'all' } },
            { type: 'labels', name: 'labels', removed: true },
            { type: 'interaction', name: 'interaction-2' },
        ] } })
        return { names: Object.keys(ht.unitdisk.layerStack.layers), straight: document.querySelectorAll('[id="my-links"] path').length,
                 circles: document.querySelectorAll('[id="nodes"] circle').length, visible: ht.unitdisk.cache.unculledNodes.length,
                 firstD: document.querySelector('[id="my-links"] path').getAttribute('d') }
    })
    expect(r.names).toEqual(['background', 'my-links', 'nodes', 'interaction-2'])
    expect(r.straight).toBeGreaterThan(10)
    expect(r.firstD).toMatch(/^M [^A]* L /)         // straight links (curvature '0')
    expect(r.circles).toBe(r.visible)               // show: 'all'
    expectNoErrors(errors)
})
