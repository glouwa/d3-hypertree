import { C, CktoCp } from './hyperbolic-math'
import { N }         from '../n/n'

// Rectangular view: the upper half-plane model via the Cayley transform (prototype,
// geometry.halfPlane). Layout, filter, transformation and interaction stay in the
// disk; only the drawn positions are mapped at the end of the update pipeline and
// pointer input is mapped back at the start (docs/dev/MODERNIZATION.md, "Rectangular
// view with the Cayley transform").
//
//   disk z  ->  half-plane w = i·(1 + z) / (1 − z)        (z = 0 -> w = i)
//   w       ->  view  (Re w, 1 − Im w)                     (the boundary Im w = 0 at y = 1)
//
// So the view shows Re w in [−a, a] (a: half the width of the rectangle) and
// Im w in [0, ~2], the center of the disk in the middle, the disk border along the
// bottom edge. The disk is rotated first so that the gap of the root wedge (no nodes)
// goes to infinity above (g, infinityOf).

// g: the direction of the disk that goes to infinity (|g| = 1; default z = 1). The
// tree puts it into the gap of the root wedge, where there are no nodes (infinityOf).
const ONE = { re: 1, im: 0 }
const rotate = (z:C, g:C) : C => ({ re: z.re * g.re - z.im * g.im, im: z.re * g.im + z.im * g.re })
const unrotate = (z:C, g:C) : C => ({ re: z.re * g.re + z.im * g.im, im: z.im * g.re - z.re * g.im })

export function toHalfPlane(z:C, g:C = ONE) : C {
    z = unrotate(z, g)
    const d = (1 - z.re) * (1 - z.re) + z.im * z.im
    return { re: -2 * z.im / d, im: (1 - z.re * z.re - z.im * z.im) / d }
}

export function toView(z:C, g:C = ONE) : C {
    const w = toHalfPlane(z, g)
    return { re: w.re, im: 1 - w.im }
}

/** The direction that goes to infinity: the middle of the gap of the root wedge. */
export function infinityOf(rootWedge:{ orientation:number, angle:number }) : C {
    const a = rootWedge ? rootWedge.orientation + Math.PI : Math.PI / 2
    return { re: Math.cos(a), im: Math.sin(a) }
}

/** A point of the view (pointer position) back into the disk: z = (w − i) / (w + i). */
export function viewToDisk(p:C, g:C = ONE) : C {
    const wr = p.re, wi = 1 - p.im                   // w
    const nr = wr, ni = wi - 1                         // w − i
    const dr = wr, di = wi + 1                         // w + i
    const d = dr * dr + di * di
    return rotate({ re: (nr * dr + ni * di) / d, im: (ni * dr - nr * di) / d }, g)
}

/** Local scale of the map |dw/dz| = 2 / |1 − z|²: sizes in the view. */
export function viewScale(z:C, g:C = ONE) : number {
    z = unrotate(z, g)
    return 2 / ((1 - z.re) * (1 - z.re) + z.im * z.im)
}

// nodes above this height (Im w) are outside the view and not drawn: near z = 1 the
// map grows without bound
const maxHeight = 3

/**
 * Maps the drawn nodes of a frame into the view (call after culling): keeps the disk
 * position in n.cacheDisk (interaction), sets n.cache and the derived strings to the
 * view position and multiplies the distance scale with the scale of the map.
 * Returns the nodes that are inside the view (the root always stays first).
 */
export function mapToView(nodes:N[], g:C = ONE) : N[] {
    const visible = []
    for (const n of nodes) {
        const z = { re: n.cache.re, im: n.cache.im }
        const w = toHalfPlane(z, g)
        if (w.im > maxHeight && n.parent) continue
        n.cacheDisk = z
        n.cache = { re: w.re, im: 1 - w.im }
        n.cachep = CktoCp(n.cache)
        n.distScale = n.distScale * viewScale(z, g)
        n.dampedDistScale = n.distScale * (.5 / n.distScale + .5)
        n.strCache = `${n.cache.re} ${n.cache.im}`
        n.transformStrCache = ` translate(${n.strCache})`
        n.scaleStrText = ` scale(${n.dampedDistScale})`
        visible.push(n)
    }
    return visible
}

/** The disk position of a node (n.cache holds the view position in the half-plane view). */
export const diskPos = (n:N) : C => n.cacheDisk || n.cache
