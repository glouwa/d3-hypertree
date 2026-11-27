import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The closed-form projections of projection/euclidean.ts (on mapped.ts): klein,
// equal-area, equidistant, gans (radial), stretch and squircle (to the box), sector
// (conformal wedge). For each: the drawn positions are the map of the disk positions,
// the inverse returns them, they lie in the projection's shape, the root lies below
// the leaves, the stem is drawn, hover finds the nearest node, a drag follows the
// pointer, every link joins its node and its parent, nothing is NaN.

test.use({ viewport: { width: 1300, height: 700 } })

const KINDS = {
    'klein':       { inShape: (v, p) => Math.hypot(v.re, v.im) <= 1 + 1e-9 },
    'equal-area':  { inShape: (v, p) => Math.hypot(v.re, v.im) <= 1 + 1e-9 },
    'equidistant': { inShape: (v, p) => Math.hypot(v.re, v.im) <= 1 + 1e-9 },
    'gans':        { inShape: null },
    'stretch':     { inShape: (v, p) => (v.re / p.aspect) ** 2 + v.im ** 2 <= 1 + 1e-9 },
    'squircle':    { inShape: (v, p) => Math.abs(v.re) <= p.aspect + 1e-9 && Math.abs(v.im) <= 1 + 1e-9 },
    'sector':      { inShape: null },
}

const toScreen = (page, c) => page.evaluate(c => {
    const m = document.querySelector('.unitDisc').getScreenCTM()
    return { x: m.a * c.re + m.c * c.im + m.e, y: m.b * c.re + m.d * c.im + m.f }
}, c)

for (const [kind, K] of Object.entries(KINDS)) {
    const geometry = encodeURIComponent(JSON.stringify({ projection: kind }))
    const open = (page, extra = '') => openTree(page, `gen=nTree&depth=6&childs=3&labels=1&size=1200x600&geometry=${geometry}${extra}`)

    test.describe(kind, () => {
        test('positions: the map of the disk positions, the inverse exact, inside the shape, the root below the leaves', async ({ page }) => {
            const errors = collectErrors(page)
            await open(page)
            await waitForStable(page)
            const r = await page.evaluate(src => {
                const inShape = src ? new Function('v', 'p', `return (${src})(v, p)`) : null
                const ht = harness.ht, p = ht.projection, u = ht.unitdisk.cache.unculledNodes
                let maxErr = 0, maxInv = 0, outside = 0
                for (const n of u) {
                    const v = p.toView(n.cacheDisk)
                    maxErr = Math.max(maxErr, Math.hypot(v.re - n.cache.re, v.im - n.cache.im))
                    const z = p.toDisk({ re: n.cache.re, im: n.cache.im })
                    if (!n.outOfView) maxInv = Math.max(maxInv, Math.hypot(z.re - n.cacheDisk.re, z.im - n.cacheDisk.im))
                    if (inShape && !inShape(n.cache, p)) outside++
                }
                const deepest = Math.max(...u.map(n => n.depth)), leaves = u.filter(n => n.depth === deepest)
                const c = p.toView({ re: 0, im: 0 })
                const stem = [...document.querySelectorAll('.unitDisc path')].find(el => el.__data__ === ht.data)
                return { kind: p.kind, n: u.length, maxErr, maxInv, outside, center: Math.hypot(c.re, c.im),
                         rootY: ht.data.cache.im, leavesY: leaves.reduce((a, n) => a + n.cache.im, 0) / leaves.length,
                         stem: !!stem, nan: document.querySelector('.unitDisc').innerHTML.includes('NaN'),
                         cells: ht.unitdisk.cache.cells.length }
            }, K.inShape && K.inShape.toString())
            expect(r.kind).toBe(kind)
            expect(r.n).toBeGreaterThan(100)
            expect(r.maxErr).toBeLessThan(1e-12)
            expect(r.maxInv).toBeLessThan(1e-6)
            expect(r.outside).toBe(0)
            expect(r.center).toBeLessThan(1e-9)
            expect(r.leavesY).toBeLessThan(r.rootY)
            expect(r.stem).toBe(true)
            expect(r.cells).toBeGreaterThan(50)
            expect(r.nan).toBe(false)
            expectNoErrors(errors)
        })

        test('hover finds the nearest node; a drag moves the grabbed node with the pointer', async ({ page }) => {
            const errors = collectErrors(page)
            await open(page, `&interaction=${encodeURIComponent(JSON.stringify({ keepTreeInView: false }))}`)
            await waitForStable(page)
            const n = await page.evaluate(() => {
                const u = harness.ht.unitdisk.cache.unculledNodes.filter(n => n.depth === 2 && !n.outOfView)
                const n = u.reduce((a, b) => Math.hypot(b.cache.re - .3, b.cache.im + .2) < Math.hypot(a.cache.re - .3, a.cache.im + .2) ? b : a)
                return { id: n.mergeId, re: n.cache.re, im: n.cache.im }
            })
            const s = await toScreen(page, n)
            await page.mouse.move(s.x - 15, s.y - 15)
            await page.mouse.move(s.x, s.y, { steps: 3 })
            await page.waitForTimeout(200)
            const hovered = await page.evaluate(t => {
                const u = harness.ht.unitdisk.cache.unculledNodes
                const nearest = u.reduce((a, b) => Math.hypot(b.cache.re - t.re, b.cache.im - t.im) < Math.hypot(a.cache.re - t.re, a.cache.im - t.im) ? b : a)
                const h = u.find(n => n.hovered)
                return { nearest: nearest.mergeId, hovered: h && h.mergeId }
            }, n)
            expect(hovered.hovered).toBe(hovered.nearest)
            const to = await toScreen(page, { re: n.re * .5, im: n.im * .5 })
            await page.mouse.down()
            await page.mouse.move(to.x, to.y, { steps: 10 })
            await page.waitForTimeout(150)
            const now = await page.evaluate(id => { const n = harness.ht.data.descendants().find(n => n.mergeId === id); return { re: n.cache.re, im: n.cache.im } }, n.id)
            await page.mouse.up()
            const at = await toScreen(page, now)
            expect(Math.hypot(at.x - to.x, at.y - to.y)).toBeLessThan(3)
            expectNoErrors(errors)
        })

        test('every link joins its node and its parent, also after a goto and zooming in', async ({ page }) => {
            const errors = collectErrors(page)
            await open(page, `&interaction=${encodeURIComponent(JSON.stringify({ λbounds: [.02, .9] }))}`)
            await waitForStable(page)
            await page.evaluate(() => {
                const deep = harness.ht.data.descendants().filter(n => n.depth === 4 && n.layout)
                return harness.ht.api.gotoNode(deep[Math.floor(deep.length / 2)])
            })
            await waitForStable(page)
            const c = await toScreen(page, { re: 0, im: 0 })
            await page.mouse.move(c.x, c.y)
            for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60) }
            await waitForStable(page)
            const r = await page.evaluate(k => {
                let links = 0, bad = 0, curved = 0
                for (const el of document.querySelectorAll('[id="link-arcs"] > path')) {
                    const d = el.__data__
                    if (!d || !d.parent) continue
                    const attr = el.getAttribute('d'), nums = attr.match(/-?[\d.]+(e-?\d+)?/g).map(Number)
                    const [x1, y1] = nums, [x2, y2] = nums.slice(-2)
                    links++
                    if (/[QA]/.test(attr)) curved++
                    if (!(Math.hypot(x1 - d.cache.re, y1 - d.cache.im) + Math.hypot(x2 - d.parent.cache.re, y2 - d.parent.cache.im) < 1e-6)) bad++
                }
                return { links, bad, curved, nan: document.querySelector('.unitDisc').innerHTML.includes('NaN') }
            }, kind)
            expect(r.links).toBeGreaterThan(5)
            expect(r.bad).toBe(0)
            expect(r.nan).toBe(false)
            if (kind === 'klein') expect(r.curved).toBe(0)          // geodesics are straight lines
            expectNoErrors(errors)
        })
    })
}
