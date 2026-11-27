import { N }                          from '../data/n'
import { C, CktoCp, arcCenter }       from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'
import { toHalfPlane, viewToDisk, viewScale, infinityOf } from '../geometry/cayley'

// The band (strip) model (docs/dev/GLATZHOFER-TRANSFORMATION.md, candidate B): the
// Cayley map to the half-plane (geometry/cayley.ts), then the complex logarithm
//
//   ξ = log w = ln|w| + i·arg w,   0 < arg w < π
//
// maps the half-plane conformally onto the strip 0 < Im ξ < π. The rim of the disk is
// the two long edges (the two halves of the half-plane's real axis), the gap of the
// root wedge (w = ∞) is the one end of the strip, the rim point opposite the gap
// (w = 0) the other. The geodesic from the center through the gap is the straight
// axis of the strip. It is the Schwarz–Christoffel rectangle with two corners at
// infinity (aspect ratio → ∞); conformal everywhere, the strip is infinitely long.
//
// View coordinates: the strip is drawn horizontally with height 2, y ∈ ±1 (the rim on
// the top and bottom edges), x = −(2/π)·ln|w| so the gap (the root's side, the stem) is
// at the left end and the leaves grow to the right; y = −(2/π)·(arg w − π/2). The disk's
// center is the origin. The drawn box shows x ∈ ±A (A its aspect ratio); nodes beyond
// get outOfView (no labels, emojis, symbols), their links are drawn. A view position
// carries its disk position (disk), so the primitives need no inverse map.
type ViewPos = C & { disk?:C }

const S = 2 / Math.PI
const MIN_R = 1e-12, MAX_R = 1e12

export class BandProjection implements Projection
{
    readonly kind = 'band'
    readonly followsSize = true
    private g:C                    // the direction of the disk that goes to the gap (the left end)
    private A = 1.6                // the aspect ratio of the drawn box: x ∈ ±A is in the picture
    private scale0:number

    constructor(rootWedge:{ orientation:number, angle:number }) {
        this.g = infinityOf(rootWedge)
        this.scale0 = this.scaleOf({ re: 0, im: 0 })
    }
    /** The strip: height 2 (y ∈ ±1); this much of its length is drawn (x ∈ ±aspect). */
    get aspect() : number { return this.A }

    // the half-plane position of a disk position, its radius bounded (the gap and the
    // point opposite are the ends of the strip)
    private halfPlane(z:C) : C {
        const w = toHalfPlane(z, this.g)
        if (!isFinite(w.re) || !isFinite(w.im)) return { re: 0, im: MAX_R }
        return w
    }
    private band(w:C) : C {
        const r = Math.min(MAX_R, Math.max(MIN_R, Math.hypot(w.re, w.im)))
        const φ = Math.atan2(w.im, w.re)                         // (0, π): 0 and π on the rim
        return { re: -S * Math.log(r), im: -S * (φ - Math.PI / 2) }
    }
    /** The local scale of the view per disk unit: the log's 1/|w| times the Cayley scale. */
    private scaleOf(z:C) : number {
        const w = this.halfPlane(z)
        return S * viewScale(z, this.g) / Math.max(MIN_R, Math.hypot(w.re, w.im))
    }

    toView(disk:C) : ViewPos {
        const v = this.band(this.halfPlane(disk))
        return { re: v.re, im: v.im, disk: { re: disk.re, im: disk.im } }
    }
    toDisk(view:C) : C {
        const r = Math.exp(-view.re / S)                                              // x = −S·ln r
        const φ = Math.min(Math.PI - 1e-9, Math.max(1e-9, Math.PI / 2 - view.im / S))  // y = −S·(φ − π/2)
        const w = { re: r * Math.cos(φ), im: r * Math.sin(φ) }
        return viewToDisk({ re: w.re, im: w.im - 1 }, this.g)
    }

    project(nodes:N[]) : N[] {
        for (const n of nodes) {
            const z = { re: n.cache.re, im: n.cache.im }
            const v = this.band(this.halfPlane(z))
            n.cacheDisk = z
            n.outOfView = Math.abs(v.re) > this.A + 1
            n.cache = <ViewPos>{ re: v.re, im: v.im, disk: z }
            n.cachep = CktoCp(n.cache)
            // sizes by the local scale relative to the center, never bigger than there
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
        if (!isFinite(r) || r > 1000 || d < 1e-12) return m          // (nearly) straight
        return { re: c.re + (m.re - c.re) * r / d, im: c.im + (m.im - c.im) * r / d }
    }

    // a quadratic curve through the image of the disk arc's midpoint: the image of the
    // geodesic for '-' (the default, as in the disk), mirrored for '+'
    geodesic(a:ViewPos, b:ViewPos, curvature:ArcCurvature) : string {
        if (curvature === '0' || curvature === 'l') return `M ${a.re} ${a.im} L ${b.re} ${b.im}`
        const mid = this.toView(this.arcMiddle(this.diskOf(a), this.diskOf(b)))
        let cx = 2 * mid.re - (a.re + b.re) / 2, cy = 2 * mid.im - (a.im + b.im) / 2
        if (curvature === '+') { cx = a.re + b.re - cx; cy = a.im + b.im - cy }
        return `M ${a.re} ${a.im} Q ${cx} ${cy}, ${b.re} ${b.im}`
    }

    // the root's stem: the geodesic to the gap, in the half-plane the vertical ray above
    // the root; in the band it bends onto the axis y = 0 and leaves at the left end
    stem(root:ViewPos, curvature:ArcCurvature) : string {
        const end = -(this.A + 1)
        if (curvature === '0' || curvature === 'l') return `M ${root.re} ${root.im} L ${end} 0`
        const w = this.halfPlane(this.diskOf(root))
        let d = `M ${root.re} ${root.im}`
        for (let y = w.im * 2; ; y *= 2) {
            const v = this.band({ re: w.re, im: y })
            if (v.re < end || y > MAX_R) break
            d += ` L ${v.re} ${v.im}`
        }
        return d + ` L ${end} 0`
    }

    // small circles (the focus, the λ circle) approximately: the image of the center
    // and the radius by the local scale
    circle(center:C, r:number) {
        if (!(r > 0) || r > .5) return null
        const v = this.toView(center)
        return { cx: v.re, cy: v.im, r: r * this.scaleOf(center) }
    }

    // away from the axis, toward the nearer long edge
    outward(view:C) : C { return { re: 0, im: view.im < 0 ? -1 : 1 } }
    // how far out: the disk radius of the position (a view position carries it)
    rim(view:ViewPos) : number {
        if (view.disk) return Math.hypot(view.disk.re, view.disk.im)
        return Math.min(1, Math.abs(view.im))
    }

    // the strip's height fills the box (y ∈ ±1), as much of its length as the aspect
    // ratio allows
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        const aspect = width > 0 && height > 0 ? width / height : 1.6
        this.A = Math.max(.2, Math.min(5, aspect))
        const w = Math.round(1000 * aspect)
        return { viewBox: `0 0 ${w} 1000`, transform: `translate(${w / 2},500) scale(${500 * (diskSize || 1)})` }
    }
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -20).attr('y', -1.01).attr('width', 40).attr('height', 2.02) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-20, -1.5], [20, 1.5]] }
    background() {
        return { elementType: 'rect', className: 'background-band',
                 create: (s:any)=> s.attr('x', -20).attr('y', -1).attr('width', 40).attr('height', 2).attr('fill', 'rgba(128,128,128,.07)') }
    }
    // the root (at P, |P| ≤ .5) stays in the picture: x = −(2/π)·ln 3 ≈ −.7 at most
    overviewClamp(P:C) : C { return P }
}
