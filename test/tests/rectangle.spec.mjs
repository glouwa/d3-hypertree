import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The rectangular view as the conformal image of the whole disk (geometry.view
// 'rectangle', the Schwarz–Christoffel map, projection/rectangle.ts): the rim of the
// disk is the edge of the rectangle, so every node is in the picture; the gap of the
// root wedge goes to the middle of the bottom edge. Layout, filter and transformation
// stay in the disk; the drawn positions are mapped at the end, pointer input back.

test.use({ viewport: { width: 1300, height: 700 } })

const geometry = encodeURIComponent(JSON.stringify({ view: 'rectangle' }))
const open = (page, query = 'gen=nTree&depth=6&childs=3&labels=1') =>
    openTree(page, `${query}&size=1200x600&geometry=${geometry}`)

// a point of the view (the coordinates of the drawn tree) on the screen
const toScreen = (page, c) => page.evaluate(c => {
    const g = document.querySelector('.unitDisc'), m = g.getScreenCTM()
    return { x: m.a * c.re + m.c * c.im + m.e, y: m.b * c.re + m.d * c.im + m.f }
}, c)

const viewBoxFor = page => page.evaluate(() => {
    const svg = document.querySelector('.unitdisk-nav > svg'), r = svg.getBoundingClientRect()
    return { viewBox: svg.getAttribute('viewBox'), expected: `0 0 ${Math.round(1000 * r.width / r.height)} 1000`, aspect: r.width / r.height }
})

// the drawn positions against the projection's map of the disk positions, and whether
// they all lie in the rectangle (x ∈ ±1, y ∈ ±height/2)
const mapped = page => page.evaluate(() => {
    const ht = harness.ht, p = ht.projection, cache = ht.unitdisk.cache
    let maxErr = 0, outside = 0, outsideDisk = 0
    for (const n of cache.unculledNodes) {
        const v = p.toView(n.cacheDisk)
        maxErr = Math.max(maxErr, Math.hypot(v.re - n.cache.re, v.im - n.cache.im))
        if (Math.abs(n.cache.re) > 1 + 1e-9 || Math.abs(n.cache.im) > p.height / 2 + 1e-9) outside++
        if (Math.hypot(n.cacheDisk.re, n.cacheDisk.im) >= 1) outsideDisk++
    }
    return { n: cache.unculledNodes.length, maxErr, outside, outsideDisk, height: p.height, root: cache.unculledNodes[0] === ht.data,
             links: document.querySelectorAll('[id="link-arcs"] > *').length, cells: cache.cells.length, nan: document.querySelector('.unitDisc').innerHTML.includes('NaN') }
})

test('the view is a rectangle with the aspect ratio of the drawn svg; the map follows a resize', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const v = await viewBoxFor(page)
    expect(v.viewBox).toBe(v.expected)
    expect(v.viewBox).toBe('0 0 1857 1000')
    const m0 = await mapped(page)
    expect(Math.abs(m0.height - 2 / v.aspect)).toBeLessThan(1e-9)      // the rectangle's height for the width 2
    await page.setViewportSize({ width: 900, height: 700 })
    await expect.poll(async () => { const v = await viewBoxFor(page); return v.viewBox === v.expected && v.viewBox }).toBe('0 0 1286 1000')
    await waitForStable(page)
    const v2 = await viewBoxFor(page), m1 = await mapped(page)
    expect(Math.abs(m1.height - 2 / v2.aspect)).toBeLessThan(1e-9)
    expect(m1.maxErr).toBeLessThan(1e-12)                              // the positions were mapped again
    expect(m1.outside).toBe(0)
    expectNoErrors(errors)
})

test('drawn positions: the conformal image of the disk positions, all inside the rectangle', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const r = await mapped(page)
    expect(r.n).toBeGreaterThan(100)
    expect(r.maxErr).toBeLessThan(1e-12)
    expect(r.outside).toBe(0)
    expect(r.outsideDisk).toBe(0)
    expect(r.root).toBe(true)
    expect(r.links).toBeGreaterThan(100)
    expect(r.cells).toBeGreaterThan(100)
    expect(r.nan).toBe(false)
    expectNoErrors(errors)
})

test('like the disk: the root at the bottom with its stem going down to the edge, the tree above it', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const ht = harness.ht, root = ht.data, u = ht.unitdisk.cache.unculledNodes
        const deepest = Math.max(...u.map(n => n.depth))
        const leaves = u.filter(n => n.depth === deepest)
        const stem = [...document.querySelectorAll('.unitDisc path')].find(el => el.__data__ === root)
        const nums = stem && stem.getAttribute('d').match(/-?[\d.]+(e-?\d+)?/g).map(Number)
        return { rootY: root.cache.im, leavesY: leaves.reduce((a, n) => a + n.cache.im, 0) / leaves.length,
                 stemEnd: nums && { x: nums[nums.length - 2], y: nums[nums.length - 1] }, height: ht.projection.height }
    })
    expect(r.leavesY).toBeLessThan(r.rootY)
    expect(r.stemEnd.y).toBeGreaterThan(r.rootY)
    expect(Math.abs(r.stemEnd.y - r.height / 2)).toBeLessThan(.01)      // the middle of the bottom edge
    expect(Math.abs(r.stemEnd.x)).toBeLessThan(.01)
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

test('drag: the grabbed node follows the pointer', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await waitForStable(page)
    const grab = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 2 && Math.abs(n.cache.im) < .3 && Math.abs(n.cache.re) > .3)
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

test('wheel: zooms by the layout (λ), keeps the node under the pointer in place', async ({ page }) => {
    await open(page)
    await waitForStable(page)
    const n0 = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 2 && Math.abs(n.cache.im) < .4)
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

test('click with clickAction select selects the node under the pointer', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=5&childs=3&size=1200x600&geometry=${geometry}&interaction=${encodeURIComponent(JSON.stringify({ clickAction: 'select' }))}`)
    await waitForStable(page)
    const n = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 1 && Math.abs(n.cache.im) < .5)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
    })
    const s = await toScreen(page, n)
    await page.mouse.click(s.x, s.y)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => harness.ht.args.objects.selections.map(n => n.mergeId))).toEqual([n.id])
})

// every link starts at its node and ends at its parent (a quadratic curve through the
// image of the arc's midpoint), also centered on a deep node, zoomed in and dragged;
// nothing leaves the rectangle
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

test('the infovis presets and the file system work in the rectangle', async ({ page }) => {
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
