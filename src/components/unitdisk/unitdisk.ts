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
import { UnitDiskArgs }            from '../../models/unitdisk/unitdisk-model'

import { navBackgroundLayers }     from './layers-background'
import { navBgNodeR }              from './layers-background'
import { navParameterLayers }      from './layers-parameter'

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
        cache: ()=> this.args.cacheUpdate(this, this.cache), // gehört nicht hier her
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
            nodeRadius:         ()=> navBgNodeR,
            nodeScale:          args.nodeScale,
            nodeFilter:         args.nodeFilter,        
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
            nodeRadius:         ()=> .16,
            nodeScale:          ()=> 1,
            nodeFilter:         ()=> true,
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
