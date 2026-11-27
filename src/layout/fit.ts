// The zoom bounds and the start zoom of a tree: interaction.minFill / maxLinkLength
// (the λ bounds) and layout.initSize (the first view), computed after loading.

import { N }                   from '../data/n'
import { HypertreeArgs }       from '../config/schema'
import { IUnitDisk }           from '../view/unitdisk'
import { sigmoid }             from '../geometry/hyperbolic-math'
import { cacheUpdate, settleMagic } from '../filter/culling'

/** What the fit needs of the hypertree. */
export interface FitHost {
    args:         HypertreeArgs
    data:         N
    unitdisk:     IUnitDisk
    findingInitλ: boolean
    updateLayoutPath_(n:N): void
    clampλ(λ:number): number
}

// the farthest visible node (the filter decides what is visible at λ, with the root
// in the middle)
function reachAt(ht:FitHost, λ:number) : number {
    ht.args.geometry.transformation.state.λ = λ
    ht.updateLayoutPath_(ht.data)
    cacheUpdate(ht.unitdisk, ht.unitdisk.cache)
    const visible = ht.args.geometry.transformation.cache.unculledNodes || []
    return visible.reduce((m, n)=> Math.max(m, n.layout && n.layout.zp ? n.layout.zp.r : 0), 0)
}

/**
 * interaction.minFill: the lower λ bound at which the visible tree, with the root in
 * the middle, still reaches minFill of the disk radius (the radius grows with λ, so a
 * bisection). Zooming out further would leave the tree a small spot in the middle. A
 * tree that never reaches it gets λbounds[1].
 * interaction.maxLinkLength: the upper bound. In layoutBergé a link whose parent is in
 * the middle is λ long (a normal link; leaves among many siblings get an extra length
 * L, staggered outward, and are not the measure: bounding those made the normal links
 * a third as long), so λ = maxLinkLength.
 */
export function applyλBounds(ht:FitHost) : void {
    if (!ht.data) return
    const maxLink = ht.args.interaction.maxLinkLength
    if (maxLink)
        ht.args.interaction.λbounds = [ht.args.interaction.λbounds[0], maxLink]
    const fill = ht.args.interaction.minFill
    if (!fill) {
        const [lo, hi] = ht.args.interaction.λbounds
        if (lo > hi) ht.args.interaction.λbounds = [hi, hi]
        return
    }
    const max = ht.args.interaction.λbounds[1]
    const λstart = ht.args.geometry.transformation.state.λ
    let λ = max
    if (reachAt(ht, max) > fill) {
        let lo = 1e-5, hi = max
        for (let i = 0; i < 40; i++) {
            const mid = Math.sqrt(lo * hi)
            if (reachAt(ht, mid) >= fill) hi = mid; else lo = mid
        }
        λ = hi
    }
    // a new array: λbounds may be shared with a preset
    ht.args.interaction.λbounds = [λ, max]
    ht.args.geometry.transformation.state.λ = λstart
    ht.updateLayoutPath_(ht.data)
}

/**
 * The start zoom: the largest λ at which the outermost visible node stays within
 * layout.initSize of the disk radius (within the λ bounds), the start position
 * (geometry.startPosition), and the filter settled for the first frame.
 */
export function findInitλ(ht:FitHost) : void {
    const initSize = ht.args.layout.initSize
    let fitting:number = undefined, tooLarge:number = undefined
    // the filter takes plain steps meanwhile (culling.ts: no jumps over equal
    // weights, no further updates): the start zoom as before
    ht.findingInitλ = true
    for (let i=0; i<50; i++) {
        const λ = .02 + sigmoid(i/50) * .75
        if (reachAt(ht, λ) > initSize) { tooLarge = λ; break }
        fitting = λ
    }
    // the coarse steps used to stop at the first λ beyond initSize: refine
    // between the last fitting and the first too large step (bisection)
    if (fitting !== undefined && tooLarge !== undefined) {
        let lo = fitting, hi = tooLarge
        for (let i=0; i<12; i++) {
            const mid = (lo + hi) / 2
            if (reachAt(ht, mid) <= initSize) lo = mid; else hi = mid
        }
        reachAt(ht, lo)
    }
    ht.findingInitλ = false
    // the start zoom obeys interaction.λbounds like every other zoom
    const fitλ = ht.args.geometry.transformation.state.λ
    const startλ = ht.clampλ(fitλ)
    if (startλ !== fitλ) {
        ht.args.geometry.transformation.state.λ = startλ
        ht.updateLayoutPath_(ht.data)
        cacheUpdate(ht.unitdisk, ht.unitdisk.cache)
    }
    // geometry.startPosition: initial translation
    const start = ht.args.geometry.startPosition
    if (start) {
        ht.args.geometry.transformation.state.P = { re: start.re, im: start.im }
        cacheUpdate(ht.unitdisk, ht.unitdisk.cache)
    }
    // the filter's magic settles now, so the first frame shows the final visible set
    if (ht.args.filter.weightFilter)
        settleMagic(ht.unitdisk, ht.unitdisk.cache)
}
