import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree } from './helpers.mjs'

// The emojis sit with their middle exactly on their node (as bitmaps and as text), and
// the layer emoji-backgrounds puts a disk with a border under each, centered the same
// way and as large as the emoji.

// the screen position of each element's center and of its node
const measure = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => {
    const d = e.__data__
    const p = e.ownerSVGElement.createSVGPoint()
    p.x = d.cache.re; p.y = d.cache.im
    const node = p.matrixTransform(e.parentNode.getScreenCTM())
    const r = e.getBoundingClientRect()
    return { dx: r.x + r.width / 2 - node.x, dy: r.y + r.height / 2 - node.y, w: r.width, h: r.height, id: d.mergeId }
}), selector)

for (const asImage of [true, false]) {
    test(`emojis ${asImage ? 'as bitmaps' : 'as text'}: the middle of each emoji on its node`, async ({ page }) => {
        const errors = collectErrors(page)
        const layers = encodeURIComponent(JSON.stringify({ emojis: { asImage } }))
        await openTree(page, `gen=nTree&depth=4&childs=3&icons=1&filter=off&layers=${layers}`)
        const e = await measure(page, `[id="emojis"] > ${asImage ? 'image' : 'text'}`)
        expect(e.length).toBeGreaterThan(20)
        // text: the glyph's box is the font's, a little off the ink; the bitmap is the ink
        const tol = asImage ? 1 : 2.5
        const worst = e.reduce((a, b) => Math.hypot(b.dx, b.dy) > Math.hypot(a.dx, a.dy) ? b : a)
        expect(Math.hypot(worst.dx, worst.dy), JSON.stringify(worst)).toBeLessThan(tol)
        expectNoErrors(errors)
    })
}

test('emoji-backgrounds: a disk under each emoji, centered, a little larger than the emoji', async ({ page }) => {
    const errors = collectErrors(page)
    const layers = encodeURIComponent(JSON.stringify({ 'emoji-backgrounds': { invisible: false } }))
    await openTree(page, `gen=nTree&depth=4&childs=3&icons=1&filter=off&layers=${layers}`)
    const emojis = await measure(page, '[id="emojis"] > image')
    const disks = await measure(page, '[id="emoji-backgrounds"] > circle')
    expect(disks.length).toBe(emojis.length)
    const byId = Object.fromEntries(emojis.map(e => [e.id, e]))
    for (const d of disks) {
        expect(Math.hypot(d.dx, d.dy)).toBeLessThan(1)
        const e = byId[d.id]
        expect(d.w).toBeGreaterThanOrEqual(Math.max(e.w, e.h) - 1)
        expect(d.w).toBeLessThan(Math.max(e.w, e.h) * 1.6)
    }
    // drawn under the emojis, with the theme's border
    const r = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id="emoji-backgrounds"], [id="emojis"]')].map(g => g.id)
        const s = getComputedStyle(document.querySelector('[id="emoji-backgrounds"] > circle'))
        return { ids, stroke: s.stroke, fill: s.fill }
    })
    expect(r.ids).toEqual(['emoji-backgrounds', 'emojis'])
    expect(r.stroke).not.toBe('none')
    expect(r.fill).toBe('rgba(255, 255, 255, 0.76)')      // transparent like the label backgrounds
    expectNoErrors(errors)
})
