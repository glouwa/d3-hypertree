import { N }                    from '../data/n'
import { C, h2e, makeT, one }   from '../geometry/hyperbolic-math'

// A view with a good overview of the tree structure (api.overview, api.gotoOverview):
// the root at the bottom with the trunk coming in from there, the main branchings in
// the middle of the disk, the branches filling it.
//
// Computed on the S heaviest inner nodes (the structure; leaves and small branches
// don't move it), alternately until it settles (2-3 rounds):
//   - P: the root moved against the root wedge direction (down for a tree growing
//     up) until the centroid of S along that axis is in the middle of the disk; the
//     trunk stays upright (moving the centroid to the middle in both directions moved
//     balanced trees sideways)
//   - λ: the zoom at which the `fill` quantile (95 %) of the radii of S is at `fill`
// A huge polytomy (Coleoptera 16.1: Polyphaga with 7615 children) has no good view;
// λ then ends at its lower bound.
// Hand-set start views of the hypertree-of-life branch pages had the root at radius
// 0.6-0.9 and λ 0.1-0.22; this gives root radius 0.45-0.75 and λ 0.07-0.15 on the
// same trees (a little more of the tree in view).

export interface OverviewOptions {
    nodes?: number       // size of S (default 300)
    fill?:  number       // radius the branches reach (default .95)
    rounds?: number      // alternations of P and λ (default 6; settles after 2-3)
}

export interface OverviewView { P:C, λ:number }

export function overview(root:N, layout:(n:N, λ:number)=> void, orientation:number, λstart:number,
                         λbounds:[number, number], o:OverviewOptions = {}) : OverviewView {
    const count = o.nodes || 300, fill = o.fill || .95, rounds = o.rounds || 6
    const inner:N[] = []
    root.each((n:N)=> { if (n.children && n.children.length) inner.push(n) })
    inner.sort((a, b)=> b.precalc.layoutWeight - a.precalc.layoutWeight)
    const S = inner.slice(0, count)
    if (!S.length) return { P: { re:0, im:0 }, λ: λstart }

    // only S is needed: the layout goes down S and its ancestors, the children of the
    // other inner nodes are hidden meanwhile (a node's place depends on its ancestors and
    // the weights of its siblings, not on what is below it). The bisections lay the tree
    // out up to ~150 times; for all of it that took 4 s on a phone (Mammalia, 12000
    // nodes). The caller lays the tree out again for its view.
    const keep = new Set<N>()
    for (const n of S) for (let a:N = n; a && !keep.has(a); a = a.parent) keep.add(a)
    const hidden:[N, N[]][] = inner.filter(n=> !keep.has(n)).map(n=> [n, n.children])
    for (const [n] of hidden) n.children = undefined
    try {
        return search()
    }
    finally {
        for (const [n, c] of hidden) n.children = c
    }

    function search() : OverviewView {
    // start: the root moved against the direction the tree grows in (down)
    const down = { re: -Math.cos(orientation), im: -Math.sin(orientation) }
    const positions = (λ:number)=> { layout(root, λ); return S.map(n=> ({ re: n.layout.z.re, im: n.layout.z.im })) }
    const moved = (z:C, P:C)=> h2e(makeT(P, one), z)
    const quantile = (a:number[], f:number)=> { const s = a.slice().sort((x, y)=> x - y); return s[Math.floor(f * (s.length - 1))] }
    const MAX_R = .97
    const along = (p:number)=> ({ re: down.re * p, im: down.im * p })

    // P on the axis with the centroid of S (along the axis) in the middle (bisection)
    const center = (zs:C[], _P:C)=> {
        let lo = 0, hi = MAX_R
        for (let i = 0; i < 30; i++) {
            const p = (lo + hi) / 2
            let c = 0
            for (const z of zs) { const w = moved(z, along(p)); c += w.re * down.re + w.im * down.im }
            if (c < 0) lo = p; else hi = p
        }
        return along((lo + hi) / 2)
    }
    // λ with the fill quantile of the radii at fill (bisection in log λ)
    const fit = (P:C)=> {
        let lo = λbounds[0], hi = λbounds[1]
        for (let i = 0; i < 25; i++) {
            const λ = Math.sqrt(lo * hi)
            const r = quantile(positions(λ).map(z=> { const w = moved(z, P); return Math.hypot(w.re, w.im) }), fill)
            if (r < fill) lo = λ; else hi = λ
        }
        return Math.sqrt(lo * hi)
    }
    let λ = Math.min(λbounds[1], Math.max(λbounds[0], λstart))
    let P:C = { re: down.re * .5, im: down.im * .5 }
    for (let i = 0; i < rounds; i++) {
        const P2 = center(positions(λ), P)
        const λ2 = fit(P2)
        const settled = Math.hypot(P2.re - P.re, P2.im - P.im) < 1e-3 && Math.abs(λ2 - λ) < 1e-4
        P = P2; λ = λ2
        if (settled) break
    }
    return { P, λ }
    }
}
