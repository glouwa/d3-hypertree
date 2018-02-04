import * as d3 from 'd3'

import { tosub }                    from 'ducd'
import { N }                        from '../n/n'
import { dfs2, dfsFlat2, dfsFlat }  from '../../models/transformation/hyperbolic-math'

import { C, CptoCk, CktoCp, πify }  from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR }      from '../../models/transformation/hyperbolic-math'
import { CassignC }                 from '../../models/transformation/hyperbolic-math'

import { lengthDilledation }        from '../../models/transformation/hyperbolic-math'
import { loaders }                  from '../../index'
import { layoutBergé }              from '../n/n-layouts'
import { layoutBuchheim }           from '../n/n-layouts'
import { layoutSpiral }             from '../n/n-layouts'

import { HyperbolicTransformation } from '../../index'
import { PanTransformation }        from '../../index'
import { TransformationCache }      from '../../index'

import { HypertreeArgs }            from '../../models/hypertree/model'
import { UnitDisk }                 from '../../components/unitdisk/unitdisk'
import { UnitDiskNav }              from '../../components/unitdisk/unitdisk'
import { layers }                   from '../../index'
import { bboxOffset }               from '../../index'
import { Hypertree }                from '../../components/hypertree/hypertree'

var cullingRadius =   0.98
var labelλExtension = 1.2
var minLabelR =       0.85 
var animateUpR =      0.99
var hasLazy =         n=> (n.hasOutChildren && n.isOutλ /*&& n.parent.isOutλ*/)
var isLeaf =          n=> !n.children || !n.children.length
var isRoot =          n=> !n.parent 
var hasCircle =       n=> hasLazy(n) || isRoot(n) || isLeaf(n)

const layerSrc = [
    // wedges                        
    // nodes
    // nodes-leafs
    // nodes-lazy                        
    // oerlay-path
    // bounds
    // interaction-trace
    // interaction-d3
    // interaction-hammer
    (v, ud:UnitDisk)=> new layers.BackgroundLayer(v, {}),
    (v, ud:UnitDisk)=> new layers.FocusLayer(v, {
        invisible:  true,
        name:       'λ',
        r:          ()=> πify(CktoCp(ud.args.transformation.state.λ).θ) / 2 / Math.PI                            
    }),
    (v, ud:UnitDisk)=> new layers.FocusLayer(v, {        
        invisible:  true,
        name:       'labels-focus',
        r:          ()=> 1.2 * πify(CktoCp(ud.args.transformation.state.λ).θ) / 2 / Math.PI                            
    }),
    (v, ud:UnitDisk)=> new layers.FocusLayer(v, {        
        invisible:  true,
        hideOnDrag: true,
        name:       'culling-r',
        r:          ()=> cullingRadius
    }),
    (v, ud:UnitDisk)=> new layers.FocusLayer(v, {        
        invisible:  false,
        name:       '(0,0)',
        r:          ()=> .004
    }),
    (v, ud:UnitDisk)=> new layers.CellLayer(v, {
        invisible:  false,
        clip:       '#circle-clip' + ud.args.clipRadius,
        data:       ()=> ud.cache.cells,                            
    }),
    (v, ud:UnitDisk)=> new layers.NodeLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'weigths',
        className:  'weigths',
        data:       ()=> ud.cache.weights,
        r:          d=> nodeInitR(ud)(d),
        transform:  d=> d.transformStrCache 
                        + ` scale(${nodeScale(d)})`,
    }),
    (v, ud:UnitDisk)=> new layers.NodeLayer(v, {                            
        name:       'center-node',
        className:  'center-node', 
        //clip:       '#node-32-clip', centernode.id
        data:       ()=> ud.cache.centerNode?[ud.cache.centerNode]:[],
        r:          d=> .1,
        transform:  d=> d.transformStrCache                            
                        + ` scale(${nodeScale(d)})`,
    }),
    (v, ud:UnitDisk)=> new layers.ArcLayer(v, {
        invisible:  false,
        hideOnDrag: false,
        name:       'path-arcs',
        className:  'arc',
        curvature:  '-', // + - 0 l
        data:       ()=> ud.cache.paths,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> arcWidth(d) + (.013 * d.dampedDistScale),
        classed:    s=> s.classed("hovered-path",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected-path", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",          d=> d.pathes && d.pathes.finalcolor)
    }),
    (v, ud:UnitDisk)=> new layers.ArcLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'path-lines',                            
        className:  'arc',
        curvature:  'l', // + - 0 l
        data:       ()=> ud.cache.paths,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> arcWidth(d) + (.013 * d.dampedDistScale),
        classed:    s=> s.classed("hovered-path",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected-path", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",          d=> d.pathes && d.pathes.finalcolor)
    }),
    (v, ud:UnitDisk)=> new layers.ArcLayer(v, {
        invisible:  false,
        hideOnDrag: false,
        name:       'link-arcs',                            
        className:  'arc',
        curvature:  '-', // + - 0 l
        data:       ()=> ud.cache.links,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> arcWidth(d),
        classed:    (s, w)=> s
                         .classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath)                         
                         .style("stroke",      d=> d.pathes && d.pathes.finalcolor)
                         .attr("stroke-width", d=> w(d))
    }),
    (v, ud:UnitDisk)=> new layers.ArcLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'link-lines',                            
        className:  'arc',
        curvature:  'l', // + - 0 l
        data:       ()=> ud.cache.links,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> arcWidth(d),
        classed:    s=> s.classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",      d=> d.pathes && d.pathes.finalcolor)

    }),                        
    (v, ud:UnitDisk)=> new layers.NodeLayer(v, {
        name:       'nodes',
        className:  'node',
        data:       ()=> ud.cache.leafOrLazy,
        r:          d=> nodeInitR(ud)(d),
        transform:  d=> d.transformStrCache                            
                        + ` scale(${nodeScale(d)})`,
    }),                        
    (v, ud:UnitDisk)=> new layers.SymbolLayer(v, {
        name:       'symbols',
        data:       ()=> ud.cache.spezialNodes,
        r:          d=> .03,
        transform:  d=> d.transformStrCache 
                        + ` scale(${d.dampedDistScale})`,
    }),
    (v, ud:UnitDisk)=> new layers.ImageLayer(v, {
        name:       'images',
        data:       ()=> ud.cache.images,
        imagehref:  (d)=> d.imageHref,
        delta:      (d)=> CmulR({ re:-.025, im:-.025 }, d.distScale),
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + ` scale(${d.distScale})`
    }),
    (v, ud:UnitDisk)=> new layers.LabelLayer(v, {                            
        hideOnDrag: false,                            
        name:       'labels',
        className:  'caption',
        data:       ()=> ud.cache.labels,
        text:       (d)=> d.label,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d)(v[i])), 
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + d.scaleStrText                            
    }),
    (v, ud:UnitDisk)=> new layers.LabelLayer(v, {
        name:       'emojis',  
        className:  'caption',                          
        data:       ()=> ud.cache.emojis,
        text:       (d)=> d.label,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d)(v[i])),
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + d.scaleStrText                            
    }),
    (v, ud:UnitDisk)=> new layers.InteractionLayer(v, {                            
        mouseRadius: .95,
        nohover:     false,
        onClick:     (n:N, m:C)=> {
                        var s = n.ancestors().find(e=> true)          // obsolete
                        //ud.args.hypertree.updatePath('SelectionPath', s) // toggle selection 
                        ud.args.hypertree.api.toggleSelection(s)          // toggle selection 
                        ud.args.hypertree.args.onNodeSelect(s)        // focus splitter
        }
    })
]

class Cache 
{
    /*
    itertator/selector cullcondition
    global
    perNode
    actions,deps
    update/run
    results/selectedSets (nodes links, lazx, leaf, ... selected cell ...)
    */
}

function cacheUpdate(ud:UnitDisk, cache:TransformationCache) {
    // constants 
    const t0 =        performance.now()
    const normλ =     πify(CktoCp(ud.args.transformation.state.λ).θ) / 2 / Math.PI
    const maxLabelR = Math.min(normλ * labelλExtension, minLabelR)

    const range = { min:50, max:300}
    //const range = { min:50 max:350}
    const alpha = 1.05
    //stopUp
    //stopDown
    if (cache.unculledNodes) {
        if (cache.unculledNodes.length > range.max) {
            if (1/ud.args.hypertree.args.magic > 2) { // ???
                ud.args.hypertree.args.magic *= alpha
                //console.log('to big', (1/ud.args.hypertree.args.magic).toFixed(0))
            }
        }
        if (cache.unculledNodes.length < range.min) {
            if (1/ud.args.hypertree.args.magic < 500) { // ???
                ud.args.hypertree.args.magic /= alpha
                //console.log('to small', (1/ud.args.hypertree.args.magic).toFixed(0))
            }
        }
    }

    // select visible nodes
    const path =          pathToLastVisible(ud, cache)
    const startNode =     path[0]
    cache.unculledNodes = []
    cache.spezialNodes =  [ud.args.data, startNode].filter(e=> e)
        
    const tr = hwe=> hwe * ud.args.hypertree.args.magic

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
    cache.leafOrLazy = cache.unculledNodes.filter(hasCircle) 
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

function findStartNode(interaction:UnitDisk, cache:TransformationCache) {
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
function pathToLastVisible(ud:UnitDisk, cache:TransformationCache) {
    var startNode : N = null
    var path = []
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

function peocessNodeTransformation(ud:UnitDisk, cache:TransformationCache, n:N) {
    n.cache = n.cache || { re:0, im:0 }
    CassignC(n.cache, ud.args.transform(n)) 
    n.cachep = CktoCp(n.cache)   
}

function peocessNode(ud:UnitDisk, cache:TransformationCache, n:N, maxLabelR, minWeight) {    
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

function doVoronoiStuff(ud:UnitDisk, cache:TransformationCache) {
    
    try { cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes) }
    catch(e) { console.log('voronoi exception') }

    cache.cells = cache.voronoiDiagram
        .polygons()
        .filter(e=> hasCircle(e.data)
                /*|| e.data.isPartOfAnyHoverPath 
                || e.data.isPartOfAnySelectionPath*/)

    const centerCell = cache.voronoiDiagram.find(0, 0)
    if (centerCell) {
        cache.centerNode = centerCell.data
        const pathStr = cache.centerNode.ancestors().reduce((a, e)=> `${e.txt?("  "+e.txt+"  "):''}${a?"›":""}${a}`, '') 
        const hypertree = ud.args.hypertree
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
        //console.trace('centercell not found')
        cache.centerNode = undefined
    }
}

function doLabelStuff(ud:UnitDisk, cache:TransformationCache) {    
    var λmap = λ=> {
        λ = ud.args.transformation.state.λ
        λ = πify(CktoCp(λ).θ) / 2 / Math.PI        
        if (λ > 1/2) return 1.0
        if (λ > 1/4) return  .75
        if (λ > 1/8) return  .6
        else         return  .5
    }
    var wikiR = λmap(undefined)
    var labels = cache.unculledNodes
        .filter((e:N)=> e.label)

    var pathLabels = labels
        .filter((e:N)=> e.pathes.partof && e.pathes.partof.length)

    var stdlabels = labels
        .filter(e=> pathLabels.indexOf(e) === -1)
        .filter(e=> !e.icon)
        .filter((e:N)=>         
                   !e.parent                
                || !e.isOutλ
                || (e.cachep.r <= wikiR  && e.label.startsWith('𝐖')))
        //.sort((a, b)=> a.label.length - b.label.length)
        //.slice(0, 15)        
    
    var emojis = labels
        .filter((e:N)=> e.icon)

    cache.labels = stdlabels.concat(pathLabels)
    cache.emojis = emojis
}

function doImageStuff(ud:UnitDisk, cache:TransformationCache) {
    cache.images = cache.unculledNodes
        .filter((e:N)=> e.imageHref)
}

var nodeInitR = ls=> d=>
    ls.args.nodeRadius
    //* 3.5
    * ((d.children && d.parent) ? innerNodeScale(d) : 1)

var nodeScale = d=>
    d.distScale
    * (hasLazy(d) ? 1.8 : 1)    

var arcWidth = d=>
    .022
    * d.distScale
    * d.weightScale

var innerNodeScale = d=>
    d.weightScale

var nodeRadiusOffset = ls=> d=>
    CptoCk({ θ:d.cachep.θ, r:nodeInitR(ls)(d)*2 })

var emojimap = {    
    Delphinidae:'🐬', Mysticeti:'🐋',    
    Elephas:'🐘', Afrotheria:'🐘',
    Giraffidae:'🦒', Caprinae:'🐏', Cervidae:'🦌', Camelidae:'🐪', Bovinae:'🐂', Suina:'🐗', Perissodactyla:'🐎', Rhinoceros:'🦏',
    Sciuridae:'🐿️', Pan:'🐵', Gorilla:'🦍',
    Rattus:'🐀', Cricetidae:'🐹', Chiroptera:'🦇', Rodentia:'🐭', Muroidea:'🐁',
    Canidae:'🐕', Vulpes:'🦊', 'Canis lupus':'🐺', Felidae:'🐅', Felis:'🐈', Ursidae:'🐻', 'Panthera leo':'🦁', 'Ailuropoda':'🐼', 'Leopardus':'🐆', 'Panthera tigris':'🐯',
    Haplorrhini:'🐒', Diprotodontia:'🐨',     Lagomorpha:'🐇', Insectivora:'🦔',
    Anura:'🐸', Salamandroidea:'🐉',
    Aves:'🐦', Archosauria:'🐊', Dinosauria:'🦕', Theropoda:'🦖', Testudinoidea :'🐢',
    Squamata:'🦎', Serpentes:'🐍',
    Columbiformes:'🕊', Galliformes:'🐔', Anatidae:'🦆', Accipitridae:'🦅', 'Sphenisciformes Sharpe':'🐧',
    Meleagridinae:'🦃', Strigiformes:'🦉', Sphenisciformes:'🐧',

    //fs:'📂', ducd:'🦆', 'd3-hypertree':'⚾', 'hypertree-of-life':'🌍',
    //'ducd-templates':'♻', isr:'🍀'    
}

export const presets = 
{
    otolModel:
    {
        // must have
        iconmap:      'will be set by navigation or user',
        onNodeSelect: 'will be set by navigation or user',    
        dataloader:   'will be set by navigation or user',    
        langloader:   'will be set by navigation or user',   
        
        data:         'will be set by dataloader',
        langmap:      'will be set by langloader',
        
        // infovis stuff
        weight:       (n:N)=> ((!n.children || !n.children.length)?1:0),
        caption: (ht:Hypertree, n:N)=> {
            // better: set of initial node actions [label, imghref, scalef, ...]
            const w  = (!n.value || n.value==1) ? '' : n.value + ' '
            const id = ( n.data && n.data.name) ? n.data.name : ''
            const l  = ht.langMap && ht.langMap[id] ? '𝐖 ' + ht.langMap[id] : ''
            
            const i  = emojimap[id]
            n.icon = i                        
            n.txt = i || l || id

            if (n.txt) return n.txt + tosub(w) 
            else return undefined
        },        
        layout:       layoutBergé, // [0, π/2]
        magic:        1/160,
            
        objects: {                      // oder indizes?
            selections: [],
            pathes: [],        
        },
        
        // most important    
        decorator: UnitDiskNav,
        geometry: {
            clipRadius:     1,
            nodeRadius:     .01,        
            transformation: new HyperbolicTransformation({
                P:{ re: 0, im:0 },
                θ:{ re: 1, im:0 },
                λ:CptoCk({ θ:.1*2*Math.PI, r:1 })
            }),        
            cacheUpdate:    cacheUpdate,
            layers:         layerSrc        
        }
    },
    generatorModel: 
    {
        // must have
        iconmap:      'will be set by navigation or user',
        onNodeSelect: 'will be set by navigation or user',    
        dataloader:   'will be set by navigation or user',    
        langloader:   'will be set by navigation or user',   

        data:         'will be set by dataloader',
        langmap:      'will be set by langloader',

        // infovis stuff
        caption:      (ht:Hypertree, n:N)=> undefined,
        weight:       (n:N)=> ((!n.children || !n.children.length)?1:0),
        layout:       layoutBergé, // [0, π/2]
        magic:        1/160,
            
        objects: {                      // oder indizes?
            selections: [],
            pathes: [],        
        },        
        
        // most important    
        decorator: UnitDiskNav,
        geometry: {
            clipRadius:     1,
            nodeRadius:     .01,        
            transformation: new HyperbolicTransformation({
                P:{ re: 0, im:0 },
                θ:{ re: 1, im:0 },
                λ:CptoCk({ θ:.1*2*Math.PI, r:1 })
            }),        
            cacheUpdate:    cacheUpdate,
            layers:         layerSrc        
        }
    },
    generatorSpiralModel: 
    {
        // must have
        iconmap:      'will be set by navigation or user',
        onNodeSelect: 'will be set by navigation or user',    
        dataloader:   'will be set by navigation or user',    
        langloader:   'will be set by navigation or user',   

        data:         'will be set by dataloader',
        langmap:      'will be set by langloader',

        // infovis stuff
        caption:      (ht:Hypertree, n:N)=> undefined,
        weight:       (n:N)=> ((!n.children || !n.children.length)?1:0),
        layout:       layoutSpiral, // [0, π/2]
        magic:        1/160,
            
        objects: {                      // oder indizes?
            selections: [],
            pathes: [],        
        },        
        
        // most important    
        decorator: UnitDiskNav,
        geometry: {
            clipRadius:     1,
            nodeRadius:     .01,        
            transformation: new HyperbolicTransformation({
                P:{ re: 0, im:0 },
                θ:{ re: 1, im:0 },
                λ:CptoCk({ θ:.1*2*Math.PI, r:1 })
            }),        
            cacheUpdate:    cacheUpdate,
            layers:         layerSrc        
        }
    },
    fsModel: 
    {
        // must have
        iconmap:      'will be set by navigation or user',
        onNodeSelect: 'will be set by navigation or user',    
        dataloader:   'will be set by navigation or user',    
        langloader:   'will be set by navigation or user',   

        data:         'will be set by dataloader',
        langmap:      'will be set by langloader',

        // infovis stuff
        weight:       (n:N)=> ((!n.children || !n.children.length)?1:0),
        caption: (ht:Hypertree, n:N)=> {            
            const w  = (!n.value || n.value==1) ? '' : n.value + ' '
            n.txt = ( n.data && n.data.name) ? n.data.name : ''            

            return n.txt + tosub(w) 
        },
        layout:       layoutBergé, // [0, π/2]
        magic:        1/160,
            
        objects: {                      // oder indizes?
            selections: [],
            pathes: [],        
        },
        
        // most important    
        decorator: UnitDiskNav,
        geometry: {
            clipRadius:     1,
            nodeRadius:     .001,        
            transformation: new HyperbolicTransformation({
                P:{ re: 0, im:0 },
                θ:{ re: 1, im:0 },
                λ:CptoCk({ θ:.1*2*Math.PI, r:1 })
            }),        
            cacheUpdate:    cacheUpdate,
            layers:         layerSrc        
        }
    }
}