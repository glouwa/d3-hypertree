import { N }                        from '../n/n'
import { IUnitDisk }                 from "../../components/unitdisk/unitdisk"
import { dfs2, dfsFlat2, dfsFlat }  from '../../models/transformation/hyperbolic-math'
import { C, CptoCk, CktoCp, πify }  from '../../models/transformation/hyperbolic-math'
import { lengthDilledation }        from '../../models/transformation/hyperbolic-math'
import { TransformationCache }      from "../../models/transformation/hyperbolic-transformation"

export function doVoronoiStuff(ud:IUnitDisk, cache:TransformationCache) {
    
    cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes)
    cache.cells = cache.voronoiDiagram
        .polygons()
        .filter(e=> ud.args.nodeFilter(e.data)
                /*|| e.data.isPartOfAnyHoverPath 
                || e.data.isPartOfAnySelectionPath*/
            )

    const centerCell = cache.voronoiDiagram.find(0, 0)
    if (centerCell) {
        cache.centerNode = centerCell.data
        const pathStr = cache.centerNode
            .ancestors()
            .reduce((a, e)=> `${e.precalc.txt?("  "+e.precalc.txt+"  "):''}${a?"›":""}${a}`, '') 
        const hypertree = ud.view.hypertree
        hypertree.view_.path.innerText = pathStr // todo: html m frame?

        if (cache.centerNode === hypertree.data && !hypertree.view_.btnHome.classList.contains('disabled')) {
            hypertree.view_.btnHome.classList.add('disabled')
            hypertree.view_.btnPathHome.classList.add('disabled')
        }
        if (cache.centerNode !== hypertree.data && hypertree.view_.btnHome.classList.contains('disabled')) {
            hypertree.view_.btnHome.classList.remove('disabled')
            hypertree.view_.btnPathHome.classList.remove('disabled')
        }
    }
    else {
        console.warn('centercell not found')
        cache.centerNode = undefined
    }
}

export function doLabelStuff(ud:IUnitDisk, cache:TransformationCache) {    
    var λmap = λ=> {
        λ = ud.args.transformation.state.λ        
        return λ + .3 * lengthDilledation(CptoCk({ θ:0, r:λ }))
    }
    
    var wikiR = ud.cache.wikiR = λmap(undefined)
    var labels = cache.unculledNodes
        .filter((e:N)=> e.precalc.label)

    var pathLabels = labels
        .filter((e:N)=> e.pathes.partof && e.pathes.partof.length)

    var stdlabels = labels
        .filter(e=> pathLabels.indexOf(e) === -1)
        .filter(e=> !e.precalc.icon)
        .filter((e:N)=>         
                   !e.parent                
                || !e.isOutλ
                || (e.cachep.r <= wikiR  && e.precalc.label.startsWith('𝐖')))
        //.sort((a, b)=> a.label.length - b.label.length)
        //.slice(0, 15)        
    
    var emojis = labels
        .filter((e:N)=> e.precalc.icon)

    cache.labels = stdlabels.concat(pathLabels)
    cache.emojis = emojis
}

export function doImageStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.images = cache.unculledNodes
        .filter((e:N)=> e.precalc.imageHref)
}
