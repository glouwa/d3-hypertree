import { N }                          from '../data/n'
import { C, CktoCp, arcCenter }       from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'
import { toHalfPlane, viewToDisk, viewScale, infinityOf } from '../geometry/cayley'

// The half band: the Cayley half-plane (geometry/cayley.ts) under the inverse hyperbolic
// cosine
//
//   ξ = arccosh w,   Re ξ > 0, 0 < Im ξ < π
//
// maps the half-plane conformally onto the half strip (cosh maps the half strip onto
// the half-plane). The rim of the disk lies on three edges: the closed end (Re ξ = 0,
// the rim points −1 < Re w < 1 around the point opposite the gap) and the two long
// edges (Re w > 1 and Re w < −1); the gap of the root wedge (w = ∞) is the open end at
// infinity. It is the Schwarz–Christoffel rectangle with one pair of corners at
// infinity, between the rectangle (all four corners finite) and the band (both pairs
// at infinity). Conformal everywhere.
//
// View coordinates: height 2 (y ∈ ±1, the long rim edges), x = −(2/π)·(Re ξ − c₀) with
// c₀ = arccosh i = ln(1 + √2), so the disk's center is the origin, the closed rim end
// is at x = (2/π)·c₀ ≈ .56 on the right and the gap (the stem) is at the left end at
// infinity; y = −(2/π)·(Im ξ − π/2). The drawn box is placed so that its right edge is
// the closed end; nodes left of the box get outOfView. A view position carries its
// disk position (disk).
type ViewPos = C & { disk?:C }

const S = 2 / Math.PI
const C0 = Math.log(1 + Math.SQRT2)        // Re arccosh(i)
export const HALF_BAND_END = S * C0        // the view x of the closed end
const MAX_RE = 30                          // Re ξ beyond: the gap itself

const csqrt = (z:C) : C => {               // principal square root
    const r = Math.hypot(z.re, z.im), re = Math.sqrt(Math.max(0, (r + z.re) / 2)), im = Math.sqrt(Math.max(0, (r - z.re) / 2))
    return { re, im: z.im < 0 ? -im : im }
}
/** arccosh w for Im w > 0: Re ≥ 0, 0 < Im < π. */
function acosh(w:C) : C {
    const s = csqrt({ re: w.re * w.re - w.im * w.im - 1, im: 2 * w.re * w.im })
    let a = { re: w.re + s.re, im: w.im + s.im }
    if (Math.hypot(a.re, a.im) < 1) a = { re: w.re - s.re, im: w.im - s.im }
    return { re: Math.min(MAX_RE, Math.log(Math.hypot(a.re, a.im))), im: Math.atan2(a.im, a.re) }
}

export class HalfBandProjection implements Projection
{
    readonly kind = 'half-band'
    readonly followsSize = true
    private g:C                    // the direction of the disk that goes to the gap (the open end)
    private A = 1.6                // the aspect ratio of the drawn box
    private scale0:number

    constructor(rootWedge:{ orientation:number, angle:number }) {
        this.g = infinityOf(rootWedge)
        this.scale0 = this.scaleOf({ re: 0, im: 0 })
    }
    /** The aspect ratio of the drawn box: it shows x from end − 2·aspect to the closed end. */
    get aspect() : number { return this.A }
    /** The view x of the closed rim end. */
    get end() : number { return HALF_BAND_END }
    /** The view x of the left edge of the drawn box. */
    get left() : number { return HALF_BAND_END - 2 * this.A }

    private halfPlane(z:C) : C {
        const w = toHalfPlane(z, this.g)
        if (!isFinite(w.re) || !isFinite(w.im)) return { re: 0, im: 1e12 }
        return w
    }
    private strip(w:C) : C {
        const ξ = acosh(w)
        return { re: -S * (ξ.re - C0), im: -S * (ξ.im - Math.PI / 2) }
    }
    /** The local scale of the view per disk unit: |dξ/dw| = 1/|√(w² − 1)| times the Cayley scale. */
    private scaleOf(z:C) : number {
        const w = this.halfPlane(z)
        const d = Math.hypot(w.re * w.re - w.im * w.im - 1, 2 * w.re * w.im)
        return S * viewScale(z, this.g) / Math.max(1e-12, Math.sqrt(d))
    }

    toView(disk:C) : ViewPos {
        const v = this.strip(this.halfPlane(disk))
        return { re: v.re, im: v.im, disk: { re: disk.re, im: disk.im } }
    }
    toDisk(view:C) : C {
        const x = Math.max(0, -view.re / S + C0), y = Math.min(Math.PI - 1e-9, Math.max(1e-9, Math.PI / 2 - view.im / S))
        const w = { re: Math.cosh(x) * Math.cos(y), im: Math.sinh(x) * Math.sin(y) }   // cosh(x + iy)
        return viewToDisk({ re: w.re, im: Math.max(1e-12, w.im) - 1 }, this.g)
    }

    project(nodes:N[]) : N[] {
        for (const n of nodes) {
            const z = { re: n.cache.re, im: n.cache.im }
            const v = this.strip(this.halfPlane(z))
            n.cacheDisk = z
            n.outOfView = v.re < this.left - 1
            n.cache = <ViewPos>{ re: v.re, im: v.im, disk: z }
            n.cachep = CktoCp(n.cache)
            n.distScale = Math.min(n.distScale * this.scaleOf(z) / this.scale0, 1)
            n.dampedDistScale = n.distScale * (.5 / n.distScale + .5)
            n.strCache = `${n.cache.re} ${n.cache.im}`
            n.transformStrCache = ` translate(${n.strCache})`
            n.scaleStrText = ` scale(${n.dampedDistScale})`
        }
        return nodes
    }

    private diskOf(v:ViewPos) : C { return v.disk || this.toDisk(v) }

    /** The midpoint of the disk geodesic from a to b (the circle orthogonal to the rim). */
    private arcMiddle(a:C, b:C) : C {
        const m = { re: (a.re + b.re) / 2, im: (a.im + b.im) / 2 }
        const arc = arcCenter(a, b), c = arc.c
        const r = Math.hypot(a.re - c.re, a.im - c.im)
        const d = Math.hypot(m.re - c.re, m.im - c.im)
        if (!isFinite(r) || r > 1000 || d < 1e-12) return m
        return { re: c.re + (m.re - c.re) * r / d, im: c.im + (m.im - c.im) * r / d }
    }

    geodesic(a:ViewPos, b:ViewPos, curvature:ArcCurvature) : string {
        if (curvature === '0' || curvature === 'l') return `M ${a.re} ${a.im} L ${b.re} ${b.im}`
        const mid = this.toView(this.arcMiddle(this.diskOf(a), this.diskOf(b)))
        let cx = 2 * mid.re - (a.re + b.re) / 2, cy = 2 * mid.im - (a.im + b.im) / 2
        if (curvature === '+') { cx = a.re + b.re - cx; cy = a.im + b.im - cy }
        return `M ${a.re} ${a.im} Q ${cx} ${cy}, ${b.re} ${b.im}`
    }

    // the root's stem: the geodesic to the gap, in the half-plane the vertical ray above
    // the root; here it bends onto the axis y = 0 and leaves at the open (left) end
    stem(root:ViewPos, curvature:ArcCurvature) : string {
        const end = this.left - 1
        if (curvature === '0' || curvature === 'l') return `M ${root.re} ${root.im} L ${end} 0`
        const w = this.halfPlane(this.diskOf(root))
        let d = `M ${root.re} ${root.im}`
        for (let y = w.im * 2; y < 1e12; y *= 2) {
            const v = this.strip({ re: w.re, im: y })
            if (v.re < end) break
            d += ` L ${v.re} ${v.im}`
        }
        return d + ` L ${end} 0`
    }

    circle(center:C, r:number) {
        if (!(r > 0) || r > .5) return null
        const v = this.toView(center)
        return { cx: v.re, cy: v.im, r: r * this.scaleOf(center) }
    }

    // toward the nearest rim edge: the closed end on the right, else the nearer long edge
    outward(view:C) : C {
        const toEnd = HALF_BAND_END - view.re, toEdge = 1 - Math.abs(view.im)
        return toEnd < toEdge ? { re: 1, im: 0 } : { re: 0, im: view.im < 0 ? -1 : 1 }
    }
    rim(view:ViewPos) : number {
        if (view.disk) return Math.hypot(view.disk.re, view.disk.im)
        return Math.min(1, Math.max(Math.abs(view.im), 1 - (HALF_BAND_END - view.re)))
    }

    // the strip's height fills the box (y ∈ ±1); the box's right edge is the closed end
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        const aspect = width > 0 && height > 0 ? width / height : 1.6
        this.A = Math.max(.2, Math.min(5, aspect))
        const w = Math.round(1000 * aspect), k = 500 * (diskSize || 1)
        return { viewBox: `0 0 ${w} 1000`, transform: `translate(${w - k * HALF_BAND_END - (1000 - 2 * k) / 2},500) scale(${k})` }
    }
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -20).attr('y', -1.01).attr('width', 20 + HALF_BAND_END + .01).attr('height', 2.02) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-20, -1.5], [HALF_BAND_END + .5, 1.5]] }
    background() {
        return { elementType: 'rect', className: 'background-band',
                 create: (s:any)=> s.attr('x', -20).attr('y', -1).attr('width', 20 + HALF_BAND_END).attr('height', 2).attr('fill', 'rgba(128,128,128,.07)') }
    }
    overviewClamp(P:C) : C { return P }
}
