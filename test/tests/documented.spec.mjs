import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, diskBox, waitForStable } from './helpers.mjs'

// Features described in the documentation (readme.md and docs/readme.md).
// Each test checks the documented behavior. Features that no longer work are
// marked test.fail until phase 2 step 5, which brought them back (renamed ones as
// deprecated aliases with a warning).

const m = obj => `model=${encodeURIComponent(JSON.stringify(obj))}`
const tree = 'file=fixtures/small.d3.json'

// --- readme.md ------------------------------------------------------------------

// readme "Layer Configuration" example: layerOptions.nodes.nodeColor and
// layerOptions['link-arcs'].linkColor (deprecated aliases of fill / stroke).
test('readme: nodeColor and linkColor color nodes and links', async ({ page }) => {
    await openTree(page, 'gen=nTree&depth=6&childs=2&docColors=1')
    const s = await page.evaluate(() => harness.scene())
    expect(s.nodes.some(n => n.fill === 'rgb(229, 57, 53)')).toBe(true)
    expect(Object.keys(s.linkColors)).toContain('rgb(229, 57, 53)')
})

// readme cheat sheet: interaction.wheelSensitivity (the code reads wheelFactor).
test('readme: interaction.wheelSensitivity changes the zoom step', async ({ page }) => {
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

// readme cheat sheet: layout.linklen is left out for now (the zoom λ is the link
// length in this layout); removed from the docs.

// readme cheat sheet: filter.weightFilter: null | number | {...}
// Today null doesn't even arrive: merging with the defaults drops it, and the
// filter code dereferences weightFilter unconditionally.
test('readme: filter.weightFilter null disables weight culling', async ({ page }) => {
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
    test(`docs: layer "${layer}" is available`, async ({ page }) => {
        await openTree(page, tree)
        expect(await page.evaluate(() => harness.layerNames())).toContain(layer)
    })
}

// "Geometry and Layer Options": addLayer / removeLayer
test('docs: geometry.removeLayer removes a default layer', async ({ page }) => {
    await openTree(page, `${tree}&${m({ geometry: { removeLayer: ['stem-arc'] } })}`)
    expect(await page.evaluate(() => harness.layerNames())).not.toContain('stem-arc')
})

test('docs: geometry.addLayer enables an optional layer', async ({ page }) => {
    await openTree(page, `${tree}&${m({ geometry: { addLayer: ['traces'] } })}`)
    expect(await page.evaluate(() => harness.layer('traces').args.invisible)).toBe(false)
})

// "animateUpRadius: transformation.λ will be set to a value such that the initial
// tree will fit within a circle with radius animateUpRadius"
test('docs: geometry.animateUpRadius fits the initial tree into that radius', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&${m({ geometry: { animateUpRadius: 0.5 } })}`)
    const maxR = await page.evaluate(() => Math.max(...harness.ht.unitdisk.cache.unculledNodes.map(n => n.cachep.r)))
    expect(maxR).toBeLessThanOrEqual(0.55)
})

// "Data Model": iconmap (unicode emojis by node id) and langmap (translations)
test('docs: iconmap assigns emojis to nodes', async ({ page }) => {
    await openTree(page, `${tree}&${m({ iconmap: { a: '🐱', b: '🐶' } })}`)
    expect(await page.evaluate(() => document.querySelectorAll('#emojis text').length)).toBeGreaterThan(0)
})

test('docs: langmap translates node labels', async ({ page }) => {
    await openTree(page, `${tree}&${m({ langmap: { a: 'Ast A', b: 'Ast B' } })}`)
    expect(await page.evaluate(() => harness.scene().labels)).toContain('Ast A')
})

// "Filter Options": cullingWeight { min, max } = range of visible nodes
// The range is a target: nodes inside the focus area are never culled by weight, and
// magic is bounded by rangeCullingWeight, so a tree may not reach every range.
test('docs: filter.cullingWeight limits the number of visible nodes', async ({ page }) => {
    const visible = async range => {
        await openTree(page, `gen=nTree&depth=5&childs=4&${m({ filter: { cullingWeight: range } })}`)
        expect(await page.evaluate(() => harness.ht.args.filter.weightFilter.rangeNodes)).toEqual(range)
        return page.evaluate(() => harness.ht.unitdisk.cache.unculledNodes.length)
    }
    const few = await visible({ min: 10, max: 20 })
    const many = await visible({ min: 300, max: 600 })
    expect(few).toBeLessThan(many)
    expect(many).toBeGreaterThanOrEqual(300)
})

// "Filter Options": transformation.P = initial root position
test('docs: filter.transformation.P sets the initial translation', async ({ page }) => {
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

// Renamed options keep working and print a deprecation warning naming the current option.
test('deprecated option names print a warning with the current name', async ({ page }) => {
    const warnings = []
    page.on('console', msg => { if (msg.type() === 'warning') warnings.push(msg.text()) })
    await openTree(page, `${tree}&${m({
        interaction: { wheelSensitivity: 1.3 },
        geometry: { animateUpRadius: 0.9 },
        filter: { cullingWeight: { min: 10, max: 400 }, transformation: { P: { re: 0.1, im: 0 } } },
    })}`)
    for (const [old, now] of [['wheelSensitivity', 'wheelFactor'], ['animateUpRadius', 'layout.initSize'],
                              ['cullingWeight', 'rangeNodes'], ['filter.transformation.P', 'geometry.startPosition']])
        expect(warnings.some(w => w.includes(old) && w.includes(now)), old).toBe(true)
})

test('geometry.startPosition sets the initial translation (current name)', async ({ page }) => {
    await openTree(page, `${tree}&${m({ geometry: { startPosition: { re: -0.2, im: 0.1 } } })}`)
    const P = await page.evaluate(() => harness.ht.unitdisk.args.transformation.state.P)
    expect(P.re).toBeCloseTo(-0.2, 9)
    expect(P.im).toBeCloseTo(0.1, 9)
})

test('filter.weightFilter null: no node is culled by weight', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=4&childs=3&${m({ filter: { weightFilter: null, cullingRadius: 1 } })}`)
    expect(await page.evaluate(() => harness.ht.unitdisk.cache.unculledNodes.every(n => !n.isOutWeight))).toBe(true)
})
