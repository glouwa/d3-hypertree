import * as d3                           from 'd3'
import { HTML }                          from 'ducd'
import { N }                             from '../../models/n/n'
import { obj2data }                      from '../../models/n/n-loaders'
import { C, CktoCp, CmulR, CsubC }       from '../../hyperbolic-math'
import { dfsFlat, πify, CassignC }       from '../../hyperbolic-math'
import { ArrAddR }                       from '../../hyperbolic-math'
import { lengthDilledation }             from '../../hyperbolic-math'
import { Transformation }                from '../../hyperbolic-transformation'
import { PanTransformation }             from '../../hyperbolic-transformation'
import { NegTransformation }             from '../../hyperbolic-transformation'
import { TransformationCache }           from '../../hyperbolic-transformation'
import { ILayer }                        from '../layerstack/layer'
import { NodeLayer }                     from '../layerstack/layers/node-layer'
import { CellLayer }                     from '../layerstack/layers/cell-layer'
import { BackgroundLayer }               from '../layerstack/layers/background-layer'
import { SymbolLayer }                   from '../layerstack/layers/symbol-layer'
import { ArcLayer }                      from '../layerstack/layers/link-layer'
import { LabelLayer }                    from '../layerstack/layers/label-layer'
import { InteractionLayer }              from '../layerstack/layers/interaction-layer'
import { LayerStack }                    from '../layerstack/layerstack'
import { HypertreeMeta }                 from '../meta/hypertree-meta/hypertree-meta'
import { HypertreeMetaNav }              from '../meta/hypertree-meta/hypertree-meta'

export interface IUnitDisk
{
    args:                 UnitDiskArgs
    cache    
    layerStack:           LayerStack

    HypertreeMetaType

    navParameter?:        UnitDisk,

    update: {
        data: ()=> void,
        layout: ()=> void,
        transformation: ()=> void,
        pathes: ()=> void
    }
/*
    updateData:           ()=> void
    updateTransformation: ()=> void 
    updateSelection:      ()=> void */
}

export interface UnitDiskArgs
{
    parent:            any,
    position:          string,
    className:         string,
    hypertree,
    data:              N,
    layers:            ((ls:IUnitDisk)=> ILayer)[],

    cacheUpdate:       (ud:IUnitDisk, cache:TransformationCache)=> void,
    transformation:    Transformation<N>,
    transform:         (n:N)=> C,

    caption:           (n:N)=> string,
    nodeRadius:        number,
    clipRadius?:       number
}

//----------------------------------------------------------------------------------------

export class UnitDisk implements IUnitDisk
{
    args          : UnitDiskArgs    
    voronoiLayout : d3.VoronoiLayout<N>    
    cache         : TransformationCache // zeigt auf transformation.cache
    
    view          
    layerStack    : LayerStack

    HypertreeMetaType = HypertreeMeta

    cacheMeta

    constructor(args : UnitDiskArgs) {
        this.args = args
        this.cache = args.transformation.cache
                        
        this.view = d3.select(args.parent).append('g')
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
        
        this.args.cacheUpdate(this, this.cache)

        this.layerStack = new LayerStack({ 
            parent: this.view,
            unitdisk: this
        })
    }

    public calcCache()
    {
        this.args.cacheUpdate(this, this.cache)
    }

    update = {
        data: ()=> this.update.layout(),
        layout: ()=> { 
            this.args.cacheUpdate(this, this.cache)
            this.updateData()
        },
        transformation: ()=> {
            this.args.cacheUpdate(this, this.cache)
            this.updateTransformation()
        },
        pathes: ()=> {
            this.args.cacheUpdate(this, this.cache)
            this.updateSelection()
        }
    }

    public updateData() {                
        this.layerStack.updateTransformation()  
    }

    public updateTransformation() {        
        this.layerStack.updateTransformation()  
    }

    public updateSelection() { 
        //this.layerStack.updatePath()         TODO        
        this.layerStack.updatePath()
    }
}

//----------------------------------------------------------------------------------------

export class UnitDiskNav implements IUnitDisk
{
    args          : UnitDiskArgs
    cache         // redircteds NOT xD to view.cache    
    layerStack
      
    view          : UnitDisk
    navBackground : UnitDisk
    navParameter  : UnitDisk

    HypertreeMetaType = HypertreeMetaNav

    constructor(args : UnitDiskArgs) {
        this.args = args

        this.view = new UnitDisk(args)
        this.cache = this.view.cache        
        this.layerStack = this.view.layerStack
        
        var arcWidth = d=>
            .022
            * d.distScale
            * d.weightScale

        this.navBackground = new UnitDisk({
            parent:             args.parent,
            className:          'nav-background-disc',
            position:           'translate(95,95) scale(70)',
            hypertree:          args.hypertree,
            data:               args.data,
            //layers:             args.layers.filter((l, idx)=> usedLayers[idx]),
            layers:             [
                                    (ud:UnitDisk)=> new BackgroundLayer({}),
                                    (ud:UnitDisk)=> new CellLayer({
                                        invisible:  true,
                                        hideOnDrag: true,                    
                                        clip:       '#circle-clip' + ud.args.clipRadius,                            
                                        data:       ()=> ud.cache.cells,      
                                        // TODO: read d.z                      
                                    }),
                                    (ud:UnitDisk)=> new ArcLayer({                                        
                                        name:       'link-arcs',                            
                                        className:  'arc',
                                        curvature:  '-', // + - 0 l
                                        data:       ()=> ud.cache.links,  
                                        nodePos:    n=> n.zRef || n.z,
                                        nodePosStr: n=> n.strCacheZref || n.strCacheZ,
                                        width:      d=> arcWidth(d),
                                        classed:    (s,w)=> {}
                                    }),
                                    (ud:UnitDisk)=> new ArcLayer({                                        
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
                                    (ud:UnitDisk)=> new ArcLayer({                                        
                                        name:       'path-arcs',                
                                        className:  'arc',
                                        curvature:  '-', // + - 0 l
                                        data:       ()=> ud.cache.paths,       
                                        nodePos:    n=> n.zRef || n.z,
                                        nodePosStr: n=> n.strCacheZref || n.strCacheZ,
                                        width:      d=> arcWidth(d) + (.013 * d.dampedDistScale),
                                        classed:    s=> s.classed("hovered-path-nav",  d=> d.isHovered)
                                                         .classed("selected-path-nav", d=> d.isSelected)
                                    }),                                    
                                    (ud:UnitDisk)=> new SymbolLayer({
                                        name:       'symbols',
                                        data:       ()=> ud.cache.spezialNodes,                                        
                                        r:          d=> .03,
                                        transform:  d=> d.transformStrCache 
                                                        + ` scale(${d.dampedDistScale})`,
                                    }),
                                ],
            cacheUpdate:        args.cacheUpdate,
            transformation:     args.transformation,
            transform:          (n:N)=> n.z,

            caption:            (n:N)=> undefined,
            nodeRadius:         .012,
            clipRadius:         1
        })

        var navTransformation =
            new NegTransformation(
                new PanTransformation(args.transformation.state))
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

        this.navParameter = new UnitDisk({
            parent:             args.parent,
            className:          'nav-parameter-disc',
            position:           'translate(95,95) scale(70)',
            hypertree:          args.hypertree,
            data:               obj2data(args.transformation.state),
            layers:             [
                                    (ud:UnitDisk)=> new CellLayer({
                                        invisible:  true,
                                        clip:       '#circle-clip'+ud.args.clipRadius,
                                        data:       ()=> ud.cache.cells,                                        
                                    }), 
                                    (ud:UnitDisk)=> new NodeLayer({
                                        name:        'nodes',
                                        className:   'node',
                                        data:        ()=> ud.cache.unculledNodes,
                                        r:           d=> ud.args.nodeRadius * (d.name==='P' ? Pscale(ud)(d) : 1),
                                        transform:   d=> d.transformStrCache,
                                    }),
                                    (ud:UnitDisk)=> new LabelLayer({
                                        invisible:  true,
                                        hideOnDrag: true,   
                                        name:        'labels',
                                        data:        ()=> ud.cache.unculledNodes,
                                        text:        d=> ({ P:'+', θ:'🠆', λ:'⚲' })[d.name],
                                        delta:       d=> deltaMap[d.name],
                                        transform:   (d, delta)=> 
                                                        ` translate(${d.cache.re+delta.re} ${d.cache.im+delta.im})` 
                                                        + rotate(d)
                                    }),
                                    (ud:UnitDisk)=> new InteractionLayer({                                        
                                        unitdisk:    ud,
                                        mouseRadius: 1.5,
                                        onClick:     (n:N, m:C)=> {}
                                    })
                                ],
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
            this.view.calcCache()
            this.navParameter.calcCache()

            this.navBackground.updateTransformation() 
            this.view.updateTransformation()
            this.navParameter.updateTransformation()        
        },
        transformation: ()=> {
            this.view.calcCache()
            this.navParameter.calcCache()

            this.view.updateTransformation()        
            this.navParameter.updateTransformation()        
            this.navBackground.updateSelection()
        },
        pathes: ()=> {
            this.view.calcCache()            

            this.view.updateTransformation()                
            this.navBackground.updateSelection()
            this.navParameter.updateTransformation() // wegen node hover
        }
    }
    
    // updateData()           => this.layerStack.updateTransformation()  
    // updateTransformation() => this.layerStack.updateTransformation()      
    // updateSelection()      => this.layerStack.updatePath()            
}


