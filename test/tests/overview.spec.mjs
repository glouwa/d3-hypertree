import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// api.overview / api.gotoOverview (src/models/hypertree/overview.ts): a start view with
// the root at the bottom, the main branchings in the middle, the branches filling the
// disk.

const tree = 'file=fixtures/filesystem.d3.json&labels=name&layout=' + encodeURIComponent(JSON.stringify({ childOrder: 'balanced' }))

test('overview: the root below the middle on the trunk axis, the branches fill the disk', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, tree)
    await waitForStable(page)
    const before = await page.evaluate(() => { const s = harness.ht.args.geometry.transformation.state; return { λ: s.λ, P: { ...s.P } } })
    const v = await page.evaluate(() => harness.ht.api.overview())
    // the root goes against the growth direction (rootWedge orientation 3π/2: up, so down)
    expect(Math.abs(v.P.re)).toBeLessThan(1e-9)
    expect(v.P.im).toBeGreaterThan(.05)
    expect(v.P.im).toBeLessThan(.97)
    const [lo, hi] = await page.evaluate(() => harness.ht.args.interaction.λbounds)
    expect(v.λ).toBeGreaterThanOrEqual(lo)
    expect(v.λ).toBeLessThanOrEqual(hi)
    // only computed: the view is unchanged
    expect(await page.evaluate(() => { const s = harness.ht.args.geometry.transformation.state; return { λ: s.λ, P: { ...s.P } } })).toEqual(before)

    // there: the heavy branches reach about the rim, their centroid is near the middle
    await page.evaluate(() => harness.ht.api.gotoOverview())
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const inner = harness.ht.data.descendants().filter(n => n.children && n.children.length)
            .sort((a, b) => b.precalc.layoutWeight - a.precalc.layoutWeight).slice(0, 300).filter(n => n.cache)
        const rs = inner.map(n => Math.hypot(n.cache.re, n.cache.im)).sort((a, b) => a - b)
        const s = harness.ht.args.geometry.transformation.state
        return { root: { ...harness.ht.data.cache }, λ: s.λ, q95: rs[Math.floor(.95 * (rs.length - 1))], cy: inner.reduce((a, n) => a + n.cache.im, 0) / inner.length }
    })
    expect(r.root.im).toBeCloseTo(v.P.im, 2)
    expect(r.λ).toBeCloseTo(v.λ, 3)
    expect(r.q95).toBeGreaterThan(.85)
    expect(r.q95).toBeLessThan(.99)
    expect(Math.abs(r.cy)).toBeLessThan(.15)
    expectNoErrors(errors)
})
