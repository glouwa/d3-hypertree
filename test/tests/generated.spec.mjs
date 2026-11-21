import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, counts, diskBox } from './helpers.mjs'

test.describe('generated trees render', () => {
    test('binary tree (depth 10)', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')

        expect(await page.evaluate(() => harness.ht.data.descendants().length)).toBe(2047)
        const c = await counts(page)
        expect(c.nodes).toBeGreaterThan(20)
        expect(c.links).toBeGreaterThan(20)

        await expect(page).toHaveScreenshot('binary-depth10.png')
        expectNoErrors(errors)
    })

    test('wide tree with labels and icons (depth 5, 8 children)', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=5&childs=8&labels=1&icons=1')

        const c = await counts(page)
        expect(c.nodes).toBeGreaterThan(300)
        expect(c.emojis).toBeGreaterThan(300)

        await expect(page).toHaveScreenshot('wide-labels-icons.png')
        expectNoErrors(errors)
    })

    for (const query of ['gen=star&n=250', 'gen=path&n=50', 'gen=deepStar&arms=4&depth=30']) {
        test(query, async ({ page }) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            expect((await counts(page)).links).toBeGreaterThan(5)
            expectNoErrors(errors)
        })
    }
})

test.describe('interaction', () => {
    test('dragging pans the tree', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        const before = await page.evaluate(() => JSON.stringify(harness.ht.unitdisk.args.transformation.state.P))

        const box = await diskBox(page)
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) await page.mouse.move(cx + i * 5, cy + i * 3)
        await page.mouse.up()
        await waitForStable(page)

        const after = await page.evaluate(() => JSON.stringify(harness.ht.unitdisk.args.transformation.state.P))
        expect(after).not.toBe(before)
        expect((await counts(page)).nodes).toBeGreaterThan(20)
        expectNoErrors(errors)
    })

    test('mouse wheel zooms out', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        const λ = () => page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
        const before = await λ()

        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 - 50)
        for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(50) }
        await waitForStable(page)

        expect(await λ()).toBeLessThan(before)
        expectNoErrors(errors)
    })

    // The computed start zoom ignores interaction.λbounds, so wide trees start
    // far above the default maximum (0.45). Zoom steps that move back towards
    // the bounds must still work (regression: they used to be rejected, which
    // made the wheel do nothing at all on such trees).
    test('mouse wheel zooms out when the start zoom is above λbounds', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=5&childs=8')
        const λ = () => page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
        const max = await page.evaluate(() => harness.ht.args.interaction.λbounds[1])
        const before = await λ()
        expect(before).toBeGreaterThan(max) // precondition: starts outside the bounds

        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 - 50)
        for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(50) }
        await waitForStable(page)

        expect(await λ()).toBeLessThan(before)
        expectNoErrors(errors)
    })

    test('mouse wheel does not zoom in beyond λbounds', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        const λ = () => page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
        const max = await page.evaluate(() => harness.ht.args.interaction.λbounds[1])
        const before = await λ()
        expect(before).toBeGreaterThan(max) // binary tree starts slightly above the maximum

        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 - 50)
        for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(50) }
        await waitForStable(page)

        expect(await λ()).toBe(before)
    })

    test.describe('touch', () => {
        test.use({ hasTouch: true })

        test('pinching zooms out when the start zoom is above λbounds', async ({ page }) => {
            const errors = collectErrors(page)
            await openTree(page, 'gen=nTree&depth=5&childs=8')
            const λ = () => page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
            const before = await λ()

            const box = await diskBox(page)
            const cx = box.x + box.width / 2, cy = box.y + box.height / 2
            const cdp = await page.context().newCDPSession(page)
            const touch = (type, d) => cdp.send('Input.dispatchTouchEvent', {
                type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d, y: cy, id: 0 }, { x: cx + d, y: cy, id: 1 }],
            })
            // a small pinch (finger distance 300 -> 240 px, factor 0.8): the target
            // zoom stays above the maximum, so it only works if steps back
            // towards the bounds are allowed
            await touch('touchStart', 150)
            for (let d = 150; d >= 120; d -= 3) { await touch('touchMove', d); await page.waitForTimeout(16) }
            await touch('touchEnd', 120)
            await waitForStable(page)

            expect(await λ()).toBeLessThan(before)
            expectNoErrors(errors)
        })
    })
})

test.describe('deep trees', () => {
    // Known bug: node positions are global Poincaré-disk coordinates composed from
    // parent to child, so deep nodes end up extremely close to the boundary.
    // Navigating down a long arm then makes the view collapse (no NaN, but the
    // values are no longer usable for the transformation). Remove .fail once fixed.
    test.fail('navigating down a deep arm keeps the neighbourhood visible', async ({ page }) => {
        await openTree(page, 'gen=deepStar&arms=8&depth=80')
        let visible = 0
        for (let step = 0; step < 4; step++) {
            visible = await page.evaluate(async () => {
                const rendered = [...document.querySelectorAll('#nodes circle')].map(c => c.__data__).filter(Boolean)
                const deepest = rendered.reduce((a, b) => (b.depth > a.depth ? b : a))
                await harness.ht.api.gotoNode(deepest)
                return document.querySelectorAll('#nodes circle').length
            })
            await waitForStable(page)
        }
        visible = await page.evaluate(() => document.querySelectorAll('#nodes circle').length)
        // a focused node on a path should show several neighbours around it
        expect(visible).toBeGreaterThanOrEqual(5)
    })
})

test.describe('hover', () => {
    test('hovering a node highlights the voronoi cells on its hover path', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        await page.evaluate(() => {
            harness.ht.unitdisk.layerStack.layers.cells.args.invisible = false
            harness.ht.update.data()
        })
        const target = await page.evaluate(() => {
            const c = [...document.querySelectorAll('#nodes circle')]
                .filter(c => c.__data__ && c.__data__.depth >= 2)
                .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
            const r = c.getBoundingClientRect()
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
        })
        await page.mouse.move(target.x, target.y)
        await page.waitForTimeout(300)

        const r = await page.evaluate(() => {
            const cells = [...document.querySelectorAll('#cells > *')]
            const onPath = cells.filter(c => c.__data__.data.pathes
                && c.__data__.data.pathes.isPartOfAnyHoverPath && c.__data__.data.parent)
            const hovered = document.querySelectorAll('#cells .hovered')
            return {
                expected: onPath.length,
                hovered: hovered.length,
                fill: hovered[0] ? getComputedStyle(hovered[0]).fill : null,
            }
        })
        expect(r.expected).toBeGreaterThan(1)
        expect(r.hovered).toBe(r.expected)
        expect(r.fill).not.toBe('none') // the CSS rule applies
        expectNoErrors(errors)
    })
})

test.describe('layers', () => {
    test('layers can be shown and hidden individually', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')

        await page.evaluate(() => harness.showOnly(['nodes']))
        let c = await counts(page)
        expect(c.nodes).toBeGreaterThan(20)
        expect(c.links).toBe(0)

        await page.evaluate(() => harness.showOnly('all'))
        c = await counts(page)
        expect(c.links).toBeGreaterThan(20)
        expectNoErrors(errors)
    })
})
