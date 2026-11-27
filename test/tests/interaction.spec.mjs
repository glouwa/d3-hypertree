import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox, expectScene, expectPlausibleScene } from './helpers.mjs'

// User interactions, each checked by state (level 1) and scene snapshot (level 2).
// The filter decides which nodes are visible, so every interaction runs once with
// the filter off (pure geometry: layout + transformation, all nodes visible) and
// once with the default filter.

const configs = [
    ['filter-off', 'gen=nTree&depth=6&childs=2&filter=off'],
    ['filter-default', 'gen=nTree&depth=10&childs=2'],
]

const state = page => page.evaluate(() => {
    const s = harness.ht.unitdisk.args.transformation.state
    return { λ: s.λ, P: { re: s.P.re, im: s.P.im } }
})

// node closest to a page position (by rendered circle)
const nodeAt = (page, x, y) => page.evaluate(([x, y]) => {
    let best = null, bestD = Infinity
    for (const c of document.querySelectorAll('#nodes circle')) {
        if (!c.__data__) continue
        const r = c.getBoundingClientRect()
        const d = Math.hypot(r.x + r.width / 2 - x, r.y + r.height / 2 - y)
        if (d < bestD) { bestD = d; best = c.__data__.mergeId }
    }
    return best
}, [x, y])

async function touch(page, points) {
    const cdp = await page.context().newCDPSession(page)
    return (type, pts) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : pts.map((p, id) => ({ x: p.x, y: p.y, id })),
    })
}

for (const [name, query] of configs) {
    test.describe(name, () => {
        test('initial view', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `${name}-initial`)
            expectNoErrors(errors)
        })

        test('drag: the grabbed node follows the pointer', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            const box = await diskBox(page)
            const from = { x: box.x + box.width * 0.62, y: box.y + box.height * 0.4 }
            const to = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.55 }
            const grabbed = await nodeAt(page, from.x, from.y)
            const start = await page.evaluate(id => harness.nodePos(id), grabbed)

            await page.mouse.move(start.x, start.y)
            await page.mouse.down()
            await page.mouse.move(to.x, to.y, { steps: 12 })
            await page.mouse.up()
            await waitForStable(page)

            const end = await page.evaluate(id => harness.nodePos(id), grabbed)
            expect(end, 'grabbed node is still drawn').not.toBeNull()
            expect(Math.hypot(end.x - to.x, end.y - to.y)).toBeLessThan(8)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `${name}-drag`)
            expectNoErrors(errors)
        })

        test('wheel: zooming out and in again', async ({ page }, testInfo) => {
            const errors = collectErrors(page)
            await openTree(page, query)
            const box = await diskBox(page)
            await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45)
            const s0 = await state(page)
            for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60) }
            await waitForStable(page)
            const s1 = await state(page)
            expect(s1.λ).toBeLessThan(s0.λ)
            await expectPlausibleScene(page)
            await expectScene(page, testInfo, `${name}-wheel-out`)

            for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(60) }
            await waitForStable(page)
            expect((await state(page)).λ).toBeGreaterThan(s1.λ)
            await expectScene(page, testInfo, `${name}-wheel-in`)
            expectNoErrors(errors)
        })

        test.describe('touch', () => {
            test.use({ hasTouch: true })

            test('one-finger pan moves the tree', async ({ page }, testInfo) => {
                const errors = collectErrors(page)
                await openTree(page, query)
                const box = await diskBox(page)
                const t = await touch(page)
                const s0 = await state(page)
                const x0 = box.x + box.width * 0.6, y0 = box.y + box.height * 0.45
                await t('touchStart', [{ x: x0, y: y0 }])
                for (let i = 1; i <= 10; i++) { await t('touchMove', [{ x: x0 - i * 12, y: y0 + i * 8 }]); await page.waitForTimeout(16) }
                await t('touchEnd', [])
                await waitForStable(page)
                const s1 = await state(page)
                expect(s1.P).not.toEqual(s0.P)
                expect(s1.λ).toBeCloseTo(s0.λ, 6)
                await expectPlausibleScene(page)
                await expectScene(page, testInfo, `${name}-touch-pan`)
                expectNoErrors(errors)
            })

            test('pinch: fingers together zoom out, apart zoom in', async ({ page }, testInfo) => {
                const errors = collectErrors(page)
                await openTree(page, query)
                await page.evaluate(() => harness.ht.api.gotoλ(0.3))
                await waitForStable(page)
                const box = await diskBox(page)
                const cx = box.x + box.width / 2, cy = box.y + box.height / 2
                const t = await touch(page)
                const pinch = async (from, to) => {
                    await t('touchStart', [{ x: cx - from, y: cy }, { x: cx + from, y: cy }])
                    const steps = 10
                    for (let i = 1; i <= steps; i++) {
                        const d = from + (to - from) * i / steps
                        await t('touchMove', [{ x: cx - d, y: cy }, { x: cx + d, y: cy }])
                        await page.waitForTimeout(16)
                    }
                    await t('touchEnd', [])
                    await waitForStable(page)
                }
                const s0 = await state(page)
                await pinch(150, 110)
                const s1 = await state(page)
                expect(s1.λ).toBeLessThan(s0.λ)
                await expectScene(page, testInfo, `${name}-pinch-out`)
                await pinch(110, 150)
                expect((await state(page)).λ).toBeGreaterThan(s1.λ)
                await expectPlausibleScene(page)
                await expectScene(page, testInfo, `${name}-pinch-in`)
                expectNoErrors(errors)
            })
        })
    })
}

test('hover: highlights the path from the root to the hovered node', async ({ page }, testInfo) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=10&childs=2')
    const target = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#nodes circle')]
            .filter(c => c.__data__ && c.__data__.depth >= 3)
            .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
        const r = c.getBoundingClientRect()
        return { id: c.__data__.mergeId, depth: c.__data__.depth, x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.move(target.x, target.y)
    await page.waitForTimeout(300)
    const r = await page.evaluate(id => {
        const n = harness.ht.data.descendants().find(n => n.mergeId === id)
        const onPath = harness.ht.data.descendants().filter(n => n.pathes && n.pathes.isPartOfAnyHoverPath)
        return {
            pathArcs: document.querySelectorAll('#path-arcs path').length,
            onPath: onPath.map(n => n.mergeId).sort((a, b) => a - b),
            ancestors: n.ancestors().map(n => n.mergeId).sort((a, b) => a - b),
        }
    }, target.id)
    expect(r.onPath).toEqual(r.ancestors)       // exactly the path to the root
    expect(r.pathArcs).toBe(target.depth)       // one arc per edge on that path
    await expectScene(page, testInfo, 'hover-path')
    expectNoErrors(errors)
})

// The mouse's back and forward buttons (3, 4) belong to the browser: the tree neither
// cancels them (that kept the browser from going back) nor drags with them
test('the back and forward mouse buttons are left to the browser', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=6&childs=2')
    const r = await page.evaluate(async () => {
        const target = document.querySelector('circle.mouse-circle')         // the interaction layer's capture circle
        const box = document.querySelector('.unitDisc').getBoundingClientRect()
        const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true }
        const P0 = { ...harness.ht.args.geometry.transformation.state.P }
        const out = {}
        for (const button of [3, 4]) {
            const down = new MouseEvent('mousedown', { ...at, button, buttons: button === 3 ? 8 : 16 })
            target.dispatchEvent(down)
            const move = new MouseEvent('mousemove', { ...at, clientX: at.clientX + 80, button, buttons: button === 3 ? 8 : 16 })
            target.dispatchEvent(move)
            const up = new MouseEvent('mouseup', { ...at, clientX: at.clientX + 80, button, buttons: 0 })
            target.dispatchEvent(up)
            out[button] = { down: down.defaultPrevented, up: up.defaultPrevented }
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        const P1 = harness.ht.args.geometry.transformation.state.P
        // the left button still drags (and is cancelled)
        const left = new MouseEvent('mousedown', { ...at, button: 0, buttons: 1 })
        target.dispatchEvent(left)
        target.dispatchEvent(new MouseEvent('mouseup', { ...at, button: 0, buttons: 0 }))
        return { out, moved: Math.hypot(P1.re - P0.re, P1.im - P0.im), leftPrevented: left.defaultPrevented }
    })
    expect(r.out).toEqual({ 3: { down: false, up: false }, 4: { down: false, up: false } })
    expect(r.moved).toBeLessThan(1e-12)
    expect(r.leftPrevented).toBe(true)
    expectNoErrors(errors)
})

test('layers with hideOnDrag are hidden while dragging and come back afterwards', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=5&childs=4&labels=1&icons=1')
    const counts = () => page.evaluate(() => {
        const r = {}
        for (const name of harness.layerNames()) {
            const l = harness.layer(name), g = document.getElementById(name)
            r[name] = { hideOnDrag: !!l.args.hideOnDrag, invisible: !!l.args.invisible, n: g ? g.querySelectorAll('*').length : 0 }
        }
        return r
    })
    const before = await counts()
    const box = await diskBox(page)
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 6 })
    await page.waitForTimeout(150)
    const during = await counts()
    await page.mouse.up()
    await waitForStable(page)
    const after = await counts()

    for (const [name, c] of Object.entries(during)) {
        if (name.startsWith('interaction')) continue
        // layers hidden on drag have no elements while dragging (d3 update pattern layers)
        if (c.hideOnDrag && before[name].n > 0 && !['background', 'λ', '(0,0)', 'center-node', 'stem-arc'].includes(name))
            expect(c.n, `${name} while dragging`).toBe(0)
    }
    for (const [name, c] of Object.entries(before)) {
        if (c.n > 0 && !c.invisible) expect(after[name].n, `${name} after dragging`).toBeGreaterThan(0)
    }
    expectNoErrors(errors)
})

// Regression: while dragging, only hideOnDrag was checked, so an invisible layer
// with hideOnDrag false (the playground's emoji layer) appeared during a drag.
test('invisible layers stay hidden while dragging', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=nTree&depth=5&childs=4&labels=1&icons=1&layers={"emojis":{"invisible":true,"hideOnDrag":false},"link-arcs":{"invisible":true}}')
    const n = name => page.evaluate(name => document.getElementById(name).querySelectorAll('*').length, name)
    expect(await n('emojis')).toBe(0)
    const box = await diskBox(page)
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 6 })
    await page.waitForTimeout(150)
    expect(await n('emojis'), 'emojis while dragging').toBe(0)
    expect(await n('link-arcs'), 'link-arcs while dragging').toBe(0)
    expect(await n('nodes'), 'visible layers still render').toBeGreaterThan(0)
    await page.mouse.up()
    await waitForStable(page)
    expect(await n('emojis')).toBe(0)
    expectNoErrors(errors)
})
