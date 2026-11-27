import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree } from './helpers.mjs'

// geometry.captionPx: the labels in screen pixels, kept on resize and configure.

// the size a caption at scale 1 has on the screen: the svg's font size times the
// caption's em (the theme: .002em) times the disk's scale on the screen (computed here,
// not read from the caption: Chromium clamps tiny computed font sizes to 6 px)
const probePx = page => page.evaluate(() => {
    const ud = document.querySelector('.unitDisc'), svg = ud.ownerSVGElement
    const m = ud.getScreenCTM()
    return parseFloat(svg.style.fontSize) * .002 * Math.hypot(m.a, m.b)
})

test('captionPx: a caption has that size on the screen; kept when the element is resized; changed by configure', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, `gen=nTree&depth=4&childs=3&labels=1&geometry=${encodeURIComponent(JSON.stringify({ captionPx: 14 }))}`)
    await page.waitForTimeout(200)
    expect(await probePx(page)).toBeCloseTo(14, 1)
    const h = await page.evaluate(() => harness.ht.args.geometry.captionHeight)
    // the element half as wide (and the svg in it, as in a page with a fluid layout): the
    // disk smaller, the captions keep their size
    await page.evaluate(() => {
        const e = document.getElementById('tree'), svg = document.querySelector('.unitDisc').ownerSVGElement
        e.style.width = '450px'; e.style.height = '450px'
        svg.style.width = '450px'; svg.style.height = '450px'
    })
    await page.waitForTimeout(400)
    expect(await probePx(page)).toBeCloseTo(14, 1)
    expect(await page.evaluate(() => harness.ht.args.geometry.captionHeight)).toBeGreaterThan(h * 1.5)
    // configure: another size
    await page.evaluate(() => harness.ht.configure({ geometry: { captionPx: 20 } }))
    expect(await probePx(page)).toBeCloseTo(20, 1)
    expectNoErrors(errors)
})

test('without captionPx the labels keep the size of the CSS (in the units of the disk)', async ({ page }) => {
    await openTree(page, 'gen=nTree&depth=4&childs=3&labels=1')
    expect(await page.evaluate(() => document.querySelector('.unitDisc').ownerSVGElement.style.fontSize)).toBe('')
    expect(await page.evaluate(() => harness.ht.args.geometry.captionHeight)).toBe(.04)
})
