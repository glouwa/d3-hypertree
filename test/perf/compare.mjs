// Compares two result files of the performance suite (docs/dev/performance/*.json):
// per group and row the means of both, the change in percent and a mark where the
// change is larger than twice the larger standard deviation (and at least 3 %).
//   node test/perf/compare.mjs [a] [b]      default: last-run against last-commit
//   node test/perf/compare.mjs last-run longterm
// Also used by run.mjs after a run. Names without a slash are looked up in docs/dev/performance.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { GROUPS } from './schema.mjs'

export const DIR = fileURLToPath(new URL('../../docs/dev/performance/', import.meta.url))
export const resolveResult = name => /[\\/]/.test(name) ? name : `${DIR}${name.replace(/\.json$/, '')}.json`
export const load = name => { const f = resolveResult(name); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }

const f = (v, d) => v === undefined || v === null || isNaN(v) ? '-' : v.toFixed(d)
const pctOf = (a, b) => b ? (a - b) / b * 100 : NaN

/**
 * Which way is better for a metric: 'higher' (frames/sec, frames during a gesture),
 * null for counts that only describe the tree (nodes, visible nodes, style frames), else 'lower'.
 */
export function better(m) {
    if (m.key === 'fps' || m.key === 'framesDuring' || /frames during/.test(m.label)) return 'higher'
    if (m.key === 'nodes' || m.key === 'visible' || m.key === 'styleFrames') return null
    return 'lower'
}

/**
 * Whether a change is beyond the noise: both results from at least MIN_N iterations (a
 * standard deviation from one or two samples says nothing: two equal samples gave sd 0
 * and a +23 % of plain noise turned red), more than twice the larger sd and more than
 * NOISE_PCT (the drag of the same build varies by about 1 ms of 6 between iterations).
 */
export const MIN_N = 3, NOISE_PCT = 10
export const significant = (x, y) => (x.n || 0) >= MIN_N && (y.n || 0) >= MIN_N
    && Math.abs(x.mean - y.mean) > 2 * Math.max(x.sd || 0, y.sd || 0) && Math.abs(pctOf(x.mean, y.mean)) > NOISE_PCT

const COLORS = { green: '#2e7d32', red: '#c62828', gray: '#888888' }

/**
 * The change of a cell against the previous result, for the markdown tables: the signed
 * percentage, green when it got better beyond the noise, red when worse, gray otherwise
 * (and for metrics without a direction). An HTML span in the text's own font (the VS Code
 * preview shows the color; GitHub drops it and shows the number plainly).
 */
export function deltaCell(x, y, m) {
    if (!x || !y || isNaN(x.mean) || isNaN(y.mean) || !y.mean) return ''
    const p = pctOf(x.mean, y.mean), dir = better(m)
    const text = (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(Math.abs(p) < 10 ? 1 : 0) + ' %'
    const color = !dir || !significant(x, y) ? 'gray' : (p < 0) === (dir === 'lower') ? 'green' : 'red'
    return ` <span style="color:${COLORS[color]}">${text}</span>`
}
const describe = r => `${r.kind} ${r.date.slice(0, 16)} (${r.commit}${r.dirty ? '+' : ''}, ${r.iterations} iterations)`

/** The comparison as markdown lines. a: the newer result, b: the reference. */
export function compare(a, b, { onlyChanged = false } = {}) {
    const out = [`a: ${describe(a)}`, `b: ${describe(b)}`,
        `Δ = (a − b) / b; * = both ≥ ${MIN_N} iterations, |a − b| > 2 · max(sd) and > ${NOISE_PCT} %. Lower is better except "visible nodes", "nodes", "frames during" and "frames/sec" (higher is better).`]
    for (const g of GROUPS) {
        const rows = Object.keys(a.rows).filter(k => k.startsWith(g.key + '|') && b.rows[k])
        if (!rows.length) continue
        const lines = []
        for (const key of rows) {
            const ra = a.rows[key], rb = b.rows[key]
            const cells = g.metrics.map(m => {
                const x = ra[m.key], y = rb[m.key]
                if (!x || !y || isNaN(x.mean) || isNaN(y.mean)) return '-'
                const p = pctOf(x.mean, y.mean)
                const sig = significant(x, y)
                return `${f(x.mean, m.digits)} / ${f(y.mean, m.digits)} (${p >= 0 ? '+' : ''}${f(p, 0)} %${sig ? ' *' : ''})`
            })
            if (onlyChanged && !cells.some(c => c.endsWith('*)'))) continue
            lines.push(`| ${key.slice(g.key.length + 1)} | ${cells.join(' | ')} |`)
        }
        if (!lines.length) continue
        out.push('', `### ${g.title}: a / b (Δ)`, '', `| ${g.rowLabel} | ${g.metrics.map(m => m.label).join(' | ')} |`, `|---|${g.metrics.map(() => '---').join('|')}|`, ...lines)
    }
    return out.join('\n')
}

const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
if (isMain) {
    const [aName = 'last-run', bName = 'last-commit'] = process.argv.slice(2)
    const a = load(aName), b = load(bName)
    if (!a || !b) { console.error(`missing: ${!a ? resolveResult(aName) : ''} ${!b ? resolveResult(bName) : ''}`); process.exit(1) }
    console.log(compare(a, b))
}
