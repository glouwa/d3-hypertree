import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, diskBox, waitForStable } from './helpers.mjs'

// Features described in the documentation (readme.md and docs/readme.md).
// Each test checks the documented behavior. Features that no longer work are
// marked test.fail: they are part of the public promise to users and should come
// back in v2; Playwright reports when one starts passing.

const m = obj => `model=${encodeURIComponent(JSON.stringify(obj))}`
const tree = 'file=fixtures/small.d3.json'

// --- readme.md ------------------------------------------------------------------

// readme "Layer Configuration" example: layerOptions.nodes.nodeColor and
// layerOptions['link-arcs'].linkColor. The code reads fill / stroke instead.
test.fail('readme: nodeColor and linkColor color nodes and links', async ({ page }) => {
    await openTree(page, 'gen=nTree&depth=6&childs=2&docColors=1')
    const s = await page.evaluate(() => harness.scene())
    expect(s.nodes.some(n => n.fill === 'rgb(229, 57, 53)')).toBe(true)
    expect(Object.keys(s.linkColors)).toContain('rgb(229, 57, 53)')
})

// readme cheat sheet: interaction.wheelSensitivity (the code reads wheelFactor).
test.fail('readme: interaction.wheelSensitivity changes the zoom step', async ({ page }) => {
    const step = async query => {
        await openTree(page, query)
        await page.evaluate(() => harness.ht.api.gotoλ(0.3))
        await waitForStable(page)
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.wheel(0, 100)
        await page.waitForTimeout(200)
        return page.evaluate(() => 0.3 / harness.ht.unitdisk.args.transformation.state.λ)
    }
    const normal = await step('gen=nTree&depth=6&childs=2')
    const sensitive = await step(`gen=nTree&depth=6&childs=2&interaction=${encodeURIComponent(JSON.stringify({ wheelSensitivity: 2 }))}`)
    expect(sensitive).toBeGreaterThan(normal * 1.3)
})

test('readme: interaction.wheelFactor (current name) changes the zoom step', async ({ page }) => {
    const step = async query => {
        await openTree(page, query)
        await page.evaluate(() => harness.ht.api.gotoλ(0.3))
        await waitForStable(page)
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.wheel(0, 100)
        await page.waitForTimeout(200)
        return page.evaluate(() => 0.3 / harness.ht.unitdisk.args.transformation.state.λ)
    }
    const normal = await step('gen=nTree&depth=6&childs=2')
    const strong = await step(`gen=nTree&depth=6&childs=2&interaction=${encodeURIComponent(JSON.stringify({ wheelFactor: 2 }))}`)
    expect(strong).toBeGreaterThan(normal * 1.3)
})

// readme cheat sheet: layout.linklen (not referenced anywhere in the code).
test.fail('readme: layout.linklen sets the link length', async ({ page }) => {
    const firstChildR = async query => {
        await openTree(page, `${query}&filter=off`)
        return page.evaluate(() => { const z = harness.ht.data.children[0].layout.z; return Math.hypot(z.re, z.im) })
    }
    const normal = await firstChildR('gen=nTree&depth=4&childs=2')
    // a function can't be passed through the URL, so set it before loading
    await page.goto('harness.html?gen=nTree&depth=4&childs=2&filter=off')
    const longer = await page.evaluate(async () => {
        await harness.ready
        harness.ht.args.layout.linklen = n => 2
        harness.ht.api.setModel(Object.assign({}, harness.ht.args, { layout: Object.assign({}, harness.ht.args.layout, { linklen: n => 2 }) }))
        await new Promise(r => setTimeout(r, 1500))
        const z = harness.ht.data.children[0].layout.z
        return Math.hypot(z.re, z.im)
    })
    expect(longer).toBeGreaterThan(normal * 1.2)
})

// readme cheat sheet: filter.weightFilter: null | number | {...}
// Today null doesn't even arrive: merging with the defaults drops it, and the
// filter code dereferences weightFilter unconditionally.
test.fail('readme: filter.weightFilter null disables weight culling', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(`harness.html?gen=nTree&depth=5&childs=4&${m({ filter: { weightFilter: null } })}`)
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => harness.ht.args.filter.weightFilter)).toBeNull()
    expectNoErrors(errors)
    expect(await page.evaluate(() => document.querySelectorAll('#nodes circle').length)).toBeGreaterThan(0)
})

// --- docs/readme.md (API reference) ---------------------------------------------

// "Available Layers": link-lines and path-lines
for (const layer of ['link-lines', 'path-lines']) {
    test.fail(`docs: layer "${layer}" is available`, async ({ page }) => {
        await openTree(page, tree)
        expect(await page.evaluate(() => harness.layerNames())).toContain(layer)
    })
}

// "Geometry and Layer Options": addLayer / removeLayer
test.fail('docs: geometry.removeLayer removes a default layer', async ({ page }) => {
    await openTree(page, `${tree}&${m({ geometry: { removeLayer: ['stem-arc'] } })}`)
    expect(await page.evaluate(() => harness.layerNames())).not.toContain('stem-arc')
})

test.fail('docs: geometry.addLayer enables an optional layer', async ({ page }) => {
    await openTree(page, `${tree}&${m({ geometry: { addLayer: ['traces'] } })}`)
    expect(await page.evaluate(() => harness.layer('traces').args.invisible)).toBe(false)
})

// "animateUpRadius: transformation.λ will be set to a value such that the initial
// tree will fit within a circle with radius animateUpRadius"
test.fail('docs: geometry.animateUpRadius fits the initial tree into that radius', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&${m({ geometry: { animateUpRadius: 0.5 } })}`)
    const maxR = await page.evaluate(() => Math.max(...harness.ht.unitdisk.cache.unculledNodes.map(n => n.cachep.r)))
    expect(maxR).toBeLessThanOrEqual(0.55)
})

// "Data Model": iconmap (unicode emojis by node id) and langmap (translations)
test.fail('docs: iconmap assigns emojis to nodes', async ({ page }) => {
    await openTree(page, `${tree}&${m({ iconmap: { a: '🐱', b: '🐶' } })}`)
    expect(await page.evaluate(() => document.querySelectorAll('#emojis text').length)).toBeGreaterThan(0)
})

test.fail('docs: langmap translates node labels', async ({ page }) => {
    await openTree(page, `${tree}&${m({ langmap: { a: 'Ast A', b: 'Ast B' } })}`)
    expect(await page.evaluate(() => harness.scene().labels)).toContain('Ast A')
})

// "Filter Options": cullingWeight { min, max } = range of visible nodes
test.fail('docs: filter.cullingWeight limits the number of visible nodes', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=5&childs=4&${m({ filter: { cullingWeight: { min: 10, max: 20 } } })}`)
    for (let i = 0; i < 100; i++) await page.evaluate(() => harness.ht.update.transformation())
    expect(await page.evaluate(() => harness.ht.unitdisk.cache.unculledNodes.length)).toBeLessThanOrEqual(30)
})

// "Filter Options": transformation.P = initial root position
test.fail('docs: filter.transformation.P sets the initial translation', async ({ page }) => {
    await openTree(page, `${tree}&${m({ filter: { transformation: { P: { re: 0.3, im: 0 } } } })}`)
    const P = await page.evaluate(() => harness.ht.unitdisk.args.transformation.state.P)
    expect(P.re).toBeCloseTo(0.3, 2)
})

// "Data Model": objects.selections = highlighted nodes
test('docs: objects.selections can be changed through toggleSelection', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, tree)
    const sel = await page.evaluate(() => {
        harness.ht.api.toggleSelection(harness.ht.data.children[0])
        return harness.ht.args.objects.selections.map(n => n.data.name)
    })
    expect(sel).toEqual(['a'])
    expectNoErrors(errors)
})
