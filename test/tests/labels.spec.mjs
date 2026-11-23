import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable, diskBox } from './helpers.mjs'

// The label layers that place labels away from their node:
//   labels-force   relaxation (label-force-layer.ts)
//   labels-placed  candidate placement (label-placement-layer.ts)
// Both: in the center a label sits above its node, toward the rim it points outward;
// labels give way to each other (labels-placed: never overlapping); leader lines
// ('auto') only for labels pushed away from their node.

const layerOpts = (layer, extra = {}) => ({ labels: { invisible: true }, [layer]: { invisible: false, hideOnDrag: false, maxLabels: 40, ...extra } })
const open = (page, layer, extra, tree = 'file=fixtures/primates.treeml.xml&labels=name') =>
    openTree(page, `${tree}&layers=${encodeURIComponent(JSON.stringify(layerOpts(layer, extra)))}`)

// screen boxes of the drawn labels, overlaps between them, and per label its node
const measure = (page, layer) => page.evaluate(layer => {
    const texts = [...document.querySelectorAll(`[id="${layer}"] text`)]
    const boxes = texts.map(t => t.getBoundingClientRect())
    let overlaps = 0
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps++
    }
    const m = document.querySelector('.unitDisc').getScreenCTM()
    const toScreen = c => ({ x: m.a * c.re + m.c * c.im + m.e, y: m.b * c.re + m.d * c.im + m.f })
    const center = toScreen({ re: 0, im: 0 })
    const labels = texts.map((t, i) => {
        const n = t.__data__, p = toScreen(n.cache), b = boxes[i]
        const lc = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
        const out = { x: p.x - center.x, y: p.y - center.y }, len = Math.hypot(out.x, out.y) || 1
        return { r: Math.hypot(n.cache.re, n.cache.im), dx: lc.x - p.x, dy: lc.y - p.y,
                 outward: ((lc.x - p.x) * out.x + (lc.y - p.y) * out.y) / len, id: n.mergeId }
    })
    const lines = [...document.querySelectorAll('.unitDisc line.label-link')].filter(l => l.style.display !== 'none').length
    return { count: texts.length, overlaps, labels, lines }
}, layer)

for (const layer of ['labels-force', 'labels-placed']) {
    test.describe(layer, () => {
        test('no (or almost no) overlaps; labels-placed: none', async ({ page }) => {
            const errors = collectErrors(page)
            for (const tree of ['file=fixtures/primates.treeml.xml&labels=name', 'gen=nTree&depth=5&childs=4&labels=1', 'file=fixtures/filesystem.d3.json&labels=name']) {
                await open(page, layer, {}, tree)
                await waitForStable(page)
                const r = await measure(page, layer)
                expect(r.count, tree).toBeGreaterThan(10)
                if (layer === 'labels-placed') expect(r.overlaps, tree).toBe(0)
                else expect(r.overlaps, tree).toBeLessThanOrEqual(Math.ceil(r.count * .05))
            }
            expectNoErrors(errors)
        })

        test('above the node in the center, outward toward the rim', async ({ page }) => {
            await open(page, layer)
            await waitForStable(page)
            const { labels } = await measure(page, layer)
            const inner = labels.filter(l => l.r < .25), outer = labels.filter(l => l.r > .85)
            expect(inner.length).toBeGreaterThan(0)
            expect(outer.length).toBeGreaterThan(5)
            // center: mostly above the node (dy < 0)
            expect(inner.filter(l => l.dy < 0).length / inner.length).toBeGreaterThanOrEqual(.5)
            // rim: most labels point outward
            expect(outer.filter(l => l.outward > 0).length / outer.length).toBeGreaterThanOrEqual(.8)
        })

        test('labels stay calm while dragging slowly', async ({ page }) => {
            await open(page, layer)
            await waitForStable(page)
            const box = await diskBox(page)
            const cx = box.x + box.width / 2, cy = box.y + box.height / 2
            await page.mouse.move(cx, cy)
            await page.mouse.down()
            // per step: how far the labels move relative to their node (jumps)
            let prev = await measure(page, layer), jumps = 0, compared = 0
            for (let i = 1; i <= 12; i++) {
                await page.mouse.move(cx + i * 3, cy + i * 2)
                await page.waitForTimeout(40)
                const now = await measure(page, layer)
                const before = new Map(prev.labels.map(l => [l.id, l]))
                for (const l of now.labels) {
                    const b = before.get(l.id)
                    if (!b) continue
                    compared++
                    if (Math.hypot(l.dx - b.dx, l.dy - b.dy) > 25) jumps++   // pixels, relative to the node
                }
                prev = now
            }
            await page.mouse.up()
            expect(compared).toBeGreaterThan(50)
            expect(jumps / compared).toBeLessThan(.05)
        })

        test('leaderLines: never, always, auto (only for labels pushed away)', async ({ page }) => {
            await open(page, layer, { leaderLines: 'never' })
            await waitForStable(page)
            expect((await measure(page, layer)).lines).toBe(0)
            await open(page, layer, { leaderLines: 'always' })
            await waitForStable(page)
            const always = await measure(page, layer)
            expect(always.lines).toBe(always.count)
            await open(page, layer)
            await waitForStable(page)
            const auto = await measure(page, layer)
            expect(auto.lines).toBeGreaterThan(0)
            expect(auto.lines).toBeLessThan(auto.count)
        })
    })
}

// precalc.labelOnHover: such labels are not in the normal selection, only on the
// path to the node under the mouse (hoverLabel / hoverPathLabels)
test('precalc.labelOnHover: only shown for the hovered node and its path', async ({ page }) => {
    const opts = { labels: { invisible: false, hideOnDrag: false, maxLabels: 50, hoverLabel: true, hoverPathLabels: true } }
    await openTree(page, `gen=nTree&depth=5&childs=3&labels=1&filter=off&layers=${encodeURIComponent(JSON.stringify(opts))}`)
    await waitForStable(page)
    // inner nodes of depth 1..3: labels only on hover
    await page.evaluate(() => {
        harness.ht.data.each(n => { if (n.depth >= 1 && n.depth <= 3) n.precalc.labelOnHover = true })
        harness.ht.update.transformation()
    })
    const depths = () => page.evaluate(() => [...document.querySelectorAll('[id="labels"] text')].map(t => t.__data__.depth))
    expect((await depths()).filter(d => d >= 1 && d <= 3)).toEqual([])
    const t = await page.evaluate(() => {
        const n = harness.ht.unitdisk.cache.unculledNodes.find(n => n.depth === 4)
        const m = document.querySelector('.unitDisc').getScreenCTM()
        return { path: n.ancestors().filter(a => a.depth >= 1 && a.depth <= 3).map(a => a.mergeId), x: m.a * n.cache.re + m.c * n.cache.im + m.e, y: m.b * n.cache.re + m.d * n.cache.im + m.f }
    })
    await page.mouse.move(t.x + 8, t.y + 8)
    await page.mouse.move(t.x, t.y, { steps: 3 })
    await expect.poll(async () => {
        const ids = await page.evaluate(() => [...document.querySelectorAll('[id="labels"] text')].map(e => e.__data__.mergeId))
        return t.path.every(id => ids.includes(id))
    }).toBe(true)
})

// option transition (labels-force, labels-placed): a label that appears grows from 0,
// one that disappears shrinks to 0 and is then removed; the other labels move smoothly
// (labels-force: giving way, labels-placed: gliding to another place)

// offset of the drawn label center from its node, from the transform
// translate(x y) scale(k): the text starts at x, its center is at x + len·k/2
const centerOffsets = layer => `(() => {
    const out = new Map()
    for (const e of document.querySelectorAll('[id="${layer}"] text')) {
        const n = e.__data__, tr = e.getAttribute('transform')
        const t = /translate\\(([^ ]+) ([^)]+)\\)/.exec(tr), s = /scale\\(([^)]+)\\)/.exec(tr)
        if (!t) continue
        const k = s ? +s[1] : 1, len = n.precalc['${layer}len'] || 0
        out.set(n, { x: +t[1] + len * k / 2 - n.cache.re, y: +t[2] - n.cache.im, k })
    }
    return out
})()`

for (const layer of ['labels-force', 'labels-placed']) {
    test(`${layer}: labels grow when they appear and shrink when they disappear`, async ({ page }) => {
        const errors = collectErrors(page)
        await open(page, layer, { hoverLabel: true, maxLabels: 10 })
        await waitForStable(page)
        // a node without a label so far, not too near the rim
        const t = await page.evaluate(layer => {
            const shown = new Set([...document.querySelectorAll(`[id="${layer}"] text`)].map(e => e.__data__))
            const n = harness.ht.unitdisk.cache.unculledNodes.filter(n => n.precalc.label && !shown.has(n) && n.cachep.r > .2 && n.cachep.r < .8)
                .sort((a, b) => a.cachep.r - b.cachep.r)[0]
            const m = document.querySelector('.unitDisc').getScreenCTM()
            return { id: n.mergeId, x: m.a * n.cache.re + m.c * n.cache.im + m.e, y: m.b * n.cache.re + m.d * n.cache.im + m.f }
        }, layer)
        // per animation frame: the scale of the label of node id (null: not drawn) and the
        // largest move of another label relative to its node
        const record = (id, ms) => page.evaluate(([id, ms, offsets]) => new Promise(done => {
            const frames = [], t0 = performance.now()
            let prev = new Map(), last = t0
            const tick = () => {
                let scale = null, move = 0
                const now = eval(offsets), time = performance.now(), per16 = 16 / Math.max(8, time - last)
                last = time
                for (const [n, o] of now) {
                    if (n.mergeId === id) { scale = o.k; continue }
                    const p = prev.get(n)
                    if (p) move = Math.max(move, Math.hypot(o.x - p.x, o.y - p.y) * per16)   // per 16 ms frame
                }
                prev = now
                frames.push({ scale, move })
                if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(frames)
            }
            requestAnimationFrame(tick)
        }), [id, ms, centerOffsets(layer)])

        await page.mouse.move(t.x + 6, t.y + 6)
        const [appear] = await Promise.all([record(t.id, 600), page.mouse.move(t.x, t.y, { steps: 2 })])
        const hovered = await page.evaluate(id => harness.ht.unitdisk.cache.unculledNodes.find(n => n.mergeId === id).hovered, t.id)
        expect(hovered).toBe(true)
        const scales = appear.map(f => f.scale).filter(s => s !== null)
        expect(scales.length).toBeGreaterThan(5)
        expect(scales[0]).toBeLessThan(scales[scales.length - 1] * .5)          // starts small
        for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1] - 1e-9)   // grows
        expect(Math.max(...appear.map(f => f.move))).toBeLessThan(.05)         // the others: no jumps

        const [vanish] = await Promise.all([record(t.id, 600), page.mouse.move(5, 5)])
        const shrinking = vanish.map(f => f.scale).filter(s => s !== null)
        expect(shrinking.length).toBeGreaterThan(3)                             // still drawn a while
        for (let i = 1; i < shrinking.length; i++) expect(shrinking[i]).toBeLessThanOrEqual(shrinking[i - 1] + 1e-9)
        expect(vanish[vanish.length - 1].scale).toBeNull()                      // then removed
        expect(Math.max(...vanish.map(f => f.move))).toBeLessThan(.05)
        expectNoErrors(errors)
    })

    // hovering one node after the other: the labels that give way or change their place
    // move in small steps (per 16 ms frame; without animation: labels-force ~.07, labels-placed ~.6)
    test(`${layer}: the other labels move smoothly while hover labels come and go`, async ({ page }) => {
        await open(page, layer, { hoverLabel: true, maxLabels: 30 })
        await waitForStable(page)
        const targets = await page.evaluate(layer => {
            const shown = new Set([...document.querySelectorAll(`[id="${layer}"] text`)].map(e => e.__data__))
            const m = document.querySelector('.unitDisc').getScreenCTM()
            return harness.ht.unitdisk.cache.unculledNodes.filter(n => n.precalc.label && !shown.has(n) && n.cachep.r > .2 && n.cachep.r < .8).slice(0, 12)
                .map(n => ({ x: m.a * n.cache.re + m.c * n.cache.im + m.e, y: m.b * n.cache.re + m.d * n.cache.im + m.f }))
        }, layer)
        await page.evaluate(offsets => {
            window.__max = 0
            let prev = new Map(), last = performance.now()
            const tick = () => {
                const now = eval(offsets), time = performance.now(), per16 = 16 / Math.max(8, time - last)
                last = time
                for (const [n, o] of now) {
                    const p = prev.get(n)
                    // per 16 ms frame
                    if (p && !n.hovered) window.__max = Math.max(window.__max, Math.hypot(o.x - p.x, o.y - p.y) * per16)
                }
                prev = now
                requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        }, centerOffsets(layer))
        for (const t of targets) { await page.mouse.move(t.x, t.y, { steps: 2 }); await page.waitForTimeout(400) }
        expect(targets.length).toBeGreaterThan(5)
        expect(await page.evaluate(() => window.__max)).toBeLessThan(.05)
    })

    test(`${layer}: transition 0 shows and removes labels at once`, async ({ page }) => {
        await open(page, layer, { hoverLabel: true, maxLabels: 25, transition: 0 })
        await waitForStable(page)
        const scales = await page.evaluate(layer => [...document.querySelectorAll(`[id="${layer}"] text`)].map(e => +/scale\(([^)]+)\)/.exec(e.getAttribute('transform'))[1]), layer)
        expect(scales.length).toBeGreaterThan(10)
        expect(scales.every(s => s > .3)).toBe(true)
    })
}

test('labels-placed in the rectangular view: no overlaps', async ({ page }) => {
    const geometry = encodeURIComponent(JSON.stringify({ halfPlane: true }))
    await page.setViewportSize({ width: 1300, height: 700 })
    await openTree(page, `file=fixtures/primates.treeml.xml&labels=name&size=1200x600&geometry=${geometry}&layers=${encodeURIComponent(JSON.stringify(layerOpts('labels-placed')))}`)
    await waitForStable(page)
    const r = await measure(page, 'labels-placed')
    expect(r.count).toBeGreaterThan(10)
    expect(r.overlaps).toBe(0)
})
