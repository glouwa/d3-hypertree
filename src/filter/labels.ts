import { N }                        from '../data/n'
import { IUnitDisk }                from "../view/unitdisk"
import { TransformationCache }      from "../geometry/transformation"

// The parts of the frame after the culling: the voronoi cells, the label selection
// and the images.

/** The limit of the label layers (option maxLabels) by default. */
export const DEFAULT_MAX_LABELS = 25

export function doVoronoiStuff(ud:IUnitDisk, cache:TransformationCache) {
    // the voronoi diagram holds at least the clickable nodes: the click finds its node in it
    cache.voronoiDiagram = ud.voronoiLayout(
        cache.unculledNodes.filter((n:N)=> n.precalc.clickable)
    )
    cache.cells = cache.voronoiDiagram.polygons()
}

export function doLabelStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.labels = selectLabels(ud, cache, DEFAULT_MAX_LABELS)
    cache.labelsByMax = {}
}

export function doImageStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.images = cache.unculledNodes
        .filter((e:N)=> e.precalc.imageHref)
}

/**
 * The labels of a label layer with the layer option maxLabels (the default limit
 * gives cache.labels). Computed once per update and limit.
 */
export function labelsFor(ud:IUnitDisk, max:number|undefined) : N[] {
    const cache = ud.cache
    if (max === undefined || max === null || max === DEFAULT_MAX_LABELS) return cache.labels
    if (!cache.labelsByMax) cache.labelsByMax = {}
    return cache.labelsByMax[max] || (cache.labelsByMax[max] = selectLabels(ud, cache, max))
}

/**
 * The labels of a label layer: labelsFor(maxLabels), plus as its options ask
 *   hoverLabel:      the node under the mouse (n.hovered)
 *   hoverPathLabels: every node on the path from it to the root
 * if they are visible and have a label. These come on top of the limit. Nodes with
 * precalc.labelOnHover show their label only this way.
 */
export function labelsWithHover(ud:IUnitDisk, args:{ maxLabels?:number, hoverLabel?:boolean, hoverPathLabels?:boolean }) : N[] {
    const base = labelsFor(ud, args.maxLabels)
    if (!args.hoverLabel && !args.hoverPathLabels) return base
    const extra = ud.cache.unculledNodes.filter((n:N)=> n.precalc.label && !n.outOfView
        && ((args.hoverLabel && n.hovered) || (args.hoverPathLabels && n.pathes && n.pathes.isPartOfAnyHoverPath)))
    if (!extra.length) return base
    const inBase = new Set(base)
    return base.concat(extra.filter(n=> !inBase.has(n)))
}

/**
 * The weight of a node when choosing labels (label layers, labels-placed priority):
 * filter.labelScore (e.g. a felt importance), else (or when it gives undefined, null
 * or NaN) the subtree weight precalc.cullingWeight.
 */
export function labelWeight(ud:IUnitDisk, n:N) : number {
    const labelScore = ud.args.model.filter.labelScore
    const s = labelScore ? labelScore(n) : undefined
    return s === undefined || s === null || isNaN(s) ? (n.precalc.cullingWeight || 1) : s
}

function selectLabels(ud:IUnitDisk, cache:TransformationCache, max:number) : N[] {
    // the label layers draw precalc.label: nodes with only an icon are drawn by the emoji layer
    // (half-plane view: not the nodes far above the view; precalc.labelOnHover: only
    // shown for the hovered node and its path)
    const candidates = cache.unculledNodes.filter((n:N)=> n.precalc.label && !n.outOfView && !n.precalc.labelOnHover)
    const root = candidates.find(n=> !n.parent)
    const others = candidates.filter(n=> n !== root)
    // score: the node's weight (labelWeight) times the squared display scale (1 at the
    // center, 0 at the rim): heavy nodes near the center first
    const score = (n:N)=> labelWeight(ud, n) * n.distScale * n.distScale
    if (others.length > max)
        others.sort((a, b)=> score(b) - score(a))
    const n = Math.max(0, root ? max - 1 : max)
    const nearest = others.length > n ? others.slice(0, n) : others
    return root ? [root, ...nearest] : nearest
}
