import { N }                          from '../data/n'
import { C, CktoCp, arcCenter }       from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'
import { RectangleMap }               from '../geometry/schwarz-christoffel'
import { infinityOf }                 from '../geometry/cayley'

// The rectangular view as a conformal image of the whole disk (the Schwarz–Christoffel
// map, geometry/schwarz-christoffel.ts): the rim of the disk becomes the edge of the
// rectangle, so every node, the root and the path to it are always in the picture, as
// in the disk; fans keep their angles. The disk is rotated first so that the gap of
// the root wedge (the stem) goes to the middle of the bottom edge and the tree grows
// up, like the disk. Geodesics are no circles here: a link is drawn as a quadratic
// curve through the image of the midpoint of its disk arc. The aspect ratio of the
// rectangle follows the drawn element (viewBox); the map's modulus is set from it.
//
// A view position carries its disk position (disk), so the primitives (links, the
// stem, the rim of a label) need no inverse map.
type ViewPos = C & { disk?:C }

const rotate   = (z:C, g:C) : C => ({ re: z.re * g.re - z.im * g.im, im: z.re * g.im + z.im * g.re })
const unrotate = (z:C, g:C) : C => ({ re: z.re * g.re + z.im * g.im, im: z.im * g.re - z.re * g.im })

export class RectangleProjection implements Projection
{
    readonly kind = 'rectangle'
    readonly followsSize = true
    private g:C                    // the direction of the disk that goes to the bottom edge
    private map:RectangleMap
    private scale0:number          // the map's scale at the center

    constructor(rootWedge:{ orientation:number, angle:number }, aspect = 1.6) {
        this.g = infinityOf(rootWedge)
        this.setAspect(aspect)
    }

    /** The map for an aspect ratio (width : height) of the drawn box. */
    private setAspect(aspect:number) {
        const a = Math.max(.2, Math.min(5, aspect || 1.6))
        if (this.map && this.map.aspect === a) return
        this.map = new RectangleMap(a)
        this.scale0 = this.map.scale({ re: 0, im: 0 })
    }
    /** The rectangle: width 2, this height (view units). */
    get height() : number { return this.map.height }

    toView(disk:C) : ViewPos {
        const v = this.map.map(unrotate(disk, this.g))
        return { re: v.re, im: v.im, disk: { re: disk.re, im: disk.im } }
    }
    toDisk(view:C) : C { return rotate(this.map.unmap(view), this.g) }

    project(nodes:N[]) : N[] {
        for (const n of nodes) {
            const z = { re: n.cache.re, im: n.cache.im }
            const zr = unrotate(z, this.g)
            const v = this.map.map(zr)
            n.cacheDisk = z
            n.outOfView = false
            n.cache = <ViewPos>{ re: v.re, im: v.im, disk: z }
            n.cachep = CktoCp(n.cache)
            // sizes follow the map's scale relative to the center, never bigger than
            // there (the map stretches the rim near the middle of the long edges)
            n.distScale = Math.min(n.distScale * this.map.scale(zr) / this.scale0, 1)
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

    // the root's stem: toward the rim in the gap's direction (the middle of the bottom edge)
    stem(root:ViewPos, curvature:ArcCurvature) : string {
        return this.geodesic(root, this.toView({ re: .9999 * this.g.re, im: .9999 * this.g.im }), curvature)
    }

    // small circles (the focus, the λ circle) approximately: the image of the center
    // and the radius by the local scale; large ones are no circles any more
    circle(center:C, r:number) {
        if (!(r > 0) || r > .5) return null
        const v = this.toView(center)
        return { cx: v.re, cy: v.im, r: r * this.map.scale(unrotate(center, this.g)) }
    }

    outward(view:C) : C {
        const r = Math.hypot(view.re, view.im)
        return r > 1e-9 ? { re: view.re / r, im: view.im / r } : { re: 0, im: -1 }
    }
    // how far out: the disk radius of the position (a view position carries it)
    rim(view:ViewPos) : number {
        if (view.disk) return Math.hypot(view.disk.re, view.disk.im)
        return Math.min(1, Math.max(Math.abs(view.re), Math.abs(view.im) * 2 / this.height))
    }

    // the rectangle with the aspect ratio of the drawn box, as wide as diskSize of it
    // (x ∈ ±1, y ∈ ±K'/2K); the map's modulus follows the aspect ratio
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        const aspect = width > 0 && height > 0 ? width / height : 1.6
        this.setAspect(aspect)
        const w = Math.round(1000 * aspect)
        return { viewBox: `0 0 ${w} 1000`, transform: `translate(${w / 2},500) scale(${500 * aspect * (diskSize || 1)})` }
    }
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -1.01).attr('y', -3).attr('width', 2.02).attr('height', 6) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-2, -3], [2, 3]] }
    background() {
        return { elementType: 'rect', className: 'background-rectangle',
                 create: (s:any)=> s.attr('x', -1).attr('y', -3).attr('width', 2).attr('height', 6).attr('fill', 'rgba(128,128,128,.07)') }
    }
    // the whole disk is in the picture: the overview's P as it is
    overviewClamp(P:C) : C { return P }
}
