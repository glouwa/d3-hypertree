// Shared helpers of the library's performance suite (test/perf/run.mjs): the generated
// trees and modes, opening the test harness until the tree is drawn, the frame hooks
// inside the page, the gestures, the CDP metrics and the statistics. Headless Edge
// through Playwright. The application has the same suite for its real pages
// (hypertree-of-life/perf).
import { chromium } from '@playwright/test'

// the trees: harness URL parameters (test/config.js), deterministic generators
export const TREES = {
    binary:  { query: 'gen=nTree&depth=10&childs=2&labels=1',          label: 'binary 2^10 (2,047 nodes)' },
    ternary: { query: 'gen=nTree&depth=8&childs=3&labels=1',           label: 'ternary 3^8 (9,841 nodes)' },
    wide:    { query: 'gen=nTree&depth=5&childs=8&labels=1&icons=1',   label: 'wide 8^5 with emojis (37,449 nodes)' },
    fan:     { query: 'gen=fan&n=200&depth=6&labels=1',                label: 'fan of 200 leaves + binary 2^6' },
    deep:    { query: 'gen=deepStar&arms=4&depth=40&labels=1',         label: 'deep star, 4 arms of depth 40' },
}

// the modes: desktop unthrottled; slow = CPU 6x slower with touch (pinch), like a phone
export const MODES = {
    desktop: { ctx: { viewport: { width: 1000, height: 1000 } }, rate: 1, touch: false },
    slow:    { ctx: { viewport: { width: 1000, height: 1000 }, hasTouch: true }, rate: 6, touch: true },
}

export async function launch() { return chromium.launch({ channel: 'msedge' }) }

const HT_ACCESSOR = () => { window.__ht = () => window.harness && window.harness.ht }

/**
 * Opens the harness with a tree (plus extra URL parameters) in a mode and waits until
 * the tree is drawn. readyMs: until the component's initPromise resolved (data,
 * layout, first frame). The CPU throttling starts after the load.
 */
export async function open(browser, base, treeName, modeName, extraQuery = '', fullQuery = '') {
    const mode = MODES[modeName]
    const ctx = await browser.newContext(mode.ctx)
    const page = await ctx.newPage()
    await page.route(url => !url.toString().startsWith(base), r => r.abort())
    await page.addInitScript(HT_ACCESSOR)
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Performance.enable')
    const query = fullQuery || TREES[treeName].query + (extraQuery ? '&' + extraQuery : '')
    const t0 = Date.now()
    await page.goto(`${base}/test/harness.html?${query}`)
    await page.waitForFunction(() => window.harness, null, { timeout: 300_000 })
    await page.evaluate(() => harness.ready)
    await page.waitForFunction(() => harness.ht.unitdisk.cache.unculledNodes && document.querySelector('#nodes circle'), null, { timeout: 300_000, polling: 50 })
    const readyMs = Date.now() - t0
    await page.waitForTimeout(800)
    if (mode.rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: mode.rate })
    return { ctx, page, cdp, readyMs, mode }
}

/**
 * Installs the frame hooks in the page: every frame of the unit disk is recorded in
 * window.__rp.frames (reason, JS ms, the filter stages, the layer times, counts, whether
 * an interaction was running). Returns the node counts.
 */
export const HOOKS = () => {
    const ht = window.__ht(), ud = ht.unitdisk
    const R = window.__rp = { frames: [], t0: performance.now() }
    const UD = Object.getPrototypeOf(ud)
    if (!UD.__rpHooked) {
        UD.__rpHooked = true
        const frame = UD.frame
        UD.frame = function (reason) {
            const t0 = performance.now()
            frame.call(this, reason)
            const t1 = performance.now()
            const m = this.layerStack.d3meta || { names: [], Δ: [] }
            const c = this.cache
            window.__rp.frames.push({
                t: +(t0 - window.__rp.t0).toFixed(1), reason, js: +(t1 - t0).toFixed(2),
                filter: this.cacheMeta ? this.cacheMeta.Δ.map(x => +x.toFixed(2)) : null,
                layers: m.names.map((n, k) => [n, +m.Δ[k].toFixed(2)]),
                n: c.unculledNodes ? c.unculledNodes.length : 0,
                moving: this.view.hypertree.isAnimationRunning(),
            })
        }
    }
    return { nodes: ht.data.descendants().length, visible: ud.cache.unculledNodes.length }
}
export const RESET = () => { window.__rp.frames.length = 0; window.__rp.t0 = performance.now() }
export const FRAMES = () => window.__rp.frames

export async function diskCenter(page) {
    const box = await page.locator('.unitDisc').first().boundingBox()
    return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: Math.min(box.width, box.height) / 2 }
}

// --- gestures. pause: ms between the steps; 0 on the unthrottled desktop (the events
// then come at the round-trip rate, like a real mouse), 40 with a throttled CPU.
export const pauseFor = mode => mode.rate > 1 ? 40 : 0
export const DRAG_STEPS = 60, WHEEL_STEPS = 20, PINCH_STEPS = 50, HOVER_STEPS = 40
export async function drag(page, c, pause) {
    await page.mouse.move(c.cx, c.cy)
    await page.mouse.down()
    for (let i = 0; i <= DRAG_STEPS; i++) {
        await page.mouse.move(c.cx + 110 * Math.sin(i / 8), c.cy + 90 * Math.sin(i / 11))
        await page.waitForTimeout(pause)
    }
    await page.mouse.up()
}
export async function pinch(page, cdp, c, pause) {
    const pts = (d, dy) => [{ x: c.cx - d, y: c.cy + dy, id: 0 }, { x: c.cx + d, y: c.cy + dy, id: 1 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(80, 0) })
    for (let i = 1; i <= PINCH_STEPS; i++) {
        const d = 80 + 50 * Math.sin(i / PINCH_STEPS * 2 * Math.PI), dy = 25 * Math.sin(i / 7)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d, dy) })
        await page.waitForTimeout(pause)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
export async function wheel(page, c, pause) {
    await page.mouse.move(c.cx + 40, c.cy - 30)
    for (let i = 0; i < WHEEL_STEPS; i++) {
        await page.mouse.wheel(0, i < WHEEL_STEPS / 2 ? -100 : 100)
        await page.waitForTimeout(pause)
    }
}
export async function hoverSweep(page, c, pause) {
    for (let i = 0; i < HOVER_STEPS; i++) {
        await page.mouse.move(c.cx + c.r * .7 * Math.cos(i / 4), c.cy + c.r * .7 * Math.sin(i / 3), { steps: 3 })
        await page.waitForTimeout(pause)
    }
}

/** The renderer's cumulative CDP metrics (seconds): TaskDuration, ScriptDuration, LayoutDuration, RecalcStyleDuration. */
export async function metrics(cdp) { return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])) }
export const msBetween = (m0, m1, key = 'TaskDuration') => (m1[key] - m0[key]) * 1000

// --- statistics
const nums = a => a.filter(x => typeof x === 'number' && !isNaN(x))
export const median = a => { const s = nums(a).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN }
export const mean = a => { const s = nums(a); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN }
export const sd = a => { const s = nums(a); if (s.length < 2) return NaN; const m = mean(s); return Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / (s.length - 1)) }
export const stats = a => ({ n: nums(a).length, mean: mean(a), sd: sd(a), values: nums(a) })
