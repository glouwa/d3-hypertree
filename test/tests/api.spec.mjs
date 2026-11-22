import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox, expectScene, expectPlausibleScene } from './helpers.mjs'

// The animation and selection API that applications use (e.g. to navigate on click).
// Checked by end state (level 1) and scene snapshot (level 2), filter off and default.

const configs = [
    ['filter-off', 'gen=nTree&depth=6&childs=2&filter=off'],
    ['filter-default', 'gen=nTree&depth=10&childs=2'],
]

const state = page => page.evaluate(() => {
    const s = harness.ht.unitdisk.args.transformation.state
    return { λ: s.λ, P: { re: s.P.re, im: s.P.im } }
})
const center = async page => {
    const b = await diskBox(page)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

for (const [name, query] of configs) {
    test.describe(name, () => {
        test('gotoNode: animates the node to the center', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            const id = await page.evaluate(async () => {
                const n = harness.ht.data.children[1].children[0].children[1]
                await harness.ht.api.gotoNode(n)
                return n.mergeId
            })
            await waitForStable(page)
            // inner nodes have no circle, so check the node's transformed position
            const r = await page.evaluate(id => {
                const n = harness.ht.data.descendants().find(n => n.mergeId === id)
                return Math.hypot(n.cache.re, n.cache.im)
            }, id)
            expect(r).toBeLessThan(0.01) // animations stop slightly short of the target
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `${name}-gotoNode`)
            expectNoErrors(errors)
        })

        test('gotoHome: brings the root back to the center', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            await page.evaluate(async () => {
                await harness.ht.api.gotoNode(harness.ht.data.children[0].children[1])
                await harness.ht.api.gotoHome()
            })
            await waitForStable(page)
            const s = await state(page)
            expect(Math.hypot(s.P.re, s.P.im)).toBeLessThan(0.005)
            await expectScene(page, testInfo, `${name}-gotoHome`)
            expectNoErrors(errors)
        })

        // Known bug: animateTo ignores its λ argument, so goto(p, λ) only translates.
        // Remove .fail once fixed.
        test.fail('goto: the zoom argument is applied', async ({ page }) => {
            await openTree(page, query)
            await page.evaluate(() => harness.ht.api.goto({ re: 0.2, im: -0.3 }, 0.25))
            await waitForStable(page)
            expect(Math.abs((await state(page)).λ - 0.25)).toBeLessThan(0.005)
        })

        test('goto: translation', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            await page.evaluate(() => harness.ht.api.goto({ re: 0.2, im: -0.3 }, null))
            await waitForStable(page)
            const s = await state(page)
            // animations end within ~0.3% of the way (the last frame stops short)
            expect(Math.abs(s.P.re - 0.2)).toBeLessThan(0.005)
            expect(Math.abs(s.P.im + 0.3)).toBeLessThan(0.005)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `${name}-goto`)
            expectNoErrors(errors)
        })

        test('gotoλ: zoom only', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            const P0 = (await state(page)).P
            await page.evaluate(() => harness.ht.api.gotoλ(0.2))
            await waitForStable(page)
            const s = await state(page)
            expect(Math.abs(s.λ - 0.2)).toBeLessThan(0.005)
            expect(s.P.re).toBeCloseTo(P0.re, 6)
            expect(s.P.im).toBeCloseTo(P0.im, 6)
            await expectScene(page, testInfo, `${name}-gotoλ`)
            expectNoErrors(errors)
        })

        test('animateUp, then drawDetailFrame', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            const before = await state(page)
            await page.evaluate(() => new Promise((ok, err) => harness.ht.animateUp(ok, err)))
            await page.evaluate(() => harness.ht.drawDetailFrame())
            await waitForStable(page)
            const after = await state(page)
            expect(Math.abs(after.λ - before.λ)).toBeLessThan(0.005) // grows back to the start zoom
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `${name}-animateUp`)
            expectNoErrors(errors)
        })
    })
}

test('toggleSelection: selected nodes get a selection path', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=6&childs=2&filter=off')
    const ids = await page.evaluate(() => {
        const a = harness.ht.data.children[0].children[1].leaves()[0]   // leaf: has a circle
        const b = harness.ht.data.children[1].children[1]               // inner node: path only
        harness.ht.api.toggleSelection(a)
        harness.ht.api.toggleSelection(b)
        return [a.mergeId, b.mergeId].sort((x, y) => x - y)
    })
    await waitForStable(page)
    const s = await page.evaluate(() => ({
        selections: harness.scene().selections,
        selectedNodes: document.querySelectorAll('#nodes .selected').length,
        pathArcs: document.querySelectorAll('#path-arcs path').length,
    }))
    expect(s.selections).toEqual(ids)
    expect(s.selectedNodes).toBeGreaterThan(0)
    expect(s.pathArcs).toBeGreaterThan(0)
    await expectScene(page, testInfo, 'toggleSelection')

    // deselecting one keeps the other
    await page.evaluate(id => harness.ht.api.toggleSelection(harness.ht.data.descendants().find(n => n.mergeId === id)), ids[0])
    expect(await page.evaluate(() => harness.scene().selections)).toEqual([ids[1]])
    expectNoErrors(errors)
})

test('setPathHead: draws a path to the given node', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=6&childs=2&filter=off')
    const r = await page.evaluate(() => {
        const n = harness.ht.data.children[1].children[0].children[1].children[0]
        harness.ht.api.setPathHead(harness.ht.args.objects.pathes[0], n)
        const onPath = harness.ht.data.descendants().filter(m => m.pathes && m.pathes.isPartOfAnyHoverPath)
        return { depth: n.depth, onPath: onPath.length, arcs: document.querySelectorAll('#path-arcs path').length }
    })
    expect(r.onPath).toBe(r.depth + 1)
    expect(r.arcs).toBe(r.depth)
    expectNoErrors(errors)
})

test('selectQuery: highlights paths to all matching nodes', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await openTree(page, 'file=fixtures/small.d3.json&filter=off')
    const r = await page.evaluate(() => {
        harness.ht.api.selectQuery('b', 'name')
        const heads = harness.ht.args.objects.pathes.map(p => p.head && p.head.data.name).filter(Boolean).sort()
        return { heads, arcs: document.querySelectorAll('#path-arcs path').length }
    })
    expect(r.heads).toEqual(['b', 'b1', 'b2', 'b21', 'b22'])
    expect(r.arcs).toBeGreaterThan(0)
    await expectScene(page, testInfo, 'selectQuery')
    expectNoErrors(errors)
})

// selectQuery replaces objects.pathes, including the hover path object the
// interaction layer references; hovering must keep working anyway.
test('hover still highlights a path after selectQuery', async ({ page }) => {
    await openTree(page, 'file=fixtures/small.d3.json&filter=off')
    await page.evaluate(() => harness.ht.api.selectQuery('zzz', 'name')) // matches nothing
    const target = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#nodes circle')].find(c => c.__data__ && c.__data__.depth === 2)
        const r = c.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.move(target.x, target.y)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => document.querySelectorAll('#path-arcs path').length)).toBeGreaterThan(0)
})

test('ripple: shows a ripple at the node and removes it when done', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=6&childs=2')
    const shown = await page.evaluate(() => {
        const n = harness.ht.data.children[0]
        const layer = harness.layer('interaction-2')
        window.__rippleDone = new Promise(ok => layer.ripple(n, n.cache, ok))
        return document.querySelectorAll('.ripple-circle').length
    })
    expect(shown).toBe(1)
    await page.evaluate(() => Promise.race([window.__rippleDone, new Promise((_, e) => setTimeout(() => e(new Error('ripple never finished')), 5000))]))
    expect(await page.evaluate(() => document.querySelectorAll('.ripple-circle').length)).toBe(0)
    expectNoErrors(errors)
})
