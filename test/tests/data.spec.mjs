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
