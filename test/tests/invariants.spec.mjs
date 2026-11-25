import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox } from './helpers.mjs'

// Invariants of a rendered tree that must hold for every tree shape, before and after
// interacting: positions in the disk, the visible set connected and within
// rangeNodes, links and cells matching the visible nodes, the center node the
// nearest one, labels within maxlabels.

const trees = [
    ['binary tree', 'gen=nTree&depth=9&childs=2&labels=1'],
    ['wide tree', 'gen=nTree&depth=5&childs=6&labels=1'],
    ['star', 'gen=star&n=400&labels=1'],
    ['path', 'gen=path&n=120&labels=1'],
    ['deep star', 'gen=deepStar&arms=4&depth=30&labels=1'],
    ['flare.csv', 'file=fixtures/flare.csv&labels=name'],
    ['file system (10k)', 'file=fixtures/filesystem.d3.json&labels=name'],
]

// all checks in one pass over the current frame
const check = (page, afterLoading) => page.evaluate(afterLoading => {
    const ht = harness.ht, ud = ht.unitdisk, cache = ud.cache
    const problems = []
    const unculled = cache.unculledNodes
    const set = new Set(unculled)
    const all = ht.data.descendants()
    const range = ht.args.filter.weightFilter && ht.args.filter.weightFilter.rangeNodes
    const finite = c => c && isFinite(c.re) && isFinite(c.im)

    if (unculled[0] !== ht.data) problems.push('the first visible node is not the root')
    for (const n of unculled) {
        if (!finite(n.cache) || Math.hypot(n.cache.re, n.cache.im) >= 1) { problems.push(`node ${n.mergeId} outside the disk`); break }
        if (n.parent && !set.has(n.parent)) { problems.push(`node ${n.mergeId} visible without its parent`); break }
    }
    // (hidden nodes may keep a layout of an older zoom: only the visible ones)
    for (const n of unculled) if (!finite(n.layout.z) || Math.hypot(n.layout.z.re, n.layout.z.im) >= 1) { problems.push(`layout of ${n.mergeId} outside the disk`); break }

    // the visible count within rangeNodes (unless the whole tree is smaller). After
    // zooming in, nodes beyond the rim are gone for good: the minimum only after loading
    if (range && all.length > range.min && ((afterLoading && unculled.length < range.min * .9) || unculled.length > range.max * 1.1))
        problems.push(`${unculled.length} visible nodes, rangeNodes ${range.min}..${range.max}`)

    // links and cells match the visible nodes
    const linkEls = document.querySelectorAll('[id="link-arcs"] > *').length
    if (linkEls !== unculled.length - 1) problems.push(`${linkEls} links for ${unculled.length} nodes`)
    // one cell per position (nodes at the same position share one). Known limit: points
    // crowded on a circle arc near the rim (a path tree after dragging) are a degenerate
    // case for d3-delaunay, a few of them get no cell (find still gives the right node)
    const positions = new Set(unculled.filter(n => n.precalc.clickable).map(n => n.cache.re + ',' + n.cache.im)).size
    if (cache.cells.length && (cache.cells.length > positions || cache.cells.length < positions * .9))
        problems.push(`${cache.cells.length} cells for ${positions} positions of clickable nodes`)

    // the center node is the visible node nearest to the center, within the hysteresis
    // of 0.02 (the last center stays while no node is clearly nearer; magic-filter.ts)
    const nearest = unculled.reduce((a, b) => Math.hypot(b.cache.re, b.cache.im) < Math.hypot(a.cache.re, a.cache.im) ? b : a)
    if (cache.centerNode && Math.hypot(cache.centerNode.cache.re, cache.centerNode.cache.im) > Math.hypot(nearest.cache.re, nearest.cache.im) + .02 + 1e-9)
        problems.push('the center node is not the nearest visible node')

    // labels: at most the default limit of the label layers, the root has one
    const labels = cache.labels || []
    if (labels.length > hyt.DEFAULT_MAX_LABELS) problems.push(`${labels.length} labels, maxLabels ${hyt.DEFAULT_MAX_LABELS}`)
    if (labels.length && ht.data.precalc.label && !labels.includes(ht.data)) problems.push('the root has no label')
    if (labels.some(n => !set.has(n))) problems.push('a label of a hidden node')
    return { problems, visible: unculled.length }
}, afterLoading)

for (const [name, query] of trees) {
    test(`${name}: invariants after loading and after dragging and zooming`, async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, query)
        await waitForStable(page)
        const loaded = await check(page, true)
        expect(loaded.problems, name).toEqual([])
        expect(loaded.visible).toBeGreaterThan(5)

        // drag, zoom in, drag back, zoom out
        const box = await diskBox(page)
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width / 2
        await page.mouse.move(cx + r * .3, cy + r * .2)
        await page.mouse.down()
        await page.mouse.move(cx - r * .2, cy - r * .1, { steps: 8 })
        await page.mouse.up()
        await page.mouse.wheel(0, -400)
        await page.mouse.move(cx - r * .1, cy + r * .3)
        await page.mouse.down()
        await page.mouse.move(cx + r * .25, cy - r * .2, { steps: 8 })
        await page.mouse.up()
        await page.mouse.wheel(0, 300)
        await waitForStable(page)
        const after = await check(page, false)
        expect(after.problems, name + ' after interacting').toEqual([])
        expectNoErrors(errors)
    })
}
