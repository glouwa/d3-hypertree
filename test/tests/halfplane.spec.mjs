import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The rectangular view (geometry.halfPlane): the upper half-plane via the Cayley
// transform. Layout, filter and transformation stay in the disk; the drawn positions
// are mapped at the end, pointer input is mapped back (cayley.ts).

test.use({ viewport: { width: 1300, height: 700 } })

const geometry = encodeURIComponent(JSON.stringify({ halfPlane: true }))
const open = (page, query = 'gen=nTree&depth=6&childs=3&labels=1') =>
    openTree(page, `${query}&size=1200x600&geometry=${geometry}`)

// a point of the view (the coordinates of the drawn tree) on the screen
const toScreen = (page, c) => page.evaluate(c => {
    const g = document.querySelector('.unitDisc'), m = g.getScreenCTM()
    return { x: m.a * c.re + m.c * c.im + m.e, y: m.b * c.re + m.d * c.im + m.f }
}, c)

test('the view is a rectangle with the aspect ratio of the element', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    expect(await page.evaluate(() => document.querySelector('.unitdisk-nav > svg').getAttribute('viewBox'))).toBe('0 0 2000 1000')
    // a resize keeps it
    await page.evaluate(() => { document.getElementById('tree').style.width = '900px'; window.dispatchEvent(new Event('resize')) })
    expect(await page.evaluate(() => document.querySelector('.unitdisk-nav > svg').getAttribute('viewBox'))).toBe('0 0 1500 1000')
    expectNoErrors(errors)
})

test('drawn positions: the Cayley image of the disk positions, above the border', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const ht = harness.ht, cache = ht.unitdisk.cache, g = hyt.infinityOf(ht.args.layout.rootWedge)
        let maxErr = 0, below = 0, outsideDisk = 0
        for (const n of cache.unculledNodes) {
            const v = hyt.toView(n.cacheDisk, g)
            maxErr = Math.max(maxErr, Math.hypot(v.re - n.cache.re, v.im - n.cache.im))
            if (n.cache.im >= 1) below++
            if (Math.hypot(n.cacheDisk.re, n.cacheDisk.im) >= 1) outsideDisk++
        }
        return { n: cache.unculledNodes.length, maxErr, below, outsideDisk, root: cache.unculledNodes[0] === ht.data,
                 links: document.querySelectorAll('[id="link-arcs"] > *').length, cells: cache.cells.length }
    })
    expect(r.n).toBeGreaterThan(100)
    expect(r.maxErr).toBeLessThan(1e-12)
    expect(r.below).toBe(0)
    expect(r.outsideDisk).toBe(0)
    expect(r.root).toBe(true)
    expect(r.links).toBe(r.n - 1)
    expect(r.cells).toBe(r.n)
    expectNoErrors(errors)
})

test('links are geodesics of the half-plane: arcs centered on the border', async ({ page }) => {
    await open(page)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        let arcs = 0, worst = 0
        for (const el of document.querySelectorAll('[id="link-arcs"] > path')) {
            const m = /^M (\S+) (\S+) A (\S+) \S+, 0, 0, [01], (\S+) (\S+)$/.exec(el.getAttribute('d'))
            if (!m) continue
            const [x1, y1, r, x2, y2] = m.slice(1).map(Number)
            // the circle through both ends centered on y = 1 has radius r
            const c = (x1 * x1 + (1 - y1) ** 2 - x2 * x2 - (1 - y2) ** 2) / (2 * (x1 - x2))
            worst = Math.max(worst, Math.abs(Math.hypot(x1 - c, 1 - y1) - r) / r, Math.abs(Math.hypot(x2 - c, 1 - y2) - r) / r)
            arcs++
        }
        return { arcs, worst }
    })
    expect(r.arcs).toBeGreaterThan(50)
    expect(r.worst).toBeLessThan(1e-9)
})

test('hover: the node under the pointer is the nearest one in the view', async ({ page }) => {
    await open(page)
    await waitForStable(page)
    // a target between nodes, below the center
    const target = { re: .37, im: .55 }
    const s = await toScreen(page, target)
    await page.mouse.move(s.x - 20, s.y - 20)
    await page.mouse.move(s.x, s.y, { steps: 3 })
    await page.waitForTimeout(200)
    const r = await page.evaluate(t => {
        const u = harness.ht.unitdisk.cache.unculledNodes
        const nearest = u.reduce((a, b) => Math.hypot(b.cache.re - t.re, b.cache.im - t.im) < Math.hypot(a.cache.re - t.re, a.cache.im - t.im) ? b : a)
        const hovered = u.find(n => n.hovered)
        return { nearest: nearest.mergeId, hovered: hovered && hovered.mergeId }
    }, target)
    expect(r.hovered).toBe(r.nearest)
})

test('drag: the grabbed node follows the pointer', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    // grab a node off center
    const grab = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 2 && n.cache.im < .8 && Math.abs(n.cache.re) > .3)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
    })
    const from = await toScreen(page, grab)
    const to = await toScreen(page, { re: grab.re * .3, im: grab.im - .25 })
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.waitForTimeout(150)
    const now = await page.evaluate(id => { const n = harness.ht.data.descendants().find(n => n.mergeId === id); return { re: n.cache.re, im: n.cache.im } }, grab.id)
    await page.mouse.up()
    const at = await toScreen(page, now)
    expect(Math.hypot(at.x - to.x, at.y - to.y)).toBeLessThan(3)   // pixels
    expectNoErrors(errors)
})

// Zoom works as in the disk: it changes λ of the hyperbolic layout (the link length),
// not a euclidean scale of the view. layoutSpread: the hyperbolic distance from the
// root to a child in the layout, which only λ changes; exact: the view still shows
// the Cayley image of the disk positions.
const zoomState = page => page.evaluate(() => {
    const ht = harness.ht, g = hyt.infinityOf(ht.args.layout.rootWedge)
    const child = ht.data.children[0], r = Math.hypot(child.layout.z.re, child.layout.z.im)
    const exact = ht.unitdisk.cache.unculledNodes.every(n => {
        const v = hyt.toView(n.cacheDisk, g)
        return Math.hypot(v.re - n.cache.re, v.im - n.cache.im) < 1e-12
    })
    return { λ: ht.unitdisk.args.transformation.state.λ, layoutSpread: Math.log((1 + r) / (1 - r)), exact }
})

test('wheel: zooms by the layout (λ), keeps the node under the pointer in place', async ({ page }) => {
    await open(page)
    await waitForStable(page)
    const n0 = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 2 && n.cache.im < .85)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
    })
    const s = await toScreen(page, n0)
    await page.mouse.move(s.x, s.y)
    const z0 = await zoomState(page)
    await page.mouse.wheel(0, 200)          // out (the start zoom is at the upper λbound)
    await waitForStable(page)
    const z1 = await zoomState(page)
    expect(z1.λ).toBeLessThan(z0.λ)
    expect(z1.layoutSpread).toBeLessThan(z0.layoutSpread * .99)   // the layout got tighter
    expect(z1.exact).toBe(true)
    const r = await page.evaluate(id => {
        const n = harness.ht.data.descendants().find(n => n.mergeId === id)
        return { re: n.cache.re, im: n.cache.im }
    }, n0.id)
    const s2 = await toScreen(page, r)
    expect(Math.hypot(s2.x - s.x, s2.y - s.y)).toBeLessThan(3)
})

test.describe('touch', () => {
    test.use({ hasTouch: true })
    test('pinch: zooms by the layout (λ), fingers together out, apart in', async ({ page }) => {
        const errors = collectErrors(page)
        await open(page)
        await page.evaluate(() => harness.ht.api.gotoλ(0.3))
        await waitForStable(page)
        const c = await toScreen(page, { re: 0, im: .3 })
        const cdp = await page.context().newCDPSession(page)
        const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts.map((p, id) => ({ x: p.x, y: p.y, id })) })
        const pinch = async (from, to) => {
            await t('touchStart', [{ x: c.x - from, y: c.y }, { x: c.x + from, y: c.y }])
            for (let i = 1; i <= 10; i++) {
                const d = from + (to - from) * i / 10
                await t('touchMove', [{ x: c.x - d, y: c.y }, { x: c.x + d, y: c.y }])
                await page.waitForTimeout(16)
            }
            await t('touchEnd', [])
            await waitForStable(page)
        }
        const z0 = await zoomState(page)
        await pinch(150, 100)
        const z1 = await zoomState(page)
        expect(z1.λ).toBeLessThan(z0.λ)
        expect(z1.layoutSpread).toBeLessThan(z0.layoutSpread * .99)
        expect(z1.exact).toBe(true)
        await pinch(100, 150)
        const z2 = await zoomState(page)
        expect(z2.λ).toBeGreaterThan(z1.λ)
        expect(z2.layoutSpread).toBeGreaterThan(z1.layoutSpread * 1.01)
        expect(z2.exact).toBe(true)
        expectNoErrors(errors)
    })
})

test('click with clickAction select selects the node under the pointer', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=5&childs=3&size=1200x600&geometry=${geometry}&interaction=${encodeURIComponent(JSON.stringify({ clickAction: 'select' }))}`)
    await waitForStable(page)
    const n = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 1 && n.cache.im < .9)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
    })
    const s = await toScreen(page, n)
    await page.mouse.click(s.x, s.y)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => harness.ht.args.objects.selections.map(n => n.mergeId))).toEqual([n.id])
})

test('indicator circles: the image of |z| = r goes through the images of its points', async ({ page }) => {
    const layers = encodeURIComponent(JSON.stringify({ 'focus-r': { invisible: false } }))
    await openTree(page, `gen=nTree&depth=5&childs=3&size=1200x600&geometry=${geometry}&layers=${layers}`)
    await waitForStable(page)
    const worst = await page.evaluate(() => {
        const ht = harness.ht, r = ht.unitdisk.cache.focusR, g = hyt.infinityOf(ht.args.layout.rootWedge)
        const t = /translate\((\S+) (\S+)\) scale\((\S+)\)/.exec(document.querySelector('[id="focus-r"] circle').getAttribute('transform'))
        const [cx, cy, rad] = t.slice(1).map(Number)
        let e = 0
        for (let a = 0; a < 2 * Math.PI; a += .3) {
            const v = hyt.toView({ re: r * Math.cos(a), im: r * Math.sin(a) }, g)
            e = Math.max(e, Math.abs(Math.hypot(v.re - cx, v.im - cy) - rad) / rad)
        }
        return e
    })
    expect(worst).toBeLessThan(1e-9)
})

test('the infovis presets and the file system work in the rectangular view', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, 'file=fixtures/filesystem.d3.json&preset=infovisFiles')
    await waitForStable(page)
    const r = await page.evaluate(() => ({
        visible: harness.ht.unitdisk.cache.unculledNodes.length,
        cells: document.querySelectorAll('[id="cells"] polygon').length,
        nan: document.querySelector('.unitDisc').innerHTML.includes('NaN'),
    }))
    expect(r.visible).toBeGreaterThan(50)
    expect(r.cells).toBeGreaterThan(50)
    expect(r.nan).toBe(false)
    expectNoErrors(errors)
})
