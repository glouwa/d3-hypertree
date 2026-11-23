import { N } from '../../models/n/n'
import { C } from '../../models/transformation/hyperbolic-math'

// Geometry shared by the label layers that place labels away from their node:
// labels-force (relaxation, label-force-layer.ts) and labels-placed (candidate
// placement, label-placement-layer.ts).
//
// The rest position of a label goes smoothly from "directly above its node" in the
// center to "outward, beyond its node" toward the rim; a label only leaves it when
// it would overlap another one. Outward is radial in the disk, down (toward the
// border) in the half-plane view.

export interface Box { x:number, y:number, w:number, h:number }   // center, size

/** The direction away from the center (unit vector, view coordinates). */
export function outward(n:N, halfPlane:boolean) : C {
    if (halfPlane) return { re: 0, im: 1 }
    const r = Math.hypot(n.cache.re, n.cache.im)
    return r > 1e-9 ? { re: n.cache.re / r, im: n.cache.im / r } : { re: 0, im: -1 }
}

const smoothstep = (a:number, b:number, x:number)=> {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

/** 0 in the center (label above its node) .. 1 near the rim (label outward). */
export function rimness(n:N, halfPlane:boolean) : number {
    const r = halfPlane ? Math.max(0, n.cache.im) : Math.hypot(n.cache.re, n.cache.im)
    return smoothstep(.3, .85, r)
}

/** The box of a label: width from the measured text, height from the caption height. */
export function labelSize(n:N, lenprop:string, captionHeight:number, k:number) : { w:number, h:number } {
    const lines = String(n.precalc.label || '').split('\n').length
    return { w: (n.precalc[lenprop] || 0) * k, h: captionHeight * lines * k }
}

/** The center of a box at distance `gap` from the node in direction u (box edge to node). */
export function besideNode(n:N, u:C, w:number, h:number, gap:number) : C {
    const d = Math.abs(u.re) * w / 2 + Math.abs(u.im) * h / 2 + gap
    return { re: n.cache.re + u.re * d, im: n.cache.im + u.im * d }
}

/** The rest position (box center): above the node in the center, outward toward the rim. */
export function restCenter(n:N, w:number, h:number, gap:number, halfPlane:boolean) : C {
    const t = rimness(n, halfPlane)
    const above = besideNode(n, { re: 0, im: -1 }, w, h, gap)
    const out = besideNode(n, outward(n, halfPlane), w, h, gap)
    return { re: above.re + (out.re - above.re) * t, im: above.im + (out.im - above.im) * t }
}

/** Overlap of two boxes along x and y (both > 0: they overlap), with a margin. */
export function overlap(a:Box, b:Box, margin = 0) : { x:number, y:number } {
    return {
        x: (a.w + b.w) / 2 + margin - Math.abs(a.x - b.x),
        y: (a.h + b.h) / 2 + margin - Math.abs(a.y - b.y),
    }
}
export const overlapping = (a:Box, b:Box, margin = 0)=> { const o = overlap(a, b, margin); return o.x > 0 && o.y > 0 }

/** Distance from a point to a box (0 inside). */
export function distanceToBox(p:C, b:Box) : number {
    const dx = Math.max(0, Math.abs(p.re - b.x) - b.w / 2)
    const dy = Math.max(0, Math.abs(p.im - b.y) - b.h / 2)
    return Math.hypot(dx, dy)
}
