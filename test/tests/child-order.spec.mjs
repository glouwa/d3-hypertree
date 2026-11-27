import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree, waitForStable } from './helpers.mjs'

// layout.childOrder 'balanced' (src/models/n/children-order.ts): the heaviest child in
// the middle, the others on the lighter side, so the heaviest path runs straight.

const tree = 'file=fixtures/filesystem.d3.json&labels=name'
const open = (page, childOrder) => openTree(page, `${tree}${childOrder ? `&layout=${encodeURIComponent(JSON.stringify({ childOrder }))}` : ''}`)

// per node with >= 2 children: the weight (precalc.angleWeight, the part of the wedge)
// left and right of the heaviest child
const sides = page => page.evaluate(() => {
    const out = []
    harness.ht.data.each(n => {
        const c = n.children
        if (!c || c.length < 2) return
        const w = x => x.precalc.angleWeight
        const max = Math.max(...c.map(w))
        // of several equally heavy children: the one with the most even sides
        let best = null
        c.forEach((x, h) => {
            if (w(x) !== max) return
            const left = c.slice(0, h).reduce((a, y) => a + w(y), 0)
            const right = c.slice(h + 1).reduce((a, y) => a + w(y), 0)
            if (!best || Math.abs(left - right) < Math.abs(best.left - best.right)) best = { left, right, middle: h }
        })
        const others = Math.max(...c.filter((x, i) => i !== best.middle).map(w))
        out.push({ ...best, others, count: c.length })
    })
    return out
})

// how much the way to the heaviest child turns: at every inner node the angle between
// the way in (from the parent) and the way out (to the heaviest child), measured where
// the node is moved to the origin (Möbius transformation: there geodesics are straight
// lines); the mean over all nodes. 0: the heaviest child goes straight on. Where two
// big children split, no order can avoid a turn (that is fine: not every clade is a
// spruce); the mean shows the nodes where balancing can help.
const turning = page => page.evaluate(() => {
    const sub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im })
    const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re })
    const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d } }
    const toOrigin = (p, z) => div(sub(z, p), sub({ re: 1, im: 0 }, mul({ re: p.re, im: -p.im }, z)))
    // the heaviest child; of several equally heavy ones the most centered (in a
    // balanced order the middle one)
    const heaviest = n => {
        const c = n.children, w = x => x.precalc.angleWeight, max = Math.max(...c.map(w))
        const side = i => Math.abs(c.slice(0, i).reduce((a, x) => a + w(x), 0) - c.slice(i + 1).reduce((a, x) => a + w(x), 0))
        let best = -1
        c.forEach((x, i) => { if (w(x) === max && (best < 0 || side(i) < side(best))) best = i })
        return c[best]
    }
    // every inner node below the root with >= 2 children: from its parent on to its
    // heaviest child
    let sum = 0, steps = 0
    harness.ht.data.each(n => {
        if (!n.parent || !n.children || n.children.length < 2) return
        const parent = n.parent, next = heaviest(n)
        const back = toOrigin(n.layout.z, parent.layout.z), out = toOrigin(n.layout.z, next.layout.z)
        // straight on: the way out points away from the way back
        let t = Math.abs(Math.atan2(out.im, out.re) - Math.atan2(-back.im, -back.re))
        if (t > Math.PI) t = 2 * Math.PI - t
        sum += t; steps++
    })
    return { mean: sum / steps, steps }
})

test('balanced: the heaviest child is in the middle, the sides weigh about the same', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, 'balanced')
    await waitForStable(page)
    const s = await sides(page)
    expect(s.length).toBeGreaterThan(100)
    // greedy: the sides differ by at most the heaviest of the other children
    for (const x of s) expect(Math.abs(x.left - x.right)).toBeLessThanOrEqual(x.others)
    // several children: the heaviest is not at an end
    const many = s.filter(x => x.count >= 3)
    expect(many.filter(x => x.middle > 0 && x.middle < x.count - 1).length / many.length).toBeGreaterThan(.95)
    expectNoErrors(errors)
})

test('balanced: the heaviest child goes on much straighter than with the data order', async ({ page }) => {
    // without the filter every node is laid out (culled nodes keep old positions)
    const openAll = childOrder => openTree(page, `${tree}&filter=off${childOrder ? `&layout=${encodeURIComponent(JSON.stringify({ childOrder }))}` : ''}`)
    await openAll(null)
    await waitForStable(page)
    const data = await turning(page)
    await openAll('balanced')
    await waitForStable(page)
    const balanced = await turning(page)
    if (process.env.DEBUG_ORDER) console.log('data', data, 'balanced', balanced)
    expect(balanced.steps).toBe(data.steps)
    expect(balanced.steps).toBeGreaterThan(100)
    expect(balanced.mean).toBeLessThan(data.mean * .5)
})

test('balanced: a trunk does not lean further and further to one side', async ({ page }) => {
    // along every trunk (from a node through its heaviest children) the turns (weight
    // left minus right of the heaviest child, in parts of all) add up to the lean; the
    // sides are swapped where the lean would grow, so it stays within the largest single
    // turn on the way (with the depth rule alone it grew on the trees of the Tree of Life)
    const errors = collectErrors(page)
    await open(page, 'balanced')
    await waitForStable(page)
    const worst = await page.evaluate(() => {
        const w = x => x.precalc.angleWeight
        let worst = 0, trunks = 0
        harness.ht.data.each(start => {
            if (start.parent && start.parent.children.length > 1) {
                const p = start.parent.children, max = Math.max(...p.map(w))
                if (w(start) === max && p.filter(x => w(x) === max).length === 1) return   // on its parent's trunk
            }
            trunks++
            let n = start, lean = 0, largest = 0
            while (n.children && n.children.length) {
                const c = n.children
                if (c.length > 1) {
                    const max = Math.max(...c.map(w))
                    // equally heavy children: which one the trunk follows is the library's
                    // choice (the first in the data order), not known here: the trunk ends
                    if (c.filter(x => w(x) === max).length > 1) break
                    const side = i => c.slice(0, i).reduce((a, x) => a + w(x), 0) - c.slice(i + 1).reduce((a, x) => a + w(x), 0)
                    const h = c.findIndex(x => w(x) === max)
                    const total = c.reduce((a, x) => a + w(x), 0)
                    const t = total ? side(h) / total : 0
                    lean += t; largest = Math.max(largest, Math.abs(t))
                    worst = Math.max(worst, Math.abs(lean) - largest)
                    n = c[h]
                }
                else n = c[0]
            }
        })
        return { worst, trunks }
    })
    expect(worst.trunks).toBeGreaterThan(10)
    expect(worst.worst).toBeLessThanOrEqual(1e-9)
    expectNoErrors(errors)
})

test('default: the children keep the data order', async ({ page }) => {
    await open(page, null)
    await waitForStable(page)
    const same = await page.evaluate(() => {
        let ok = true
        harness.ht.data.each(n => { if (n.children && n.data.children) ok = ok && n.children.every((c, i) => c.data === n.data.children[i]) })
        return ok
    })
    expect(same).toBe(true)
})

test('childOrder "alternating": as given on odd heights, reversed on even ones; configure goes back to the data order', async ({ page }) => {
    await open(page, 'alternating')
    const r = await page.evaluate(() => {
        const ht = harness.ht
        const check = mode => { let ok = true, flipped = 0; ht.data.each(n => {
            if (!n.children || n.children.length < 2) return
            const given = n.data.children, rev = mode === 'alternating' && n.height % 2 === 0
            const want = rev ? given.slice().reverse() : given
            ok = ok && n.children.every((c, i) => c.data === want[i]); if (rev) flipped++ }); return { ok, flipped } }
        const alt = check('alternating')
        ht.configure({ layout: { childOrder: 'data' } })
        const data = check('data')
        ht.configure({ layout: { childOrder: 'alternating' } })
        return { alt, data, again: check('alternating') }
    })
    expect(r.alt.ok).toBe(true)
    expect(r.alt.flipped).toBeGreaterThan(0)
    expect(r.data.ok).toBe(true)
    expect(r.again.ok).toBe(true)
})
