import { C, CktoCp } from './hyperbolic-math'
import { N }         from '../data/n'

// Rectangular view: the upper half-plane model via the Cayley transform (prototype,
// geometry.halfPlane). Layout, filter, transformation and interaction stay in the
// disk; only the drawn positions are mapped at the end of the update pipeline and
// pointer input is mapped back at the start (docs/dev/MODERNIZATION.md, "Rectangular
// view with the Cayley transform").
//
//   disk z  ->  half-plane w = i·(1 + z) / (1 − z)        (z = 0 -> w = i)
//   w       ->  view  (Re w, Im w − 1)                     (the boundary Im w = 0 at y = −1)
//
// So the view shows Re w in [−a, a] (a: half the width of the rectangle) and
// Im w in [0, ~2], the center of the disk in the middle, the disk border along the
// top edge. The disk is rotated first so that the gap of the root wedge (no nodes,
// the stem) goes to infinity below (g, infinityOf): like the disk, the root is at the
// bottom with its stem and the tree grows up to the border, left and right as in the
// disk (the view draws w with y downward, as the disk is drawn). In the usual upright
// orientation (y up) that is the lower half-plane, conj(w): the grid of the background
// labels it so, (0,0) on the border, (0,−1) the center of the disk.
// (Until then the view was (Re w, 1 − Im w): the border at the bottom, the root at
// the very top and its stem upward out of the view.)

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
    return { re: w.re, im: w.im - 1 }
}

/** The view y of the border (Im w = 0) and the view position for a height Im w. */
export const BORDER_Y = -1
export const viewY = (imw:number) : number => imw - 1

/**
 * The image of the disk circle |z − c| = r in the view: a Möbius map takes circles to
 * circles, so it is the circle through the images of three of its points. null when it
 * goes through the point at infinity (a straight line in the view).
 */
export function circleToView(c:C, r:number, g:C = ONE) : { cx:number, cy:number, r:number } | null {
    const p = [0, 2 * Math.PI / 3, 4 * Math.PI / 3].map(a=> toView({ re: c.re + r * Math.cos(a), im: c.im + r * Math.sin(a) }, g))
    const [a, b, d] = p
    const den = 2 * (a.re * (b.im - d.im) + b.re * (d.im - a.im) + d.re * (a.im - b.im))
    if (!isFinite(den) || Math.abs(den) < 1e-12) return null
    const a2 = a.re * a.re + a.im * a.im, b2 = b.re * b.re + b.im * b.im, d2 = d.re * d.re + d.im * d.im
    const cx = (a2 * (b.im - d.im) + b2 * (d.im - a.im) + d2 * (a.im - b.im)) / den
    const cy = (a2 * (d.re - b.re) + b2 * (a.re - d.re) + d2 * (b.re - a.re)) / den
    const rad = Math.hypot(a.re - cx, a.im - cy)
    return isFinite(rad) ? { cx, cy, r: rad } : null
}

/** The direction that goes to infinity: the middle of the gap of the root wedge. */
export function infinityOf(rootWedge:{ orientation:number, angle:number }) : C {
    const a = rootWedge ? rootWedge.orientation + Math.PI : Math.PI / 2
    return { re: Math.cos(a), im: Math.sin(a) }
}

/** A point of the view (pointer position) back into the disk: z = (w − i) / (w + i). */
export function viewToDisk(p:C, g:C = ONE) : C {
    const wr = p.re, wi = p.im + 1                   // w
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

// nodes beyond this height (Im w; below the view) are outside the view: no labels,
// emojis, symbols for them (n.outOfView). They are still mapped: links of visible
// children go down to them.
const maxHeight = 3
// near the direction to infinity the map grows without bound: limit the height
const maxDrawnHeight = 1e6

/**
 * Maps the visible nodes of a frame into the view (call after culling): keeps the disk
 * position in n.cacheDisk (interaction), sets n.cache and the derived strings to the
 * view position and multiplies the distance scale with the scale of the map (capped).
 * Every node is mapped (a link needs both ends in the view coordinates); nodes far
 * below the view (toward infinity) get n.outOfView.
 */
export function mapToView(nodes:N[], g:C = ONE) : N[] {
    for (const n of nodes) {
        const z = { re: n.cache.re, im: n.cache.im }
        const w = toHalfPlane(z, g)
        if (!(w.im < maxDrawnHeight)) { w.im = maxDrawnHeight; if (!isFinite(w.re)) w.re = 0 }
        n.outOfView = w.im > maxHeight
        n.cacheDisk = z
        n.cache = { re: w.re, im: viewY(w.im) }
        n.cachep = CktoCp(n.cache)
        // sizes (disks, link widths, labels): the scale of the map, relative to the
        // center (|dw/dz| = 2 there), but never bigger than in the center: in the
        // half-plane sizes grow with the height, which made links and labels below
        // the center (the ancestors) huge
        n.distScale = Math.min(n.distScale * viewScale(z, g) / 2, 1)
        n.dampedDistScale = n.distScale * (.5 / n.distScale + .5)
        n.strCache = `${n.cache.re} ${n.cache.im}`
        n.transformStrCache = ` translate(${n.strCache})`
        n.scaleStrText = ` scale(${n.dampedDistScale})`
    }
    return nodes
}

/** The disk position of a node (n.cache holds the view position in the half-plane view). */
export const diskPos = (n:N) : C => n.cacheDisk || n.cache
