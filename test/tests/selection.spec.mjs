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

test('highlightNode "mousehover" sets n.hovered on the node under the mouse; "none" hovers nothing', async ({ page }) => {
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
    expect(await hoverAt({ highlightNode: 'none' })).toEqual({ hovered: 0, paths: 0, events: false })
    // v2.0 name, migrated: hover 'none' -> highlightNode 'none'
    expect(await hoverAt({ hover: 'none' })).toEqual({ hovered: 0, paths: 0, events: false })
})

test('highlightNode "mousehover": onHoverNodeChange once per change, not on every mouse move', async ({ page }) => {
    await open(page)
    const box = await diskBox(page)
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4)
    await page.waitForTimeout(200)
    await page.evaluate(() => harness.clearEvents())
    // small moves inside one cell: no change
    for (let i = 1; i <= 4; i++) await page.mouse.move(box.x + box.width * 0.55 + i * .3, box.y + box.height * 0.4)
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => harness.events.filter(e => e.type === 'hoverchange').length)).toBe(0)
    // leaving the tree: undefined once
    await page.mouse.move(box.x - 40, box.y - 40)
    await page.waitForTimeout(200)
    const after = await page.evaluate(() => ({
        events: harness.events.filter(e => e.type === 'hoverchange').map(e => e.id),
        hovered: harness.ht.data.descendants().filter(n => n.hovered).length }))
    expect(after).toEqual({ events: [undefined], hovered: 0 })
})

test.describe('highlightNode "center"', () => {
    const state = page => page.evaluate(() => {
        const ht = harness.ht, c = ht.lastCenterNode
        const hovered = ht.data.descendants().filter(n => n.hovered)
        return {
            center: c && c.mergeId,
            hovered: hovered.map(n => n.mergeId),
            paths: ht.args.objects.pathes.filter(p => p.type === 'HoverPath').map(p => p.head.mergeId),
        }
    })

    test('the center node is highlighted: n.hovered, the hover path, onHoverNodeChange', async ({ page }) => {
        const errors = collectErrors(page)
        await open(page, { highlightNode: 'center' })
        await page.waitForTimeout(300)
        const s = await state(page)
        expect(s.center).toBeDefined()
        expect(s.hovered).toEqual([s.center])
        expect(s.paths).toEqual([s.center])
        expect(await page.evaluate(() => harness.events.filter(e => e.type === 'hoverchange').map(e => e.id).pop())).toBe(s.center)
        expectNoErrors(errors)
    })

    test('the mouse does not change it (moving over other nodes, leaving the tree)', async ({ page }) => {
        await open(page, { highlightNode: 'center' })
        await page.waitForTimeout(300)
        const before = await state(page)
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 4 })
        await page.mouse.move(box.x - 40, box.y - 40)
        await page.waitForTimeout(250)
        expect(await state(page)).toEqual(before)
    })

    test('follows the center node during a drag, not only at its end', async ({ page }) => {
        const errors = collectErrors(page)
        await open(page, { highlightNode: 'center' })
        await page.waitForTimeout(300)
        const start = await state(page)
        await page.evaluate(() => harness.clearEvents())
        const box = await diskBox(page)
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        const during = []
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx + i * box.width * .03, cy - i * box.height * .02)
            await page.waitForTimeout(40)
            during.push(await state(page))
        }
        // still pressed: the highlight is the center node of the frame
        expect(await page.evaluate(() => harness.ht.unitdisk.isDraging)).toBe(true)
        const mid = during[during.length - 1]
        expect(mid.center).not.toBe(start.center)
        expect(mid.hovered).toEqual([mid.center])
        expect(mid.paths).toEqual([mid.center])
        await page.mouse.up()
        await page.waitForTimeout(300)
        const end = await state(page)
        expect(end.hovered).toEqual([end.center])
        // one onHoverNodeChange per change, each one a center node (onCenterNodeChange)
        const ev = await page.evaluate(() => harness.events.filter(e => e.type === 'hoverchange' || e.type === 'center').map(e => [e.type, e.id]))
        const changes = ev.filter(([t]) => t === 'hoverchange').map(([, id]) => id)
        const centers = ev.filter(([t]) => t === 'center').map(([, id]) => id)
        expect(changes.length).toBeGreaterThan(0)
        expect(changes).toEqual(centers)
        expectNoErrors(errors)
    })
})

test.describe('highlightUpdate "settled"', () => {
    const hovered = page => page.evaluate(() => harness.ht.data.descendants().filter(n => n.hovered).map(n => n.mergeId))

    test('"center": not while dragging, when the view stands still', async ({ page }) => {
        const errors = collectErrors(page)
        await open(page, { highlightNode: 'center', highlightUpdate: 'settled' })
        await page.waitForTimeout(300)
        const start = await hovered(page)
        expect(start).toEqual([await page.evaluate(() => harness.ht.lastCenterNode.mergeId)])
        const box = await diskBox(page)
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) { await page.mouse.move(cx + i * box.width * .03, cy - i * box.height * .02); await page.waitForTimeout(30) }
        // the center node changed, the highlight did not
        expect(await page.evaluate(() => harness.ht.lastCenterNode.mergeId)).not.toBe(start[0])
        expect(await hovered(page)).toEqual(start)
        await page.mouse.up()
        await page.waitForTimeout(400)
        expect(await hovered(page)).toEqual([await page.evaluate(() => harness.ht.lastCenterNode.mergeId)])
        expectNoErrors(errors)
    })

    test('"mousehover" with highlightDelay: only after the mouse rested', async ({ page }) => {
        await open(page, { highlightUpdate: 'settled', highlightDelay: 300 })
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4, { steps: 3 })
        await page.waitForTimeout(100)
        expect(await hovered(page)).toEqual([])
        await page.waitForTimeout(500)
        expect((await hovered(page)).length).toBe(1)
    })
})

test('highlightLabelFallback "ancestor": a node without a label shows its ancestor\'s, and gets its own back', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&labels=1&interaction=${encodeURIComponent(JSON.stringify({ highlightLabelFallback: 'ancestor' }))}`)
    const r = await page.evaluate(() => {
        const ht = harness.ht
        const leaf = ht.data.leaves()[3], other = ht.data.leaves()[20]
        const parent = leaf.parent
        leaf.precalc.label = ''
        const lenKeys = Object.keys(parent.precalc).filter(k => k.endsWith('len') && k !== 'emojislen')
        ht.highlighting.set(leaf)
        const lent = { label: leaf.precalc.label, onHover: leaf.precalc.labelOnHover, widths: lenKeys.every(k => leaf.precalc[k] === parent.precalc[k]) }
        ht.highlighting.set(other)
        return { parent: parent.precalc.label, lent, back: leaf.precalc.label, otherOwn: other.precalc.label !== parent.precalc.label }
    })
    expect(r.lent).toEqual({ label: r.parent, onHover: true, widths: true })
    expect(r.back).toBe('')
    expect(r.otherOwn).toBe(true)
})

test.describe('layer highlight-marker', () => {
    const openMarker = (page, interaction = {}) => openTree(page, `gen=nTree&depth=6&childs=2&filter=off`
        + `&interaction=${encodeURIComponent(JSON.stringify(interaction))}`
        + `&layers=${encodeURIComponent(JSON.stringify({ 'highlight-marker': { invisible: false, duration: 400 } }))}`)
    const marker = page => page.evaluate(() => {
        const c = document.querySelector('circle.highlight-marker'), n = harness.ht.highlighted
        return { shown: !!c && c.style.display !== 'none', x: c && +c.getAttribute('cx'), y: c && +c.getAttribute('cy'),
                 target: n && { x: n.cache.re, y: n.cache.im } }
    })
    const near = (m, eps = 1e-6) => Math.hypot(m.x - m.target.x, m.y - m.target.y) < eps

    test('off by default; on: a disk on the highlighted node, moving along the tree to a new one', async ({ page }) => {
        const errors = collectErrors(page)
        await open(page)
        expect(await page.evaluate(() => { const c = document.querySelector('circle.highlight-marker'); return !c || c.style.display === 'none' })).toBe(true)

        await openMarker(page)
        const nodes = await page.evaluate(() => {
            const ht = harness.ht, [a, b] = [ht.data.leaves()[0], ht.data.leaves()[40]]
            ht.highlighting.set(a)
            return [a.mergeId, b.mergeId]
        })
        await page.waitForTimeout(500)
        expect(near(await marker(page))).toBe(true)
        // to another leaf: on the way it is on neither node, then on the new one
        await page.evaluate(id => harness.ht.highlighting.set(harness.ht.data.leaves().find(n => n.mergeId === id)), nodes[1])
        await page.waitForTimeout(120)
        const mid = await marker(page)
        expect(mid.shown).toBe(true)
        expect(near(mid, 1e-3)).toBe(false)
        await page.waitForTimeout(500)
        expect(near(await marker(page))).toBe(true)
        expectNoErrors(errors)
    })

    test('presets highlightCell and highlightDisk: the cell or the disk shows the highlighted node', async ({ page }) => {
        const show = async preset => {
            await openTree(page, `gen=nTree&depth=6&childs=2&filter=off&preset=${preset}`)
            const box = await diskBox(page)
            await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4, { steps: 3 })
            await page.waitForTimeout(400)
            return page.evaluate(() => {
                const c = document.querySelector('circle.highlight-marker')
                return { cell: document.querySelectorAll('.cell.hovered').length > 0, disk: !!c && c.style.display !== 'none',
                         r: c ? +c.getAttribute('r') : 0, font: harness.ht.args.geometry.captionHeight / harness.ht.args.geometry.captionRatio }
            })
        }
        const cell = await show('highlightCell')
        expect({ cell: cell.cell, disk: cell.disk }).toEqual({ cell: true, disk: false })
        const disk = await show('highlightDisk')
        expect({ cell: disk.cell, disk: disk.disk }).toEqual({ cell: false, disk: true })
        expect(disk.r).toBeLessThanOrEqual(1.5 * disk.font + 1e-9)        // 3 fonts high in the center, smaller toward the rim
        expect(disk.r).toBeGreaterThan(.3 * disk.font)
    })

    test('stays on the center node while dragging (highlightNode "center")', async ({ page }) => {
        await openMarker(page, { highlightNode: 'center' })
        await page.waitForTimeout(600)
        const box = await diskBox(page)
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) { await page.mouse.move(cx + i * box.width * .03, cy - i * box.height * .02); await page.waitForTimeout(30) }
        await page.mouse.up()
        await page.waitForTimeout(700)
        const m = await marker(page)
        expect(m.shown).toBe(true)
        expect(await page.evaluate(() => harness.ht.highlighted === harness.ht.lastCenterNode)).toBe(true)
        expect(near(m)).toBe(true)
    })
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
    test('path-arcs: "none" leaves out the selection path, the default draws it', async ({ page }) => {
        const pathArcs = () => page.evaluate(() => document.querySelectorAll('[id="path-arcs"] path, [id="path-arcs"] line').length)
        await run(page, {})
        expect(await pathArcs()).toBe(6)
        await run(page, { 'path-arcs': { selection: 'none' } })
        expect(await pathArcs()).toBe(0)
    })
})
