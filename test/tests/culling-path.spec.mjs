import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// The path the selection starts from (filter/culling.ts pathToLastVisible): the
// ancestors of the center node within the culling radius. A wheel step changes λ and
// relays only the ancestors of the node under the pointer; the center node of the last
// frame may lie in another branch. It used to be laid out from its parent that still
// had the old λ: deep in the tree that mix moved it beyond the culling radius, the
// path was empty, nothing was selected and the root (now the center) kept it empty:
// the tree was gone until a reload. Now the chain root → center is laid out top-down
// and the path is never empty.

const toScreen = (page, c) => page.evaluate(c => {
    const m = document.querySelector('.unitDisc').getScreenCTM()
    return { x: m.a * c.re + m.c * c.im + m.e, y: m.b * c.re + m.d * c.im + m.f }
}, c)

test('wheel zoom deep in the tree at a node of another branch keeps the tree', async ({ page }) => {
    const errors = collectErrors(page)
    // a big wheel step: the displacement of a node laid out from a stale parent grows with
    // the depth and the λ change (Mammalia needs depth ~30 at the default wheelFactor)
    await openTree(page, `gen=nTree&depth=12&childs=2&interaction=${encodeURIComponent(JSON.stringify({ λbounds: [.02, .9], wheelFactor: 1.7 }))}`)
    // deeper in steps (the layout is lazy: only visible nodes have a position): to the
    // deepest visible node of depth <= 8 away from the center, until one of depth 8 is centered
    for (let i = 0; i < 6; i++) {
        const depth = await page.evaluate(() => {
            const ht = harness.ht, u = ht.unitdisk.cache.unculledNodes.filter(n => n.depth <= 8 && Math.hypot(n.cache.re, n.cache.im) > .15)
            if (!u.length) throw new Error(`no node to go to: ${ht.unitdisk.cache.unculledNodes.length} visible, center depth ${ht.unitdisk.cache.centerNode && ht.unitdisk.cache.centerNode.depth}`)
            const n = u.reduce((a, b) => b.depth > a.depth ? b : a)
            return ht.api.gotoNode(n).then(() => n.depth)
        })
        await waitForStable(page)
        if (depth >= 8) break
    }
    // the deepest visible node away from the center that is not an ancestor of the center
    // node and not in the subtree of the center's parent: then the center's parent is
    // not relaid by the wheel step (it was laid out from that stale parent)
    const t = await page.evaluate(() => {
        const ht = harness.ht, c = ht.unitdisk.cache.centerNode, anc = new Set(c.ancestors())
        const cands = ht.unitdisk.cache.unculledNodes.filter(n => {
            const r = Math.hypot(n.cache.re, n.cache.im)
            return r > .15 && r < .97 && !anc.has(n) && !n.ancestors().includes(c.parent)
        })
        if (!cands.length) throw new Error(`no candidate: ${ht.unitdisk.cache.unculledNodes.length} visible, center depth ${c.depth}, radii ${ht.unitdisk.cache.unculledNodes.slice(0, 12).map(n => Math.hypot(n.cache.re, n.cache.im).toFixed(2)).join(' ')}`)
        const n = cands.reduce((a, b) => b.depth > a.depth ? b : a)
        return { id: n.mergeId, re: n.cache.re, im: n.cache.im, depth: n.depth, centerDepth: c.depth, visible: ht.unitdisk.cache.unculledNodes.length }
    })
    expect(t.centerDepth).toBeGreaterThanOrEqual(7)
    const s = await toScreen(page, t)
    await page.mouse.move(s.x, s.y)
    await page.waitForTimeout(100)
    for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, -200)
        await page.waitForTimeout(150)
        const r = await page.evaluate(id => {
            const ht = harness.ht, n = ht.data.descendants().find(n => n.mergeId === id), c = ht.unitdisk.cache.centerNode
            return { visible: ht.unitdisk.cache.unculledNodes.length, re: n.cache.re, im: n.cache.im, λ: ht.args.geometry.transformation.state.λ, centerDepth: c && c.depth }
        }, t.id)
        // the tree is still there (it was gone: 0 visible, the root the center) and the
        // node under the pointer stays in place
        expect(r.visible, `step ${i}: λ ${r.λ}, center depth ${r.centerDepth}`).toBeGreaterThan(5)
        expect(r.centerDepth, `step ${i}: λ ${r.λ}`).toBeGreaterThan(3)
        expect(Math.hypot(r.re - t.re, r.im - t.im), `step ${i}`).toBeLessThan(.02)
    }
    await waitForStable(page)
    expect(await page.evaluate(() => harness.ht.unitdisk.cache.unculledNodes.length)).toBeGreaterThan(5)
    expectNoErrors(errors)
})
