import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors, openTree } from './helpers.mjs'

// layout.multirowHighDegreeNodes (src/models/n/fan-weight.ts): the leaf children of a
// node with many of them in several rows (a staircase, fanRun(k) leaves per run); the
// node needs the angle of its runs (columns), not of its leaves. Default true; false:
// one row, every leaf its own angle.
// Tree: root with "fan" (100 leaf children: 11 per run, 10 runs) and "binary" (8 leaves).

const state = page => page.evaluate(() => {
    const ht = harness.ht, [fan, binary] = ht.data.children
    const width = n => { let w = n.layout.wedge.Ω - n.layout.wedge.α; while (w < 0) w += 2 * Math.PI; return w }
    return {
        fan:    { angle: fan.precalc.angleWeight, leaves: fan.precalc.layoutWeight, culling: fan.precalc.cullingWeight, run: fan.precalc.fanRun, width: width(fan) },
        binary: { angle: binary.precalc.angleWeight, leaves: binary.precalc.layoutWeight, width: width(binary) },
        L:      fan.children.map(c => c.layout.wedge.L),
        binaryL: binary.children.map(c => c.layout.wedge.L),
    }
})
const off = `layout=${encodeURIComponent(JSON.stringify({ multirowHighDegreeNodes: false }))}`

test('multirow (default): a fan weighs its columns, the leaf weights stay', async ({ page }) => {
    const errors = collectErrors(page)
    await openTree(page, 'gen=fan&n=100&depth=3&filter=off')
    const s = await state(page)
    expect(s.fan.run).toBe(11)
    expect(s.fan.angle).toBe(10)                       // ceil(100 / 11) runs
    expect(s.binary.angle).toBe(8)                     // no fan: the leaves
    expect(s.fan.leaves).toBe(100)                     // layoutWeight, culling: unchanged
    expect(s.fan.culling).toBeGreaterThanOrEqual(100)
    // the wedges in proportion to the angle weights
    expect(s.fan.width / s.binary.width).toBeCloseTo(10 / 8, 5)
    expectNoErrors(errors)
})

test('multirow: the first row at the link length, every further row .15 link lengths out', async ({ page }) => {
    await openTree(page, 'gen=fan&n=100&depth=3&filter=off')
    const s = await state(page)
    s.L.forEach((L, i) => expect(L).toBeCloseTo(.15 * (i % 11), 9))
    // inner children are not part of a staircase
    s.binaryL.forEach(L => expect(L).toBe(0))
})

test('multirowHighDegreeNodes false: one row, every leaf its own angle', async ({ page }) => {
    await openTree(page, `gen=fan&n=100&depth=3&filter=off&${off}`)
    const s = await state(page)
    expect(s.fan.angle).toBe(100)
    expect(s.fan.width / s.binary.width).toBeCloseTo(100 / 8, 5)
    s.L.forEach(L => expect(L).toBe(0))
    s.binaryL.forEach(L => expect(L).toBe(0))
})

test('small fans: two leaves as until v1 (each its angle, .1 apart), three leaves two columns', async ({ page }) => {
    const weights = async n => {
        await openTree(page, `gen=fan&n=${n}&depth=1&filter=off`)
        return page.evaluate(() => {
            const [fan, binary] = harness.ht.data.children
            return { fan: fan.precalc.angleWeight, binary: binary.precalc.angleWeight, L: fan.children.map(c => c.layout.wedge.L) }
        })
    }
    expect(await weights(2)).toEqual({ fan: 2, binary: 2, L: [0, .1] })
    expect(await weights(3)).toEqual({ fan: 2, binary: 2, L: [0, .15, 0] })   // runs of 2
})
