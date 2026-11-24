import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// interaction.minFill: the lower λ bound is computed per tree so that the visible tree
// (root in the middle) never fills less than minFill of the disk radius.

// the farthest visible node at the current view (root in the middle: the harness does
// not move it)
const reach = page => page.evaluate(() => Math.max(...harness.ht.unitdisk.cache.unculledNodes.map(n => Math.hypot(n.cache.re, n.cache.im))))

for (const tree of ['file=fixtures/primates.treeml.xml', 'gen=nTree&depth=6&childs=3', 'file=fixtures/filesystem.d3.json']) {
    test(`minFill .9: the tree reaches 90 % of the radius at the lowest zoom (${tree})`, async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, `${tree}&interaction=${encodeURIComponent(JSON.stringify({ minFill: .9 }))}`)
        await waitForStable(page)
        const [min, max] = await page.evaluate(() => harness.ht.args.interaction.λbounds)
        expect(min).toBeGreaterThan(0)
        // a small tree that never reaches 90 % gets the upper bound
        expect(min).toBeLessThanOrEqual(max)
        // zooming out as far as it goes: stops at the bound, the visible tree still
        // reaches about 90 % of the radius (the filter adapts while zooming)
        await page.evaluate(() => harness.ht.api.gotoλ(.001))
        await waitForStable(page)
        expect(await page.evaluate(() => harness.ht.args.geometry.transformation.state.λ)).toBeCloseTo(min, 9)
        if (min < max) expect(await reach(page)).toBeGreaterThan(.85)
        expectNoErrors(errors)
    })
}

// interaction.maxLinkLength: the upper λ bound so that a normal link whose parent is in
// the middle is that long (share of the disk radius; leaves staggered outward among
// many siblings, layout wedge L > 0, are longer and do not count)
for (const tree of ['file=fixtures/primates.treeml.xml', 'file=fixtures/filesystem.d3.json']) {
    test(`maxLinkLength .5: at the upper bound a normal link from the middle is half the radius (${tree})`, async ({ page }) => {
        await openTree(page, `${tree}&interaction=${encodeURIComponent(JSON.stringify({ maxLinkLength: .5, minFill: .9 }))}`)
        await waitForStable(page)
        const r = await page.evaluate(() => {
            const ht = harness.ht, [min, max] = ht.args.interaction.λbounds
            ht.args.layout.type(ht.data, max)
            // each link with its parent moved to the middle: (z - p) / (1 - conj(p) z)
            let longest = 0
            ht.data.each(n => {
                // normal links: not from the root (half length), no extra leaf length
                if (!n.parent || !n.parent.parent || n.layout.wedge.L) return
                const p = n.parent.layout.z, z = n.layout.z
                const nr = z.re - p.re, ni = z.im - p.im
                const dr = 1 - (p.re * z.re + p.im * z.im), di = -(p.re * z.im - p.im * z.re)
                longest = Math.max(longest, Math.hypot(nr, ni) / Math.hypot(dr, di))
            })
            ht.args.layout.type(ht.data, ht.args.geometry.transformation.state.λ)
            return { min, max, longest }
        })
        expect(r.longest).toBeCloseTo(.5, 6)
        expect(r.min).toBeLessThanOrEqual(r.max)
    })
}

test('without minFill λbounds stay as configured', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=6&childs=3&interaction=${encodeURIComponent(JSON.stringify({ λbounds: [.03, .5] }))}`)
    await waitForStable(page)
    expect(await page.evaluate(() => harness.ht.args.interaction.λbounds)).toEqual([.03, .5])
})
