// Interaction performance for d3-hypertree: dragging, mouse-wheel zoom and pinch.
//
// Goal: pleasant zooming, pinching and dragging. Per tree update this reports
//   - total renderer main-thread time and the browser-native part (style,
//     layout, paint, ...) from a Chrome trace
//   - the JavaScript part split into pipeline phases, from a CPU profile:
//       layout      layoutBergé (lazy, per node, inside the filter)
//       filter      magic filter: walking the tree, transformation, culling
//       labels      label placement (doLabelStuff)
//       voronoi     voronoi cells for hit testing (doVoronoiStuff)
//       layers      layer updates writing to the DOM (d3 update pattern)
//       other JS    event handling, interaction math, d3 internals
//       gc          garbage collection
// Samples are attributed by call stack, so no timers run inside the library
// (performance.now() is clamped to 100 µs in browsers anyway).
//
// Emojis and labels are off by default: their render cost is measured by
// bench-layers.mjs; here the focus is the update pipeline.
//
// Usage: node bench-interaction.mjs [--cpu 1] [--out bench-interaction.json]
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const arg = (k, d) => argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d
const cpus = arg('cpu', '1,4').split(',').map(Number)
const out = arg('out', 'bench-interaction.json')

const trees = [
    { name: 'binary',     query: 'gen=nTree&depth=10&childs=2' },  //  2,047 nodes
    { name: 'wide 8^5',   query: 'gen=nTree&depth=5&childs=8' },   // 37,449 nodes
    { name: 'large 6^6',  query: 'gen=nTree&depth=6&childs=6' },   // 55,987 nodes
]
const scenarios = ['drag', 'wheel', 'pinch']

const port = 4182
const base = `http://localhost:${port}/test/harness.html?`

// ---------------------------------------------------------------------------------------------
// trace: main-thread busy time and browser-native share between two marks

const NATIVE = /^(UpdateLayoutTree|RecalculateStyles|Layout|HitTest|UpdateLayout|Paint|PrePaint|PaintImage|UpdateLayerTree|Layerize|CompositeLayers|Commit|LayerTreeHost|ProxyMain::|WaitForCommit|LocalFrameView|InlineNode::|Blink\.)/
function analyzeTrace(buffer) {
    const json = JSON.parse(buffer.toString())
    const events = json.traceEvents ?? json
    const s = events.find(e => e.name === 'bench-start'), e2 = events.find(e => e.name === 'bench-end')
    const xs = events.filter(e => e.ph === 'X' && e.pid === s.pid && e.tid === s.tid && e.dur > 0 && e.ts >= s.ts && e.ts + e.dur <= e2.ts)
        .sort((a, b) => a.ts - b.ts || b.dur - a.dur)
    const self = new Map(), stack = []
    let busy = 0
    for (const e of xs) {
        while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop()
        if (stack.length) { const p = stack[stack.length - 1]; self.set(p.ev, self.get(p.ev) - Math.min(e.dur, p.end - e.ts)) }
        else busy += e.dur
        self.set(e, e.dur)
        stack.push({ ev: e, end: e.ts + e.dur })
    }
    let native = 0
    for (const [e, v] of self) if (NATIVE.test(e.name)) native += Math.max(0, v)
    return { busyMs: busy / 1000, nativeMs: native / 1000 }
}

// ---------------------------------------------------------------------------------------------
// CPU profile: attribute each sample to a pipeline phase by its call stack

const PHASES = [
    ['layout',  /^(layoutBergé|layoutNode|layoutUnitLines|layoutUnitVectors|layoutSpiral|layoutBuchheim|wedgeTranslate|setZ)$/],
    ['labels',  /^doLabelStuff$/],
    ['voronoi', /^doVoronoiStuff$/],
    ['filter',  /^(cacheUpdate|pathToLastVisible|collectNodesByWeight|peocessNode|peocessNodeTransformation|abortfilter|doImageStuff|addPathToUnculled)$/],
    ['layers',  /^(updateData|updatePath|updateTransform|updateColor)$/],
]
function analyzeProfile(profile) {
    const byId = new Map(profile.nodes.map(n => [n.id, n]))
    const parent = new Map()
    for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id)
    const phaseOf = new Map()
    const classify = id => {
        if (phaseOf.has(id)) return phaseOf.get(id)
        const names = []
        for (let cur = id; cur !== undefined; cur = parent.get(cur)) names.push(byId.get(cur).callFrame.functionName)
        const leaf = names[0]
        let phase = null
        if (leaf === '(idle)') phase = 'idle'
        else if (leaf === '(program)') phase = 'native'
        else if (leaf === '(garbage collector)') phase = 'gc'
        else phase = PHASES.find(([, re]) => names.some(n => re.test(n)))?.[0] ?? 'other JS'
        phaseOf.set(id, phase)
        return phase
    }
    const ms = {}
    profile.samples.forEach((id, i) => { const p = classify(id); ms[p] = (ms[p] || 0) + (profile.timeDeltas[i] || 0) / 1000 })
    return ms
}

// ---------------------------------------------------------------------------------------------

async function open(browser, tree, cpu) {
    const context = await browser.newContext({ viewport: { width: 900, height: 900 }, hasTouch: true })
    const page = await context.newPage()
    await page.goto(base + tree.query)
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    // Known bug: the computed start zoom can lie outside interaction.λbounds, and
    // then the wheel handler rejects zooming in *and* out. Start from a valid zoom.
    await page.evaluate(() => harness.ht.api.gotoλ(0.3))
    await page.waitForTimeout(1000)
    await page.evaluate(() => {
        const ht = harness.ht
        window.__updates = 0
        const t = ht.update.transformation
        ht.update.transformation = (...a) => { window.__updates++; return t.apply(ht.update, a) }
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    const box = await page.locator('svg').filter({ has: page.locator('#nodes') }).first().boundingBox()
    return { context, page, cdp, box }
}

async function interact(page, cdp, box, scenario) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width * 0.25
    const frame = () => page.waitForTimeout(1000 / 60)
    if (scenario === 'drag') {
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 0; i <= 180; i++) {
            const a = (i / 180) * Math.PI // half circle, ends away from the start
            await page.mouse.move(cx + r * Math.sin(a), cy - r * (1 - Math.cos(a)))
            await frame()
        }
        await page.mouse.up()
    } else if (scenario === 'wheel') {
        // zoom out first: right after load, zooming in is blocked by a known λbounds bug
        await page.mouse.move(cx + r * 0.3, cy - r * 0.3)
        for (let i = 0; i < 40; i++) {
            await page.mouse.wheel(0, i < 20 ? 100 : -100)
            await page.waitForTimeout(60)
        }
    } else if (scenario === 'pinch') {
        // two fingers around the center: closer together (zoom out), then apart again
        const touch = (type, d) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: type === 'touchEnd' ? [] : [
                { x: cx - d, y: cy, id: 0 }, { x: cx + d, y: cy, id: 1 },
            ],
        })
        await touch('touchStart', 150)
        for (let i = 0; i <= 180; i++) {
            const d = 150 - 90 * Math.sin((i / 180) * Math.PI) // 150 -> 60 -> 150 px
            await touch('touchMove', d)
            await frame()
        }
        await touch('touchEnd', 150)
    }
    await page.waitForTimeout(300)
}

async function measure(browser, tree, scenario, cpu) {
    // pass 1: trace -> total and browser-native time
    let { context, page, cdp, box } = await open(browser, tree, cpu)
    const visible = await page.evaluate(() => document.querySelectorAll('#nodes circle').length)
    await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'] })
    await page.evaluate(() => { performance.mark('bench-start'); window.__updates = 0 })
    await interact(page, cdp, box, scenario)
    const updates = await page.evaluate(() => { performance.mark('bench-end'); return window.__updates })
    const trace = analyzeTrace(await browser.stopTracing())
    await context.close()

    // pass 2: CPU profile -> JavaScript split into pipeline phases
    ;({ context, page, cdp, box } = await open(browser, tree, cpu))
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
    await page.evaluate(() => { window.__updates = 0 })
    await cdp.send('Profiler.start')
    await interact(page, cdp, box, scenario)
    const { profile } = await cdp.send('Profiler.stop')
    const updates2 = await page.evaluate(() => window.__updates)
    await context.close()
    const phases = analyzeProfile(profile)

    const per = (v, u) => u ? +(v / u).toFixed(2) : null
    return {
        tree: tree.name, scenario, cpu, updates, visibleNodes: visible,
        msPerUpdate: per(trace.busyMs, updates),
        browserNativeMs: per(trace.nativeMs, updates),
        js: Object.fromEntries(['layout', 'filter', 'labels', 'voronoi', 'layers', 'other JS', 'gc']
            .map(k => [k, per(phases[k] || 0, updates2)])),
    }
}

// ---------------------------------------------------------------------------------------------

const here = fileURLToPath(new URL('.', import.meta.url))
const server = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: here, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 800))
const browser = await chromium.launch({ channel: 'msedge' })
const results = []
try {
    for (const cpu of cpus)
        for (const tree of trees)
            for (const scenario of scenarios) {
                const r = await measure(browser, tree, scenario, cpu)
                results.push(r)
                console.error(`measured ${tree.name} ${scenario} ${cpu}x: ${r.msPerUpdate} ms/update (${r.updates} updates)`)
            }
} finally {
    await browser.close()
    server.kill()
}

await writeFile(out, JSON.stringify({
    date: new Date().toISOString(),
    note: 'Per tree update, headless Edge 900x900, no labels/emojis. msPerUpdate = renderer main-thread time ' +
          '(trace); browserNativeMs = style/layout/paint/commit part of it; js = JavaScript split by call stack ' +
          '(CPU profile, separate run). At 60 fps the budget is 16.7 ms per frame.',
    results,
}, null, 2) + '\n')

console.table(results.map(r => ({
    tree: r.tree, scenario: r.scenario, cpu: `${r.cpu}x`, visible: r.visibleNodes, updates: r.updates,
    'ms/update': r.msPerUpdate, browser: r.browserNativeMs,
    layout: r.js.layout, filter: r.js.filter, labels: r.js.labels, voronoi: r.js.voronoi,
    layers: r.js.layers, 'other JS': r.js['other JS'], gc: r.js.gc,
})))
console.log(`written to ${out}`)
