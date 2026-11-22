import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox, expectScene, expectPlausibleScene } from './helpers.mjs'

// Configuration options and switchable features. Every option is changed on its
// own against the defaults and checked by state and scene snapshot.

const base = 'gen=nTree&depth=4&childs=3&labels=1&icons=1'
const ALWAYS = ['interaction-2']

test.describe('each layer on its own', () => {
    // layer names as configured by the default layer set
    const layers = ['background', 'cells', 'culling-r', 'mouse-r', 'focus-r', 'labels-r-𝐖', 'λ', '(0,0)',
        'center-node', 'path-arcs', 'link-arcs', 'stem-arc', 'nodes', 'symbols', 'images', 'emojis',
        'labels', 'labels-force', 'traces']
    const safe = name => name.replace(/[^a-z0-9-]/gi, c => ({ '(': '', ')': '', ',': '-', 'λ': 'lambda', '𝐖': 'W' })[c] ?? '_')

    test('the default layer set is unchanged', async ({ page }) => {
        await openTree(page, base)
        expect(await page.evaluate(() => harness.layerNames())).toEqual([...layers.slice(0, -1), ...ALWAYS, 'traces'])
    })

    for (const layer of layers) {
        test(`only "${layer}"`, async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, base)
            await page.evaluate(l => harness.showOnly([l, 'interaction', 'interaction-2']), layer)
            await waitForStable(page)
            const counts = await page.evaluate(() => harness.scene().layers)
            for (const [name, n] of Object.entries(counts)) {
                if (name === layer || ALWAYS.includes(name)) continue
                // every other data-driven layer is empty
                if (!['background', 'λ', '(0,0)', 'stem-arc', 'center-node', 'culling-r', 'mouse-r', 'focus-r', 'labels-r-𝐖'].includes(name))
                    expect(n, `${name} must be empty`).toBe(0)
            }
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `only-${safe(layer)}`)
            expectNoErrors(errors)
        })
    }

    test('traces: touch points are drawn while touching', async ({ page, browser }) => {
        const context = await browser.newContext({ viewport: { width: 900, height: 900 }, hasTouch: true, baseURL: test.info().project.use.baseURL })
        const p = await context.newPage()
        const errors = collectErrors(p)
        await openTree(p, `${base}&layers={"traces":{"invisible":false,"hideOnDrag":false}}`)
        const box = await diskBox(p)
        const cdp = await context.newCDPSession(p)
        const x = box.x + box.width * 0.6, y = box.y + box.height * 0.45
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
        for (let i = 1; i <= 5; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 10, y, id: 0 }] })
            await p.waitForTimeout(16)
        }
        await p.waitForTimeout(100)
        const during = await p.evaluate(() => document.getElementById('traces').querySelectorAll('*').length)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await waitForStable(p)
        const after = await p.evaluate(() => document.getElementById('traces').querySelectorAll('*').length)
        expect(during).toBeGreaterThan(0)
        expect(after).toBe(0)
        expectNoErrors(errors)
        await context.close()
    })
})

test.describe('layer options', () => {
    test('color callbacks: node fill and link stroke', async ({ page }, testInfo) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=6&childs=2&colors=1')
        const s = await page.evaluate(() => harness.scene())
        // node circles are only drawn for leaves (all at depth 6 here), so the
        // colors by depth show on the links, which cover every depth
        expect(s.nodes.every(n => n.fill && n.fill.startsWith('rgb'))).toBe(true)
        expect(Object.keys(s.linkColors).length).toBeGreaterThan(1)
        expect(Object.keys(s.linkColors).every(c => c.startsWith('rgb'))).toBe(true)
        await expectScene(page, testInfo, 'colors')
        expectNoErrors(errors)
    })

    // documented values: '+', '-', 'l' (a code comment also mentions '0', see below)
    for (const curvature of ['+', '-', 'l']) {
        test(`link curvature "${curvature}"`, async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, `gen=nTree&depth=6&childs=2&layers=${encodeURIComponent(JSON.stringify({ 'link-arcs': { curvature } }))}`)
            const tag = await page.evaluate(() => { const e = document.getElementById('link-arcs').firstElementChild; return e && e.tagName })
            expect(tag).toBe(curvature === 'l' ? 'line' : 'path')
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `curvature-${{ '+': 'plus', '-': 'minus', 'l': 'line' }[curvature]}`)
            expectNoErrors(errors)
        })
    }

    // Known bug: curvature '0' (mentioned in a comment in preset-layers.ts, not in the
    // docs) crashes with "Cannot read properties of undefined (reading 'nodePosStr')".
    // Regression: curvature '0' crashed (the path function was called without `this`).
    // '0' draws straight lines as SVG paths ('l' draws them as SVG lines).
    test('link curvature "0" draws straight lines', async ({ page }) => {
        const errors = collectErrors(page)
        const layers = encodeURIComponent(JSON.stringify({ 'link-arcs': { curvature: '0' } }))
        await page.goto(`harness.html?gen=nTree&depth=6&childs=2&layers=${layers}`)
        await page.waitForFunction(() => window.harness && harness.ht.data && document.querySelectorAll('#link-arcs path').length > 10)
        const ds = await page.evaluate(() => [...document.querySelectorAll('#link-arcs path')].map(p => p.getAttribute('d')))
        expect(ds.every(d => /^M \S+ \S+ L \S+ \S+$/.test(d))).toBe(true)
        expectNoErrors(errors)
    })

    test('geometry.linkCurvature "0" straightens both arc layers', async ({ page }) => {
        const errors = collectErrors(page)
        await page.goto(`harness.html?gen=nTree&depth=6&childs=2&geometry=${encodeURIComponent('{"linkCurvature":"0"}')}`)
        await page.waitForFunction(() => window.harness && harness.ht.data && document.querySelectorAll('#link-arcs path').length > 10)
        expect(await page.evaluate(() => [...document.querySelectorAll('#link-arcs path')].some(p => p.getAttribute('d').includes(' A ')))).toBe(false)
        expectNoErrors(errors)
    })

    test('dark theme renders like the light one (coarse image check)', async ({ page }, testInfo) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=6&childs=2&theme=dark')
        await expectScene(page, testInfo, 'theme-dark')
        // level 3: coarse image comparison, catches broken CSS or empty renders
        await expect(page).toHaveScreenshot('theme-dark.png', { maxDiffPixelRatio: 0.02, threshold: 0.3 })
        expectNoErrors(errors)
    })
})

test.describe('layout', () => {
    const wedges = [
        ['wedge-right-half', { rootWedge: { orientation: 0, angle: Math.PI } }],
        ['wedge-full', { rootWedge: { orientation: 3 * Math.PI / 2, angle: 2 * Math.PI } }],
        ['wedge-narrow-up', { rootWedge: { orientation: 3 * Math.PI / 2, angle: Math.PI / 2 } }],
    ]
    for (const [name, layout] of wedges) {
        test(`rootWedge ${name}`, async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&layout=${encodeURIComponent(JSON.stringify(layout))}`)
            // all children of the root lie within the wedge
            const ok = await page.evaluate(w => harness.ht.data.children.every(c => {
                const a = Math.atan2(c.layout.z.im, c.layout.z.re)
                const d = Math.atan2(Math.sin(a - w.orientation), Math.cos(a - w.orientation))
                return Math.abs(d) <= w.angle / 2 + 1e-6
            }), layout.rootWedge)
            expect(ok).toBe(true)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `layout-${name}`)
            expectNoErrors(errors)
        })
    }

    for (const type of ['berge', 'spiral', 'buchheim', 'unitLines', 'unitVectors']) {
        test(`layout type ${type} (filter off)`, async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, `gen=nTree&depth=5&childs=2&filter=off&layoutType=${type}`)
            expect((await page.evaluate(() => harness.scene())).layers['link-arcs']).toBeGreaterThan(10)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `layout-type-${type}`)
            expectNoErrors(errors)
        })
    }
})

test.describe('presets', () => {
    for (const preset of ['modelBase', 'otolModel', 'generatorModel', 'generatorSpiralModel', 'stackoverflowModel', 'acmflareModel', 'fsModel']) {
        test(`preset ${preset}`, async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, `gen=nTree&depth=4&childs=3&preset=${preset}`)
            expect((await page.evaluate(() => harness.scene())).nodes.length).toBeGreaterThan(5)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `preset-${preset}`)
            expectNoErrors(errors)
        })
    }
})

test.describe('node layer option show', () => {
    const circles = page => page.evaluate(() => [...document.querySelectorAll('#nodes circle')].map(c => c.__data__))
    test('default "leaves": leaves, root and nodes with hidden children only', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=6&childs=2&filter=off')
        const ds = await page.evaluate(() => [...document.querySelectorAll('#nodes circle')].map(c => !!(c.__data__.children && c.__data__.parent)))
        expect(ds.length).toBeGreaterThan(10)
        expect(ds.some(inner => inner)).toBe(false)
    })
    test('"all": a disk for every visible node, inner nodes included', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&layers=${encodeURIComponent('{"nodes":{"show":"all"}}')}`)
        const r = await page.evaluate(() => ({
            circles: document.querySelectorAll('#nodes circle').length,
            visible: harness.ht.unitdisk.cache.unculledNodes.length,
            inner: [...document.querySelectorAll('#nodes circle')].filter(c => c.__data__.children && c.__data__.parent).length }))
        expect(r.circles).toBe(r.visible)
        expect(r.inner).toBeGreaterThan(10)
        expectNoErrors(errors)
    })
    test('a function chooses the nodes', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=6&childs=2&filter=off')
        await page.evaluate(() => { harness.layer('nodes').args.show = n => n.depth === 3; harness.ht.update.data() })
        await page.waitForTimeout(200)
        expect(await page.evaluate(() => [...new Set([...document.querySelectorAll('#nodes circle')].map(c => c.__data__.depth))])).toEqual([3])
    })
})

// Layer option shrinkAtRim (labels, labels-force, emojis): scale with the distance to
// the center like the links instead of the damped scale (or none for labels-force).
test.describe('shrinkAtRim', () => {
    const scales = (page, layer) => page.evaluate(layer => [...document.querySelectorAll(`[id="${layer}"] > text, [id="${layer}"] > image`)].map(t => {
        const m = /scale\(([^)]+)\)/.exec(t.getAttribute('transform') || '')
        return { s: m ? +m[1] : 1, r: t.__data__.cachep.r, k: t.__data__.distScale }
    }), layer)
    for (const [layer, query, factor] of [
        ['labels', 'labels=1', 1],
        ['emojis', 'icons=1', 2],
        ['labels-force', `labels=1&layers=${encodeURIComponent('{"labels-force":{"invisible":false}}')}`, 1],
    ]) {
        test(`${layer}: off by default, on scales like the links`, async ({ page }) => {
            const errors = collectErrors(page)
            await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&${query}`)
            const off = await scales(page, layer)
            expect(off.length).toBeGreaterThan(5)
            const layers = layer === 'labels-force' ? { 'labels-force': { invisible: false, shrinkAtRim: true } } : { [layer]: { shrinkAtRim: true } }
            await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&${query.replace(/&layers=.*/, '')}&layers=${encodeURIComponent(JSON.stringify(layers))}`)
            const on = await scales(page, layer)
            // on: the scale is the node's distance factor (times 2 for emojis)
            expect(on.every(t => Math.abs(t.s - t.k * factor) < 1e-6)).toBe(true)
            // the outermost element is smaller than without the option
            const outermost = list => list.reduce((a, b) => (b.r > a.r ? b : a))
            expect(outermost(on).s).toBeLessThan(outermost(off).s)
            expectNoErrors(errors)
        })
    }
})

// layer option maxLabels: a limit per label layer (default filter.maxlabels)
test('label layers: maxLabels per layer', async ({ page }) => {
    const layers = { labels: { maxLabels: 3 }, 'labels-force': { invisible: false, hideOnDrag: false, maxLabels: 8 } }
    await openTree(page, `gen=nTree&depth=6&childs=3&labels=1&filter=off&layers=${encodeURIComponent(JSON.stringify(layers))}`)
    await waitForStable(page)
    const count = id => page.evaluate(id => document.querySelectorAll(`[id="${id}"] text`).length, id)
    const labels = await count('labels'), force = await count('labels-force')
    expect(labels).toBeGreaterThan(0)
    expect(labels).toBeLessThanOrEqual(3)
    expect(force).toBeGreaterThan(labels)
    expect(force).toBeLessThanOrEqual(8)
})
