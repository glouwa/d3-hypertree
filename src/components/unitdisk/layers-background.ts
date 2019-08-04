import { N }                       from '../../models/n/n'
import { C, CktoCp, CptoCk }       from '../../models/transformation/hyperbolic-math'
import { CmulR, CsubC, CaddC }     from '../../models/transformation/hyperbolic-math'
import { CtoStr }                  from '../../models/transformation/hyperbolic-math'
import { bboxCenter }              from '../layerstack/d3updatePattern'
import { ILayer }                  from '../layerstack/layer'
import { NodeLayer }               from '../layers/node-layer'
import { CellLayer }               from '../layers/cell-layer'
import { BackgroundLayer }         from '../layers/background-layer'
import { SymbolLayer }             from '../layers/symbol-layer'
import { ArcLayer }                from '../layers/link-layer'
import { LabelLayer }              from '../layers/label-layer'
import { InteractionLayer }        from '../layers/interaction-layer'
import { UnitDisk }                from './unitdisk'

export const navBgNodeR = .012
const arcWidth = (d:N)=>
    .022
    * d.distScale
    * d.precalc.weightScale
const nodeRadiusOffset = (ud:UnitDisk)=> (d:N)=>
    CptoCk({ 
        θ:(d.layoutReference||d.layout).zp.θ, 
        r:navBgNodeR 
    }) 

const labelDelta = (ud:UnitDisk)=> (d:N, i:number, v:N[])=> 
    CaddC(
        nodeRadiusOffset(ud)(d),
        bboxCenter(
            d, 
            'labellen-bg', 
            d.layoutReference.zp || CktoCp(d.layout.z)
        )
    )

export const navBackgroundLayers = [
    (v, ud:UnitDisk)=> new BackgroundLayer(v, {}),
    (v, ud:UnitDisk)=> new CellLayer(v, {
        invisible:  true,
        hideOnDrag: true,                    
        clip:       '#circle-clip' + ud.args.clipRadius,                            
        data:       ()=> ud.cache.cells        
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'link-arcs',
        className:  'arc',
        curvature:  ud.view.hypertree.args.geometry.linkCurvature,
        data:       ()=> ud.cache.links,  
        nodePos:    (n:N)=> (n.layoutReference || n.layout).z,
        nodePosStr: (n:N)=> (n.layoutReference || n.layout).zStrCache,
        width:      (n:N)=> arcWidth(n),
        classed:    (s,w)=> {}
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                            
        name:       'link-arcs-focus',                            
        className:  'arc-focus',
        curvature:  ud.view.hypertree.args.geometry.linkCurvature,
        data:       ()=> ud.cache.links.filter(n=> n.parent.cachep.r < .6),        
        nodePos:    (n:N)=> (n.layoutReference || n.layout).z,
        nodePosStr: (n:N)=> (n.layoutReference || n.layout).zStrCache,
        width:      (d:N)=> arcWidth(d) + (.005 * d.dampedDistScale),
        classed:    (s,w)=> {}
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'path-arcs',                
        className:  'arc',
        curvature:  ud.view.hypertree.args.geometry.linkCurvature,
        data:       ()=> ud.cache.paths,       
        nodePos:    (n:N)=> (n.layoutReference || n.layout).z,
        nodePosStr: (n:N)=> (n.layoutReference || n.layout).zStrCache,        
        width:      (d:N)=> arcWidth(d) + (.013 * d.dampedDistScale),
        classed:    s=> s
            .classed("hovered-path-nav",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
            .classed("selected-path-nav", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
            .style("stroke",              d=> d.pathes && d.pathes.finalcolor)
    }),            
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'emojis',   
        className:  'caption label-big',
        data:       ()=> ud.cache.emojis,
        text:       (d:N)=> d.precalc.icon,
        delta:      labelDelta(ud),
        transform:  (d:N, delta:C)=> 
            ` translate(${CtoStr(CaddC((d.layoutReference||d.layout).z, delta))})`
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        name:       'labels',
        className:  'caption label-big', 
        data:       ()=> ud.view.hypertree.args.objects.selections,
        text:       (d:N)=> d.precalc.label,
        delta:      labelDelta(ud),
        transform:  (d:N, delta:C)=> 
            ` translate(${CtoStr(CaddC((d.layoutReference||d.layout).z, delta))})`
    }),           
    (v, ud:UnitDisk)=> new SymbolLayer(v, {
        name:       'symbols',
        data:       ()=> ud.cache.spezialNodes,                                        
        r:          (d:N)=> .03,
        transform:  (d:N)=> 
            ` translate(${(d.layoutReference || d.layout).zStrCache})`
          + ` scale(${d.dampedDistScale})`,
    }),
]