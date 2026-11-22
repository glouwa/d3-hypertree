import { N }                        from '../n/n'
import { IUnitDisk }                 from "../../components/unitdisk/unitdisk"
import { TransformationCache }      from "../transformation/hyperbolic-transformation"

export function doVoronoiStuff(ud:IUnitDisk, cache:TransformationCache) {    
    //voro muss mindestens clickable enthalten für mousetonode bei click
    cache.voronoiDiagram = ud.voronoiLayout(
        cache.unculledNodes.filter((n:N)=> n.precalc.clickable)      
    )    
    cache.cells = cache.voronoiDiagram.polygons()
    /*
    if (cache.cells.length)
    else
        */
}

export function doLabelStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.labels = selectLabels(ud, cache, ud.view.hypertree.args.filter.maxlabels)
    cache.labelsByMax = {}
}

/**
 * The labels of a label layer with the layer option maxLabels (default:
 * filter.maxlabels, which gives cache.labels). Computed once per update and limit.
 */
export function labelsFor(ud:IUnitDisk, max:number|undefined) : N[] {
    const cache = ud.cache
    if (max === undefined || max === null || max === ud.view.hypertree.args.filter.maxlabels) return cache.labels
    if (!cache.labelsByMax) cache.labelsByMax = {}
    return cache.labelsByMax[max] || (cache.labelsByMax[max] = selectLabels(ud, cache, max))
}

// The max visible nodes nearest to the center of the disk that have a label; the
// root (tree root) always has one. Until v1 the candidates were the nodes inside
// the focus radius, thinned out by weight, so max was often not reached.
function selectLabels(ud:IUnitDisk, cache:TransformationCache, max:number) : N[] {
    // the label layers draw precalc.label: nodes with only an icon are drawn by the emoji layer
    const candidates = cache.unculledNodes.filter((n:N)=> n.precalc.label)
    const root = candidates.find(n=> !n.parent)
    const others = candidates.filter(n=> n !== root)
    // score: subtree weight times the squared display scale (1 at the center, 0 at
    // the rim): big subtrees near the center first
    const score = (n:N)=> (n.precalc.cullingWeight || 1) * n.distScale * n.distScale
    if (others.length > max)
        others.sort((a, b)=> score(b) - score(a))
    const n = Math.max(0, root ? max - 1 : max)
    const nearest = others.length > n ? others.slice(0, n) : others
    return root ? [root, ...nearest] : nearest
}

export function doImageStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.images = cache.unculledNodes
        .filter((e:N)=> e.precalc.imageHref)
}
