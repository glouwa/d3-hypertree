import { N }                        from '../n/n'
import { IUnitDisk }                 from "../../components/unitdisk/unitdisk"
import { dfs2, dfsFlat2, dfsFlat }  from '../../models/transformation/hyperbolic-math'
import { C, CptoCk, CktoCp, πify }  from '../../models/transformation/hyperbolic-math'
import { lengthDilledation }        from '../../models/transformation/hyperbolic-math'
import { TransformationCache }      from "../../models/transformation/hyperbolic-transformation"

export function doVoronoiStuff(ud:IUnitDisk, cache:TransformationCache) {    
    //voro muss mindestens clickable enthalten für mousetonode bei click
        
    cache.voronoiDiagram = ud.voronoiLayout(
        cache.unculledNodes.filter((n:N)=> n.precalc.clickable)
        //cache.labels
        /*.filter(n=> 
            (n.cachep.r <= ud.cache.wikiR && n.precalc.label.startsWith('𝐖')) ||
            (n.data && n.data.name == 'carnivora') 
        )*/
    )
    //cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes)
    cache.cells = cache.voronoiDiagram.polygons()
        //.filter(e=> ud.args.nodeFilter(e.data)
                /*|| e.data.isPartOfAnyHoverPath 
                || e.data.isPartOfAnySelectionPath*/
        //    )

    updateCenterNodeStuff(ud, cache)    
}

export function updateCenterNodeStuff(ud:IUnitDisk, cache:TransformationCache) 
{
    if (cache.centerNode) {
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
}

/*
cache.emojis = hasicon
cache.labels = haslabel + inpath - hasicon
cache.wikis  = haslabel + inpath - labels - wikis
*/
const wikiR = .9
export function doLabelStuff(ud:IUnitDisk, cache:TransformationCache) {    
    
    ud.cache.wikiR = wikiR
    var labels = cache.unculledNodes
        .filter((e:N)=> e.precalc.label || e.precalc.icon)

    //var pathLabels = labels
    //    .filter((e:N)=> e.pathes.partof && e.pathes.partof.length)
        
    var stdlabels = labels
    //    .filter(e=> pathLabels.indexOf(e) === -1)        
        .filter(e=>                         
               (e.cachep.r <= wikiR  && e.precalc.label.startsWith('𝐖'))
            || !e.parent                
            || !e.isOutλ)
        //.sort((a, b)=> a.label.length - b.label.length)
        //.slice(0, 15)        
        
    let damping = 1
    while (stdlabels.length > 25) {
        stdlabels = stdlabels.filter(n=> 
               (n.value > (n.minWeight * damping) )
            || !n.parent
            /*|| !n.isOutλ*/)
        damping /= .8
    }

    cache.labels = stdlabels//.concat(pathLabels)
}

export function doImageStuff(ud:IUnitDisk, cache:TransformationCache) {
    cache.images = cache.unculledNodes
        .filter((e:N)=> e.precalc.imageHref)
}
