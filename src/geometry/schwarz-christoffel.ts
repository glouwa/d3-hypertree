import { C } from './hyperbolic-math'

// The conformal map of the Poincaré disk onto a rectangle (the Schwarz–Christoffel
// map for four right angles), for the rectangular view (projection/rectangle.ts).
//
//   disk z  ->  half-plane  ζ = i·a·(1 + z) / (1 − z),   a = 1/√k   (z = 0 -> ζ = i·a)
//   ζ       ->  rectangle   w = sn⁻¹(ζ, k) = ∫₀^ζ dt / √((1 − t²)(1 − k²t²))
//
// sn⁻¹ maps the upper half-plane onto the rectangle [−K, K] × [0, K'] (K, K': the
// complete elliptic integrals of the modulus k and of k' = √(1 − k²)); the real axis
// becomes its four edges, the points ±1 and ±1/k its corners. sn(i·K'/2) = i/√k, so
// the Cayley map scaled by a puts the center of the disk at the center of the
// rectangle. The view coordinates divide by K and center the rectangle:
//   x = Re w / K ∈ [−1, 1],   y = (Im w − K'/2) / K ∈ [−K'/2K, K'/2K]
// so the aspect ratio width : height is 2K : K'. The modulus for an aspect ratio comes
// from the nome: q = exp(−π K'/K), k = (θ₂(q) / θ₃(q))².
//
// Unlike the half-plane (cayley.ts), the whole closed disk maps onto a bounded
// rectangle: every node is in the view, the rim of the disk is the edge of the
// rectangle, the path to the root is always in the picture (as in the disk). The map
// is conformal (fans keep their angles); its scale is finite everywhere except at the
// four corner points of the rim, where it is zero.
//
// Numerics: sn⁻¹ with Carlson's RF for complex arguments (the duplication theorem,
// one evaluation per drawn node and frame); sn with the theta series (the pointer
// positions back into the disk); K via the arithmetic-geometric mean.

const cmul = (a:C, b:C) : C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re })
const cdiv = (a:C, b:C) : C => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d } }
const cabs = (a:C) : number => Math.hypot(a.re, a.im)
/** the principal square root (Re ≥ 0) */
const csqrt = (a:C) : C => {
    const r = cabs(a)
    const re = Math.sqrt(Math.max(0, (r + a.re) / 2)), im = Math.sqrt(Math.max(0, (r - a.re) / 2))
    return { re, im: a.im < 0 ? -im : im }
}
const csin = (a:C) : C => ({ re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) })
const ccos = (a:C) : C => ({ re: Math.cos(a.re) * Math.cosh(a.im), im: -Math.sin(a.re) * Math.sinh(a.im) })

/** The complete elliptic integral of the first kind K(k), by the arithmetic-geometric mean. */
export function ellipticK(k:number) : number {
    let a = 1, b = Math.sqrt(1 - k * k)
    for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) { const m = (a + b) / 2; b = Math.sqrt(a * b); a = m }
    return Math.PI / (2 * a)
}

/**
 * Carlson's symmetric integral RF(x, y, z) for complex arguments off the negative real
 * axis (the duplication theorem until the arguments agree, then the Taylor series).
 */
export function carlsonRF(x:C, y:C, z:C) : C {
    for (let i = 0; i < 60; i++) {
        const mu = { re: (x.re + y.re + z.re) / 3, im: (x.im + y.im + z.im) / 3 }
        const m = cabs(mu)
        const dev = Math.max(cabs({ re: x.re - mu.re, im: x.im - mu.im }), cabs({ re: y.re - mu.re, im: y.im - mu.im }), cabs({ re: z.re - mu.re, im: z.im - mu.im }))
        if (dev <= 2e-4 * m) {
            // the series at mu: 1 − E2/10 + E3/14 + E2²/24 − 3·E2·E3/44, in 1/√mu
            const X = cdiv({ re: mu.re - x.re, im: mu.im - x.im }, mu), Y = cdiv({ re: mu.re - y.re, im: mu.im - y.im }, mu)
            const Z = { re: -X.re - Y.re, im: -X.im - Y.im }
            const XY = cmul(X, Y), E2 = { re: XY.re - Z.re * Z.re + Z.im * Z.im, im: XY.im - 2 * Z.re * Z.im }
            const E3 = cmul(XY, Z)
            const E22 = cmul(E2, E2), E23 = cmul(E2, E3)
            const s = { re: 1 - E2.re / 10 + E3.re / 14 + E22.re / 24 - 3 * E23.re / 44,
                        im:   - E2.im / 10 + E3.im / 14 + E22.im / 24 - 3 * E23.im / 44 }
            return cdiv(s, csqrt(mu))
        }
        const sx = csqrt(x), sy = csqrt(y), sz = csqrt(z)
        const l = { re: 0, im: 0 }
        for (const p of [cmul(sx, sy), cmul(sy, sz), cmul(sz, sx)]) { l.re += p.re; l.im += p.im }
        x = { re: (x.re + l.re) / 4, im: (x.im + l.im) / 4 }
        y = { re: (y.re + l.re) / 4, im: (y.im + l.im) / 4 }
        z = { re: (z.re + l.re) / 4, im: (z.im + l.im) / 4 }
    }
    return cdiv({ re: 1, im: 0 }, csqrt({ re: (x.re + y.re + z.re) / 3, im: (x.im + y.im + z.im) / 3 }))
}

const THETA_TERMS = 8

/** The map of the disk onto the rectangle of an aspect ratio (width : height). */
export class RectangleMap
{
    readonly aspect : number
    readonly k      : number       // the modulus
    readonly K      : number       // K(k)
    readonly Kp     : number       // K(k')
    readonly q      : number       // the nome exp(−π K'/K)
    private  a      : number       // 1/√k: the scale of the half-plane
    private  t2     : number       // θ₂(0), θ₃(0)
    private  t3     : number

    constructor(aspect:number) {
        this.aspect = aspect
        const q = Math.exp(-Math.PI * 2 / aspect)                   // K'/K = 2 / aspect
        let t2 = 0, t3 = 1
        for (let n = 0; n < THETA_TERMS; n++) { t2 += Math.pow(q, (n + .5) * (n + .5)); if (n > 0) t3 += Math.pow(q, n * n) }
        t2 *= 2; t3 = 1 + 2 * (t3 - 1)
        this.q = q; this.t2 = t2; this.t3 = t3
        this.k = (t2 / t3) * (t2 / t3)
        this.K = ellipticK(this.k)
        this.Kp = ellipticK(Math.sqrt(1 - this.k * this.k))
        this.a = 1 / Math.sqrt(this.k)
    }

    /** The half-plane point of a disk point: ζ = i·a·(1 + z) / (1 − z). */
    private zeta(z:C) : C {
        const d = (1 - z.re) * (1 - z.re) + z.im * z.im
        return { re: -2 * this.a * z.im / d, im: this.a * (1 - z.re * z.re - z.im * z.im) / d }
    }

    /** A disk point into the rectangle: x ∈ [−1, 1], y ∈ ±K'/2K (y grows toward the edge that z = 1 maps to). */
    map(z:C) : C {
        const zt = this.zeta(z)
        if (!isFinite(zt.re) || !isFinite(zt.im) || cabs(zt) > 1e8) return { re: 0, im: this.Kp / (2 * this.K) }
        const z2 = cmul(zt, zt), k2 = this.k * this.k
        const w = cmul(zt, carlsonRF({ re: 1 - z2.re, im: -z2.im }, { re: 1 - k2 * z2.re, im: -k2 * z2.im }, { re: 1, im: 0 }))
        return { re: w.re / this.K, im: (w.im - this.Kp / 2) / this.K }
    }

    /** A rectangle point back into the disk: ζ = sn(w, k) by the theta series, z = (ζ − i·a) / (ζ + i·a). */
    unmap(v:C) : C {
        const w = { re: v.re * this.K, im: v.im * this.K + this.Kp / 2 }
        const u = { re: Math.PI * w.re / (2 * this.K), im: Math.PI * w.im / (2 * this.K) }
        const q = this.q
        const t1 = { re: 0, im: 0 }, t4 = { re: 1, im: 0 }
        for (let n = 0; n < THETA_TERMS; n++) {
            const s = csin({ re: (2 * n + 1) * u.re, im: (2 * n + 1) * u.im }), f = (n % 2 ? -2 : 2) * Math.pow(q, (n + .5) * (n + .5))
            t1.re += f * s.re; t1.im += f * s.im
            if (n > 0) {
                const c = ccos({ re: 2 * n * u.re, im: 2 * n * u.im }), g = (n % 2 ? -2 : 2) * Math.pow(q, n * n)
                t4.re += g * c.re; t4.im += g * c.im
            }
        }
        const zt = cdiv(t1, t4)
        zt.re *= this.t3 / this.t2; zt.im *= this.t3 / this.t2
        return cdiv({ re: zt.re, im: zt.im - this.a }, { re: zt.re, im: zt.im + this.a })
    }

    /** The local scale |dw/dz| / K of the map at a disk point (view units per disk unit). */
    scale(z:C) : number {
        const zt = this.zeta(z)
        const d = (1 - z.re) * (1 - z.re) + z.im * z.im
        const z2 = cmul(zt, zt), k2 = this.k * this.k
        const f = cmul({ re: 1 - z2.re, im: -z2.im }, { re: 1 - k2 * z2.re, im: -k2 * z2.im })
        const s = 2 * this.a / d / Math.sqrt(cabs(f)) / this.K
        return isFinite(s) ? s : 0
    }

    /** The height of the rectangle in view units (its width is 2). */
    get height() : number { return this.Kp / this.K }
}
