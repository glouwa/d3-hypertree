import { N }                        from '../n/n'
import { IUnitDisk }                 from "../../components/unitdisk/unitdisk"
import { dfs2, dfsFlat2, dfsFlat }  from '../../models/transformation/hyperbolic-math'
import { TransformationCache }      from "../../models/transformation/hyperbolic-transformation"
import { C, CptoCk, CktoCp, πify }  from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR }      from '../../models/transformation/hyperbolic-math'
import { CassignC }                 from '../../models/transformation/hyperbolic-math'

import { doVoronoiStuff }           from './preset-process'
import { doLabelStuff }             from './preset-process'
import { doImageStuff }             from './preset-process'

var cullingRadius =   0.98
var labelλExtension = 1.2
var minLabelR =       0.85 

function adjustMagic() {

}

export function cacheUpdate(ud:IUnitDisk, cache:TransformationCache) {
    // constants 
    const t0 =        performance.now()
    const normλ =     ud.args.transformation.state.λ
    const maxLabelR = Math.min(normλ * labelλExtension, minLabelR)

    const rangeNodes = { min:50, max:300}
    const rangeMagic = { min:2,  max:500}
    const alpha = 1.05
    //stopUp
    //stopDown
    if (cache.unculledNodes) {
        if (cache.unculledNodes.length > rangeNodes.max) {
            if (ud.view.hypertree.args.magic > rangeMagic.min) { // ???
                ud.view.hypertree.args.magic /= alpha
                //console.log('to big', (ud.args.hypertree.args.magic).toFixed(0))
            }
        }
        if (cache.unculledNodes.length < rangeNodes.min) {
            if (ud.view.hypertree.args.magic < rangeMagic.max) { // ???
                ud.view.hypertree.args.magic *= alpha
                //console.log('to small', (ud.args.hypertree.args.magic).toFixed(0))
            }
        }
    }

    // select visible nodes
    const path =          pathToLastVisible(ud, cache)
    const startNode =     path[0]
    cache.unculledNodes = []
    cache.spezialNodes =  [ud.args.data, startNode].filter(e=> e)
        
    const tr = hwe=> hwe / ud.view.hypertree.args.magic

    function abortfilter(n, idx, highway) { // return false to abort
        const minWeight = tr(highway[0].value)
        peocessNodeTransformation(ud, cache, n)
        peocessNode(ud, cache, n, maxLabelR, minWeight)        
        return !n.isOut
    }

    // select visible nodes - rootnode extra
    if (ud.args.data) {
        peocessNodeTransformation(ud, cache, ud.args.data)
        peocessNode(ud, cache, ud.args.data, maxLabelR, 0)
        // root ist nicht in uncullednodes! (gut)
    }
    // select visible nodes - alle anderen (von startnode bis abortfilter)
    dfs2({
        node:        startNode,
        abortFilter: abortfilter,
        preAction:   n=> cache.unculledNodes.push(n),
        highway:     path
    })
    
    // groups of nodes
    const t1 = performance.now()
    cache.links =      cache.unculledNodes.slice(1)     
    cache.leafOrLazy = cache.unculledNodes.filter(ud.args.nodeFilter) 
    cache.paths =      cache.links.filter((n:N)=> n.pathes.partof && n.pathes.partof.length)
    cache.weights =    []
    
    const t2 = performance.now()
    doVoronoiStuff(ud, cache)

    const t3 = performance.now()
    doLabelStuff(ud, cache)
    doImageStuff(ud, cache)
    
    // only for meta view
    ud.cacheMeta = {
        minWeight: path.map(n=> tr(n.value)),
        Δ: [t1-t0, t2-t1, t3-t2, performance.now()-t3]        
    }
}

function findStartNode(interaction:IUnitDisk, cache:TransformationCache) {
    let startNode = null
    let prev_startNode = null
    if (interaction.args.data) {
        startNode = cache.centerNode || interaction.args.data
        prev_startNode = startNode

        while (true) {            
            peocessNodeTransformation(interaction, cache, startNode) 

            if (startNode.cachep.r >= cullingRadius) {
                startNode = prev_startNode
                break
            }
            if(!startNode.parent) 
                break

            prev_startNode = startNode
            startNode = startNode.parent
        }
    }
    return startNode
}

function pathToLastVisible(ud:IUnitDisk, cache:TransformationCache) {
    let startNode : N = null
    let path = []
    if (ud.args.data) {
        startNode = cache.centerNode || ud.args.data        
        path.push(startNode)

        while (true) {
            peocessNodeTransformation(ud, cache, startNode) 

            if (startNode.cachep.r >= cullingRadius) {                                
                path = path.slice(0, -1)
                break
            }
            if(!startNode.parent) 
                break
           
            startNode = startNode.parent
            path.push(startNode)
        }
    }
    return path.reverse()
}

function peocessNodeTransformation(ud:IUnitDisk, cache:TransformationCache, n:N) {
    n.cache = n.cache || { re:0, im:0 }
    CassignC(n.cache, ud.args.transform(n)) 
    //CassignC(n.cache, n.layout.z) 
    n.cachep = CktoCp(n.cache)   
}

function peocessNode(ud:IUnitDisk, cache:TransformationCache, n:N, maxLabelR, minWeight) {    
    n.strCache =                   `${n.cache.re} ${n.cache.im}`    
    n.transformStrCache =          ` translate(${n.strCache})`
    n.transformStrCacheZ =         ` translate(${n.layout.zStrCache})`
    
    n.isOutλ =                     n.cachep.r >= maxLabelR
    n.isOut99 =                    n.cachep.r >= cullingRadius
    n.isOutWeight =                n.value <= minWeight
    n.distScale =                  ud.args.transformation.transformDist(n.cache)
    n.dampedDistScale =            n.distScale * (.5 / n.distScale + .5)
    n.scaleStrText =               ` scale(${n.dampedDistScale})`
    n.isOut =                      !(!(n.isOut99 || n.isOutWeight) || !n.isOutλ || (n.parent && !n.parent.isOutλ))

    n.hasOutPeriChildren = n.hasOutWeightChildren = n.hasOutChildren = false

    if (n.parent && n.isOut99)     n.parent.hasOutPeriChildren = true
    if (n.parent && n.isOutWeight) n.parent.hasOutWeightChildren = true
    if (n.parent && n.isOut)       n.parent.hasOutChildren = true
}
