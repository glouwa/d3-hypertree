import { C }                          from '../geometry/hyperbolic-math'
import { ArcCurvature, ViewBox }      from './projection'
import { MappedProjection, ViewPos, wideViewBox } from './mapped'
import { toHalfPlane, viewToDisk, viewScale } from '../geometry/cayley'

// Closed-form maps of the Poincaré disk into the plane (docs/dev/GLATZHOFER-TRANSFORMATION.md
// lists them with the others). All keep layout, filter and navigation in the disk;
// MappedProjection (mapped.ts) draws them.
//
//   radial (the direction kept, the radius r = |z| mapped by f):
//     'klein'        f = 2r/(1+r²)              geodesics are straight lines; the rim the unit circle
//     'equal-area'   f = 2r/√(1+3r²)            the drawn area of the disk around the center is
//                                                πf² = πH/(H+π), H its hyperbolic area: equal for
//                                                small areas, saturating toward π (a bounded map
//                                                cannot keep the infinite area)
//     'equidistant'  f = tanh(artanh(r)/2)      hyperbolic distance from the center halved, then
//                                                bounded: more context near the rim than the disk
//     'gans'         f = 2r/(1−r²) / 4          the orthographic image of the hyperboloid;
//                                                unbounded, the box shows f ≤ 1 (r ≤ .78)
//   to the box:
//     'stretch'      (x, y) → (A·x, y)          the disk stretched affinely to an ellipse filling a wide box
//     'squircle'     the elliptic grid map of the disk onto the square, stretched to the box:
//                    the rim on all four edges, the gap in the middle of the bottom edge,
//                    no conformal pinch at the corners
//   conformal:
//     'sector'       ζ = (−1/w)^α, w the Cayley half-plane, α = 2/3: a 120° wedge with the gap
//                    at its apex (the bottom middle of the box), the rim on its two rays and
//                    at infinity; the box shows the part near the apex

type Radial = { f:(r:number)=> number, inv:(f:number)=> number, df:(r:number)=> number, f0:number }

const MAX_R = 1 - 1e-12
const RADIAL : { [kind:string]: Radial } = {
    'klein': {
        f:   r=> 2 * r / (1 + r * r),
        inv: f=> f < 1e-12 ? f / 2 : (1 - Math.sqrt(Math.max(0, 1 - f * f))) / f,
        df:  r=> 2 * (1 - r * r) / ((1 + r * r) * (1 + r * r)),
        f0:  2,
    },
    'equal-area': {
        f:   r=> 2 * r / Math.sqrt(1 + 3 * r * r),
        inv: f=> Math.sqrt(f * f / Math.max(1e-12, 4 - 3 * f * f)),
        df:  r=> 2 / Math.pow(1 + 3 * r * r, 1.5),
        f0:  2,
    },
    'equidistant': {
        f:   r=> Math.tanh(Math.atanh(Math.min(r, MAX_R)) / 2),
        inv: f=> Math.tanh(2 * Math.atanh(Math.min(f, MAX_R))),
        df:  r=> { const f = Math.tanh(Math.atanh(Math.min(r, MAX_R)) / 2); return (1 - f * f) / (2 * (1 - r * r)) },
        f0:  .5,
    },
    'gans': {
        f:   r=> 2 * r / (1 - r * r) / 4,
        inv: f=> { const F = 4 * f; return F < 1e-12 ? F / 2 : (Math.sqrt(1 + F * F) - 1) / F },
        df:  r=> 2 * (1 + r * r) / ((1 - r * r) * (1 - r * r)) / 4,
        f0:  .5,
    },
}

export class RadialProjection extends MappedProjection
{
    readonly kind:string
    private R:Radial

    constructor(kind:'klein' | 'equal-area' | 'equidistant' | 'gans', rootWedge:{ orientation:number, angle:number }) {
        super(rootWedge)
        this.kind = kind
        this.R = RADIAL[kind]
    }
    protected map(z:C) : C {
        const r = Math.min(Math.hypot(z.re, z.im), MAX_R)
        if (r < 1e-15) return { re: z.re * this.R.f0, im: z.im * this.R.f0 }
        const k = this.R.f(r) / r
        return { re: z.re * k, im: z.im * k }
    }
    protected unmap(v:C) : C {
        const f = Math.hypot(v.re, v.im)
        if (f < 1e-15) return { re: v.re / this.R.f0, im: v.im / this.R.f0 }
        const r = Math.min(this.R.inv(f), MAX_R), k = r / f
        return { re: v.re * k, im: v.im * k }
    }
    // √|det J| of a radial map: √(f′(r) · f(r)/r)
    protected scaleAt(z:C) : number {
        const r = Math.min(Math.hypot(z.re, z.im), MAX_R)
        if (r < 1e-9) return this.R.f0
        return Math.sqrt(this.R.df(r) * this.R.f(r) / r)
    }
    protected inView(v:C) : boolean { return this.kind !== 'gans' || Math.max(Math.abs(v.re), Math.abs(v.im)) < 1.3 }

    // Klein: geodesics are straight lines
    geodesic(a:ViewPos, b:ViewPos, curvature:ArcCurvature) : string {
        if (this.kind === 'klein') return `M ${a.re} ${a.im} L ${b.re} ${b.im}`
        return super.geodesic(a, b, curvature)
    }

    // Gans is unbounded: the square box, no rim circle
    clip(clipPath:any, clipRadius:number) {
        if (this.kind === 'gans') clipPath.append('rect').attr('x', -1.02).attr('y', -1.02).attr('width', 2.04).attr('height', 2.04)
        else super.clip(clipPath, clipRadius)
    }
    background() {
        if (this.kind !== 'gans') return super.background()
        return { elementType: 'rect', className: 'background-rectangle',
                 create: (s:any)=> s.attr('x', -1).attr('y', -1).attr('width', 2).attr('height', 2).attr('fill', 'rgba(128,128,128,.07)') }
    }
}

/** The disk stretched affinely to an ellipse that fills a wide box. */
export class StretchProjection extends MappedProjection
{
    readonly kind = 'stretch'
    readonly followsSize = true
    protected map(z:C) : C { return { re: this.A * z.re, im: z.im } }
    protected unmap(v:C) : C { return { re: v.re / this.A, im: v.im } }
    protected scaleAt(z:C) : number { return Math.sqrt(this.A) }
    outward(view:C) : C {
        const x = view.re / this.A, r = Math.hypot(x, view.im)
        return r > 1e-9 ? { re: x / r, im: view.im / r } : { re: 0, im: -1 }
    }
    viewBox(width:number, height:number, diskSize:number) : ViewBox { return wideViewBox(this, width, height, diskSize) }
    clip(clipPath:any, clipRadius:number) { clipPath.append('ellipse').attr('rx', 5 * clipRadius).attr('ry', clipRadius) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-6, -2], [6, 2]] }
    // the box (the background is created once; the ellipse's width follows resizes)
    background() {
        return { elementType: 'rect', className: 'background-rectangle',
                 create: (s:any)=> s.attr('x', -6).attr('y', -1).attr('width', 12).attr('height', 2).attr('fill', 'rgba(128,128,128,.07)') }
    }
}

// the elliptic grid map of the unit disk onto the square [−1, 1]² and its inverse
const SQ2 = 2 * Math.SQRT2
function diskToSquare(u:number, v:number) : C {
    const a = 2 + u * u - v * v, b = 2 - u * u + v * v
    return { re: .5 * Math.sqrt(Math.max(0, a + SQ2 * u)) - .5 * Math.sqrt(Math.max(0, a - SQ2 * u)),
             im: .5 * Math.sqrt(Math.max(0, b + SQ2 * v)) - .5 * Math.sqrt(Math.max(0, b - SQ2 * v)) }
}
const squareToDisk = (x:number, y:number) : C => ({ re: x * Math.sqrt(1 - y * y / 2), im: y * Math.sqrt(1 - x * x / 2) })

/** The disk onto the box by the elliptic grid map (the rim on all four edges), stretched to the aspect ratio. */
export class SquircleProjection extends MappedProjection
{
    readonly kind = 'squircle'
    readonly followsSize = true
    protected map(z:C) : C {
        const r = Math.hypot(z.re, z.im), k = r > MAX_R ? MAX_R / r : 1
        const s = diskToSquare(z.re * k, z.im * k)
        return { re: this.A * s.re, im: s.im }
    }
    protected unmap(v:C) : C {
        const x = Math.max(-MAX_R, Math.min(MAX_R, v.re / this.A)), y = Math.max(-MAX_R, Math.min(MAX_R, v.im))
        return squareToDisk(x, y)
    }
    // √|det J| from the inverse's Jacobian (closed form, well conditioned): 1/√|det J⁻¹|
    protected scaleAt(z:C) : number {
        const s = this.map(z), x = s.re / this.A, y = s.im
        const px = Math.sqrt(Math.max(1e-12, 1 - y * y / 2)), py = Math.sqrt(Math.max(1e-12, 1 - x * x / 2))
        // u = x·py(x)… : ∂u/∂x = px, ∂u/∂y = −x·y/(2px), ∂v/∂x = −x·y/(2py), ∂v/∂y = py
        const det = Math.abs(px * py - (x * y / (2 * px)) * (x * y / (2 * py)))
        return Math.sqrt(this.A / Math.max(1e-12, det))
    }
    viewBox(width:number, height:number, diskSize:number) : ViewBox { return wideViewBox(this, width, height, diskSize) }
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -6).attr('y', -1.01).attr('width', 12).attr('height', 2.02) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-6, -1.5], [6, 1.5]] }
    background() {
        return { elementType: 'rect', className: 'background-rectangle',
                 create: (s:any)=> s.attr('x', -6).attr('y', -1).attr('width', 12).attr('height', 2).attr('fill', 'rgba(128,128,128,.07)') }
    }
}

/** A conformal wedge: ζ = (−1/w)^α of the Cayley half-plane, the gap at the apex (bottom middle). */
export class SectorProjection extends MappedProjection
{
    readonly kind = 'sector'
    readonly followsSize = true
    readonly alpha = 2 / 3
    // the rotation that turns the wedge's bisector (angle απ/2) upward (view −y)
    private rot = -Math.PI / 2 - this.alpha * Math.PI / 2

    // w′ = −1/w in the upper half-plane, the gap at w′ = 0
    private wp(z:C) : C {
        const w = toHalfPlane(z, this.g)
        if (!isFinite(w.re) || !isFinite(w.im)) return { re: 0, im: 0 }
        const d = w.re * w.re + w.im * w.im
        return d < 1e-300 ? { re: 0, im: 1e150 } : { re: -w.re / d, im: w.im / d }
    }
    protected map(z:C) : C {
        const p = this.wp(z), ρ = Math.pow(Math.hypot(p.re, p.im), this.alpha), θ = this.alpha * Math.atan2(p.im, p.re) + this.rot
        return { re: ρ * Math.cos(θ), im: ρ * Math.sin(θ) + 1 }
    }
    protected unmap(v:C) : C {
        const x = v.re, y = v.im - 1, ρ = Math.hypot(x, y)
        const θ = Math.min(this.alpha * Math.PI - 1e-9, Math.max(1e-9, Math.atan2(y, x) - this.rot))
        const R = Math.pow(ρ, 1 / this.alpha), φ = θ / this.alpha
        const p = { re: R * Math.cos(φ), im: R * Math.sin(φ) }                  // w′
        const d = p.re * p.re + p.im * p.im
        const w = d < 1e-300 ? { re: 0, im: 1e12 } : { re: -p.re / d, im: p.im / d }
        return viewToDisk({ re: w.re, im: w.im - 1 }, this.g)
    }
    // |dζ/dz| = α·|w′|^(α+1)·|dw/dz|
    protected scaleAt(z:C) : number {
        const p = this.wp(z)
        return this.alpha * Math.pow(Math.hypot(p.re, p.im), this.alpha + 1) * viewScale(z, this.g)
    }
    protected inView(v:C) : boolean { return Math.abs(v.re) < this.A + .5 && v.im > -1.5 }
    outward(view:C) : C {
        const x = view.re, y = view.im - 1, r = Math.hypot(x, y)
        return r > 1e-9 ? { re: x / r, im: y / r } : { re: 0, im: -1 }
    }
    viewBox(width:number, height:number, diskSize:number) : ViewBox { return wideViewBox(this, width, height, diskSize) }
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -6).attr('y', -1.01).attr('width', 12).attr('height', 2.02) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-8, -3], [8, 1.5]] }
    background() {
        const a = this.alpha * Math.PI / 2, L = 20
        const d = `M 0 1 L ${-L * Math.sin(a)} ${1 - L * Math.cos(a)} L ${L * Math.sin(a)} ${1 - L * Math.cos(a)} Z`
        return { elementType: 'path', className: 'background-rectangle',
                 create: (s:any)=> s.attr('d', d).attr('fill', 'rgba(128,128,128,.07)') }
    }
}
