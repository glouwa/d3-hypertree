import { test, expect } from '@playwright/test'

// The filter's internal magic settles at initialization: the first frame already shows
// the final visible set (it used to grow over many updates, mostly while interacting).
test('the visible node set is final from the first frame', async ({ page }) => {
    await page.goto('harness.html?gen=nTree&depth=10&childs=2')
    await page.waitForFunction(() => window.harness && harness.ht.data && document.querySelector('#link-arcs > *'))
    const visible = () => page.evaluate(() => harness.ht.unitdisk.cache.unculledNodes.length)
    const first = await visible()
    for (let i = 0; i < 20; i++) await page.evaluate(() => harness.ht.update.transformation())
    expect(await visible()).toBe(first)
    // within rangeNodes (magic has only a wide internal safety bound)
    const f = await page.evaluate(() => harness.ht.args.filter.weightFilter)
    expect(first <= f.rangeNodes.max).toBe(true)
    expect(first >= f.rangeNodes.min).toBe(true)
})

test('a configured weightFilter.magic is ignored with a warning', async ({ page }) => {
    const warnings = []
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()) })
    await page.goto('harness.html?gen=nTree&depth=6&childs=2&filterOpt=' + encodeURIComponent('{"weightFilter":{"magic":3}}'))
    await page.waitForFunction(() => window.harness && harness.ht.data)
    expect(warnings.some(w => w.includes('magic') && w.includes('rangeNodes'))).toBe(true)
})
import { collectErrors, expectNoErrors, openTree, expectScene, expectPlausibleScene, diskBox } from './helpers.mjs'

// Filter options. The filter decides which nodes are visible, so each option gets
// its own scene snapshots, changing one option at a time against the defaults.
// A wide tree with labels gives the filter something to cut.

const base = 'gen=nTree&depth=5&childs=4&labels=1'   // 1,365 nodes
const withFilter = opt => `${base}&filterOpt=${encodeURIComponent(JSON.stringify(opt))}`

// The filter adapts weightFilter.magic by the factor alpha on every update, so it
// needs several frames to converge; right after loading (no updates yet) it is
// not settled. Run updates until magic and the visible node count stop changing,
// with a fixed upper bound so the result stays deterministic.
const settle = page => page.evaluate(() => {
    const f = harness.ht.args.filter.weightFilter
    let last = '', same = 0
    for (let i = 0; i < 200 && same < 5; i++) {
        harness.ht.update.transformation()
        const sig = f.magic + '|' + harness.ht.unitdisk.cache.unculledNodes.length
        if (sig === last) same++; else { same = 0; last = sig }
    }
})

const open = async (page, query) => { await openTree(page, query); await settle(page) }

const stats = page => page.evaluate(() => {
    const cache = harness.ht.unitdisk.cache
    return {
        unculled: cache.unculledNodes.length,
        maxR: Math.max(...cache.unculledNodes.map(n => n.cachep.r)),
        labels: harness.scene().labels.length,
    }
})

let defaults
test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 }, baseURL: test.info().project.use.baseURL })
    await open(page, base)
    defaults = await stats(page)
    await page.close()
})

test('defaults', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await open(page, base)
    await expectPlausibleScene(page)
    await expectScene(page, testInfo, 'defaults')
    expectNoErrors(errors)
})

const cases = [
    // name, filter option, extra check against the defaults
    // cullingRadius only culls nodes whose parent lies outside the focus area
    ['cullingRadius-0.9', { cullingRadius: 0.9 }, (s, d) => expect(s.unculled).toBeLessThan(d.unculled)],
    ['cullingRadius-0.95', { cullingRadius: 0.95 }, (s, d) => expect(s.unculled).toBeLessThanOrEqual(d.unculled)],
    ['rangeNodes-small', { weightFilter: { rangeNodes: { min: 20, max: 40 } } }, (s, d) => expect(s.unculled).toBeLessThan(d.unculled)],
    // at this zoom the default already shows every node the focus and cullingRadius
    // rules allow, so more can't appear
    ['rangeNodes-large', { weightFilter: { rangeNodes: { min: 600, max: 900 } } }, (s, d) => expect(s.unculled).toBeGreaterThanOrEqual(d.unculled)],
    ['focusExtension-1', { focusExtension: 1 }, () => {}],
    ['focusExtension-2.5', { focusExtension: 2.5 }, () => {}],
    ['maxFocusRadius-0.5', { maxFocusRadius: 0.5 }, () => {}],
    ['maxlabels-3', { maxlabels: 3 }, s => expect(s.labels).toBeLessThanOrEqual(3)],
    ['maxlabels-60', { maxlabels: 60 }, (s, d) => expect(s.labels).toBeGreaterThanOrEqual(d.labels)],
]

for (const [name, opt, check] of cases) {
    test(name, async ({ page }, testInfo) => {
        const errors = collectErrors(page)
        await open(page, withFilter(opt))
        check(await stats(page), defaults)
        await expectPlausibleScene(page)
        await expectScene(page, testInfo, name)
        expectNoErrors(errors)
    })
}

test('weight: uniform node weights', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await open(page, `${base}&weight=uniform`)
    await expectPlausibleScene(page)
    await expectScene(page, testInfo, 'weight-uniform')
    expectNoErrors(errors)
})

// Regression: when many nodes share one weight, a single step of magic shows or hides
// all of them at once. If that jumps over the whole rangeNodes (below min -> above max),
// the next step went back: the visible set flipped on every update (the Metatheria
// branch of the Tree of Life flickered). The filter must settle instead.
// Nodes inside the focus circle are never hidden: with more of them than rangeNodes.max
// (a flat tree zoomed out) no magic helps. magic used to sink toward 0 on every update;
// moved away from the center every node was then too light, nothing was drawn
// (Coleoptera 16.1 in hypertree-of-life: 0 visible nodes).
test('a flat tree: magic stops sinking when it hides nothing, the tree never gets empty', async ({ page }) => {
    const filterOpt = encodeURIComponent(JSON.stringify({ weightFilter: { rangeNodes: { min: 100, max: 300 } } }))
    await page.goto(`harness.html?gen=star&n=3000&filterOpt=${filterOpt}`)
    await page.waitForFunction(() => window.harness && harness.ht && harness.ht.unitdisk && harness.ht.unitdisk.cache && harness.ht.unitdisk.cache.unculledNodes)
    // many frames at the center
    await page.evaluate(async () => { for (let i = 0; i < 60; i++) { harness.ht.update.transformation(); await new Promise(r => requestAnimationFrame(r)) } })
    const center = await page.evaluate(() => ({ visible: harness.ht.unitdisk.cache.unculledNodes.length, magic: harness.ht.args.filter.weightFilter.magic }))
    expect(center.visible).toBeGreaterThan(300)          // more than max: inside the focus
    expect(center.magic).toBeGreaterThan(1e-3)           // did not sink toward 0
    // moved away: never empty (the start node at least). (In a star all leaves weigh
    // the same: one step of magic shows or hides all of them, the filter then stays
    // below rangeNodes on purpose, see the oscillation test below.)
    await page.evaluate(() => harness.ht.api.goto({ re: 0, im: .6 }, null))
    const counts = await page.evaluate(async () => {
        const out = []
        for (let i = 0; i < 60; i++) { harness.ht.update.transformation(); await new Promise(r => requestAnimationFrame(r)); out.push(harness.ht.unitdisk.cache.unculledNodes.length) }
        return out
    })
    expect(Math.min(...counts)).toBeGreaterThan(0)
})

// Zoomed fully in, dragged, zoomed out again: the filter used to stop far above
// rangeNodes.max. Limits learned zoomed in held after zooming out, and the steps
// ended with the last update of the interaction (Mammalia: 1699 nodes of 750..1000).
// Now it goes on by itself until the count is in the range, and then stops updating.
test('zoomed in, dragged, zoomed out: the count comes back into rangeNodes by itself', async ({ page }) => {
    const errors = collectErrors(page)
    const filterOpt = encodeURIComponent(JSON.stringify({ weightFilter: { rangeNodes: { min: 300, max: 400 } } }))
    await openTree(page, `gen=nTree&depth=12&childs=2&filterOpt=${filterOpt}`)
    const box = await diskBox(page)
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -300)
    await page.waitForTimeout(500)
    await page.mouse.down()
    for (let i = 0; i < 30; i++) await page.mouse.move(cx + 200 * Math.sin(i / 5), cy + 150 * Math.cos(i / 4))
    await page.mouse.up()
    await page.waitForTimeout(500)
    await page.mouse.move(cx, cy)
    for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 300)
    // settled: no update for half a second (one step per frame; slow under load)
    const s = await page.evaluate(async () => {
        const ud = harness.ht.unitdisk, f = ud.update.transformation.bind(ud.update)
        let last = performance.now()
        ud.update.transformation = (...a) => { last = performance.now(); return f(...a) }
        const t0 = performance.now()
        while (performance.now() - last < 500 && performance.now() - t0 < 20000) await new Promise(r => setTimeout(r, 100))
        return { visible: ud.cache.unculledNodes.length, settled: performance.now() - last >= 500 }
    })
    expect(s.settled).toBe(true)
    expect(s.visible).toBeLessThanOrEqual(400)
    expect(s.visible).toBeGreaterThan(0)
    expectNoErrors(errors)
})

test('magic does not oscillate when one step jumps over the whole rangeNodes', async ({ page }) => {
    const errors = collectErrors(page)
    const filterOpt = encodeURIComponent(JSON.stringify({ weightFilter: { rangeNodes: { min: 300, max: 500 } } }))
    await openTree(page, `gen=nTree&depth=4&childs=6&filterOpt=${filterOpt}`)   // flipped 1555 / 259
    const counts = await page.evaluate(() => {
        const ht = harness.ht, out = []
        for (let i = 0; i < 12; i++) { ht.update.transformation(); out.push(ht.unitdisk.cache.unculledNodes.length) }
        return out
    })
    // after the first updates it stays put (no A, B, A, B ...)
    const tail = counts.slice(-6)
    expect(new Set(tail).size, counts.join(' ')).toBe(1)
    expectNoErrors(errors)
})
