import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, diskBox } from './helpers.mjs'

// geometry.startView, api.gotoStart, and the detail frame after an animation.

const open = (page, geometry) =>
    openTree(page, `gen=nTree&depth=6&childs=3` + (geometry ? `&geometry=${encodeURIComponent(JSON.stringify(geometry))}` : ''))
const view = page => page.evaluate(() => { const s = harness.ht.args.geometry.transformation.state; return { P: { re: s.P.re, im: s.P.im }, λ: s.λ } })
const close = (a, b, eps = 1e-6) => Math.abs(a.P.re - b.P.re) < eps && Math.abs(a.P.im - b.P.im) < eps && Math.abs(a.λ - b.λ) < eps

test('startView { P, λ }: the tree zooms up and moves there at the start (startPromise)', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, { startView: { P: { re: 0, im: .3 }, λ: .2 } })
    await page.evaluate(() => harness.ht.startPromise)
    expect(close(await view(page), { P: { re: 0, im: .3 }, λ: .2 })).toBe(true)
    expectNoErrors(errors)
})

test('labels and emojis grow with the tree while it zooms up (growth), full size afterwards', async ({ page }) => {
    await openTree(page, `gen=nTree&depth=6&childs=3&labels=1&icons=1&geometry=${encodeURIComponent(JSON.stringify({ startView: { P: { re: 0, im: .3 }, λ: .2 } }))}`)
    const r = await page.evaluate(async () => {
        const ht = harness.ht
        await ht.startPromise
        // zoomed up again (the start animation already ran while the page opened)
        const seen = []
        let done = false
        const watch = () => { if (ht.transition) seen.push(ht.growth); if (!done) requestAnimationFrame(watch) }
        const up = new Promise((ok, err) => ht.animateUp(ok, err))
        requestAnimationFrame(watch)
        await up
        done = true
        return { first: seen[0], grew: seen.some(g => g > .2 && g < .9), after: ht.growth }
    })
    expect(r.first).toBeLessThan(.2)
    expect(r.grew).toBe(true)
    expect(r.after).toBe(1)
})

test('startView "overview": the view of api.overview(), computed once', async ({ page }) => {
    await open(page, { startView: 'overview' })
    const r = await page.evaluate(async () => {
        const ht = harness.ht
        await ht.startPromise
        const s = ht.args.geometry.transformation.state
        return { now: { P: { re: s.P.re, im: s.P.im }, λ: s.λ }, start: ht.startView(), same: ht.startView() === ht.startView() }
    })
    expect(close(r.now, r.start)).toBe(true)
    expect(r.same).toBe(true)
})

test('api.gotoStart goes back to the start view after dragging; without startView to the initial view', async ({ page }) => {
    for (const geometry of [{ startView: { P: { re: .1, im: .4 }, λ: .15 } }, undefined]) {
        await open(page, geometry)
        await page.evaluate(() => harness.ht.startPromise)
        const start = await view(page)
        const box = await diskBox(page)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * .3, box.y + box.height * .7, { steps: 8 })
        await page.mouse.up()
        expect(close(await view(page), start, 1e-3)).toBe(false)
        await page.evaluate(() => harness.ht.api.gotoStart())
        expect(close(await view(page), start)).toBe(true)
    }
})

test('a detail frame after an animation, one after a chain (animateUp, then goto)', async ({ page }) => {
    await open(page)
    const frames = await page.evaluate(async () => {
        const ht = harness.ht
        let n = 0
        const draw = ht.drawDetailFrame.bind(ht)
        ht.drawDetailFrame = () => { n++; draw() }
        const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        await ht.api.goto({ re: .2, im: .1 }, null)
        await settle()
        const one = n
        n = 0
        await new Promise((ok, err) => ht.animateUp(ok, err)).then(() => ht.api.goto({ re: 0, im: .3 }, null))
        await settle()
        return { one, chain: n }
    })
    expect(frames).toEqual({ one: 1, chain: 1 })
})
