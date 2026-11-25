// Render performance per layer for d3-hypertree.
//
// Renders a generated tree in test/harness.html and drags it for ~3 s per
// configuration, recording a Chrome trace each time:
//   none      only the interaction layers (cost of math, filtering, layout of the tree model)
//   all       default layer configuration (also yields JS time per layer from the layer stack)
//   <layer>   exactly one layer visible (plus interaction)
// "isolated - none" is the marginal cost of a layer including browser-native work
// (style, layout, paint), which the trace alone can't attribute to a layer.
//
// Usage: node bench-layers.mjs [--tree "gen=nTree&depth=5&childs=8&labels=1&icons=1"]
//                              [--cpu 4] [--out bench-layers.json]
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const arg = (k, d) => argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d
const tree = arg('tree', 'gen=nTree&depth=5&childs=8&labels=1&icons=1')
const cpu = Number(arg('cpu', 1))
const out = arg('out', 'bench-layers.json')

const port = 4181
const base = `http://localhost:${port}/test/harness.html?${tree}`
const ALWAYS = ['interaction', 'interaction-2'] // needed to receive mouse events

// ---------------------------------------------------------------------------------------------
// trace analysis: self time per category on the renderer main thread between two marks

const BUCKETS = {
    scripting: /^(FunctionCall|EvaluateScript|TimerFire|FireAnimationFrame|EventDispatch|RunMicrotasks|V8\.Execute|v8\.(run|callFunction|compile)|V8\.(Parse|Compile)|ProfileCall)/,
    gc:        /GC|ThreadState::|BlinkGC/,
    style:     /^(UpdateLayoutTree|RecalculateStyles|ScheduleStyleRecalculation|InvalidateLayout|StyleInvalidator)/,
    layout:    /^(Layout|HitTest|UpdateLayout)/,
    paint:     /^(Paint|PrePaint|PaintImage|PaintSetup|Decode|Rasterize|RasterTask)/,
    composite: /^(UpdateLayerTree|Layerize|CompositeLayers|Commit|UpdateLayer|LayerTreeHost)/,
}
const bucketOf = name => Object.keys(BUCKETS).find(b => BUCKETS[b].test(name)) || 'other'

function analyzeTrace(buffer) {
    const json = JSON.parse(buffer.toString())
    const events = json.traceEvents ?? json
    const start = events.find(e => e.name === 'bench-start'), end = events.find(e => e.name === 'bench-end')
    if (!start || !end) throw new Error('bench marks missing in trace')
    const xs = events
        .filter(e => e.ph === 'X' && e.pid === start.pid && e.tid === start.tid && e.dur > 0
                  && e.ts >= start.ts && e.ts + e.dur <= end.ts)
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
    const buckets = { scripting: 0, style: 0, layout: 0, paint: 0, composite: 0, gc: 0, other: 0 }
    for (const [e, s] of self) buckets[bucketOf(e.name)] += Math.max(0, s) / 1000
    return { busyMs: busy / 1000, buckets }
}

// ---------------------------------------------------------------------------------------------

async function measure(browser, config) {
    const context = await browser.newContext({ viewport: { width: 900, height: 900 } })
    const page = await context.newPage()
    await page.goto(base)
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    const visible = config === 'all' ? 'all' : [...ALWAYS, ...(config === 'none' ? [] : [config])]
    await page.evaluate(v => harness.showOnly(v), visible)
    await page.waitForTimeout(500)

    const elements = await page.evaluate(name => {
        const g = name && document.getElementById(name)
        return {
            layer: g ? g.querySelectorAll('*').length : null,
            total: document.querySelectorAll('svg *').length,
        }
    }, ['none', 'all'].includes(config) ? null : config)

    // count tree updates and accumulate the layer stack's own per-layer JS timings
    await page.evaluate(() => {
        const ht = harness.ht
        const ls = ht.unitdisk.layerStack || ht.unitdisk.mainView.layerStack
        window.__updates = 0
        window.__layerMs = {}
        const t = ht.update.transformation
        ht.update.transformation = (...a) => { window.__updates++; return t.apply(ht.update, a) }
        // v2: every frame goes through layerStack.frame(reason) (a drag calls it
        // directly); until v2 through layerStack.update.data
        const accumulate = () => ls.d3meta.names.forEach((n, i) => window.__layerMs[n] = (window.__layerMs[n] || 0) + ls.d3meta.Δ[i])
        if (typeof ls.frame === 'function') {
            const f = ls.frame.bind(ls)
            ls.frame = (...a) => { const r = f(...a); accumulate(); return r }
        } else {
            const d = ls.update.data
            ls.update.data = (...a) => { const r = d.apply(ls.update, a); accumulate(); return r }
        }
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })

    const box = await page.locator('svg').filter({ has: page.locator('#nodes') }).first().boundingBox()
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width * 0.25

    await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink.user_timing'] })
    await page.evaluate(() => { performance.mark('bench-start'); window.__updates = 0; window.__layerMs = {} })
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 0; i <= 180; i++) {
        // half circle ending away from the start, so it's never taken as a click
        const a = (i / 180) * Math.PI
        await page.mouse.move(cx + r * Math.sin(a), cy - r * (1 - Math.cos(a)))
        await page.waitForTimeout(1000 / 60)
    }
    await page.mouse.up()
    await page.waitForTimeout(300)
    const { updates, layerMs } = await page.evaluate(() => {
        performance.mark('bench-end')
        return { updates: window.__updates, layerMs: window.__layerMs }
    })
    const trace = analyzeTrace(await browser.stopTracing())
    await context.close()

    const per = v => +(v / Math.max(1, updates)).toFixed(2)
    return {
        config, updates, elements,
        msPerUpdate: per(trace.busyMs),
        breakdownPerUpdate: Object.fromEntries(Object.entries(trace.buckets).map(([k, v]) => [k, per(v)])),
        layerJsMsPerUpdate: Object.fromEntries(Object.entries(layerMs).map(([k, v]) => [k, per(v)])),
    }
}

// ---------------------------------------------------------------------------------------------

const here = fileURLToPath(new URL('.', import.meta.url))
const server = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: here, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 800))
const browser = await chromium.launch({ channel: 'msedge' })

let runs = []
try {
    const probe = await browser.newPage()
    await probe.goto(base)
    await probe.waitForFunction(() => window.harness)
    await probe.evaluate(() => harness.ready)
    const layerNames = (await probe.evaluate(() => harness.layerNames())).filter(n => !ALWAYS.includes(n))
    await probe.close()

    for (const config of ['none', 'all', ...layerNames]) {
        runs.push(await measure(browser, config))
        console.error(`measured ${config}: ${runs.at(-1).msPerUpdate} ms/update`)
    }
} finally {
    await browser.close()
    server.kill()
}

const none = runs.find(r => r.config === 'none'), all = runs.find(r => r.config === 'all')
const layers = runs.filter(r => !['none', 'all'].includes(r.config)).map(r => ({
    layer: r.config,
    elements: r.elements.layer,
    // JS time this layer spends inside the layer stack, measured with all default layers on
    jsInAllMs: all.layerJsMsPerUpdate[r.config] ?? 0,
    // full marginal cost when the layer is the only one visible
    isolatedMs: +(r.msPerUpdate - none.msPerUpdate).toFixed(2),
    scriptMs: +(r.breakdownPerUpdate.scripting - none.breakdownPerUpdate.scripting).toFixed(2),
    styleLayoutMs: +((r.breakdownPerUpdate.style + r.breakdownPerUpdate.layout) - (none.breakdownPerUpdate.style + none.breakdownPerUpdate.layout)).toFixed(2),
    paintCompMs: +((r.breakdownPerUpdate.paint + r.breakdownPerUpdate.composite) - (none.breakdownPerUpdate.paint + none.breakdownPerUpdate.composite)).toFixed(2),
})).sort((a, b) => b.isolatedMs - a.isolatedMs)

const result = {
    date: new Date().toISOString(), tree, cpuThrottle: cpu,
    note: 'Per tree update while dragging, headless Edge 900x900. none = interaction layers only; ' +
          'isolatedMs = (only this layer visible) - none, includes style/layout/paint; ' +
          'jsInAllMs = JS time inside the layer with all default layers visible.',
    summary: {
        noneMsPerUpdate: none.msPerUpdate, allMsPerUpdate: all.msPerUpdate,
        allBreakdownPerUpdate: all.breakdownPerUpdate, allElements: all.elements.total,
    },
    layers, runs,
}
await writeFile(out, JSON.stringify(result, null, 2) + '\n')

console.log(`\ntree: ${tree}, CPU ${cpu}x`)
console.log(`all default layers: ${all.msPerUpdate} ms/update (${all.elements.total} svg elements)`, all.breakdownPerUpdate)
console.log(`interaction only:   ${none.msPerUpdate} ms/update`, none.breakdownPerUpdate)
console.table(layers.map(l => ({
    layer: l.layer, elements: l.elements, 'isolated ms': l.isolatedMs,
    'script ms': l.scriptMs, 'style+layout ms': l.styleLayoutMs, 'paint+comp ms': l.paintCompMs,
    'JS in all ms': l.jsInAllMs,
})))
console.log(`written to ${out}`)
