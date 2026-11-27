// The performance suite of d3-hypertree: generated trees in the test harness in headless
// Edge, load, idle, drag, the settling after it, wheel (desktop), pinch (slow mode),
// hover, the render time per layer, the cost of single options (features) and of the
// library's presets. Every number is measured over several iterations and reported as
// mean ± standard deviation. The result goes to docs/dev/performance/ as JSON (for
// compare.mjs) and markdown (for reading):
//
//   npm run perf                    -> last-run.md/.json     (2 iterations)
//   npm run perf:commit             -> last-commit.md/.json  (3 iterations; clean working tree; the post-commit hook runs it)
//   npm run perf:push               -> last-push.md/.json    (3 iterations; clean; the pre-push hook runs it)
//   npm run perf:longterm           -> longterm.md/.json     (8 iterations; clean; only when asked)
//
// Options (node test/perf/run.mjs ...): --iterations N; --trees binary,ternary,wide,fan,deep;
//   --modes desktop,slow; --features all|none|a,b; --presets all|none|a,b; --feature-tree ternary
//   (the tree the features and presets are measured on, desktop); --quick (ternary, desktop,
//   1 iteration, 4 features, no presets: ~1 min); --no-build (dist/ is current);
//   --server http://localhost:3100 (a running server of the repo root, e.g. the playground's);
//   --label "text"; --force (write commit or longterm although the tree is dirty).
// After the run the result is compared with last-commit (and longterm) when they exist.
import { spawn, spawnSync, execSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cpus, platform, release, tmpdir } from 'node:os'
import * as L from './lib.mjs'
import { GROUPS, LAYERS, FEATURES, PRESETS } from './schema.mjs'
import { compare, load, DIR } from './compare.mjs'

// --- arguments
const argv = process.argv.slice(2)
const has = k => argv.includes(`--${k}`)
const arg = (k, d) => has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d
const quick = has('quick')
const kind = arg('write', 'run')
if (!['run', 'commit', 'push', 'longterm'].includes(kind)) { console.error(`--write run|commit|push|longterm, not ${kind}`); process.exit(2) }
const iterations = Number(arg('iterations', quick ? 1 : { run: 2, commit: 3, push: 3, longterm: 8 }[kind]))
const trees = arg('trees', quick ? 'ternary' : Object.keys(L.TREES).join(',')).split(',').filter(Boolean)
const modes = arg('modes', quick ? 'desktop' : Object.keys(L.MODES).join(',')).split(',').filter(Boolean)
const pick = (value, all) => value === 'none' ? [] : value === 'all' ? Object.keys(all) : value.split(',')
const features = pick(arg('features', quick ? 'base,noCells,noLabels,rectangle' : 'all'), FEATURES)
const presets = pick(arg('presets', quick ? 'none' : 'all'), PRESETS)
const featureTree = arg('feature-tree', 'ternary')
const label = arg('label', '')
for (const t of trees) if (!L.TREES[t]) { console.error(`unknown tree ${t}`); process.exit(2) }
for (const m of modes) if (!L.MODES[m]) { console.error(`unknown mode ${m}`); process.exit(2) }
for (const f of features) if (!(f in FEATURES)) { console.error(`unknown feature ${f}`); process.exit(2) }
for (const p of presets) if (!(p in PRESETS)) { console.error(`unknown preset ${p}`); process.exit(2) }

// --- the repository
const root = fileURLToPath(new URL('../../', import.meta.url))
const git = args => { try { return execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).trim() } catch { return '' } }
const commit = git('rev-parse --short HEAD') || '-', dirty = git('status --porcelain --untracked-files=no') !== ''
if (kind !== 'run' && dirty && !has('force')) {
    console.error(`--write ${kind} needs a clean working tree: commit first, or --force`)
    process.exit(1)
}

// --- one measurement at a time on this machine (both suites, the hooks): a shared lock
const LOCK = tmpdir() + '/hypertree-perf.lock'
const locked = ()=> { try { const pid = Number(readFileSync(LOCK, 'utf8')); process.kill(pid, 0); return pid !== process.pid } catch { try { unlinkSync(LOCK) } catch {} return false } }
for (let waited = 0; locked(); waited += 10) {
    if (waited === 0) console.log('another measurement is running: waiting ...')
    if (waited > 7200) { console.error('the perf lock was held for two hours: giving up'); process.exit(1) }
    await new Promise(r => setTimeout(r, 10000))
}
writeFileSync(LOCK, String(process.pid))
process.on('exit', ()=> { try { if (readFileSync(LOCK, 'utf8') === String(process.pid)) unlinkSync(LOCK) } catch {} })

// --- build and serve
const tStart = Date.now()
if (!has('no-build') && !has('server')) {
    console.log('building ...')
    if (spawnSync('npm run build', { cwd: root, shell: true, stdio: 'ignore' }).status) { console.error('build failed'); process.exit(1) }
}
let server = null, base = arg('server', '')
if (!base) {
    const port = 4183
    base = `http://localhost:${port}`
    server = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: root + 'test', stdio: 'ignore' })
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/test/harness.html')).ok) break } catch {} await new Promise(r => setTimeout(r, 200)) }
}
base = base.replace(/\/$/, '')

// --- the measurement
const samples = {}   // "group|row" -> metric -> values
const add = (group, row, metric, value) => { if (typeof value === 'number' && !isNaN(value)) ((samples[`${group}|${row}`] ??= {})[metric] ??= []).push(value) }
const movingOf = frames => frames.filter(f => f.moving)
const layerMs = (frames, name) => L.median(frames.map(f => { const l = f.layers.find(x => x[0] === name); return l ? l[1] : NaN }))
// frames per second the JS of the median frame would allow (1000 / its ms)
const fpsOf = frames => { const ms = L.median(frames.map(f => f.js)); return ms > 0 ? 1000 / ms : NaN }

async function measureTree(browser, treeName, modeName) {
    const row = `${treeName} ${modeName}`, mode = L.MODES[modeName], pause = L.pauseFor(mode)
    const o = await L.open(browser, base, treeName, modeName)
    const { page, cdp } = o
    add('load', row, 'readyMs', o.readyMs)
    const counts = await page.evaluate(L.HOOKS)
    add('load', row, 'nodes', counts.nodes); add('load', row, 'visible', counts.visible)
    const c = await L.diskCenter(page)
    const reset = () => page.evaluate(L.RESET), frames = () => page.evaluate(L.FRAMES)

    // idle: the mouse in a corner, 3 s
    await page.mouse.move(5, 5); await page.waitForTimeout(600)
    await reset(); let m0 = await L.metrics(cdp)
    await page.waitForTimeout(3000)
    let m1 = await L.metrics(cdp); let F = await frames()
    add('idle', row, 'frames', F.length); add('idle', row, 'mainMs', L.msBetween(m0, m1))

    // drag
    await page.mouse.move(c.cx, c.cy); await page.waitForTimeout(400)
    await reset(); m0 = await L.metrics(cdp)
    await L.drag(page, c, pause)
    m1 = await L.metrics(cdp); F = await frames()
    let moving = movingOf(F)
    add('drag', row, 'mainPerStep', L.msBetween(m0, m1) / (L.DRAG_STEPS + 1))
    add('drag', row, 'fps', fpsOf(moving))
    add('drag', row, 'filterMs', L.median(moving.map(f => f.filter ? f.filter.reduce((a, b) => a + b, 0) : NaN)))
    add('drag', row, 'frames', moving.length)
    add('drag', row, 'visible', L.median(moving.map(f => f.n)))
    // every layer that costs measurable time (>= 0.05 ms per frame): the frames/sec it alone would allow
    const names = [...LAYERS, ...new Set(moving.flatMap(f => f.layers.map(l => l[0])).filter(n => !LAYERS.includes(n)))]
    for (const name of names) { const ms = layerMs(moving, name); if (ms >= .05) add('layers', `${row} ${name}`, 'fps', 1000 / ms) }

    // after the drag: 4 s
    await reset(); m0 = await L.metrics(cdp)
    await page.waitForTimeout(4000)
    m1 = await L.metrics(cdp); F = await frames()
    add('afterDrag', row, 'frames', F.length); add('afterDrag', row, 'mainMs', L.msBetween(m0, m1))
    add('afterDrag', row, 'lastAt', F.length ? F[F.length - 1].t : 0)

    if (!mode.touch) {
        // wheel: 20 steps and the 4 s after
        await reset(); m0 = await L.metrics(cdp)
        await L.wheel(page, c, pause)
        m1 = await L.metrics(cdp)
        const tEnd = await page.evaluate(() => performance.now() - window.__rp.t0)
        await page.waitForTimeout(4000)
        const m2 = await L.metrics(cdp); F = await frames()
        const after = F.filter(f => f.t > tEnd)
        add('wheel', row, 'mainPerStep', L.msBetween(m0, m1) / L.WHEEL_STEPS)
        add('wheel', row, 'framesDuring', F.length - after.length); add('wheel', row, 'framesAfter', after.length)
        add('wheel', row, 'mainAfterMs', L.msBetween(m1, m2))

        // hover sweep
        await page.mouse.move(c.cx, c.cy); await page.waitForTimeout(400)
        await reset(); m0 = await L.metrics(cdp)
        await L.hoverSweep(page, c, 60)
        m1 = await L.metrics(cdp); F = await frames()
        const style = F.filter(f => f.reason === 'style')
        add('hover', row, 'mainPerStep', L.msBetween(m0, m1) / L.HOVER_STEPS)
        add('hover', row, 'fps', fpsOf(style)); add('hover', row, 'styleFrames', style.length)
    } else {
        // pinch
        await reset(); m0 = await L.metrics(cdp)
        await L.pinch(page, cdp, c, pause)
        m1 = await L.metrics(cdp); F = await frames()
        moving = movingOf(F)
        add('pinch', row, 'mainPerStep', L.msBetween(m0, m1) / L.PINCH_STEPS)
        add('pinch', row, 'fps', fpsOf(moving)); add('pinch', row, 'frames', moving.length)
    }
    await o.ctx.close()
}

/** A drag on the feature tree with a variant: URL parameters (query / url) or a configure overlay. */
async function measureVariant(browser, group, variant, V) {
    const modeName = 'desktop', mode = L.MODES[modeName], row = `${featureTree} ${modeName} ${variant}`
    const o = await L.open(browser, base, featureTree, modeName, V && V.query ? V.query : '', V && V.url ? V.url : '')
    const { page, cdp } = o
    if (V && !V.query && !V.url) { await page.evaluate(ov => window.__ht().configure(ov), V); await page.waitForTimeout(800) }
    if (group === 'presets') add(group, row, 'readyMs', o.readyMs)
    await page.evaluate(L.HOOKS)
    const c = await L.diskCenter(page)
    await page.mouse.move(c.cx, c.cy); await page.waitForTimeout(400)
    await page.evaluate(L.RESET); const m0 = await L.metrics(cdp)
    await L.drag(page, c, L.pauseFor(mode))
    const m1 = await L.metrics(cdp); const moving = movingOf(await page.evaluate(L.FRAMES))
    add(group, row, 'mainPerStep', L.msBetween(m0, m1) / (L.DRAG_STEPS + 1))
    add(group, row, 'fps', fpsOf(moving))
    add(group, row, 'frames', moving.length); add(group, row, 'visible', L.median(moving.map(f => f.n)))
    await o.ctx.close()
}

const perIteration = trees.length * modes.length * 20 + (features.length + presets.length) * 9   // seconds
console.log(`${kind}: ${iterations} iteration(s), trees ${trees.join(',')}, modes ${modes.join(',')}, features ${features.length ? features.join(',') : 'none'}, presets ${presets.length ? presets.join(',') : 'none'} (on ${featureTree}); about ${Math.max(1, Math.round(perIteration * iterations / 60))} min`)
const browser = await L.launch()
const edge = browser.version()
try {
    for (let k = 0; k < iterations; k++) {
        for (const t of trees) for (const m of modes) { process.stdout.write(`  ${k + 1}/${iterations} ${t} ${m} ... `); await measureTree(browser, t, m); console.log('ok') }
        for (const v of features) { process.stdout.write(`  ${k + 1}/${iterations} feature ${v} ... `); await measureVariant(browser, 'features', v, FEATURES[v]); console.log('ok') }
        for (const p of presets) { process.stdout.write(`  ${k + 1}/${iterations} preset ${p} ... `); await measureVariant(browser, 'presets', p, PRESETS[p]); console.log('ok') }
    }
} finally {
    await browser.close()
    if (server) server.kill()
}

// --- the result
const rows = {}
for (const [key, metrics] of Object.entries(samples)) rows[key] = Object.fromEntries(Object.entries(metrics).map(([m, v]) => [m, L.stats(v)]))
const result = {
    kind, date: new Date().toISOString(), label, iterations, commit, dirty,
    machine: { cpu: cpus()[0].model.trim(), cores: cpus().length, os: `${platform()} ${release()}`, node: process.version, edge },
    settings: { trees, modes, features, presets, featureTree, base, quick },
    runtimeMin: +((Date.now() - tStart) / 60000).toFixed(1),
    rows,
}
const fmt = (s, d) => s.n > 1 && !isNaN(s.sd) ? `${s.mean.toFixed(d)} ± ${s.sd.toFixed(d)}` : s.mean.toFixed(d)
function markdown(r) {
    const title = { run: 'Last run', commit: 'Last commit', push: 'Last push', longterm: 'Long-term reference' }[r.kind]
    const out = [`# Performance: ${title}`, '',
        `Generated by test/perf/run.mjs, do not edit. ${r.date.slice(0, 16).replace('T', ' ')}${r.label ? `, "${r.label}"` : ''}. ` +
        `${r.iterations} iteration(s); cells are mean ± standard deviation over the iterations.`, '',
        `Commit ${r.commit}${r.dirty ? ' (uncommitted changes)' : ''}. ` +
        `${r.machine.cpu}, ${r.machine.cores} cores, ${r.machine.os}, Node ${r.machine.node}, Edge ${r.machine.edge}. Runtime ${r.runtimeMin} min.`, '',
        `Trees: ${r.settings.trees.map(t => `${t} = ${L.TREES[t].label}`).join('; ')}. Modes ${r.settings.modes.join(', ')} (slow: CPU 6× slower, touch). ` +
        `Features ${r.settings.features.length ? r.settings.features.join(', ') : 'none'} and presets ${r.settings.presets.length ? r.settings.presets.join(', ') : 'none'} on ${r.settings.featureTree} (desktop). ` +
        'Main thread = renderer task time (CDP). frames/sec = 1000 / the median JS time of the unit disk\'s frame function measured in the page: the rate the JS alone would allow, not the displayed frame rate.', '']
    for (const g of GROUPS) {
        const keys = Object.keys(r.rows).filter(k => k.startsWith(g.key + '|'))
        if (!keys.length) continue
        out.push(`## ${g.title}`, '', `| ${g.rowLabel} | ${g.metrics.map(m => m.label).join(' | ')} |`, `|---|${g.metrics.map(() => '---:').join('|')}|`)
        for (const k of keys) out.push(`| ${k.slice(g.key.length + 1)} | ${g.metrics.map(m => r.rows[k][m.key] ? fmt(r.rows[k][m.key], m.digits) : '-').join(' | ')} |`)
        out.push('')
    }
    return out.join('\n')
}
mkdirSync(DIR, { recursive: true })
const file = { run: 'last-run', commit: 'last-commit', push: 'last-push', longterm: 'longterm' }[kind]
writeFileSync(`${DIR}${file}.json`, JSON.stringify(result, null, 1))
const md = markdown(result)
writeFileSync(`${DIR}${file}.md`, md)
console.log('\n' + md)
console.log(`written: docs/dev/performance/${file}.md and .json`)

// --- compare with the references
for (const ref of kind === 'run' ? ['last-commit', 'last-push', 'longterm'] : kind === 'commit' ? ['last-push', 'longterm'] : kind === 'push' ? ['longterm'] : []) {
    const b = load(ref)
    if (!b) continue
    console.log(`\n## Compared with ${ref}\n`)
    console.log(compare(result, b))
}
