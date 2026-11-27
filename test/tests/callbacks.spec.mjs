import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox } from './helpers.mjs'

// Screen positions of the largest visible nodes (excluding the root), largest first.
async function bigNodes(page, count = 2) {
    return page.evaluate(count => [...document.querySelectorAll('#nodes circle')]
        .filter(c => c.__data__ && c.__data__.depth >= 1)
        .map(c => ({ c, r: c.getBoundingClientRect() }))
        .sort((a, b) => b.r.width - a.r.width)
        .slice(0, count)
        .map(({ c, r }) => ({ id: c.__data__.mergeId, x: r.x + r.width / 2, y: r.y + r.height / 2 })), count)
}

const events = (page, type) => page.evaluate(t => harness.events.filter(e => !t || e.type === t), type)
const clear = page => page.evaluate(() => harness.clearEvents())

test.describe('callbacks: mouse', () => {
    test.beforeEach(async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        await clear(page)
    })

    test('onNodeClick: a click on a node reports that node', async ({ page }) => {
        const errors = collectErrors(page)
        const [a] = await bigNodes(page)
        await page.mouse.click(a.x, a.y)
        await page.waitForTimeout(200)
        const clicks = await events(page, 'click')
        expect(clicks.map(e => e.id)).toEqual([a.id])
        expect(await events(page, 'hold')).toEqual([])
        expectNoErrors(errors)
    })

    test('onNodeClick: dragging is not a click', async ({ page }) => {
        const [a] = await bigNodes(page)
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(a.x + 60, a.y + 40, { steps: 5 })
        await page.mouse.up()
        await page.waitForTimeout(200)
        expect(await events(page, 'click')).toEqual([])
    })

    test('onNodeHold: pressing for holdDuration reports the node, and no click follows', async ({ page }) => {
        const errors = collectErrors(page)
        const [a] = await bigNodes(page)
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.waitForTimeout(800) // default holdDuration: 500 ms
        await page.mouse.up()
        await page.waitForTimeout(200)
        expect((await events(page, 'hold')).map(e => e.id)).toEqual([a.id])
        expect(await events(page, 'click')).toEqual([])
        expectNoErrors(errors)
    })

    test('onNodeHold: moving while pressed cancels the hold', async ({ page }) => {
        const [a] = await bigNodes(page)
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(a.x + 40, a.y, { steps: 4 })
        await page.waitForTimeout(800)
        await page.mouse.up()
        await page.waitForTimeout(200)
        expect(await events(page, 'hold')).toEqual([])
    })

    test('onNodeHold: a short click is not a hold', async ({ page }) => {
        const [a] = await bigNodes(page)
        await page.mouse.click(a.x, a.y)
        await page.waitForTimeout(800)
        expect(await events(page, 'hold')).toEqual([])
    })

    test('onNodeHover / onHoverNodeChange: fire once per change of the hovered node', async ({ page }) => {
        const errors = collectErrors(page)
        const [a, b] = await bigNodes(page)
        await page.mouse.move(a.x, a.y)
        await page.mouse.move(a.x + 1, a.y + 1) // same node: no new event
        await page.mouse.move(b.x, b.y)
        await page.waitForTimeout(200)
        expect((await events(page, 'hover')).map(e => e.id)).toEqual([a.id, b.id])
        expect((await events(page, 'hoverchange')).map(e => e.id)).toEqual([a.id, b.id])
        expectNoErrors(errors)
    })

    test('onNodeHover: leaving the tree reports undefined', async ({ page }) => {
        const [a] = await bigNodes(page)
        await page.mouse.move(a.x, a.y)
        await page.evaluate(() => {
            // a real mouseout on the interaction layer, as when the pointer leaves the component
            const el = document.querySelector('#tree svg')
            el.querySelectorAll('*').forEach(e => e.dispatchEvent(new MouseEvent('mouseout', { bubbles: false })))
        })
        await page.waitForTimeout(200)
        const ids = (await events(page, 'hover')).map(e => e.id)
        expect(ids[0]).toBe(a.id)
        expect(ids[ids.length - 1]).toBeUndefined()
    })

    test('onCenterNodeChange: dragging another node to the center reports it', async ({ page }) => {
        const [a] = await bigNodes(page)
        const box = await diskBox(page)
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
        await page.mouse.up()
        await waitForStable(page)
        const centers = (await events(page, 'center')).map(e => e.id)
        expect(centers.length).toBeGreaterThan(0)
        expect(centers[centers.length - 1]).toBe(a.id)
    })
})

test.describe('callbacks: touch', () => {
    test.use({ hasTouch: true })

    const touchAt = async (page, x, y, holdMs) => {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
        await page.waitForTimeout(holdMs)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await page.waitForTimeout(200)
    }

    test.beforeEach(async ({ page }) => {
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        await clear(page)
    })

    test('tap reports onNodeClick', async ({ page }) => {
        const [a] = await bigNodes(page)
        await touchAt(page, a.x, a.y, 50)
        expect((await events(page, 'click')).map(e => e.id)).toEqual([a.id])
        expect(await events(page, 'hold')).toEqual([])
    })

    test('long press reports onNodeHold and no click', async ({ page }) => {
        const [a] = await bigNodes(page)
        await touchAt(page, a.x, a.y, 800)
        expect((await events(page, 'hold')).map(e => e.id)).toEqual([a.id])
        expect(await events(page, 'click')).toEqual([])
    })
})

test.describe('callbacks: API', () => {
    test('onNodeSelect: toggleSelection reports the node and its new state', async ({ page }) => {
        const errors = collectErrors(page)
        await openTree(page, 'gen=nTree&depth=10&childs=2')
        await clear(page)
        const r = await page.evaluate(() => {
            const n = harness.ht.data.children[0].children[1]
            harness.ht.api.toggleSelection(n)
            const afterSelect = harness.ht.args.objects.selections.includes(n)
            harness.ht.api.toggleSelection(n)
            return { id: n.mergeId, afterSelect, afterDeselect: harness.ht.args.objects.selections.includes(n) }
        })
        expect(r.afterSelect).toBe(true)
        expect(r.afterDeselect).toBe(false)
        expect(await events(page, 'select')).toEqual([
            { type: 'select', id: r.id, arg: true },
            { type: 'select', id: r.id, arg: false },
        ])
        expectNoErrors(errors)
    })
})
