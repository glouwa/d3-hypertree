import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree } from './helpers.mjs'

// interaction.keepTreeInView (interaction/view-bounds.ts): the center of the view never
// lies beyond the tip of the tree. A narrow tree (a 90° wedge) zoomed out, so that
// dragging the root against the tree's growth pulls the tips short of the center.

const wedge = encodeURIComponent(JSON.stringify({ rootWedge: { orientation: 3 * Math.PI / 2, angle: Math.PI / 2 } }))
const λ = .06
async function open(page, interaction) {
    await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&layout=${wedge}` + (interaction ? `&interaction=${encodeURIComponent(JSON.stringify(interaction))}` : ''))
    await page.evaluate(λ => harness.ht.api.gotoλ(λ), λ)
    await page.waitForTimeout(100)
}

// the view's margin, computed independently of the library: the node nearest to the
// center; no tip (in the center, a visible child, or its parent not behind it): valid;
// a tip: its distance beyond the circle with the diameter center-root*
const margin = page => page.evaluate(() => {
    const ht = harness.ht, root = ht.data
    const vis = new Set(ht.unitdisk.cache.unculledNodes.filter(n => !n.isOut)); vis.add(root)
    let nearest = root, best = Infinity
    for (const n of vis) { const d = Math.hypot(n.cache.re, n.cache.im); if (d < best) { best = d; nearest = n } }
    const r = Math.hypot(nearest.cache.re, nearest.cache.im)
    if (r < 1e-4) return 1
    if (!nearest.parent || !vis.has(nearest.parent) || (nearest.children || []).some(c => vis.has(c))) return 1
    const b = nearest.parent, dx = b.cache.re - nearest.cache.re, dy = b.cache.im - nearest.cache.im, d = Math.hypot(dx, dy)
    if ((dx * nearest.cache.re + dy * nearest.cache.im) / d / r < .5) return 1
    const rr = Math.hypot(root.cache.re, root.cache.im)
    if (rr < 1e-6) return 1
    return Math.hypot(nearest.cache.re - root.cache.re / rr / 2, nearest.cache.im - root.cache.im / rr / 2) - .5
})
// the root rule's margin (radians): the angle between the direction root -> center and
// the stem's direction (the layout's wedge orientation + π, transformed), minus half the
// stem gap
const rootMargin = page => page.evaluate(() => {
    const ht = harness.ht, root = ht.data.cache, w = ht.args.layout.rootWedge
    const r = Math.hypot(root.re, root.im)
    if (r < 1e-4) return 1
    const o = w.orientation + Math.PI
    const p = ht.args.geometry.transformation.transformPoint({ re: .02 * Math.cos(o), im: .02 * Math.sin(o) })
    const dx = p.re - root.re, dy = p.im - root.im, d = Math.hypot(dx, dy)
    const cos = (-root.re * dx - root.im * dy) / r / d
    return Math.acos(Math.max(-1, Math.min(1, cos))) - (2 * Math.PI - w.angle) / 2
})
const rootPos = page => page.evaluate(() => ({ re: harness.ht.data.cache.re, im: harness.ht.data.cache.im }))
// the direction the tree grows in (disk units, unit length): from the root to the leaves
const treeDir = page => page.evaluate(() => {
    const ht = harness.ht, leaves = ht.data.leaves()
    const m = { re: 0, im: 0 }
    for (const l of leaves) { m.re += l.cache.re - ht.data.cache.re; m.im += l.cache.im - ht.data.cache.im }
    const d = Math.hypot(m.re, m.im)
    return { re: m.re / d, im: m.im / d }
})
// a disk point on the screen (the unit disk group's screen matrix)
const toScreen = (page, p) => page.evaluate(p => {
    const m = document.querySelector('.unitDisc').getScreenCTM()
    return { x: m.a * p.re + m.c * p.im + m.e, y: m.b * p.re + m.d * p.im + m.f }
}, p)
// drags the root (the point under the pointer) to the disk point `to`, keeps pressing
async function dragRoot(page, to) {
    const from = await toScreen(page, await rootPos(page))
    const end = await toScreen(page, to)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 10 })
    await page.waitForTimeout(100)
}

test('dragging the tree away stops with its tip at the center; off, the tree is left behind', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    expect(await margin(page)).toBeGreaterThanOrEqual(0)
    const dir = await treeDir(page)
    const back = { re: -dir.re * .7, im: -dir.im * .7 }      // the root against the growth: the tips come short of the center
    await dragRoot(page, back)
    // still pressed: the view is corrected in every frame
    expect(await margin(page)).toBeGreaterThanOrEqual(-1e-3)
    const r = await rootPos(page)
    expect(Math.hypot(r.re - back.re, r.im - back.im)).toBeGreaterThan(.1)   // held back
    await page.mouse.up()
    expect(await margin(page)).toBeGreaterThanOrEqual(-1e-3)
    expectNoErrors(errors)

    await open(page, { keepTreeInView: false })
    await dragRoot(page, back)
    await page.mouse.up()
    expect(await margin(page)).toBeLessThan(-.1)
    const r2 = await rootPos(page)
    expect(Math.hypot(r2.re - back.re, r2.im - back.im)).toBeLessThan(.05)
})

test('a diagonal drag at the boundary slides along it: the movement across the axis stays', async ({ page }) => {
    await open(page)
    const dir = await treeDir(page)
    // first to the boundary (the tip at the center), straight against the growth
    await dragRoot(page, { re: -dir.re * .7, im: -dir.im * .7 })
    await page.mouse.up()
    await page.waitForTimeout(100)
    const r0 = await rootPos(page)
    expect(await margin(page)).toBeGreaterThanOrEqual(-1e-3)
    // then diagonally: further against the growth (corrected) and across (kept)
    const side = { re: -dir.im, im: dir.re }
    const to = { re: r0.re - dir.re * .3 + side.re * .3, im: r0.im - dir.im * .3 + side.im * .3 }
    await dragRoot(page, to)
    await page.mouse.up()
    expect(await margin(page)).toBeGreaterThanOrEqual(-1e-3)
    const r = await rootPos(page)
    const across = (r.re - r0.re) * side.re + (r.im - r0.im) * side.im
    const back = -((r.re - r0.re) * dir.re + (r.im - r0.im) * dir.im)
    expect(across).toBeGreaterThan(.12)                     // a good part of the .3 across, not sticking
    expect(back).toBeLessThan(.25)                          // the push against the growth held back
})

test('the wheel zooms out as far as λbounds allow, the tree stays in the view', async ({ page }) => {
    await open(page)
    const dir = await treeDir(page)
    // the mouse behind the root: zooming out there pulls the tree away from the center
    const m = await toScreen(page, { re: -dir.re * .8, im: -dir.im * .8 })
    await page.mouse.move(m.x, m.y)
    const λ0 = await page.evaluate(() => harness.ht.args.geometry.transformation.state.λ)
    const want = await page.evaluate(λ => harness.ht.clampλ(λ / Math.pow(harness.ht.args.interaction.wheelFactor, 4)), λ0)
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60) }
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => harness.ht.args.geometry.transformation.state.λ)).toBeCloseTo(want, 6)
    expect(await margin(page)).toBeGreaterThanOrEqual(-1e-3)
})

test('the root never passes the center into its stem gap; beside the center it can go', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    const dir = await treeDir(page)
    // in the growth direction: the center would lie on the stem behind the root
    await dragRoot(page, { re: dir.re * .5, im: dir.im * .5 })
    await page.mouse.up()
    expect(await rootMargin(page)).toBeGreaterThanOrEqual(-.02)
    const r = await rootPos(page)
    expect(r.re * dir.re + r.im * dir.im).toBeLessThan(.08)   // held at the center line
    // sideways: allowed, the root keeps its sideways position (a 90° wedge: the center
    // must be within 45° of the tree's axis, so the root is pushed a little back as well)
    await open(page)
    const side = { re: -dir.im, im: dir.re }
    await dragRoot(page, { re: side.re * .3, im: side.im * .3 })
    await page.mouse.up()
    expect(await rootMargin(page)).toBeGreaterThanOrEqual(-.02)
    const r2 = await rootPos(page)
    expect(r2.re * side.re + r2.im * side.im).toBeGreaterThan(.25)
    expectNoErrors(errors)

    await open(page, { keepTreeInView: false })
    await dragRoot(page, { re: dir.re * .5, im: dir.im * .5 })
    await page.mouse.up()
    expect(await rootMargin(page)).toBeLessThan(-.5)
})

test('animations are not limited: api.goto may leave the tree behind', async ({ page }) => {
    await open(page)
    const dir = await treeDir(page)
    await page.evaluate(p => harness.ht.api.goto(p, null), { re: -dir.re * .7, im: -dir.im * .7 })
    await page.waitForTimeout(200)
    expect(await margin(page)).toBeLessThan(-.1)
})
