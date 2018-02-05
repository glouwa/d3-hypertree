import * as d3                     from 'd3'
import { HTML }                    from 'ducd'
import { N }                       from '../../models/n/n'
import { obj2data }                from '../../models/n/n-loaders'
import { C, CktoCp, CptoCk }       from '../../models/transformation/hyperbolic-math'
import { CmulR, CsubC, CaddC }     from '../../models/transformation/hyperbolic-math'
import { dfsFlat, πify, CassignC } from '../../models/transformation/hyperbolic-math'
import { ArrAddR }                 from '../../models/transformation/hyperbolic-math'
import { CtoStr }                  from '../../models/transformation/hyperbolic-math'
import { lengthDilledation }       from '../../models/transformation/hyperbolic-math'
import { Transformation }          from '../../models/transformation/hyperbolic-transformation'
import { PanTransformation }       from '../../models/transformation/hyperbolic-transformation'
import { NegTransformation }       from '../../models/transformation/hyperbolic-transformation'
import { TransformationCache }     from '../../models/transformation/hyperbolic-transformation'
import { ILayer }                  from '../layerstack/layer'
import { NodeLayer }               from '../layers/node-layer'
import { CellLayer }               from '../layers/cell-layer'
import { BackgroundLayer }         from '../layers/background-layer'
import { SymbolLayer }             from '../layers/symbol-layer'
import { ArcLayer }                from '../layers/link-layer'
import { LabelLayer }              from '../layers/label-layer'
import { InteractionLayer }        from '../layers/interaction-layer'
import { LayerStack }              from '../layerstack/layerstack'
import { HypertreeMeta }           from '../meta/hypertree-meta/hypertree-meta'
import { HypertreeMetaNav }        from '../meta/hypertree-meta/hypertree-meta'
import { bboxOffset }              from '../layerstack/d3updatePattern'
import { Hypertree }               from '../hypertree/hypertree';

const navBgNodeR = .012
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
        bboxOffset(
            d, 
            'labellen-bg', 
            d.layoutReference.zp || CktoCp(d.layout.z)
        )(v[i])
    )

const navBackgroundLayers = [
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
        curvature:  '-',
        data:       ()=> ud.cache.links,  
        nodePos:    (n:N)=> (n.layoutReference || n.layout).z,
        nodePosStr: (n:N)=> (n.layoutReference || n.layout).zStrCache,
        width:      (n:N)=> arcWidth(n),
        classed:    (s,w)=> {}
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'link-arcs-focus',                            
        className:  'arc-focus',
        curvature:  '-',
        data:       ()=> ud.cache.links.filter(n=> n.parent.cachep.r < .6),        
        nodePos:    (n:N)=> (n.layoutReference || n.layout).z,
        nodePosStr: (n:N)=> (n.layoutReference || n.layout).zStrCache,
        width:      (d:N)=> arcWidth(d) + (.005 * d.dampedDistScale),
        classed:    (s,w)=> {}
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'path-arcs',                
        className:  'arc',
        curvature:  '-',
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
            ` translate(${CtoStr(CaddC((d.layout||d.layoutReference).z, delta))})`
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        name:       'labels',
        className:  'caption label-big', 
        data:       ()=> ud.args.hypertree.args.objects.selections,
        text:       (d:N)=> d.precalc.txt,
        delta:      labelDelta(ud),
        transform:  (d:N, delta:C)=> 
            ` translate(${CtoStr(CaddC((d.layout||d.layoutReference).z, delta))})`
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

var rotate = (d:N)=> // label rotation (font correction)
    (d.name === 'λ' ? ' rotate(-25)' : ' rotate(0)')
var deltaMap = { // label offsets (font correction)
    P:{ re:.0025, im:.05 }, 
    θ:{ re:.0025, im:.019 }, 
    λ:{ re:.0025, im:.013 }
}
var Pscale =  (ud:UnitDisk)=> (d:any)=>
    lengthDilledation(d)
    * (1 - πify(CktoCp(ud.args.transformation.state.λ).θ) / 2 / Math.PI)
    / ud.args.nodeRadius

const navParameterLayers = [
    (v, ud:UnitDisk)=> new CellLayer(v, {
        invisible:   true,
        hideOnDrag:  true,
        clip:        '#circle-clip' + ud.args.clipRadius,
        data:        ()=> ud.cache.cells,                                        
    }), 
    (v, ud:UnitDisk)=> new NodeLayer(v, {
        name:        'nodes',
        className:   'node',
        data:        ()=> ud.cache.unculledNodes,
        r:           (d:N)=> ud.args.nodeRadius * (d.name==='P' ? Pscale(ud)(d) : 1),
        transform:   (d:N)=> d.transformStrCache,
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        invisible:   true,
        hideOnDrag:  true,   
        name:        'labels',
        className:   'caption',
        data:        ()=> ud.cache.unculledNodes,
        text:        (d:N)=> ({ P:'+', θ:'🠆', λ:'⚲' })[d.name],
        delta:       (d:N)=> deltaMap[d.name],
        transform:   (d:N, delta:C)=> 
            ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
            + rotate(d)
    }),
    (v, ud:UnitDisk)=> new InteractionLayer(v, {        
        nohover:     true,
        mouseRadius: 1.5,
        onClick:     (n:N, m:C)=> {}
    })
]

export interface IUnitdiskView {    
    parent,
    hypertree
}

export interface UnitDiskArgs
{
    parent:            any,
    position:          string,
    className:         string,
    hypertree:         Hypertree,
    data:              N,
    layers:            ((v, ls:IUnitDisk)=> ILayer)[],

    transformation:    Transformation<N>,
    cacheUpdate:       (ud:IUnitDisk, cache:TransformationCache)=> void,    
    transform:         (n:N)=> C,

    caption:           (n:N)=> string,
    nodeRadius:        number,
    clipRadius?:       number
}

export interface IUnitDisk
{
    args:               UnitDiskArgs
    cache    
    layerStack:         LayerStack
    HypertreeMetaType
    navParameter?:      UnitDisk,

    api: {
        setTransform: (t:string, tn:string)=> void
    }

    update: {
        data:           ()=> void,
        layout:         ()=> void,
        transformation: ()=> void,
        pathes:         ()=> void
    }
}

//----------------------------------------------------------------------------------------

export class UnitDisk implements IUnitDisk
{
    public args          : UnitDiskArgs        
    public cache         : TransformationCache // zeigt auf transformation.cache
    public voronoiLayout : d3.VoronoiLayout<N>    
    
    public layerStack    : LayerStack
    public HypertreeMetaType = HypertreeMeta
    public cacheMeta

    private view // d3 select          
    
    constructor(args : UnitDiskArgs) {
        this.args = args
        this.cache = args.transformation.cache                        
        this.update.parent()
    }
    
    public api = {
        setTransform: (t:string, tn:string)=> this.view.attr('transform', t)        
    }

    public update = {
        parent: ()=> this.updateParent(),
        cache: ()=> this.args.cacheUpdate(this, this.cache),
        data: ()=> this.update.layout(),
        layout: ()=> { 
            this.args.cacheUpdate(this, this.cache)
            this.layerStack.update.transformation()  
        },
        transformation: ()=> {
            this.args.cacheUpdate(this, this.cache)
            this.layerStack.update.transformation()  
        },
        pathes: ()=> {
            this.args.cacheUpdate(this, this.cache)
            this.layerStack.update.pathes()  
        }
    }

    private updateParent() {        
        this.view = d3.select(this.args.parent).append('g')
            .attr('class', this.args.className)
            .attr('transform', this.args.position)
        
        this.view.append('clipPath')
            .attr('id', 'circle-clip' + this.args.clipRadius)
            .append('circle')
                .attr('r', this.args.clipRadius)       

        this.voronoiLayout = d3.voronoi<N>()
            .x(d=> d.cache.re)
            .y(d=> d.cache.im)
            .extent([[-2,-2], [2,2]])
        
        if (this.args.cacheUpdate)
            this.update.cache()
        else
            console.log('this.args.cacheUpdate is null, and called')

        this.layerStack = new LayerStack({ 
            parent: this.view,
            unitdisk: this
        })
    }
}

//----------------------------------------------------------------------------------------

export class UnitDiskNav implements IUnitDisk
{
    public args          : UnitDiskArgs
    public cache         // redircteds NOT xD to view.cache    
    public layerStack
      
    public view          : UnitDisk // public wegen hypertreemeta
    public navBackground : UnitDisk // public wegen hypertreemeta
    public navParameter  : UnitDisk // public wegen hypertreemeta

    public HypertreeMetaType = HypertreeMetaNav

    constructor(args:UnitDiskArgs) {
        this.args = args

        this.view = new UnitDisk(args)
        this.cache = this.view.cache        
        this.layerStack = this.view.layerStack
        
        this.navBackground = new UnitDisk({
            parent:             args.parent,
            className:          'nav-background-disc',
            position:           'translate(95,95) scale(70)',
            hypertree:          args.hypertree,
            data:               args.data,
            //layers:             args.layers.filter((l, idx)=> usedLayers[idx]),
            layers:             navBackgroundLayers,
            //cacheUpdate:        args.cacheUpdate,
            cacheUpdate:        null,
            transformation:     args.transformation,
            transform:          (n:N)=> n.layout.z,
            caption:            (n:N)=> undefined,
            nodeRadius:         navBgNodeR,
            clipRadius:         1
        })

        var navTransformation =
            new NegTransformation(
                new PanTransformation(args.transformation.state))
        
        //var ncount = 1        
        this.navParameter = new UnitDisk({
            parent:             args.parent,
            className:          'nav-parameter-disc',
            position:           'translate(95,95) scale(70)',
            hypertree:          args.hypertree,
            data:               obj2data(args.transformation.state),            
            layers:             navParameterLayers,
            cacheUpdate:        (ud:UnitDisk, cache:TransformationCache)=> {
                var t0 = performance.now()
                cache.unculledNodes = dfsFlat(ud.args.data)
                for (var n of cache.unculledNodes) {
                    n.cache = n.cache || { re:0, im:0 }
                    var np = ud.args.transform(n)
                    if (n.name == 'θ' || n.name == 'λ')
                        np = CmulR(np, 1.08)
                    CassignC(n.cache, np)

                    n.cachep            = CktoCp(n.cache)
                    n.strCache          = n.cache.re + ' ' + n.cache.im
                    n.scaleStrText      = ` scale(1)`
                    n.transformStrCache = ` translate(${n.strCache})`
                }
                cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes)
                cache.cells = <any>cache.voronoiDiagram.polygons()
                ud.cacheMeta = { minWeight:[0], Δ:[performance.now()-t0] }              
            },
            transformation:     navTransformation,
            transform:          (n:any)=> CmulR(n, -1),
            caption:            (n:N)=> undefined,
            nodeRadius:         .16,
            clipRadius:         1.7
        })
    }
    
    public api = {
        setTransform: (t:string, tn:string)=> {
            this.view.api.setTransform(t, null)
            this.navBackground.api.setTransform(tn, null)
            this.navParameter.api.setTransform(tn, null)
        }
    }

    update = {
        data: ()=> { 
            this.navBackground.args.data = this.args.data
            this.view.args.data = this.args.data

            this.update.layout()
        },
        layout: ()=> { 
            this.view.update.cache()
            this.navParameter.update.cache()

            this.navBackground.layerStack.update.transformation() 
            this.view.layerStack.update.transformation()
            this.navParameter.layerStack.update.transformation()        
        },
        transformation: ()=> {
            this.view.update.cache()
            this.navParameter.update.cache()

            this.view.layerStack.update.transformation()        
            this.navParameter.layerStack.update.transformation()        
            this.navBackground.layerStack.update.pathes()
        },
        pathes: ()=> {
            this.view.update.cache()            

            this.view.layerStack.update.transformation()
            this.navBackground.layerStack.update.pathes()
            this.navParameter.layerStack.update.transformation() // wegen node hover
        }
    }
}
