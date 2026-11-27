import { N }                          from '../data/n'
import { C, CktoCp, arcCenter }       from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'
import { toHalfPlane, viewToDisk, viewScale, infinityOf } from '../geometry/cayley'

// The compressed half-plane (docs/dev/GLATZHOFER-TRANSFORMATION.md, candidate A): the
// Cayley map to the upper half-plane (geometry/cayley.ts), then a compression of the
// half-plane into a rectangle
//
//   Y = y / (1 + y)                           the height: 0 at the rim, 1 at the gap
//   X = (A/2) · tanh( 2x / (A (1 + y)²) )     the width: ±A/2 at x = ±∞ (A: the aspect ratio)
//
// The rim of the disk (all leaves) is the top edge; the bottom, left and right edges
// are the one ideal point of the gap of the root wedge (x = ±∞ or y = ∞): no node
// lies on them. Along the center line the map is isotropic with the disk's scale at
// the center; off it the tanh squeezes and shears. Every node is in the picture (the
// map is onto the open rectangle), so every path to the root is too; the root's stem,
// the vertical ray to the gap, bends to the middle of the bottom edge. Layout, filter,
// the transformation and the navigation stay in the disk; pointer positions go back
// through the closed-form inverse.
//
// View coordinates: twice (X, Y − ½), so the rectangle is x ∈ ±A, y ∈ ±1 (the rim at
// y = −1 like the half-plane view, the gap at y = 1) and sizes at the center equal the
// disk's. A view position carries its disk position (disk), so the primitives need
// no inverse map.
type ViewPos = C & { disk?:C }

const EPS = 1e-9

export class GlatzhoferProjection implements Projection
{
    readonly kind = 'glatzhofer'
    readonly followsSize = true
    private g:C                    // the direction of the disk that goes to the gap (infinity)
    private A:number               // the aspect ratio (width : height) of the drawn box

    constructor(rootWedge:{ orientation:number, angle:number }, aspect = 1.6) {
        this.g = infinityOf(rootWedge)
        this.setAspect(aspect)
    }
    private setAspect(aspect:number) { this.A = Math.max(.2, Math.min(5, aspect || 1.6)) }
    /** The rectangle: height 2 (y ∈ ±1), this width (x ∈ ±A). */
    get width() : number { return 2 * this.A }
    get aspect() : number { return this.A }

    // the half-plane position (x, y) of a disk position; near the gap the map grows
    // without bound: a huge height is the gap itself
    private halfPlane(z:C) : C {
        const w = toHalfPlane(z, this.g)
        if (!isFinite(w.im) || w.im > 1e12) return { re: 0, im: 1e12 }
        if (!isFinite(w.re)) w.re = 0
        return w
    }
    private compress(w:C) : C {
        const A = this.A, s = 1 + w.im
        const X = (A / 2) * Math.tanh(2 * w.re / (A * s * s)), Y = w.im / s
        return { re: 2 * X, im: 2 * Y - 1 }
    }
    /** The local scale of the view per disk unit, 1 at the center (√det of the map times the Cayley scale). */
    private scale(z:C, w:C) : number {
        const s = 1 + w.im, u = 2 * w.re / (this.A * s * s)
        return 2 * viewScale(z, this.g) / (Math.cosh(u) * s * s)
    }

    toView(disk:C) : ViewPos {
        const v = this.compress(this.halfPlane(disk))
        return { re: v.re, im: v.im, disk: { re: disk.re, im: disk.im } }
    }
    toDisk(view:C) : C {
        const A = this.A
        const Y = Math.min(1 - EPS, Math.max(EPS, (view.im + 1) / 2))
        const y = Y / (1 - Y), s = 1 + y
        const t = Math.max(-1 + EPS, Math.min(1 - EPS, view.re / A))        // 2X / A
        const x = (A * s * s / 2) * Math.atanh(t)
        return viewToDisk({ re: x, im: y - 1 }, this.g)
    }

    project(nodes:N[]) : N[] {
        for (const n of nodes) {
            const z = { re: n.cache.re, im: n.cache.im }
            const w = this.halfPlane(z), v = this.compress(w)
            n.cacheDisk = z
            n.outOfView = false
            n.cache = <ViewPos>{ re: v.re, im: v.im, disk: z }
            n.cachep = CktoCp(n.cache)
            // sizes follow the local scale, never bigger than at the center (toward the
            // bottom the half-plane grows, the compression shrinks it again)
            n.distScale = Math.min(n.distScale * this.scale(z, w), 1)
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

    // a quadratic curve through the image of the arc's midpoint ('−': bent the other way)
    geodesic(a:ViewPos, b:ViewPos, curvature:ArcCurvature) : string {
        if (curvature === '0' || curvature === 'l') return `M ${a.re} ${a.im} L ${b.re} ${b.im}`
        const mid = this.toView(this.arcMiddle(this.diskOf(a), this.diskOf(b)))
        let cx = 2 * mid.re - (a.re + b.re) / 2, cy = 2 * mid.im - (a.im + b.im) / 2
        if (curvature === '-') { cx = a.re + b.re - cx; cy = a.im + b.im - cy }
        return `M ${a.re} ${a.im} Q ${cx} ${cy}, ${b.re} ${b.im}`
    }

    // the root's stem: the vertical ray x = x_root of the half-plane down to the gap,
    // which the compression bends to the middle of the bottom edge; a polyline of its
    // samples (the height doubling each step), ending at (0, 1)
    stem(root:ViewPos, curvature:ArcCurvature) : string {
        if (curvature === '0' || curvature === 'l') return `M ${root.re} ${root.im} L 0 1`
        const w = this.halfPlane(this.diskOf(root))
        let d = `M ${root.re} ${root.im}`
        for (let y = w.im * 2; y < 1e6; y *= 2) { const v = this.compress({ re: w.re, im: y }); d += ` L ${v.re} ${v.im}` }
        return d + ' L 0 1'
    }

    // small circles (the focus, the λ circle) approximately: the image of the center
    // and the radius by the local scale; large ones are no circles any more
    circle(center:C, r:number) {
        if (!(r > 0) || r > .5) return null
        const v = this.toView(center)
        return { cx: v.re, cy: v.im, r: r * this.scale(center, this.halfPlane(center)) }
    }

    outward(view:C) : C { return { re: 0, im: -1 } }                 // up, toward the rim
    // how far out: the disk radius of the position (a view position carries it)
    rim(view:ViewPos) : number {
        if (view.disk) return Math.hypot(view.disk.re, view.disk.im)
        return Math.min(1, Math.max(Math.abs(view.re) / this.A, Math.abs(view.im)))
    }

    // the rectangle with the aspect ratio of the drawn box, as high as diskSize of it
    // (x ∈ ±A, y ∈ ±1); the compression follows the aspect ratio
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        const aspect = width > 0 && height > 0 ? width / height : 1.6
        this.setAspect(aspect)
        const w = Math.round(1000 * aspect)
        return { viewBox: `0 0 ${w} 1000`, transform: `translate(${w / 2},500) scale(${500 * (diskSize || 1)})` }
    }
    // wide enough for any aspect ratio (A ≤ 5)
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -6).attr('y', -1.01).attr('width', 12).attr('height', 2.02) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-6, -1.5], [6, 1.5]] }
    background() {
        return { elementType: 'rect', className: 'background-rectangle',
                 create: (s:any)=> s.attr('x', -6).attr('y', -1).attr('width', 12).attr('height', 2).attr('fill', 'rgba(128,128,128,.07)') }
    }
    // the whole disk is in the picture: the overview's P as it is
    overviewClamp(P:C) : C { return P }
}
