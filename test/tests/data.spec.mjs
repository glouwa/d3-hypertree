import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, expectScene, expectPlausibleScene } from './helpers.mjs'

// Data sources: every loader and file format renders right when initPromise
// resolves (regression: asynchronously loaded files used to stay invisible
// until the first interaction).

const total = page => page.evaluate(() => harness.ht.data.descendants().length)
const drawnAtReady = page => page.evaluate(() => document.querySelectorAll('#nodes circle').length)

const sources = [
    // name,        query,                                   nodes in the data
    ['generator',   'gen=nTree&depth=6&childs=2',             127],
    ['fromData',    'gen=data',                               9],
    ['d3json',      'file=fixtures/small.d3.json',            11],
    ['csv',         'file=fixtures/flare.csv',                252],
    ['skos',        'file=fixtures/animals.skos.xml',         7],
    ['treeml',      'file=fixtures/primates.treeml.xml',      192],
]

for (const [name, query, count] of sources) {
    test(`${name}: loads ${count} nodes and renders them when ready`, async ({ page }, testInfo) => {
        const errors = collectErrors(page)
        await page.goto(`harness.html?${query}`)
        await page.waitForFunction(() => window.harness)
        await page.evaluate(() => harness.ready)
        expect(await total(page)).toBe(count)
        expect(await drawnAtReady(page)).toBeGreaterThan(0)

        await openTree(page, query) // reload and wait until stable for the snapshot
        await expectPlausibleScene(page)
        await expectScene(page, testInfo, `source-${name}`)
        expectNoErrors(errors)
    })
}

test('fromLangFile: labels come from the language map', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await openTree(page, 'file=fixtures/small.d3.json&lang=fixtures/small.lang.json')
    const labels = await page.evaluate(() => harness.scene().labels)
    expect(labels.length).toBeGreaterThan(0)
    // every rendered label is a translation from the map
    const map = { root: 'Wurzel', a: 'Ast A', b: 'Ast B', c: 'Blatt C', a1: 'A eins', b2: 'B zwei' }
    for (const l of labels) expect(Object.values(map)).toContain(l)
    await expectScene(page, testInfo, 'lang-file')
    expectNoErrors(errors)
})

test('dataInitBFS / langInitBFS: icons and labels from callbacks', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=4&childs=3&labels=1&icons=1')
    const s = await page.evaluate(() => harness.scene())
    expect(s.layers.emojis).toBeGreaterThan(5)
    expect(s.labels.length).toBeGreaterThan(0)
    expect(s.labels.every(l => l.startsWith('Node '))).toBe(true)
    await expectScene(page, testInfo, 'init-callbacks')
    expectNoErrors(errors)
})

// Regression: preset-process.ts called precalc.label.startsWith() without checking
// that a label exists, so icons without labels crashed.
test('icons without labels render without errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('harness.html?gen=nTree&depth=4&childs=3&icons=1')
    await page.waitForTimeout(1500)
    expectNoErrors(errors)
})

test('iconPercent: only that share of the nodes gets an icon, evenly spread', async ({ page }) => {
    const share = async pct => {
        await page.goto(`harness.html?gen=nTree&depth=4&childs=3&labels=1&icons=1${pct === undefined ? '' : '&iconPercent=' + pct}`)
        await page.waitForFunction(() => window.harness && harness.ht.data)
        return page.evaluate(() => {
            const ns = []; harness.ht.data.each(n => ns.push(n))   // breadth-first, like dataInitBFS
            return { n: ns.length, icons: ns.filter(n => n.precalc.icon).length,
                     firstHalf: ns.slice(0, ns.length / 2 | 0).filter(n => n.precalc.icon).length }
        })
    }
    expect(await share()).toMatchObject({ n: 121, icons: 121 })        // default: every node
    expect(await share(100)).toMatchObject({ icons: 121 })
    expect(await share(0)).toMatchObject({ icons: 0 })
    const quarter = await share(25)
    expect(quarter.icons).toBe(30)                                      // floor(121 * 0.25)
    expect(Math.abs(quarter.firstHalf - 15)).toBeLessThanOrEqual(1)     // spread, not the first 30
})

// Multi-line labels: a '\n' in precalc.label gives one tspan per line; the measured
// width is the longest line; the background (labels-force) covers all lines.
test('labels with \n render on several lines', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('harness.html?gen=nTree&depth=3&childs=2&filter=off')
    await page.waitForFunction(() => window.harness && harness.ht.data)
    const r = await page.evaluate(async () => {
        const ht = harness.ht
        ht.args.langInitBFS = (ht, n) => { n.precalc.label = n.depth === 1 ? 'first line\nsecond, longer line\nthird' : 'one line' }
        ht.updateLang_()
        ht.update.data()
        await new Promise(r => setTimeout(r, 300))
        const multi = [...document.querySelectorAll('#labels text')].filter(t => t.__data__.depth === 1)
        const single = [...document.querySelectorAll('#labels text')].filter(t => t.__data__.depth !== 1)
        const n1 = ht.data.children[0]
        return {
            multiTspans: multi.map(t => t.querySelectorAll('tspan').length),
            lines: multi.length ? [...multi[0].querySelectorAll('tspan')].map(s => s.textContent) : [],
            singleTspans: single.map(t => t.querySelectorAll('tspan').length),
            singleText: single.length ? single[0].textContent : null,
            width: n1.precalc.labelslen,
            widthOfLongest: (() => { const c = document.createElement('canvas').getContext('2d'); c.font = ht.args.geometry.captionFont
                                     return c.measureText('second, longer line').width / 200 / window.devicePixelRatio })(),
        }
    })
    expect(r.multiTspans.length).toBeGreaterThan(0)
    expect(r.multiTspans.every(n => n === 3)).toBe(true)
    expect(r.lines).toEqual(['first line', 'second, longer line', 'third'])
    expect(r.singleTspans.every(n => n === 0)).toBe(true)
    expect(r.singleText).toBe('one line')
    expect(r.width).toBeCloseTo(r.widthOfLongest, 9)
    expectNoErrors(errors)
})
