import { N }               from '../data/n'
import { C, CaddC, CptoCk } from '../geometry/hyperbolic-math'
import { Projection }      from '../projection/projection'
import { LayerContext }    from '../view/layer'

// Geometry shared by the label layers (labels, emojis, labels-force, labels-placed):
// sizes toward the rim, offsets from the node, and the rest position of labels placed
// away from their node.
//
// The rest position of a label goes smoothly from "directly above its node" in the
// center to "outward, beyond its node" toward the rim; a label only leaves it when it
// would overlap another one. Outward is what the projection says (radial in the disk,
// up toward the border in the half-plane view).

export interface Box { x:number, y:number, w:number, h:number }   // center, size

// the room around a label's text in its background box, at the default captionHeight
// .05; paddingsFor: for any captionHeight (the box keeps its shape when an application
// sizes its labels, e.g. in screen pixels: until v2 the paddings stayed .08 / .02, so
// larger labels got relatively thin boxes, smaller ones thick ones)
export const paddingLeftRight = .08
export const paddingTopBottom = .02
export function paddingsFor(captionHeight:number) : { lr:number, tb:number } {
    return { lr: captionHeight * paddingLeftRight / .05, tb: captionHeight * paddingTopBottom / .05 }
}

// Size of labels and emojis: the layer option scale (a number or a function of the
// node, bound to the data; default 1) times the rim factor of geometry.shrinkAtRim:
// 'none' constant, 'damped' (default) from 1 in the center to 0.5 at the rim,
// 'full' like the links (to 0 at the rim). Times the growth of the tree while it zooms
// up from a point (Hypertree.animateUp: from 0 to 1; else 1).
export function rimScale(ctx:LayerContext, d:N) : number {
    const mode = ctx.model.geometry.shrinkAtRim
    const growth = ctx.hypertree ? ctx.hypertree.growth : 1
    return (mode === 'none' ? 1 : mode === 'full' ? d.distScale : d.dampedDistScale) * growth
}
export function sizeAt(ctx:LayerContext, scale:number | ((n:N)=> number) | undefined, d:N) : number {
    const s = scale === undefined || scale === null ? 1 : typeof scale === 'function' ? scale(d) : scale
    return rimScale(ctx, d) * s
}
// offsets (delta) are measured at the damped scale: factor for the actual rim scale
export const offsetFactor = (ctx:LayerContext, d:N)=> rimScale(ctx, d) / d.dampedDistScale

/** The offset that centers a label (its measured width precalc[cacheId]) on its node. */
export var bboxCenter = (d:N, cacheId = 'labelslen')=> {
    var w = d.precalc[cacheId]
    var h = .045
    console.assert(w)
    return { re:-w/2, im:h/3 }
}

/** The offset that puts a label's box beside its node, on the side away from the center. */
export var bboxOval = (d:N, cacheId = 'labelslen', θn = undefined)=> {
    var w = d.precalc[cacheId]
    var h = .045
    console.assert(w)
    const θ = θn ? θn.θ : d.cachep.θ
    const result = {
        re:(paddingLeftRight/2 + w/2) * Math.cos(θ) - w/2,
        im:(paddingTopBottom/2 + h/2) * Math.sin(θ) + h/3
    }
    console.assert(!!result.re)
    return result
}

/** The offset of a label from its node: outward by the node radius, then its box beside the node. */
export function labelOffset(ctx:LayerContext, d:N, cacheId = 'labelslen') : C {
    const r = ctx.model.geometry.nodeRadius(ctx.unitdisk, d) * d.distScale * 1.5
    return CaddC(CptoCk({ θ: d.cachep.θ, r }), bboxOval(d, cacheId))
}

/** The direction away from the center (unit vector, view coordinates). */
export function outward(n:N, projection:Projection) : C {
    return projection.outward(n.cache)
}

const smoothstep = (a:number, b:number, x:number)=> {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

/** 0 in the center (label above its node) .. 1 near the rim (label outward). */
export function rimness(n:N, projection:Projection) : number {
    return smoothstep(.3, .85, projection.rim(n.cache))
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
export function restCenter(n:N, w:number, h:number, gap:number, projection:Projection) : C {
    const t = rimness(n, projection)
    const above = besideNode(n, { re: 0, im: -1 }, w, h, gap)
    const out = besideNode(n, outward(n, projection), w, h, gap)
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
