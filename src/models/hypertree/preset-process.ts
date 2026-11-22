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
    while (stdlabels.length > ud.view.hypertree.args.filter.maxlabels) {
        stdlabels = stdlabels.filter(n=> 
               (n.precalc.cullingWeight > (n.minWeight * damping) )
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
