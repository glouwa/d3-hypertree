import { expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

// ---------------------------------------------------------------------------------------------
// Scene snapshots: what's drawn (visible nodes, positions, layer element counts, labels),
// compared with tolerances. Robust against antialiasing and font rendering, sensitive to
// real regressions. References live in tests/__scenes__/<spec>/<name>.json; they're written
// when missing and replaced with `npm run test:update` (--update-snapshots).

const DEFAULT_TOLERANCE = {
    nodeOverlap:   0.9,  // share of nodes present in both scenes (Jaccard)
    medianPx:      2,    // median position error of nodes present in both
    maxPx:         10,   // maximum position error
    radiusPx:      2,    // maximum radius error
    layerRel:      0.1,  // relative tolerance of element counts per layer...
    layerAbs:      2,    // ...or this absolute difference, whichever is larger
    labelOverlap:  0.8,  // share of label texts present in both
    λ:             0.01, // absolute tolerance of the zoom
}

/** Compares two scenes, returns a list of human-readable differences (empty = equal enough). */
export function diffScenes(actual, expected, tolerance = {}) {
    const t = { ...DEFAULT_TOLERANCE, ...tolerance }
    const problems = []
    const jaccard = (a, b) => {
        const A = new Set(a), B = new Set(b)
        const inter = [...A].filter(x => B.has(x)).length
        const union = new Set([...A, ...B]).size
        return union ? inter / union : 1
    }

    if (Math.abs(actual.λ - expected.λ) > t.λ)
        problems.push(`zoom λ ${actual.λ} vs expected ${expected.λ}`)

    const overlap = jaccard(actual.nodes.map(n => n.id), expected.nodes.map(n => n.id))
    if (overlap < t.nodeOverlap)
        problems.push(`visible nodes: only ${(overlap * 100).toFixed(0)}% in common ` +
            `(${actual.nodes.length} vs expected ${expected.nodes.length})`)

    const exp = new Map(expected.nodes.map(n => [n.id, n]))
    const errors = [], radius = [], fills = []
    for (const n of actual.nodes) {
        const e = exp.get(n.id)
        if (!e) continue
        errors.push({ id: n.id, d: Math.hypot(n.x - e.x, n.y - e.y) })
        radius.push(Math.abs(n.r - e.r))
        if (n.fill !== e.fill) fills.push(`node ${n.id}: fill ${n.fill} vs ${e.fill}`)
    }
    if (errors.length) {
        const sorted = errors.map(e => e.d).sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        const worst = errors.reduce((a, b) => (b.d > a.d ? b : a))
        if (median > t.medianPx) problems.push(`node positions: median error ${median.toFixed(1)} px`)
        if (worst.d > t.maxPx) problems.push(`node positions: node ${worst.id} off by ${worst.d.toFixed(1)} px`)
        if (Math.max(...radius) > t.radiusPx) problems.push(`node radii: max error ${Math.max(...radius).toFixed(1)} px`)
    }
    if (fills.length) problems.push(`${fills.length} node fills differ, e.g. ${fills[0]}`)

    for (const name of new Set([...Object.keys(actual.layers), ...Object.keys(expected.layers)])) {
        const a = actual.layers[name] ?? 0, e = expected.layers[name] ?? 0
        if (Math.abs(a - e) > Math.max(t.layerAbs, e * t.layerRel))
            problems.push(`layer ${name}: ${a} elements vs expected ${e}`)
    }

    if (actual.labels.length || expected.labels.length) {
        const lo = jaccard(actual.labels, expected.labels)
        if (lo < t.labelOverlap) problems.push(`labels: only ${(lo * 100).toFixed(0)}% in common`)
    }

    const colorKeys = new Set([...Object.keys(actual.linkColors), ...Object.keys(expected.linkColors)])
    for (const c of colorKeys) {
        const a = actual.linkColors[c] ?? 0, e = expected.linkColors[c] ?? 0
        if (Math.abs(a - e) > Math.max(t.layerAbs, e * t.layerRel))
            problems.push(`link color ${c}: ${a} links vs expected ${e}`)
    }

    if (JSON.stringify(actual.selections) !== JSON.stringify(expected.selections))
        problems.push(`selections ${JSON.stringify(actual.selections)} vs ${JSON.stringify(expected.selections)}`)
    return problems
}

/** Captures the current scene and compares it with the stored reference. */
export async function expectScene(page, testInfo, name, tolerance) {
    const actual = await page.evaluate(() => harness.scene())
    const file = join(testInfo.project.testDir, '__scenes__', basename(testInfo.file), `${name}.json`)
    const update = testInfo.config.updateSnapshots === 'all' || !existsSync(file)
    if (update) {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, JSON.stringify(actual, null, 1) + '\n')
        testInfo.annotations.push({ type: 'scene', description: `wrote ${name}.json` })
        return actual
    }
    const expected = JSON.parse(readFileSync(file, 'utf8'))
    const problems = diffScenes(actual, expected, tolerance)
    expect(problems, `scene "${name}" differs from the reference:\n  ${problems.join('\n  ')}`).toEqual([])
    return actual
}

// ---------------------------------------------------------------------------------------------
// Plausibility checks (level 1) that hold for every scene

export async function expectPlausibleScene(page) {
    const r = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#tree svg *')].filter(e =>
            ['transform', 'd', 'points', 'cx', 'cy', 'r', 'x', 'y'].some(a => /NaN|Infinity/.test(e.getAttribute(a) || '')))
        const laidOut = harness.ht.data.descendants().filter(n => n.layout && n.layout.z)
        const nonFinite = laidOut.filter(n => !isFinite(n.layout.z.re) || !isFinite(n.layout.z.im))
        const outside = laidOut.filter(n => Math.hypot(n.layout.z.re, n.layout.z.im) > 1 + 1e-9)
        return { badAttributes: bad.length, nonFinite: nonFinite.length, outsideDisk: outside.length }
    })
    expect(r).toEqual({ badAttributes: 0, nonFinite: 0, outsideDisk: 0 })
}

export function collectErrors(page) {
    const errors = []
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
    page.on('console', m => m.type() === 'error' && errors.push(`console: ${m.text()}`))
    return errors
}

export function expectNoErrors(errors) {
    expect(errors, errors.join('\n')).toEqual([])
}

/** Opens the harness with the given query and waits until the tree has loaded and come to rest. */
export async function openTree(page, query) {
    await page.goto(`harness.html?${query}`)
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    await waitForStable(page)
}

/** Waits until no transition runs and node positions stay unchanged over several samples. */
export async function waitForStable(page, timeout = 30_000) {
    await page.evaluate(() => { window.__stable = { sig: '', count: 0 } })
    await page.waitForFunction(() => {
        // node positions plus the transformation state, so it also works when
        // the node layer is hidden
        const s = harness.ht.unitdisk.args.transformation.state
        const sig = [...document.querySelectorAll('#nodes circle')].slice(0, 50)
            .map(c => c.getAttribute('transform')).join('|') + `|${s.P.re},${s.P.im},${s.λ}`
        const w = window.__stable
        if (!harness.ht.transition && sig === w.sig) w.count++
        else { w.sig = sig; w.count = 0 }
        return w.count >= 5
    }, null, { timeout, polling: 200 })
}

export async function counts(page) {
    return page.evaluate(() => ({
        nodes:  document.querySelectorAll('#nodes circle').length,
        links:  document.querySelectorAll('#link-arcs path').length,
        emojis: document.querySelectorAll('#emojis text').length,
        labels: document.querySelectorAll('#labels text, #labels2 text, #labels-force text').length,
    }))
}

/** Bounding box of the unit disk svg. */
export async function diskBox(page) {
    return page.locator('svg').filter({ has: page.locator('#nodes') }).first().boundingBox()
}
