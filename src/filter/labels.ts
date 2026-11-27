import { N }                        from '../data/n'
import { IUnitDisk }                from "../view/unitdisk"
import { TransformationCache }      from './frame-cache'

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
 * The labels of a label layer, at most maxLabels, as its options ask:
 *   hoverLabel:      the node under the mouse (n.hovered): always, it counts
 *   hoverPathLabels: the nodes on the path from it to the root, nearest first, as far
 *                    as the limit goes (the ones near the root are left out first)
 *   the rest of the limit: the labels by weight and nearness (labelsFor)
 * only visible nodes with a label. Nodes with precalc.labelOnHover show their label only
 * on the hover path.
 */
export function labelsWithHover(ud:IUnitDisk, args:{ maxLabels?:number, hoverLabel?:boolean, hoverPathLabels?:boolean }) : N[] {
    if (!args.hoverLabel && !args.hoverPathLabels) return labelsFor(ud, args.maxLabels)
    const max = args.maxLabels === undefined || args.maxLabels === null ? DEFAULT_MAX_LABELS : args.maxLabels
    const shown = (n:N)=> n.precalc.label && !n.outOfView
    const unculled = ud.cache.unculledNodes
    const hover = args.hoverLabel ? unculled.filter((n:N)=> n.hovered && shown(n)) : []
    const path = !args.hoverPathLabels ? [] : unculled
        .filter((n:N)=> !hover.includes(n) && n.pathes && n.pathes.isPartOfAnyHoverPath && shown(n))
        .sort((a, b)=> b.depth - a.depth)                          // the hovered node (its head), then the nearest
        .slice(0, Math.max(0, max - hover.length))
    const taken = new Set([...hover, ...path])
    const rest = Math.max(0, max - taken.size)
    // the others: the rest of the limit (a node already on the path does not count twice)
    let base = rest ? labelsFor(ud, rest) : []
    const twice = base.filter(n=> taken.has(n)).length
    if (twice) base = labelsFor(ud, rest + twice)
    return base.filter(n=> !taken.has(n)).slice(0, rest).concat(hover, path)
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
