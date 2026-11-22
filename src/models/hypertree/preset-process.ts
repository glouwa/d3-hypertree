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

// Candidates: nodes inside the λ circle, the root, and 𝐖 labels inside wikiRadius.
// While there are more than max, the weight threshold rises (the nodes with the
// biggest subtrees stay; the root always stays).
function selectLabels(ud:IUnitDisk, cache:TransformationCache, max:number) : N[] {
    var labels = cache.unculledNodes
        // the label layers draw precalc.label: nodes with only an icon are drawn by the emoji layer
        .filter((e:N)=> e.precalc.label)

        
    var stdlabels = labels
    //    .filter(e=> pathLabels.indexOf(e) === -1)        
        .filter(e=> {                         
            return (e.cachep.r <= ud.view.hypertree.args.filter.wikiRadius  && e.precalc.label && e.precalc.label.startsWith('𝐖'))
                || !e.parent                
                || !e.isOutλ
        })
        
    let damping = 1
    while (stdlabels.length > max) {
        stdlabels = stdlabels.filter(n=> 
               (n.precalc.cullingWeight > (n.minWeight * damping) )
            || !n.parent
            /*|| !n.isOutλ*/)
        damping /= .8
    }

    return stdlabels
}

export function doImageStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.images = cache.unculledNodes
        .filter((e:N)=> e.precalc.imageHref)
}
