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
import { collectErrors, expectNoErrors, openTree, expectScene, expectPlausibleScene } from './helpers.mjs'

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
