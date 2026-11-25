import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// Red nodes (class lazy, n.hasOutChildren): the filter hid some of their children.
// They are drawn larger (nodes layer option lazyScale, default 1.5), and the class
// follows the view (it was set only when a disk was created).

const state = page => page.evaluate(() => {
    const ud = harness.ht.unitdisk, visible = new Set(ud.cache.unculledNodes)
    const circles = [...document.querySelectorAll('[id="nodes"] circle')]
    const out = { drawn: circles.length, lazy: 0, wrongClass: 0, noHiddenChild: 0, wrongRadius: 0, plainRadiusOk: 0 }
    for (const c of circles) {
        const n = c.__data__
        const isLazy = c.classList.contains('lazy')
        if (isLazy !== !!n.hasOutChildren) out.wrongClass++
        const r = harness.ht.args.geometry.nodeRadius(ud, n), drawn = +c.getAttribute('r')
        if (isLazy) {
            out.lazy++
            // some child is not visible
            if (!n.children || n.children.every(ch => visible.has(ch))) out.noHiddenChild++
            if (Math.abs(drawn - 1.5 * r) > 1e-9) out.wrongRadius++
        }
        else if (Math.abs(drawn - r) < 1e-9) out.plainRadiusOk++
    }
    return out
})

test('red nodes: exactly the drawn nodes with hidden children, 1.5 times as large', async ({ page }) => {
    const errors = collectErrors(page)
    // a tree too large for rangeNodes: the filter hides children
    const filterOpt = encodeURIComponent(JSON.stringify({ weightFilter: { rangeNodes: { min: 60, max: 120 } } }))
    await openTree(page, `gen=nTree&depth=7&childs=3&filterOpt=${filterOpt}`)
    await waitForStable(page)
    const s = await state(page)
    expect(s.lazy).toBeGreaterThan(5)
    expect(s.wrongClass).toBe(0)
    expect(s.noHiddenChild).toBe(0)
    expect(s.wrongRadius).toBe(0)
    expect(s.plainRadiusOk).toBe(s.drawn - s.lazy)

    // moved: other nodes have hidden children; the class and the size follow
    await page.evaluate(async () => {
        const n = harness.ht.unitdisk.cache.unculledNodes.filter(n => n.depth === 3)[0]
        await harness.ht.api.goto({ re: -n.layout.z.re, im: -n.layout.z.im }, null)
    })
    await waitForStable(page)
    const t = await state(page)
    expect(t.lazy).toBeGreaterThan(0)
    expect(t.wrongClass).toBe(0)
    expect(t.noHiddenChild).toBe(0)
    expect(t.wrongRadius).toBe(0)
    expectNoErrors(errors)
})

test('nodes option lazyScale: 1 draws them as large as the others', async ({ page }) => {
    const filterOpt = encodeURIComponent(JSON.stringify({ weightFilter: { rangeNodes: { min: 60, max: 120 } } }))
    const layers = encodeURIComponent(JSON.stringify({ nodes: { lazyScale: 1 } }))
    await openTree(page, `gen=nTree&depth=7&childs=3&filterOpt=${filterOpt}&layers=${layers}`)
    await waitForStable(page)
    const r = await page.evaluate(() => {
        const ud = harness.ht.unitdisk
        return [...document.querySelectorAll('[id="nodes"] circle.lazy')].map(c => +c.getAttribute('r') / harness.ht.args.geometry.nodeRadius(ud, c.__data__))
    })
    expect(r.length).toBeGreaterThan(0)
    for (const x of r) expect(x).toBeCloseTo(1, 9)
})
