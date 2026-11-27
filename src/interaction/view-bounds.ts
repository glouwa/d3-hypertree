// interaction.keepTreeInView (default true): the center of the view never lies beyond
// the tip of the tree, so dragging, pinching and the wheel can't leave the tree behind
// (a view of empty disk with the tree bunched at the rim).
//
// root*: where the line from the center through the root meets the unit circle. The
// node nearest to the center decides. It is a tip when the tree ends there, seen from
// the center: a leaf (no visible children) whose parent lies behind it, within
// TIP_ANGLE of the direction away from the center. An inner node (a trunk passing
// beside the center) or a leaf with its parent beside it is no tip: the view is valid.
// A tip must lie outside the circle with the diameter center–root* (the Thales circle,
// |n − root*/2| ≥ 1/2): the tree reaches past the center, seen from the root. Valid: a
// leaf exactly in the center; invalid: the nearest leaf short of the center with its
// branch behind it.
//
// The root end: the center never lies in the root's stem gap (the part of the circle
// around the root that layout.rootWedge leaves free, where the stem is drawn): the
// direction from the root to the center stays at least half the gap away from the
// stem's direction. The gap's angle at the root is the layout's: a Möbius transformation
// keeps angles. So the root can't be dragged past the center in the tree's direction
// (the tree bunched at the rim, the center on the stem); beside the center it can.
//
// A violation is not blocked but corrected: the view is shifted by the smallest amount
// that makes it valid, found by growing steps, then by bisection: a tip moves toward
// the center along the axis (−root*), the root along the stem's direction (the center
// enters the fan of the tree). The movement across stays, so the tree slides along the
// boundary. Only the
// translation P is corrected, never the zoom (λ is bounded by interaction.λbounds and
// minFill): zooming out around a point off the center moves the tree, the correction
// keeps it in the view. Only for the user's interactions (dragging, pinching, the
// wheel); animations (goto, the start view) are not limited.
//
// Everything is computed in the disk model (the transformation, P and root* live
// there). The disk view only: the half-plane view shows a rectangle whose focus (the
// image of the disk's center) is no visible point, a tree beyond it looks fine there.
//
// Cost: the check reads the positions the filter computed (O(N visible)); the
// correction transforms the visible nodes ~15 times (the search), then the filter
// runs again with the corrected P (view/unitdisk.ts frame).

import { N }                      from '../data/n'
import { C, compose, shift, maxR } from '../geometry/hyperbolic-math'
import { diskPos }                from '../geometry/cayley'

/** What the view bounds need of the unit disk. */
export interface ViewBoundsHost {
    args: {
        data?: N
        transformation: { state: { P:C, θ:C, λ:number }, transformPoint: (p:C)=> C }
        transform: (n:N)=> C
        model: { interaction: { keepTreeInView: boolean }, layout: { rootWedge: { orientation:number, angle:number } } }
        projection: { kind: string }
    }
    cache: { unculledNodes: N[] }
    isDraging: boolean
    isWheeling: boolean
}

// a leaf is a tip when its parent lies within this angle of the direction away from
// the center (60°: a branch ending straight before the center has it at 0°, a leaf
// beside the trunk at about 90°)
const TIP_ANGLE = Math.PI / 3
const COS_TIP = Math.cos(TIP_ANGLE)
const BISECTION_STEPS = 8
const EPS = 1e-3
const CENTER_EPS = 1e-4
// the root rule's tolerance (radians) and the layout distance of the probe that gives
// the stem's direction at the root (short: the direction is exact at the root only)
const ANGLE_EPS = .01
const STEM_PROBE = .02

/** The tree ends at n, seen from the center: a leaf (parent given, no visible child) with its parent behind it. */
export function isTip(n:C, parent:C | null, hasVisibleChild:boolean) : boolean {
    const r = Math.hypot(n.re, n.im)
    if (r < CENTER_EPS || !parent || hasVisibleChild) return false
    const ax = n.re / r, ay = n.im / r                    // away from the center
    const dx = parent.re - n.re, dy = parent.im - n.im, d = Math.hypot(dx, dy)
    return d < 1e-9 || (dx * ax + dy * ay) / d >= COS_TIP
}

/**
 * How far the view is from invalid, in disk units (≥ 0 valid): a tip's distance
 * beyond the Thales circle of center–root*; 1 for a node that is no tip.
 */
export function viewMargin(n:C, parent:C | null, hasVisibleChild:boolean, root:C) : number {
    if (!isTip(n, parent, hasVisibleChild)) return 1
    const r = Math.hypot(root.re, root.im)
    if (r < 1e-6) return 1
    const mx = root.re / r / 2, my = root.im / r / 2      // the middle of center–root*
    return Math.hypot(n.re - mx, n.im - my) - .5
}

/**
 * The root rule's margin (radians, ≥ 0 valid): the angle between the direction from
 * the root to the center and the stem's direction, minus half the stem gap
 * (2π − rootWedge.angle). 1 with the root in the center.
 */
export function rootMargin(rootPos:C, stemDir:C, wedgeAngle:number) : number {
    const r = Math.hypot(rootPos.re, rootPos.im)
    if (r < CENTER_EPS) return 1
    const cos = (-rootPos.re * stemDir.re - rootPos.im * stemDir.im) / r
    return Math.acos(Math.max(-1, Math.min(1, cos))) - (2 * Math.PI - wedgeAngle) / 2
}

// the stem's direction at the root in the view: a probe a little way along the stem in
// the layout (opposite to the wedge's orientation), transformed
function stemDirection(ud:ViewBoundsHost, rootPos:C) : C | null {
    const o = ud.args.model.layout.rootWedge.orientation + Math.PI
    const p = ud.args.transformation.transformPoint({ re: STEM_PROBE * Math.cos(o), im: STEM_PROBE * Math.sin(o) })
    const dx = p.re - rootPos.re, dy = p.im - rootPos.im, d = Math.hypot(dx, dy)
    return d < 1e-9 ? null : { re: dx / d, im: dy / d }
}

function currentRootMargin(ud:ViewBoundsHost) : number {
    const root = ud.args.data
    const stem = stemDirection(ud, diskPos(root))
    return stem ? rootMargin(diskPos(root), stem, ud.args.model.layout.rootWedge.angle) : 1
}

// the visible nodes (the root too), the visible parent of a node and whether it has a visible child
function visible(ud:ViewBoundsHost) : { nodes:N[], parent:(n:N)=> N | null, hasChild:(n:N)=> boolean } {
    const root = ud.args.data
    const set = new Set<N>(ud.cache.unculledNodes.filter(n=> !n.isOut))
    if (root) set.add(root)
    return {
        nodes: [...set],
        parent: n=> n.parent && set.has(n.parent) ? n.parent : null,
        hasChild: n=> !!n.children && n.children.some(c=> set.has(c)),
    }
}

function nearestTo(nodes:N[], pos:(n:N)=> C) : { n:N, p:C } | null {
    let best:N = null, bestPos:C = null, d0 = Infinity
    for (const n of nodes) {
        const p = pos(n), d = Math.hypot(p.re, p.im)
        if (d < d0) { d0 = d; best = n; bestPos = p }
    }
    return best ? { n: best, p: bestPos } : null
}

/**
 * The margin of the current view, from the positions the filter computed (null: no
 * tree): the smaller of the tip's (disk units) and the root's (radians).
 */
export function currentViewMargin(ud:ViewBoundsHost) : number | null {
    const root = ud.args.data
    if (!root || !root.cache) return null
    return Math.min(currentTipMargin(ud), currentRootMargin(ud))
}

function currentTipMargin(ud:ViewBoundsHost) : number {
    const root = ud.args.data
    const v = visible(ud)
    const near = nearestTo(v.nodes, diskPos)
    if (!near) return 1
    const parent = v.parent(near.n)
    return viewMargin(near.p, parent ? diskPos(parent) : null, v.hasChild(near.n), diskPos(root))
}

/**
 * After an interaction set the transformation and the filter ran: corrects P if the
 * view is invalid. Returns true if P changed (the filter has to run again).
 */
export function keepTreeInView(ud:ViewBoundsHost) : boolean {
    if (!ud.args.model.interaction.keepTreeInView || ud.args.projection.kind !== 'disk') return false
    if (!ud.isDraging && !ud.isWheeling) return false
    const root = ud.args.data
    if (!root || !root.cache) return false
    const rootViolated = currentRootMargin(ud) < -ANGLE_EPS
    if (!rootViolated && currentTipMargin(ud) >= -EPS) return false

    const v = visible(ud)
    const state = ud.args.transformation.state
    const P0 = { re: state.P.re, im: state.P.im }
    const wedge = ud.args.model.layout.rootWedge.angle

    // what moves and where to: the root along the stem's direction (the root rule, first:
    // the tree then lies around the center); else the tip toward the center along −root*
    // (the only direction that is right wherever the tip is: straight out of the circle
    // would be arbitrary for a tip near the circle's middle)
    let from:C, dx:number, dy:number
    const rootNow = diskPos(root)
    if (rootViolated) {
        const stem = stemDirection(ud, rootNow)
        from = { re: rootNow.re, im: rootNow.im }
        dx = stem.re; dy = stem.im
    }
    else {
        const near = nearestTo(v.nodes, diskPos)
        from = { re: near.p.re, im: near.p.im }
        const rr = Math.hypot(rootNow.re, rootNow.im)
        dx = -rootNow.re / rr; dy = -rootNow.im / rr
    }

    // the margin of the violated rule after the view is shifted so `from` moves s along (dx, dy)
    const marginAt = (s:number)=> {
        state.P.re = P0.re; state.P.im = P0.im
        const to = maxR({ re: from.re + s * dx, im: from.im + s * dy }, .95)
        const t = compose(state, shift(state, from, to))
        state.P.re = t.P.re; state.P.im = t.P.im
        const positions = new Map<N, C>()
        const pos = (n:N)=> { let p = positions.get(n); if (!p) positions.set(n, p = ud.args.transform(n)); return p }
        if (rootViolated) {
            const stem = stemDirection(ud, pos(root))
            return stem ? rootMargin(pos(root), stem, wedge) : 1
        }
        const nearest = nearestTo(v.nodes, pos)
        const parent = v.parent(nearest.n)
        return viewMargin(nearest.p, parent ? pos(parent) : null, v.hasChild(nearest.n), pos(root))
    }

    // the first valid shift: growing steps from the smallest (the margin along the way
    // is not monotone: another tip may take over for a while), then the smallest valid
    // shift by bisection (lo invalid, hi valid)
    let lo = 0, hi = Math.max(.01, Math.hypot(from.re, from.im) / 2), found = false
    for (let i = 0; i < 20 && !found; i++) {
        if (marginAt(hi) >= 0) found = true; else { lo = hi; hi *= 1.3 }
    }
    if (!found) {                                           // no valid shift: the view stays
        state.P.re = P0.re; state.P.im = P0.im
        return false
    }
    for (let i = 0; i < BISECTION_STEPS; i++) {
        const m = (lo + hi) / 2
        if (marginAt(m) >= 0) hi = m; else lo = m
    }
    marginAt(hi)                                            // leaves state.P at the shift hi
    return state.P.re !== P0.re || state.P.im !== P0.im
}
