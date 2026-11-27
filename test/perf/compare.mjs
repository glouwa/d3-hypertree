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
const describe = r => `${r.kind} ${r.date.slice(0, 16)} (${r.commit}${r.dirty ? '+' : ''}, ${r.iterations} iterations)`

/** The comparison as markdown lines. a: the newer result, b: the reference. */
export function compare(a, b, { onlyChanged = false } = {}) {
    const out = [`a: ${describe(a)}`, `b: ${describe(b)}`,
        'Δ = (a − b) / b; * = |a − b| > 2 · max(sd) and > 3 %. Lower is better except "visible", "nodes", "frames during" and "frames/sec" (higher is better).']
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
                const sig = Math.abs(x.mean - y.mean) > 2 * Math.max(x.sd || 0, y.sd || 0) && Math.abs(p) > 3
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
