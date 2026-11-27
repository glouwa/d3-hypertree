import { test, expect } from '@playwright/test'
import { openTree, waitForStable } from './helpers.mjs'

// geometry.linkCurvature '-' (the default) is the image of the hyperbolic geodesic in
// every projection, '+' its mirror image. Until 2026-11-27 the projections that draw a
// link as a quadratic curve through the image of the disk arc's midpoint mirrored for
// '-': by default they drew the mirror image, and '+' looked like the disk.
//
//   poincare: the SVG arc's point at half its length is the geodesic's midpoint
//   the curve projections: the quadratic's point at t = .5 is the image of that midpoint

const KINDS = ['poincare', 'schwarz-christoffel', 'glatzhofer', 'band', 'half-band',
               'klein', 'equal-area', 'equidistant', 'gans', 'stretch', 'squircle', 'sector']

for (const kind of KINDS) {
    test(`${kind}: '-' is the geodesic, '+' its mirror image`, async ({ page }) => {
        await openTree(page, `gen=nTree&depth=6&childs=3&size=1200x600&geometry=${encodeURIComponent(JSON.stringify({ projection: kind }))}`)
        await waitForStable(page)
        const r = await page.evaluate(() => {
            const ht = harness.ht, p = ht.projection
            const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path')
            svg.appendChild(path); document.body.appendChild(svg)
            // the middle of the disk geodesic's arc from a to b (the point of the arc nearest the
            // chord's middle, as the projections take it), mapped into the view. The geodesic is
            // the circle through a and b orthogonal to the rim: its center c has c·a = (|a|²+1)/2
            // and c·b = (|b|²+1)/2; a and b in line with the origin: the straight diameter
            const geodesicMid = (a, b) => {
                const m = { re: (a.re + b.re) / 2, im: (a.im + b.im) / 2 }
                const det = a.re * b.im - a.im * b.re
                if (Math.abs(det) < 1e-9) return p.toView(m)
                const ka = (a.re * a.re + a.im * a.im + 1) / 2, kb = (b.re * b.re + b.im * b.im + 1) / 2
                const c = { re: (ka * b.im - kb * a.im) / det, im: (kb * a.re - ka * b.re) / det }
                const R = Math.hypot(a.re - c.re, a.im - c.im), d = Math.hypot(m.re - c.re, m.im - c.im)
                return p.toView({ re: c.re + (m.re - c.re) * R / d, im: c.im + (m.im - c.im) * R / d })
            }
            const midOf = d => {
                const n = d.match(/-?[\d.]+(e-?\d+)?/g).map(Number)
                if (/Q/.test(d)) { const [ax, ay, cx, cy, bx, by] = n; return { re: (ax + 2 * cx + bx) / 4, im: (ay + 2 * cy + by) / 4 } }
                path.setAttribute('d', d); const q = path.getPointAtLength(path.getTotalLength() / 2); return { re: q.x, im: q.y }
            }
            let minus = 0, plus = 0, onLine = 0, same = true, n = 0
            for (const node of ht.unitdisk.cache.unculledNodes) {
                if (!node.parent || node.outOfView || node.parent.outOfView) continue
                const a = node.cacheDisk || node.cache, b = node.parent.cacheDisk || node.parent.cache
                if (Math.hypot(a.re, a.im) < .05 || Math.hypot(a.re - b.re, a.im - b.im) < .02) continue
                const g = geodesicMid(a, b)
                const dm = p.geodesic(node.cache, node.parent.cache, '-'), dp = p.geodesic(node.cache, node.parent.cache, '+')
                if (p.kind === 'klein') {
                    // a straight segment: the image of the geodesic's middle lies on it
                    const A = node.cache, B = node.parent.cache
                    onLine = Math.max(onLine, Math.abs((B.re - A.re) * (g.im - A.im) - (B.im - A.im) * (g.re - A.re)) / Math.hypot(B.re - A.re, B.im - A.im))
                    same = same && dm === dp
                }
                else {
                    const m1 = midOf(dm), m2 = midOf(dp)
                    minus = Math.max(minus, Math.hypot(m1.re - g.re, m1.im - g.im))
                    plus = Math.max(plus, Math.hypot(m2.re - g.re, m2.im - g.im))
                }
                n++
            }
            svg.remove()
            return { n, minus, plus, onLine, same, kind: p.kind, default: ht.args.geometry.linkCurvature }
        })
        expect(r.default).toBe('-')
        expect(r.n).toBeGreaterThan(10)
        if (r.kind === 'klein') {
            expect(r.onLine).toBeLessThan(1e-9)     // geodesics are straight lines
            expect(r.same).toBe(true)               // the curvature does not matter
            return
        }
        expect(r.minus).toBeLessThan(1e-6)          // on the geodesic
        expect(r.plus).toBeGreaterThan(1e-4)        // the mirror image is off it
    })
}
