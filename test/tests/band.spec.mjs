import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The band (strip) model (geometry.projection 'band', projection/band.ts,
// docs/dev/GLATZHOFER-TRANSFORMATION.md candidate B): the Cayley half-plane under the
// complex logarithm, a horizontal strip y ∈ ±1 with the rim on its top and bottom
// edges, the gap of the root wedge at the left end, the stem along the axis. Conformal;
// the box shows x ∈ ±A. Layout, filter and transformation stay in the disk.

test.use({ viewport: { width: 1300, height: 700 } })

const geometry = encodeURIComponent(JSON.stringify({ projection: 'band' }))
const open = (page, query = 'gen=nTree&depth=6&childs=3&labels=1') =>
    openTree(page, `${query}&size=1200x600&geometry=${geometry}`)

const toScreen = (page, c) => page.evaluate(c => {
    const g = document.querySelector('.unitDisc'), m = g.getScreenCTM()
    return { x: m.a * c.re + m.c * c.im + m.e, y: m.b * c.re + m.d * c.im + m.f }
}, c)

const viewBoxFor = page => page.evaluate(() => {
    const svg = document.querySelector('.unitdisk-nav > svg'), r = svg.getBoundingClientRect()
    return { viewBox: svg.getAttribute('viewBox'), expected: `0 0 ${Math.round(1000 * r.width / r.height)} 1000`, aspect: r.width / r.height }
})

// the drawn positions against the projection's map, the inverse back, whether they
// lie in the strip (y ∈ ±1) and how many are beyond the box (outOfView)
const mapped = page => page.evaluate(() => {
    const ht = harness.ht, p = ht.projection, cache = ht.unitdisk.cache
    let maxErr = 0, maxInv = 0, outside = 0, outsideDisk = 0, outOfView = 0
    for (const n of cache.unculledNodes) {
        const v = p.toView(n.cacheDisk)
        maxErr = Math.max(maxErr, Math.hypot(v.re - n.cache.re, v.im - n.cache.im))
        const z = p.toDisk({ re: n.cache.re, im: n.cache.im })
        maxInv = Math.max(maxInv, Math.hypot(z.re - n.cacheDisk.re, z.im - n.cacheDisk.im))
        if (Math.abs(n.cache.im) > 1 + 1e-9) outside++
        if (Math.hypot(n.cacheDisk.re, n.cacheDisk.im) >= 1) outsideDisk++
        if (n.outOfView) outOfView++
    }
    return { n: cache.unculledNodes.length, maxErr, maxInv, outside, outsideDisk, outOfView, aspect: p.aspect, root: cache.unculledNodes[0] === ht.data,
             links: document.querySelectorAll('[id="link-arcs"] > *').length, cells: cache.cells.length, nan: document.querySelector('.unitDisc').innerHTML.includes('NaN') }
})

test('the strip fills the height of the drawn svg; the shown length follows a resize', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const v = await viewBoxFor(page)
    expect(v.viewBox).toBe(v.expected)
    expect(v.viewBox).toBe('0 0 1857 1000')
    expect(Math.abs((await mapped(page)).aspect - v.aspect)).toBeLessThan(1e-9)
    await page.setViewportSize({ width: 900, height: 700 })
    await expect.poll(async () => { const v = await viewBoxFor(page); return v.viewBox === v.expected && v.viewBox }).toBe('0 0 1286 1000')
    await waitForStable(page)
    const v2 = await viewBoxFor(page), m1 = await mapped(page)
    expect(Math.abs(m1.aspect - v2.aspect)).toBeLessThan(1e-9)
    expect(m1.maxErr).toBeLessThan(1e-12)
    expect(m1.outside).toBe(0)
    expectNoErrors(errors)
})

test('drawn positions: the conformal image of the disk positions, inside the strip, the inverse exact', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const r = await mapped(page)
    expect(r.n).toBeGreaterThan(100)
    expect(r.maxErr).toBeLessThan(1e-12)
    expect(r.maxInv).toBeLessThan(1e-9)
    expect(r.outside).toBe(0)
    expect(r.outsideDisk).toBe(0)
    expect(r.root).toBe(true)
    expect(r.links).toBeGreaterThan(100)
    expect(r.cells).toBeGreaterThan(100)
    expect(r.nan).toBe(false)
    expectNoErrors(errors)
})

test('the map: the center at the origin, the rim on the top and bottom edges, the gap at the left end', async ({ page }) => {
    await open(page)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const p = harness.ht.projection
        const c = p.toView({ re: 0, im: 0 })
        const h = 1e-4, dx = p.toView({ re: h, im: 0 }), dy = p.toView({ re: 0, im: h })
        // the gap's direction: far left on the axis maps near the gap
        const g = p.toDisk({ re: -8, im: 0 }), gapDir = Math.atan2(g.im, g.re)
        const rimAt = a => p.toView({ re: .9999999 * Math.cos(gapDir + a), im: .9999999 * Math.sin(gapDir + a) })
        return { c, scale: [Math.hypot(dx.re - c.re, dx.im - c.im) / h, Math.hypot(dy.re - c.re, dy.im - c.im) / h],
                 gapR: Math.hypot(g.re, g.im), side1: rimAt(Math.PI / 2), side2: rimAt(-Math.PI / 2), opposite: rimAt(Math.PI),
                 nearGap: rimAt(.001), gap: p.toView({ re: .999999 * Math.cos(gapDir), im: .999999 * Math.sin(gapDir) }) }
    })
    expect(Math.hypot(r.c.re, r.c.im)).toBeLessThan(1e-12)
    expect(Math.abs(r.scale[0] - r.scale[1])).toBeLessThan(1e-3)            // conformal: isotropic
    expect(Math.abs(r.scale[0] - 4 / Math.PI)).toBeLessThan(1e-3)           // the center's scale
    expect(r.gapR).toBeGreaterThan(.999)
    expect(Math.abs(Math.abs(r.side1.im) - 1)).toBeLessThan(1e-5)           // the rim: the long edges
    expect(Math.abs(Math.abs(r.side2.im) - 1)).toBeLessThan(1e-5)
    expect(Math.sign(r.side1.im)).not.toBe(Math.sign(r.side2.im))          // one half on each edge
    expect(r.opposite.re).toBeGreaterThan(5)                                // the point opposite the gap: the right end
    expect(r.nearGap.re).toBeLessThan(-3)                                   // near the gap: the left end
    expect(r.gap.re).toBeLessThan(-5)
    expect(Math.abs(r.gap.im)).toBeLessThan(1e-3)                           // on the axis
})

test('like the disk: the root toward the gap on the left with its stem along the axis to the left end', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const ht = harness.ht, root = ht.data, u = ht.unitdisk.cache.unculledNodes, p = ht.projection
        const deepest = Math.max(...u.map(n => n.depth))
        const leaves = u.filter(n => n.depth === deepest)
        const stem = [...document.querySelectorAll('.unitDisc path')].find(el => el.__data__ === root)
        const nums = stem && stem.getAttribute('d').match(/-?[\d.]+(e-?\d+)?/g).map(Number)
        return { rootX: root.cache.re, leavesX: leaves.reduce((a, n) => a + n.cache.re, 0) / leaves.length,
                 stemEnd: nums && { x: nums[nums.length - 2], y: nums[nums.length - 1] }, A: p.aspect }
    })
    expect(r.leavesX).toBeGreaterThan(r.rootX)
    expect(r.stemEnd.x).toBeLessThan(-r.A)                                 // beyond the left edge
    expect(r.stemEnd.y).toBe(0)                                             // on the axis
    expectNoErrors(errors)
})

test('hover: the node under the pointer is the nearest one in the view', async ({ page }) => {
    await open(page)
    await waitForStable(page)
    const target = { re: .37, im: .25 }
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

// (without keepTreeInView: its disk rules apply here too and would shift this drag)
test('drag: the grabbed node follows the pointer', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, `gen=nTree&depth=6&childs=3&labels=1&interaction=${encodeURIComponent(JSON.stringify({ keepTreeInView: false }))}`)
    await waitForStable(page)
    const grab = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 2 && Math.abs(n.cache.im) < .5 && Math.abs(n.cache.re) > .3 && Math.abs(n.cache.re) < 1.2)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
    })
    const from = await toScreen(page, grab)
    const to = await toScreen(page, { re: grab.re * .3, im: grab.im - .15 })
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.waitForTimeout(150)
    const now = await page.evaluate(id => { const n = harness.ht.data.descendants().find(n => n.mergeId === id); return { re: n.cache.re, im: n.cache.im } }, grab.id)
    await page.mouse.up()
    const at = await toScreen(page, now)
    expect(Math.hypot(at.x - to.x, at.y - to.y)).toBeLessThan(3)
    expectNoErrors(errors)
})

// (without keepTreeInView, as the drag: zooming out around a node off the center moves
// the root, and the disk rules would shift the view)
test('wheel: zooms by the layout (λ), keeps the node under the pointer in place', async ({ page }) => {
    await open(page, `gen=nTree&depth=6&childs=3&labels=1&interaction=${encodeURIComponent(JSON.stringify({ keepTreeInView: false }))}`)
    await waitForStable(page)
    const n0 = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 2 && Math.abs(n.cache.im) < .4 && Math.abs(n.cache.re) < 1.2)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
    })
    const s = await toScreen(page, n0)
    await page.mouse.move(s.x, s.y)
    const λ0 = await page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
    await page.mouse.wheel(0, 200)
    await waitForStable(page)
    const λ1 = await page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
    expect(λ1).toBeLessThan(λ0)
    expect((await mapped(page)).maxErr).toBeLessThan(1e-12)
    const r = await page.evaluate(id => { const n = harness.ht.data.descendants().find(n => n.mergeId === id); return { re: n.cache.re, im: n.cache.im } }, n0.id)
    const s2 = await toScreen(page, r)
    expect(Math.hypot(s2.x - s.x, s2.y - s.y)).toBeLessThan(3)
})

// every link starts at its node and ends at its parent, also centered on a deep node,
// zoomed in and dragged; nothing leaves the strip
test('every link connects its node and its parent, also after centering deep, zooming in and dragging', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, `gen=nTree&depth=7&childs=3&labels=1&size=1200x600&geometry=${geometry}&interaction=${encodeURIComponent(JSON.stringify({ λbounds: [.02, .9] }))}`)
    await waitForStable(page)
    await page.evaluate(() => {
        const deep = harness.ht.data.descendants().filter(n => n.depth === 5 && n.layout)
        return harness.ht.api.gotoNode(deep[Math.floor(deep.length / 2)])
    })
    await waitForStable(page)
    const check = async () => {
        const r = await page.evaluate(() => {
            let links = 0, bad = 0
            for (const el of document.querySelectorAll('[id="link-arcs"] > path')) {
                const d = el.__data__
                if (!d || !d.parent) continue
                const nums = el.getAttribute('d').match(/-?[\d.]+(e-?\d+)?/g).map(Number)
                const [x1, y1] = nums, [x2, y2] = nums.slice(-2)
                links++
                if (!(Math.hypot(x1 - d.cache.re, y1 - d.cache.im) + Math.hypot(x2 - d.parent.cache.re, y2 - d.parent.cache.im) < 1e-6)) bad++
            }
            return { links, bad }
        })
        const m = await mapped(page)
        return { ...r, outside: m.outside, maxErr: m.maxErr, nan: m.nan }
    }
    const c = await toScreen(page, { re: 0, im: .2 })
    await page.mouse.move(c.x, c.y)
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60) }
    await waitForStable(page)
    const zoomed = await check()
    expect(zoomed.links).toBeGreaterThan(5)
    expect(zoomed).toEqual({ links: zoomed.links, bad: 0, outside: 0, maxErr: zoomed.maxErr, nan: false })
    expect(zoomed.maxErr).toBeLessThan(1e-12)
    const d = await toScreen(page, { re: .4, im: .1 })
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    await page.mouse.move(d.x, d.y, { steps: 10 })
    await page.mouse.up()
    await waitForStable(page)
    const dragged = await check()
    expect(dragged).toEqual({ links: dragged.links, bad: 0, outside: 0, maxErr: dragged.maxErr, nan: false })
    expectNoErrors(errors)
})

test('the infovis presets and the file system work in the band', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, 'file=fixtures/filesystem.d3.json&preset=infovisFiles')
    await waitForStable(page)
    const r = await mapped(page)
    expect(r.n).toBeGreaterThan(50)
    expect(r.cells).toBeGreaterThan(50)
    expect(r.nan).toBe(false)
    expect(r.outside).toBe(0)
    expectNoErrors(errors)
})
