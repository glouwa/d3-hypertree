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

    // Known bug: the default start zoom (λ ≈ 0.48) lies outside the default
    // interaction.λbounds [1/40, 0.45], so the wheel handler rejects zooming in
    // right after load. Remove .fail once fixed.
    test.fail('mouse wheel zooms in right after load', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        const λ = () => page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
        const before = await λ()

        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 - 50)
        for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(50) }
        await waitForStable(page)

        expect(await λ()).toBeGreaterThan(before)
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
