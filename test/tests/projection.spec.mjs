import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The projection (src/projection/): how the hyperbolic plane appears on the screen.
// The layers ask the projection for geodesics, circles, the outward direction; the
// filter maps the positions; the pointer is mapped back. geometry.projection selects it:
// 'poincare', 'cayley', 'schwarz-christoffel' or an own Projection.

test('the disk and the half-plane are the two projections; the layers hold no view branches', async ({ page }) => {
    await page.goto('harness.html?gen=data')
    const r = await page.evaluate(() => {
        const disk = hyt.createProjection('poincare', { orientation: 0, angle: 1 })
        const half = hyt.createProjection('cayley', { orientation: 3 * Math.PI / 2, angle: 1 })
        const own = { kind: 'own' }
        return {
            kinds: [disk.kind, half.kind, hyt.createProjection(own, {}).kind],
            diskIdentity: disk.toView({ re: .3, im: -.2 }), halfBorder: half.toView({ re: 0, im: 0 }),
            diskArc: disk.geodesic({ re: .2, im: .1 }, { re: .5, im: .4 }, '-'),
            halfArc: half.geodesic({ re: .2, im: .1 }, { re: .5, im: .4 }, '-'),
            line: disk.geodesic({ re: .2, im: .1 }, { re: .5, im: .4 }, '0'),
            diskStem: disk.stem({ re: .2, im: .5 }, '+'), halfStem: half.stem({ re: .2, im: .5 }, '+'),
            diskCircle: disk.circle({ re: 0, im: 0 }, .3), halfCircleAtInfinity: half.circle({ re: 0, im: 0 }, 1.5),
        }
    })
    expect(r.kinds).toEqual(['poincare', 'cayley', 'own'])
    expect(r.diskIdentity).toEqual({ re: .3, im: -.2 })
    expect(Math.abs(r.halfBorder.re) + Math.abs(r.halfBorder.im)).toBeLessThan(1e-12)   // the disk center maps to the view's (0,0)
    expect(r.diskArc).toMatch(/^M 0.2 0.1 A /)
    expect(r.halfArc).toMatch(/^M 0.2 0.1 A /)
    expect(r.line).toBe('M 0.2 0.1 L 0.5 0.4')
    expect(r.diskStem).toMatch(/A .* 0.2 1$/)                    // to the rim, straight down
    expect(r.halfStem).toBe('M 0.2 0.5 L 0.2 3')                 // to infinity below
    expect(r.diskCircle).toEqual({ cx: 0, cy: 0, r: .3 })
    expect(r.halfCircleAtInfinity).toBeNull()
})

test('an own projection in geometry.projection: the layers draw what it says', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('harness.html?gen=nTree&depth=4&childs=3')
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    // a projection that draws every link as a straight line and marks every circle
    await page.evaluate(() => {
        const disk = hyt.createProjection('poincare', harness.ht.args.layout.rootWedge)
        const own = Object.assign(Object.create(Object.getPrototypeOf(disk)), disk, {
            kind: 'straight',
            geodesic: (a, b) => `M ${a.re} ${a.im} L ${b.re} ${b.im}`,
            circle: (c, r) => ({ cx: c.re, cy: c.im, r: r * 2 }),
        })
        harness.ht.configure({ geometry: { projection: own } })
    })
    await waitForStable(page)
    const r = await page.evaluate(() => ({
        kind: harness.ht.projection.kind,
        links: [...document.querySelectorAll('[id="link-arcs"] path')].map(p => p.getAttribute('d')),
        λ: harness.ht.args.geometry.transformation.state.λ,
        λcircle: document.querySelector('[id="λ"] circle').getAttribute('transform'),
    }))
    expect(r.kind).toBe('straight')
    expect(r.links.length).toBeGreaterThan(10)
    expect(r.links.every(d => / L /.test(d) && !/ A /.test(d))).toBe(true)
    expect(r.λcircle).toBe(`translate(0 0) scale(${r.λ * 2})`)
    expectNoErrors(errors)
})
