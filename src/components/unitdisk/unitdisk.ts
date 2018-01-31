import * as d3                     from 'd3'
import { HTML }                    from 'ducd'
import { N }                       from '../../models/n/n'
import { obj2data }                from '../../models/n/n-loaders'
import { C, CktoCp, CptoCk }       from '../../hyperbolic-math'
import { CmulR, CsubC, CaddC }     from '../../hyperbolic-math'
import { dfsFlat, πify, CassignC } from '../../hyperbolic-math'
import { ArrAddR }                 from '../../hyperbolic-math'
import { lengthDilledation }       from '../../hyperbolic-math'
import { Transformation }          from '../../hyperbolic-transformation'
import { PanTransformation }       from '../../hyperbolic-transformation'
import { NegTransformation }       from '../../hyperbolic-transformation'
import { TransformationCache }     from '../../hyperbolic-transformation'
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

var arcWidth = d=>
            .022
            * d.distScale
            * d.weightScale
var navBgNodeR = .012
var nodeRadiusOffset = ls=> d=>
    CptoCk({ θ:d.zRefp ? d.zRefp.θ : CktoCp(d.z).θ, r:navBgNodeR })

const navBackgroundLayers = [
    (v, ud:UnitDisk)=> new BackgroundLayer(v, {                                        
    }),
    (v, ud:UnitDisk)=> new CellLayer(v, {
        invisible:  true,
        hideOnDrag: true,                    
        clip:       '#circle-clip' + ud.args.clipRadius,                            
        data:       ()=> ud.cache.cells,      
        // TODO: read d.z                      
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'link-arcs',                            
        className:  'arc',
        curvature:  '-', // + - 0 l
        data:       ()=> ud.cache.links,  
        nodePos:    n=> n.zRef || n.z,
        nodePosStr: n=> n.strCacheZref || n.strCacheZ,
        width:      d=> arcWidth(d),
        classed:    (s,w)=> {}
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'link-arcs-focus',                            
        className:  'arc-focus',
        curvature:  '-', // + - 0 l
        data:       ()=> ud.cache.links
                        .filter(n=> n.parent.cachep.r < .6),  
        nodePos:    n=> n.zRef || n.z,
        nodePosStr: n=> n.strCacheZref || n.strCacheZ,
        width:      d=> arcWidth(d) + (.005 * d.dampedDistScale),
        classed:    (s,w)=> {}
    }),
    (v, ud:UnitDisk)=> new ArcLayer(v, {                                        
        name:       'path-arcs',                
        className:  'arc',
        curvature:  '-', // + - 0 l
        data:       ()=> ud.cache.paths,       
        nodePos:    n=> n.zRef || n.z,
        nodePosStr: n=> n.strCacheZref || n.strCacheZ,
        width:      d=> arcWidth(d) + (.013 * d.dampedDistScale),
        classed:    s=> s.classed("hovered-path-nav",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                         .classed("selected-path-nav", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                         .style("stroke",              d=> d.pathes && d.pathes.finalcolor)
    }),            
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        name:       'emojis',   
        className:  'caption label-big',
        data:       ()=> ud.cache.emojis,
        text:       (d)=> d.icon,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d, 'labellen-bg', d.zRefp || CktoCp(d.z))(v[i])),
        transform:  (d, delta)=> 
                        ` translate(${(d.zRef ? d.zRef.re : d.z.re) + delta.re} ${d.zRef ? d.zRef.im : d.z.im})`                                                         
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        name:       'labels',
        className:  'caption label-big', 
        data:       ()=> ud.args.hypertree.args.objects.selections,
        text:       (d)=> d.txt,
        delta:      (d, i, v)=> CaddC(
                        nodeRadiusOffset(ud)(d),
                        bboxOffset(d, 'labellen-bg', d.zRefp || CktoCp(d.z))(v[i])),
        transform:  (d, delta)=> 
                        ` translate(${(d.zRef ? d.zRef.re : d.z.re) + delta.re} ${d.zRef ? d.zRef.im : d.z.im})`                                                         
    }),           
    (v, ud:UnitDisk)=> new SymbolLayer(v, {
        name:       'symbols',
        data:       ()=> ud.cache.spezialNodes,                                        
        r:          d=> .03,
        transform:  d=>  ` translate(${d.strCacheZref || d.strCacheZ})`
                        + ` scale(${d.dampedDistScale})`,
    }),
]

var rotate = d=>
            (d.name === 'λ' ? ' rotate(-25)' : ' rotate(0)')
var deltaMap = {
    P:{ re:.0025, im:.05 }, 
    θ:{ re:.0025, im:.019 }, 
    λ:{ re:.0025, im:.013 }
}
var Pscale =  ud=> d=>
    lengthDilledation(d)
    * (1 - πify(CktoCp(ud.args.transformation.state.λ).θ) / 2 / Math.PI)
    / ud.args.nodeRadius

const navParameterLayers = [
    (v, ud:UnitDisk)=> new CellLayer(v, {
        invisible:  true,
        hideOnDrag: true,
        clip:       '#circle-clip'+ud.args.clipRadius,
        data:       ()=> ud.cache.cells,                                        
    }), 
    (v, ud:UnitDisk)=> new NodeLayer(v, {
        name:        'nodes',
        className:   'node',
        data:        ()=> ud.cache.unculledNodes,
        r:           d=> ud.args.nodeRadius * (d.name==='P' ? Pscale(ud)(d) : 1),
        transform:   d=> d.transformStrCache,
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        invisible:  true,
        hideOnDrag: true,   
        name:        'labels',
        className:   'caption',
        data:        ()=> ud.cache.unculledNodes,
        text:        d=> ({ P:'+', θ:'🠆', λ:'⚲' })[d.name],
        delta:       d=> deltaMap[d.name],
        transform:   (d, delta)=> 
                        ` translate(${d.cache.re+delta.re} ${d.cache.im+delta.im})` 
                        + rotate(d)
    }),
    (v, ud:UnitDisk)=> new InteractionLayer(v, {                                        
        unitdisk:    ud,
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
    hypertree,
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
            transform:          (n:N)=> n.z,

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
            /*data:               <N & d3.HierarchyNode<N>>d3
                                    .hierarchy(obj2data(args.transformation.state))
                                    .each((n:any)=> {
                                        n.mergeId = ncount++
                                        n.pathes = {}
                                    }),*/
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
                                    //try { cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes) } catch(e) {}
                                },
            transformation:     navTransformation,
            transform:          (n:any)=> CmulR(n, -1),

            caption:            (n:N)=> undefined,
            nodeRadius:         .16,
            clipRadius:         1.7
        })
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
