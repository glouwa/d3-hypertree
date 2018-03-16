import { N }                        from '../n/n'
import { C, CptoCk, CktoCp, πify }  from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR }      from '../../models/transformation/hyperbolic-math'
import { UnitDisk }                 from '../../components/unitdisk/unitdisk'
import { NodeLayer }                from '../../components/layers/node-layer'
import { CellLayer }                from '../../components/layers/cell-layer'
import { BackgroundLayer }          from '../../components/layers/background-layer'
import { SymbolLayer }              from '../../components/layers/symbol-layer'
import { ArcLayer }                 from '../../components/layers/link-layer'
import { LabelLayer }               from '../../components/layers/label-layer'
import { LabelForceLayer }          from '../../components/layers/label-force-layer'
import { InteractionLayer }         from '../../components/layers/interaction-layer'
import { InteractionLayer2 }        from '../../components/layers/interaction-layer-2'
import { TraceLayer }               from '../../components/layers/trace-layer'
import { ImageLayer }               from '../../components/layers/image-layer'
import { FocusLayer }               from '../../components/layers/focus-layer'
import { bboxOffset }               from '../../index'

var cullingRadius =   0.98
var labelλExtension = 1.1
var minLabelR =       0.85 
var animateUpR =      0.99

var nodeRadiusOffset = (ls:UnitDisk)=> (d:N)=>
    CptoCk({ θ:d.cachep.θ, r:ls.args.nodeRadius(ls, d)*2 })
 
export const layerSrc = [    
    // nodes
    // nodes-leafs
    // nodes-lazy                        
    // oerlay-path
    // bounds
    // interaction-trace
    // interaction-d3
    // interaction-hammer
    (v, ud:UnitDisk)=> new BackgroundLayer(v, {}),    
    (v, ud:UnitDisk)=> new FocusLayer(v, {        
        invisible:  true,
        hideOnDrag: true,
        name:       'culling-r',
        r:          ()=> cullingRadius
    }),
    (v, ud:UnitDisk)=> new FocusLayer(v, {        
        invisible:  true,
        hideOnDrag: true,
        name:       'mouse-r',
        r:          ()=> .98
    }),
    (v, ud:UnitDisk)=> new FocusLayer(v, {        
        invisible:  true,
        hideOnDrag: true,
        name:       'labels-r',
        r:          ()=> 1.2 * ud.args.transformation.state.λ
    }),    
    (v, ud:UnitDisk)=> new FocusLayer(v, {        
        invisible:  true,
        hideOnDrag: true,
        name:       'labels-r-𝐖',
        r:          ()=> ud.cache.wikiR
    }),    
    (v, ud:UnitDisk)=> new FocusLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'λ',
        r:          ()=> ud.args.transformation.state.λ
    }),
    (v, ud:UnitDisk)=> new FocusLayer(v, {        
        invisible:  false,
        name:       '(0,0)',
        r:          ()=> .004
    }),
    (v, ud:UnitDisk)=> new CellLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        clip:       '#circle-clip' + ud.args.clipRadius,
        data:       ()=> ud.cache.cells,                            
    }),
    (v, ud:UnitDisk)=> new NodeLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'weigths',
        className:  'weigths',
        data:       ()=> ud.cache.weights,
        r:          d=> ud.args.nodeRadius(ud, d),
        transform:  d=> d.transformStrCache 
                        + ` scale(${ud.args.nodeScale(d)})`,
    }),
    (v, ud:UnitDisk)=> new NodeLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'wedges',
        className:  'wedges',
        data:       ()=> ud.cache.weights,
        r:          d=> ud.args.nodeRadius(ud, d),
        transform:  d=> d.transformStrCache 
                        + ` scale(${ud.args.nodeScale(d)})`,
    }),
    (v, ud:UnitDisk)=> new NodeLayer(v, {                            
        name:       'center-node',
        className:  'center-node', 
        //clip:       '#node-32-clip', centernode.id
        data:       ()=> ud.cache.centerNode?[ud.cache.centerNode]:[],
        r:          d=> .1,
        transform:  d=> d.transformStrCache                            
                        + ` scale(${ud.args.nodeScale(d)})`,
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {
        invisible:  false,
        hideOnDrag: false,
        name:       'path-arcs',
        className:  'arc',
        curvature:  '-', // + - 0 l        
        data:       ()=> ud.cache.paths,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> ud.args.linkWidth(d) + (.013 * d.dampedDistScale),
        classed:    s=> s.classed("hovered-path",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected-path", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",          d=> d.pathes && d.pathes.finalcolor)
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'path-lines',                            
        className:  'arc',
        curvature:  'l', // + - 0 l
        data:       ()=> ud.cache.paths,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> ud.args.linkWidth(d) + (.013 * d.dampedDistScale),
        classed:    s=> s.classed("hovered-path",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected-path", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",          d=> d.pathes && d.pathes.finalcolor)
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {
        invisible:  false,
        hideOnDrag: false,
        name:       'link-arcs',                            
        className:  'arc',
        curvature:  '-', // + - 0 l
        clip:       '#circle-clip' + ud.args.clipRadius,
        data:       ()=> ud.cache.links,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> ud.args.linkWidth(d),
        classed:    (s, w)=> s
                         .classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath)                         
                         .style("stroke",      d=> d.pathes && d.pathes.finalcolor)
                         .attr("stroke-width", d=> w(d))
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'link-lines',                            
        className:  'arc',
        curvature:  'l', // + - 0 l
        clip:       '#circle-clip' + ud.args.clipRadius,
        data:       ()=> ud.cache.links,                            
        nodePos:    n=> n.cache,
        nodePosStr: n=> n.strCache,
        width:      d=> ud.args.linkWidth(d),
        classed:    s=> s.classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",      d=> d.pathes && d.pathes.finalcolor)

    }),                        
    (v, ud:UnitDisk)=> new NodeLayer(v, {
        name:       'nodes',
        className:  'node',
        data:       ()=> ud.cache.leafOrLazy,
        r:          d=> ud.args.nodeRadius(ud, d),        
        transform:  d=> d.transformStrCache                            
                        + ` scale(${ud.args.nodeScale(d)})`,
    }),                        
    (v, ud:UnitDisk)=> new SymbolLayer(v, {
        name:       'symbols',
        data:       ()=> ud.cache.spezialNodes,
        r:          d=> .03,
        transform:  d=> d.transformStrCache 
                        + ` scale(${d.dampedDistScale})`,
    }),
    (v, ud:UnitDisk)=> new ImageLayer(v, {
        name:       'images',
        data:       ()=> ud.cache.images,
        imagehref:  (d)=> d.precalc.imageHref,
        delta:      (d)=> CmulR({ re:-.025, im:-.025 }, d.distScale),
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + ` scale(${d.distScale})`
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {                            
        invisible:  true,
        hideOnDrag: true,                            
        name:       'labels',
        className:  'caption',
        data:       ()=> ud.cache.labels,
        text:       (d)=> d.precalc.label,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d)(v[i])), 
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + d.scaleStrText                            
    }),
    (v, ud:UnitDisk)=> new LabelForceLayer(v, {                            
        invisible:  false,
        hideOnDrag: true,                            
        name:       'labels-force',
        className:  'caption',
        data:       ()=> ud.cache.labels,
        text:       (d)=> d.precalc.label,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d)(v[i])), 
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + d.scaleStrText                            
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        name:       'emojis',  
        className:  'caption',                          
        data:       ()=> ud.cache.emojis,
        text:       (d)=> d.precalc.label,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d)(v[i])),
        transform:  (d, delta)=> 
                        ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
                        + d.scaleStrText                            
    }),
    (v, ud:UnitDisk)=> new InteractionLayer(v, {                            
        mouseRadius: .95,
        nohover:     false,
        onClick:     (n:N, m:C)=> {
                        var s = n.ancestors().find(e=> true)          // obsolete
                        //ud.args.hypertree.updatePath('SelectionPath', s) // toggle selection 
                        ud.view.hypertree.api.toggleSelection(s)          // toggle selection 
                        ud.view.hypertree.args.onNodeSelect(s)        // focus splitter
        }
    }),
    (v, ud:UnitDisk)=> new InteractionLayer2(v, {                            
        mouseRadius: .95,
        nohover:     false,
        onClick:     (n:N, m:C)=> {
                        var s = n.ancestors().find(e=> true)          // obsolete
                        //ud.args.hypertree.updatePath('SelectionPath', s) // toggle selection 
                        ud.view.hypertree.api.toggleSelection(s)          // toggle selection 
                        ud.view.hypertree.args.onNodeSelect(s)        // focus splitter
        }
    }),
    (v, ud:UnitDisk)=> new TraceLayer(v, {  
        invisible:    true,
        hideOnDrag:   true,
        name:         'traces',
        data:         ()=> ud.view.hypertree.args.objects.traces        
    })
]