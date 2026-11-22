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

    // λ (the zoom) is limited to interaction.λbounds [min, max] everywhere: the
    // computed start zoom, mouse wheel, pinch and the API. Values outside are set
    // to the nearest bound.
    const λ = page => page.evaluate(() => harness.ht.unitdisk.args.transformation.state.λ)
    const bounds = page => page.evaluate(() => harness.ht.args.interaction.λbounds)
    const wheel = async (page, dy, steps) => {
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 - 50)
        for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(30) }
        await waitForStable(page)
    }

    test('the start zoom is clamped to λbounds', async ({ page }) => {
        const errors = collectErrors(page)
        // a wide tree: fitting it into the disk would need λ ≈ 0.7
        await openTree(page, 'gen=nTree&depth=5&childs=8')
        const [, max] = await bounds(page)
        expect(await λ(page)).toBeCloseTo(max, 9)
        // custom bounds: a start below the minimum is raised to it
        await openTree(page, 'gen=nTree&depth=5&childs=8&interaction={"λbounds":[0.8,0.9]}')
        expect(await λ(page)).toBeCloseTo(0.8, 9)
        expect((await counts(page)).nodes).toBeGreaterThan(10)
        expectNoErrors(errors)
    })

    test('mouse wheel stops at the λbounds', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        const [min, max] = await bounds(page)
        await wheel(page, -100, 5)                       // zoom in: already at the maximum
        expect(await λ(page)).toBeCloseTo(max, 9)
        await wheel(page, 100, 3)                        // zoom out works
        expect(await λ(page)).toBeLessThan(max)
        await wheel(page, 100, 30)                       // far beyond the minimum
        expect(await λ(page)).toBeCloseTo(min, 9)
        await wheel(page, -100, 30)                      // and back up to the maximum
        expect(await λ(page)).toBeCloseTo(max, 9)
        expectNoErrors(errors)
    })

    test('gotoλ clamps its target to the λbounds', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=6&childs=2')
        const [min, max] = await bounds(page)
        await page.evaluate(() => harness.ht.api.gotoλ(5))
        expect(await λ(page)).toBeCloseTo(max, 2)   // animations end slightly short (known bug)
        await page.evaluate(() => harness.ht.api.gotoλ(0.0001))
        expect(await λ(page)).toBeCloseTo(min, 2)
    })

    test.describe('touch', () => {
        test.use({ hasTouch: true })

        test('pinch zooms within the λbounds', async ({ page }) => {
            const errors = collectErrors(page)
            await openTree(page, 'gen=nTree&depth=5&childs=8')
            const [, max] = await bounds(page)
            const box = await diskBox(page)
            const cx = box.x + box.width / 2, cy = box.y + box.height / 2
            const cdp = await page.context().newCDPSession(page)
            const touch = (type, d) => cdp.send('Input.dispatchTouchEvent', {
                type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d, y: cy, id: 0 }, { x: cx + d, y: cy, id: 1 }],
            })
            const pinch = async (from, to) => {
                const step = from < to ? 3 : -3
                await touch('touchStart', from)
                for (let d = from; step > 0 ? d <= to : d >= to; d += step) { await touch('touchMove', d); await page.waitForTimeout(16) }
                await touch('touchEnd', to)
                await waitForStable(page)
            }
            await pinch(150, 120)                        // fingers together: zoom out
            const out = await λ(page)
            expect(out).toBeLessThan(max)
            await pinch(60, 240)                         // spread far: stops at the maximum
            expect(await λ(page)).toBeCloseTo(max, 9)
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
    // Only the cell under the mouse is highlighted: moving on clears the previous
    // cell, leaving the tree clears all.
    test('hover highlights exactly the voronoi cell under the mouse', async ({ page }) => {
        const errors = collectErrors(page)
        await page.setViewportSize({ width: 1100, height: 900 }) // room to leave the tree
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        await page.evaluate(() => {
            harness.ht.unitdisk.layerStack.layers.cells.args.invisible = false
            harness.ht.update.data()
        })
        const targets = await page.evaluate(() => [...document.querySelectorAll('#nodes circle')]
            .filter(c => c.__data__ && c.__data__.depth >= 2)
            .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)
            .slice(0, 3)
            .map(c => { const r = c.getBoundingClientRect(); return { id: c.__data__.mergeId, x: r.x + r.width / 2, y: r.y + r.height / 2 } }))
        const hoveredCells = () => page.evaluate(() => [...document.querySelectorAll('#cells .hovered')].map(c => c.__data__.data.mergeId))

        for (const t of targets) {
            await page.mouse.move(t.x, t.y)
            await page.waitForTimeout(250)
            expect(await hoveredCells(), `only the cell of node ${t.id}`).toEqual([t.id])
        }
        const fill = await page.evaluate(() => getComputedStyle(document.querySelector('#cells .hovered')).fill)
        expect(fill).not.toBe('none') // the CSS rule applies

        await page.mouse.move(1050, 450) // outside the tree
        await page.waitForTimeout(250)
        expect(await hoveredCells()).toEqual([])
        expectNoErrors(errors)
    })

    test('selected nodes highlight their own cell only', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=6&childs=2&filter=off')
        const ids = await page.evaluate(() => {
            harness.ht.unitdisk.layerStack.layers.cells.args.invisible = false
            harness.ht.update.data()
            const n = harness.ht.data.children[0].children[1].leaves()[0]
            harness.ht.api.toggleSelection(n)
            return [n.mergeId]
        })
        await page.waitForTimeout(250)
        expect(await page.evaluate(() => [...document.querySelectorAll('#cells .selected')].map(c => c.__data__.data.mergeId))).toEqual(ids)
    })

    // Layer options hover / selection: the layer doesn't show the state, but the
    // events, callbacks and the hover path work as before.
    test('cells option hover: false shows no hover highlight, callbacks still fire', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2&layers=' + encodeURIComponent('{"cells":{"invisible":false,"hover":false}}'))
        const t = await page.evaluate(() => {
            const c = [...document.querySelectorAll('#nodes circle')].filter(c => c.__data__ && c.__data__.depth >= 2)
                .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
            const r = c.getBoundingClientRect(); return { id: c.__data__.mergeId, x: r.x + r.width / 2, y: r.y + r.height / 2 }
        })
        await page.mouse.move(t.x, t.y)
        await page.waitForTimeout(250)
        expect(await page.locator('#cells .hovered').count()).toBe(0)
        expect(await page.evaluate(() => harness.events.filter(e => e.type === 'hover').map(e => e.id))).toContain(t.id)
        expect(await page.evaluate(() => harness.ht.args.objects.pathes.some(p => p.type === 'HoverPath'))).toBe(true)
        expectNoErrors(errors)
    })

    test('cells option selection: false shows no selection highlight', async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=6&childs=2&filter=off&layers=' + encodeURIComponent('{"cells":{"invisible":false,"selection":false}}'))
        await page.evaluate(() => harness.ht.api.toggleSelection(harness.ht.data.children[0].children[1].leaves()[0]))
        await page.waitForTimeout(250)
        expect(await page.evaluate(() => harness.ht.args.objects.selections.length)).toBe(1)
        expect(await page.locator('#cells .selected').count()).toBe(0)
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
