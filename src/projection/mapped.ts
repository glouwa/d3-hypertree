import { N }                          from '../data/n'
import { C, CktoCp, arcCenter }       from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'
import { infinityOf }                 from '../geometry/cayley'

// The base of the projections given by a closed-form map of the disk into the plane
// (projection/euclidean.ts): a subclass supplies the map, its inverse and the local
// scale; this class maps the nodes, draws the primitives and sets the box. A view
// position carries its disk position (disk), so links, the stem and the rim need no
// inverse map. Links are quadratic curves through the image of the midpoint of their
// disk arc (exact for conformal maps up to the curve's shape, an approximation
// otherwise); nodes stay circles sized by the local scale √|det J| (the circle
// approximation of non-conformal maps).
export type ViewPos = C & { disk?:C }

export abstract class MappedProjection implements Projection
{
    abstract readonly kind:string
    readonly followsSize:boolean = false
    protected g:C                  // the direction of the root wedge's gap (the stem)
    A = 1                          // the aspect ratio of the drawn box (followsSize)

    constructor(rootWedge:{ orientation:number, angle:number }) {
        this.g = infinityOf(rootWedge)
    }

    /** The view position of a disk position. */
    protected abstract map(z:C) : C
    /** The disk position of a view position. */
    protected abstract unmap(v:C) : C
    /** The local scale of the map at a disk position (√|det J|). */
    protected abstract scaleAt(z:C) : number
    /** Whether a view position is in the picture (else the node gets outOfView). */
    protected inView(v:C) : boolean { return true }

    get aspect() : number { return this.A }

    toView(disk:C) : ViewPos {
        const v = this.map(disk)
        return { re: v.re, im: v.im, disk: { re: disk.re, im: disk.im } }
    }
    toDisk(view:C) : C { return this.unmap(view) }

    project(nodes:N[]) : N[] {
        const s0 = this.scaleAt({ re: 0, im: 0 })
        for (const n of nodes) {
            const z = { re: n.cache.re, im: n.cache.im }
            const v = this.map(z)
            n.cacheDisk = z
            n.outOfView = !this.inView(v)
            n.cache = <ViewPos>{ re: v.re, im: v.im, disk: z }
            n.cachep = CktoCp(n.cache)
            // sizes by the local scale relative to the center, never bigger than there
            const s = this.scaleAt(z)
            n.distScale = Math.max(1e-6, Math.min(n.distScale * (isFinite(s) ? s : 0) / s0, 1))
            n.dampedDistScale = n.distScale * (.5 / n.distScale + .5)
            n.strCache = `${n.cache.re} ${n.cache.im}`
            n.transformStrCache = ` translate(${n.strCache})`
            n.scaleStrText = ` scale(${n.dampedDistScale})`
        }
        return nodes
    }

    protected diskOf(v:ViewPos) : C { return v.disk || this.unmap(v) }

    /** The midpoint of the disk geodesic from a to b (the circle orthogonal to the rim). */
    protected arcMiddle(a:C, b:C) : C {
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
        const mid = this.map(this.arcMiddle(this.diskOf(a), this.diskOf(b)))
        let cx = 2 * mid.re - (a.re + b.re) / 2, cy = 2 * mid.im - (a.im + b.im) / 2
        if (curvature === '+') { cx = a.re + b.re - cx; cy = a.im + b.im - cy }
        return `M ${a.re} ${a.im} Q ${cx} ${cy}, ${b.re} ${b.im}`
    }

    // the root's stem: the geodesic toward the rim in the gap's direction
    stem(root:ViewPos, curvature:ArcCurvature) : string {
        return this.geodesic(root, this.toView({ re: .9999 * this.g.re, im: .9999 * this.g.im }), curvature)
    }

    // small circles (the focus, the λ circle): the image of the center, the radius by the local scale
    circle(center:C, r:number) {
        if (!(r > 0) || r > .5) return null
        const v = this.map(center), s = this.scaleAt(center)
        return isFinite(v.re) && isFinite(s) ? { cx: v.re, cy: v.im, r: r * s } : null
    }

    outward(view:C) : C {
        const r = Math.hypot(view.re, view.im)
        return r > 1e-9 ? { re: view.re / r, im: view.im / r } : { re: 0, im: -1 }
    }
    rim(view:ViewPos) : number {
        if (view.disk) return Math.hypot(view.disk.re, view.disk.im)
        return Math.min(1, Math.hypot(view.re, view.im))
    }

    // the disk's square box, as the Poincaré disk
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        return { viewBox: '0 0 1000 1000', transform: `translate(500,500) scale(${500 * diskSize})` }
    }
    clip(clipPath:any, clipRadius:number) { clipPath.append('circle').attr('r', clipRadius) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-2, -2], [2, 2]] }
    background() {
        return { elementType: 'circle', className: 'background-circle',
                 create: (s:any)=> s.attr('r', 1).attr('fill', 'url(#exampleGradient)') }
    }
    overviewClamp(P:C) : C { return P }
}

/** The box of a wide projection: y ∈ ±1 fills the height, x ∈ ±aspect the width. */
export function wideViewBox(self:{ A:number }, width:number, height:number, diskSize:number) : ViewBox {
    const aspect = width > 0 && height > 0 ? width / height : 1.6
    self.A = Math.max(.2, Math.min(5, aspect))
    const w = Math.round(1000 * aspect)
    return { viewBox: `0 0 ${w} 1000`, transform: `translate(${w / 2},500) scale(${500 * (diskSize || 1)})` }
}
