import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox } from './helpers.mjs'

// Hover and selection (phase 2 step 8): the node state (n.hovered, n.selected) is set
// by strategies in model.interaction (hover, selection, maxSelections, clickAction);
// the layers only show it.

const open = (page, interaction = {}) =>
    openTree(page, `gen=nTree&depth=6&childs=2&filter=off&interaction=${encodeURIComponent(JSON.stringify(interaction))}`)
const selected = page => page.evaluate(() => harness.ht.args.objects.selections.map(n => n.mergeId))
const flags = page => page.evaluate(() => harness.ht.data.descendants().filter(n => n.selected).map(n => n.mergeId).sort((a, b) => a - b))
const selectEvents = page => page.evaluate(() => harness.events.filter(e => e.type === 'select').map(e => [e.id, e.arg]))
const leaf = (page, i) => page.evaluate(i => harness.ht.data.leaves()[i].mergeId, i)
const call = (page, fn, i) => page.evaluate(([fn, i]) => harness.ht.api[fn](i === undefined ? undefined : harness.ht.data.leaves()[i]), [fn, i])

test('api.select / deselect / clearSelection keep objects.selections, n.selected and the callback in sync', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    const [a, b] = [await leaf(page, 0), await leaf(page, 5)]
    await call(page, 'select', 0)
    await call(page, 'select', 5)
    await call(page, 'select', 5)                         // already selected: no change
    expect(await selected(page)).toEqual([a, b])
    expect(await flags(page)).toEqual([a, b].sort((x, y) => x - y))
    await call(page, 'deselect', 0)
    expect(await selected(page)).toEqual([b])
    await call(page, 'clearSelection')
    expect(await selected(page)).toEqual([])
    expect(await flags(page)).toEqual([])
    expect(await selectEvents(page)).toEqual([[a, true], [b, true], [a, false], [b, false]])
    expectNoErrors(errors)
})

test('selection "single": a new selection replaces the old one', async ({ page }) => {
    await open(page, { selection: 'single' })
    const [a, b] = [await leaf(page, 0), await leaf(page, 5)]
    await call(page, 'toggleSelection', 0)
    await call(page, 'toggleSelection', 5)
    expect(await selected(page)).toEqual([b])
    expect(await selectEvents(page)).toEqual([[a, true], [a, false], [b, true]])
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => document.querySelectorAll('#nodes .selected').length)).toBeGreaterThan(0)
})

test('selection "multi" with maxSelections drops the oldest', async ({ page }) => {
    await open(page, { selection: 'multi', maxSelections: 3 })
    for (const i of [0, 1, 2, 3, 4]) await call(page, 'toggleSelection', i)
    const ids = await Promise.all([2, 3, 4].map(i => leaf(page, i)))
    expect(await selected(page)).toEqual(ids)
    const dropped = (await selectEvents(page)).filter(([, s]) => s === false).map(([id]) => id)
    expect(dropped).toEqual(await Promise.all([0, 1].map(i => leaf(page, i))))
})

test('selection "none": nothing can be selected', async ({ page }) => {
    await open(page, { selection: 'none' })
    await call(page, 'toggleSelection', 0)
    await call(page, 'select', 1)
    expect(await selected(page)).toEqual([])
    expect(await selectEvents(page)).toEqual([])
})

test('hover "pointer" sets n.hovered on the node under the mouse; "none" hovers nothing', async ({ page }) => {
    const hoverAt = async interaction => {
        await open(page, interaction)
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4, { steps: 3 })
        await page.waitForTimeout(250)
        return page.evaluate(() => ({
            hovered: harness.ht.data.descendants().filter(n => n.hovered).length,
            paths: harness.ht.args.objects.pathes.filter(p => p.type === 'HoverPath').length,
            events: harness.events.filter(e => e.type === 'hover').length > 0 }))
    }
    expect(await hoverAt({})).toEqual({ hovered: 1, paths: 1, events: true })
    expect(await hoverAt({ hover: 'none' })).toEqual({ hovered: 0, paths: 0, events: false })
})

test.describe('clickAction', () => {
    const clickNode = async page => {
        const t = await page.evaluate(() => {
            const c = [...document.querySelectorAll('#nodes circle')].filter(c => c.__data__ && c.__data__.depth >= 3)
                .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
            const r = c.getBoundingClientRect()
            return { id: c.__data__.mergeId, x: r.x + r.width / 2, y: r.y + r.height / 2 }
        })
        await page.mouse.click(t.x, t.y)
        return t.id
    }

    test('"select" toggles the selection of the clicked node; onNodeClick still fires', async ({ page }) => {
        await open(page, { clickAction: 'select' })
        const id = await clickNode(page)
        await page.waitForTimeout(300)
        expect(await selected(page)).toEqual([id])
        expect(await page.evaluate(() => harness.events.some(e => e.type === 'click'))).toBe(true)
    })

    test('"goto" animates the clicked node to the center', async ({ page }) => {
        await open(page, { clickAction: 'goto' })
        const id = await clickNode(page)
        await page.waitForTimeout(1000)
        await waitForStable(page)
        const r = await page.evaluate(id => { const n = harness.ht.data.descendants().find(n => n.mergeId === id); return Math.hypot(n.cache.re, n.cache.im) }, id)
        expect(r).toBeLessThan(1e-6)
    })

    test('default: a click only calls onNodeClick', async ({ page }) => {
        await open(page)
        await clickNode(page)
        await page.waitForTimeout(300)
        expect(await selected(page)).toEqual([])
    })
})

// Layer options hover / selection decide how a layer shows the state: 'path' (default:
// the node and its ancestors), 'node' (the node itself) or 'none' / false.
test.describe('layers show the state as configured', () => {
    const run = async (page, layers) => {
        await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&layers=${encodeURIComponent(JSON.stringify(layers))}`)
        await page.evaluate(() => harness.ht.api.toggleSelection(harness.ht.data.leaves()[3]))
        await page.waitForTimeout(200)
        return page.evaluate(() => ({
            nodes: document.querySelectorAll('#nodes .selected').length,
            links: document.querySelectorAll('#link-arcs .selected').length }))
    }
    test('default "path": the selected leaf and the links up to the root', async ({ page }) => {
        const r = await run(page, {})
        expect(r.nodes).toBeGreaterThan(0)
        expect(r.links).toBe(6)          // depth 6: one link per level
    })
    test('"node": only the node itself', async ({ page }) => {
        const r = await run(page, { 'link-arcs': { selection: 'node' } })
        expect(r.links).toBe(1)
    })
    test('"none": nothing, the selection itself is unchanged', async ({ page }) => {
        const r = await run(page, { nodes: { selection: 'none' }, 'link-arcs': { selection: false } })
        expect(r).toEqual({ nodes: 0, links: 0 })
        expect(await page.evaluate(() => harness.ht.args.objects.selections.length)).toBe(1)
    })
})
