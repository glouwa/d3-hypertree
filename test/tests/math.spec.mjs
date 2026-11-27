import { test, expect } from '@playwright/test'

// Properties of the math the library is built on, checked on many random points
// (seeded, the same on every run) instead of single examples: the hyperbolic
// transformations, the Cayley map of the half-plane view, the voronoi adapter and
// the infovis scales. Runs in the harness page, where the UMD bundle defines hyt.

test.beforeEach(async ({ page }) => {
    await page.goto('harness.html?gen=star&n=3')
    await page.waitForFunction(() => window.hyt)
    await page.evaluate(() => {
        // seeded random numbers and helpers, shared by the tests below
        let seed = 1234567
        window.rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
        window.inDisk = (rMax = .95) => { const r = rMax * Math.sqrt(rnd()), a = 2 * Math.PI * rnd(); return { re: r * Math.cos(a), im: r * Math.sin(a) } }
        window.abs2 = z => z.re * z.re + z.im * z.im
        window.dist = (a, b) => Math.hypot(a.re - b.re, a.im - b.im)
        // cosh of the hyperbolic distance in the disk and in the half-plane
        window.coshDisk = (a, b) => 1 + 2 * ((a.re - b.re) ** 2 + (a.im - b.im) ** 2) / ((1 - abs2(a)) * (1 - abs2(b)))
        window.coshHalf = (v, w) => 1 + ((v.re - w.re) ** 2 + (v.im - w.im) ** 2) / (2 * v.im * w.im)
        // a random disk isometry T = { P, θ } (|P| < 1, |θ| = 1)
        window.randomT = () => { const a = 2 * Math.PI * rnd(); return { P: inDisk(.9), θ: { re: Math.cos(a), im: Math.sin(a) }, λ: null } }
    })
})

test('h2e: a disk isometry keeps points in the disk and keeps hyperbolic distances', async ({ page }) => {
    const worst = await page.evaluate(() => {
        let inside = true, distErr = 0
        for (let i = 0; i < 500; i++) {
            const t = randomT(), a = inDisk(), b = inDisk()
            const ta = hyt.h2e(t, a), tb = hyt.h2e(t, b)
            inside = inside && abs2(ta) < 1 && abs2(tb) < 1
            distErr = Math.max(distErr, Math.abs(Math.log(coshDisk(ta, tb)) - Math.log(coshDisk(a, b))))
        }
        return { inside, distErr }
    })
    expect(worst.inside).toBe(true)
    expect(worst.distErr).toBeLessThan(1e-6)
})

test('compose: applying compose(t1, t2) equals applying t1, then t2', async ({ page }) => {
    const err = await page.evaluate(() => {
        let e = 0
        for (let i = 0; i < 500; i++) {
            const t1 = randomT(), t2 = randomT(), z = inDisk()
            const once = hyt.h2e(hyt.compose(t1, t2), z)
            const twice = hyt.h2e(t2, hyt.h2e(t1, z))
            e = Math.max(e, dist(once, twice))
        }
        return e
    })
    expect(err).toBeLessThan(1e-9)
})

test('shift: dragging moves the grabbed point to the pointer (as onPointerMove uses it)', async ({ page }) => {
    const err = await page.evaluate(() => {
        // inverse of h2e: z = (w − P) / (θ (1 − conj(P) w))
        const inv = (t, w) => {
            const nr = w.re - t.P.re, ni = w.im - t.P.im
            const cr = 1 - (t.P.re * w.re + t.P.im * w.im), ci = -(t.P.re * w.im - t.P.im * w.re)   // 1 − conj(P)·w
            const dr = t.θ.re * cr - t.θ.im * ci, di = t.θ.re * ci + t.θ.im * cr                    // θ·(1 − conj(P)·w)
            const d = dr * dr + di * di
            return { re: (nr * dr + ni * di) / d, im: (ni * dr - nr * di) / d }
        }
        let e = 0
        for (let i = 0; i < 300; i++) {
            const start = { P: inDisk(.6), θ: { re: 1, im: 0 }, λ: null }   // drag state: no rotation
            const s = inDisk(.8), m = inDisk(.8)
            const grabbed = inv(start, s)                                   // the point under the pointer at the start
            const moved = { P: hyt.compose(start, hyt.shift(start, s, m)).P, θ: start.θ, λ: null }
            e = Math.max(e, dist(hyt.h2e(moved, grabbed), m))
        }
        return e
    })
    expect(err).toBeLessThan(1e-6)
})

test('arcCenter: the link arc goes through both points and meets the disk border at right angles', async ({ page }) => {
    const err = await page.evaluate(() => {
        let e = 0
        for (let i = 0; i < 500; i++) {
            const a = inDisk(), b = inDisk()
            if (Math.abs(a.re * b.im - b.re * a.im) < 1e-3) continue          // (almost) on a line through 0: straight
            const { c } = hyt.arcCenter(a, b)
            const r = dist(c, a)
            e = Math.max(e, Math.abs(dist(c, b) - r) / r, Math.abs(abs2(c) - (1 + r * r)) / abs2(c))
        }
        return e
    })
    expect(err).toBeLessThan(1e-9)
})

test('Cayley map: view and disk are inverse, the border becomes the top edge (view y = −1), distances stay', async ({ page }) => {
    const r = await page.evaluate(() => {
        let inverse = 0, border = 0, distance = 0, above = true
        for (let i = 0; i < 500; i++) {
            const z = inDisk(.98), y = inDisk(.98)
            inverse = Math.max(inverse, dist(hyt.viewToDisk(hyt.toView(z)), z))
            const w = hyt.toHalfPlane(z), v = hyt.toHalfPlane(y)
            above = above && w.im > 0
            distance = Math.max(distance, Math.abs(Math.log(coshHalf(w, v)) - Math.log(coshDisk(z, y))))
            const a = 2 * Math.PI * rnd()                                     // a point of the border (not z = 1)
            if (Math.abs(a) > .05) border = Math.max(border, Math.abs(hyt.toView({ re: Math.cos(a), im: Math.sin(a) }).im + 1))
        }
        const center = hyt.toView({ re: 0, im: 0 })
        return { inverse, border, distance, above, center }
    })
    expect(r.inverse).toBeLessThan(1e-9)
    expect(r.border).toBeLessThan(1e-9)
    expect(r.distance).toBeLessThan(1e-6)
    expect(r.above).toBe(true)
    expect(Math.abs(r.center.re) + Math.abs(r.center.im)).toBeLessThan(1e-12)  // the disk center in the middle of the view
})

test('Cayley map with a direction to infinity: still inverse, that direction goes to infinity (down in the view)', async ({ page }) => {
    const r = await page.evaluate(() => {
        let inverse = 0, up = true
        for (let i = 0; i < 300; i++) {
            const a = 2 * Math.PI * rnd(), g = { re: Math.cos(a), im: Math.sin(a) }, z = inDisk(.95)
            inverse = Math.max(inverse, dist(hyt.viewToDisk(hyt.toView(z, g), g), z))
            // a point near the boundary in direction g is far above, the opposite one near the border
            up = up && hyt.toHalfPlane({ re: .99 * g.re, im: .99 * g.im }, g).im > 100
                    && hyt.toHalfPlane({ re: -.99 * g.re, im: -.99 * g.im }, g).im < .01
        }
        // infinityOf: the middle of the gap of the root wedge (orientation + π)
        const inf = hyt.infinityOf({ orientation: 3 * Math.PI / 2, angle: 3 * Math.PI / 2 })
        return { inverse, up, inf: [Math.round(inf.re * 1e9) / 1e9, Math.round(inf.im * 1e9) / 1e9] }
    })
    expect(r.inverse).toBeLessThan(1e-9)
    expect(r.up).toBe(true)
    expect(r.inf).toEqual([0, 1])
})

test('Cayley map: viewScale is the local scale |dw/dz| of the map', async ({ page }) => {
    const err = await page.evaluate(() => {
        let e = 0
        for (let i = 0; i < 300; i++) {
            const z = inDisk(.9), h = 1e-6, a = 2 * Math.PI * rnd()
            const dz = { re: h * Math.cos(a), im: h * Math.sin(a) }
            const numeric = dist(hyt.toHalfPlane({ re: z.re + dz.re, im: z.im + dz.im }), hyt.toHalfPlane(z)) / h
            e = Math.max(e, Math.abs(numeric - hyt.viewScale(z)) / hyt.viewScale(z))
        }
        return e
    })
    expect(err).toBeLessThan(1e-4)
})

test('voronoi adapter: find gives the nearest point, every cell contains its point', async ({ page }) => {
    const r = await page.evaluate(() => {
        const pts = Array.from({ length: 400 }, () => ({ cache: inDisk(.99) }))
        const diagram = hyt.voronoiLayout(d => d.cache.re, d => d.cache.im, [[-2, -2], [2, 2]])(pts)
        let wrong = 0
        for (let i = 0; i < 500; i++) {
            const q = inDisk(1)
            const nearest = pts.reduce((a, b) => dist(b.cache, q) < dist(a.cache, q) ? b : a)
            const found = diagram.find(q.re, q.im).data
            if (found !== nearest && Math.abs(dist(found.cache, q) - dist(nearest.cache, q)) > 1e-12) wrong++
        }
        // point in polygon (ray casting)
        const inside = (p, poly) => {
            let c = false
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const [xi, yi] = poly[i], [xj, yj] = poly[j]
                if ((yi > p.im) !== (yj > p.im) && p.re < (xj - xi) * (p.im - yi) / (yj - yi) + xi) c = !c
            }
            return c
        }
        const polygons = diagram.polygons()
        return { wrong, cells: polygons.length, own: polygons.filter(poly => inside(poly.data.cache, poly)).length,
                 empty: diagram.constructor && hyt.voronoiLayout(d => 0, d => 0, [[-1, -1], [1, 1]])([]).find(0, 0) === undefined }
    })
    expect(r.wrong).toBe(0)
    expect(r.cells).toBe(400)
    expect(r.own).toBe(400)
    expect(r.empty).toBe(true)
})

test('voronoi adapter: points on one line (a path tree) each get a cell, find gives the nearest', async ({ page }) => {
    const r = await page.evaluate(() => {
        // positions like a path tree: on a line through 0, crowding toward the rim
        const pts = Array.from({ length: 100 }, (_, i) => { const s = Math.tanh(i * .03); return { cache: { re: .6 * s, im: -.8 * s } } })
        const diagram = hyt.voronoiLayout(d => d.cache.re, d => d.cache.im, [[-2, -2], [2, 2]])(pts)
        let wrong = 0
        for (let i = 0; i < 500; i++) {
            const q = inDisk(1)
            const nearest = pts.reduce((a, b) => dist(b.cache, q) < dist(a.cache, q) ? b : a)
            if (Math.abs(dist(diagram.find(q.re, q.im).data.cache, q) - dist(nearest.cache, q)) > 1e-12) wrong++
        }
        const polys = diagram.polygons()
        const inside = (p, poly) => {
            let c = false
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const [xi, yi] = poly[i], [xj, yj] = poly[j]
                if ((yi > p.im) !== (yj > p.im) && p.re < (xj - xi) * (p.im - yi) / (yj - yi) + xi) c = !c
            }
            return c
        }
        return { wrong, cells: polys.length, own: polys.filter(p => inside(p.data.cache, p)).length }
    })
    expect(r).toEqual({ wrong: 0, cells: 100, own: 100 })
})

test('infovis scales: colors and sizes follow the value, log scales accept 0', async ({ page }) => {
    const r = await page.evaluate(() => {
        // a small tree: root with children of values 0..9 (n.data.value)
        const root = { depth: 0, data: { value: 100 }, precalc: {}, children: [] }
        for (let v = 0; v < 10; v++) root.children.push({ depth: 1, parent: root, data: { value: v }, precalc: {} })
        root.descendants = () => [root, ...root.children]
        const value = n => n.data.value
        const size = hyt.sizeBy(value, [1, 2]), sizeLog = hyt.sizeBy(value, [1, 2], 'log')
        const color = hyt.colorBy(value, t => `rgb(${Math.round(255 * t)}, 0, 0)`)
        const red = n => +/rgb\((\d+)/.exec(color(n))[1]
        const kids = root.children
        return {
            sizesUp: kids.every((n, i) => i === 0 || size(n) >= size(kids[i - 1])),
            sizeRange: [size(kids[0]), size(root)],
            logZero: sizeLog(kids[0]),                       // 0 on a log scale: the minimum
            logFinite: kids.every(n => isFinite(sizeLog(n))),
            redsUp: kids.every((n, i) => i === 0 || red(n) >= red(kids[i - 1])),
            redRange: [red(kids[0]), red(root)],
            cached: color(kids[3]) === color(kids[3]),
        }
    })
    expect(r.sizesUp).toBe(true)
    expect(r.sizeRange).toEqual([1, 2])
    expect(r.logZero).toBe(1)
    expect(r.logFinite).toBe(true)
    expect(r.redsUp).toBe(true)
    expect(r.redRange).toEqual([0, 255])
    expect(r.cached).toBe(true)
})

// The Schwarz–Christoffel map of the disk onto a rectangle (the rectangular view):
// map and unmap are inverse, the whole disk lands in the rectangle x ∈ ±1,
// y ∈ ±height/2 with the aspect ratio asked for, the rim on its edges with the four
// corners, the center in the middle, and scale is the local scale of the map.
test('Schwarz–Christoffel map: inverse, the disk fills the rectangle, the rim on its edges, conformal scale', async ({ page }) => {
    const r = await page.evaluate(() => {
        const out = {}
        for (const aspect of [.5, 1, 1.6, 2.5]) {
            const m = new hyt.RectangleMap(aspect), h = m.height
            let inverse = 0, outside = 0, scaleErr = 0, maxX = 0, maxY = 0
            for (let i = 0; i < 400; i++) {
                const z = inDisk(.999), w = m.map(z)
                maxX = Math.max(maxX, Math.abs(w.re)); maxY = Math.max(maxY, Math.abs(w.im))
                if (Math.abs(w.re) > 1 + 1e-9 || Math.abs(w.im) > h / 2 + 1e-9) outside++
                inverse = Math.max(inverse, dist(m.unmap(w), z))
                if (abs2(z) < .9) {
                    const e = 1e-6, a = 2 * Math.PI * rnd(), dz = { re: e * Math.cos(a), im: e * Math.sin(a) }
                    const numeric = dist(m.map({ re: z.re + dz.re, im: z.im + dz.im }), w) / e
                    scaleErr = Math.max(scaleErr, Math.abs(numeric - m.scale(z)) / m.scale(z))
                }
            }
            const rim = []
            for (let a = 0; a < 2 * Math.PI; a += .02) rim.push(m.map({ re: .999999 * Math.cos(a), im: .999999 * Math.sin(a) }))
            const onEdge = rim.every(w => Math.abs(Math.abs(w.re) - 1) < 2e-3 || Math.abs(Math.abs(w.im) - h / 2) < 2e-3)
            // the corners: the images of the prevertices ζ = ±1, ±1/k (z = (ζ − i·a) / (ζ + i·a),
            // a = 1/√k), just inside the rim (the map compresses like a square root there)
            const a = 1 / Math.sqrt(m.k)
            const corners = [1, -1, 1 / m.k, -1 / m.k].every(ζ => {
                const d = ζ * ζ + a * a, z = { re: (ζ * ζ - a * a) / d * .9999999, im: -2 * ζ * a / d * .9999999 }
                const w = m.map(z)
                return Math.abs(Math.abs(w.re) - 1) < 1e-3 && Math.abs(Math.abs(w.im) - h / 2) < 1e-3
            })
            const c = m.map({ re: 0, im: 0 })
            out[aspect] = { inverse, outside, scaleErr, aspectErr: Math.abs(2 / h - aspect), onEdge, corners, center: Math.abs(c.re) + Math.abs(c.im), maxX, maxY: maxY / (h / 2) }
        }
        return out
    })
    for (const a in r) {
        expect(r[a].inverse, a).toBeLessThan(1e-7)
        expect(r[a].outside, a).toBe(0)
        expect(r[a].scaleErr, a).toBeLessThan(1e-4)
        expect(r[a].aspectErr, a).toBeLessThan(1e-9)
        expect(r[a].onEdge, a).toBe(true)
        expect(r[a].corners, a).toBe(true)
        expect(r[a].center, a).toBeLessThan(1e-9)
        expect(r[a].maxX, a).toBeGreaterThan(.9)                       // the disk fills the rectangle
        expect(r[a].maxY, a).toBeGreaterThan(.9)
    }
})
