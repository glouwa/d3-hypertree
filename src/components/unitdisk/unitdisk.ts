import * as d3                     from 'd3'
import { HTML }                    from 'ducd'
import { N }                       from '../../models/n/n'
import { navdata }                 from '../../models/n/n-loaders'
import { C, CktoCp, CptoCk }       from '../../models/transformation/hyperbolic-math'
import { CmulR, CsubC, CaddC }     from '../../models/transformation/hyperbolic-math'
import { dfsFlat, πify, CassignC } from '../../models/transformation/hyperbolic-math'
import { ArrAddR }                 from '../../models/transformation/hyperbolic-math'
import { Transformation }          from '../../models/transformation/hyperbolic-transformation'
import { PanTransformation }       from '../../models/transformation/hyperbolic-transformation'
import { NegTransformation }       from '../../models/transformation/hyperbolic-transformation'
import { TransformationCache }     from '../../models/transformation/hyperbolic-transformation'
import { LayerStack }              from '../layerstack/layerstack'
import { HypertreeMeta }           from '../meta/hypertree-meta/hypertree-meta'
import { HypertreeMetaNav }        from '../meta/hypertree-meta/hypertree-meta'
import { UnitDiskArgs }            from '../../models/unitdisk/unitdisk-model'
import { UnitDiskView }            from '../../models/unitdisk/unitdisk-model'

import { Hypertree }               from '../hypertree/hypertree'
import { navBackgroundLayers }     from './layers-background'
import { navBgNodeR }              from './layers-background'
import { navParameterLayers }      from './layers-parameter'

//----------------------------------------------------------------------------------------

export interface IUnitDisk
{  
    view:               UnitDiskView
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
    public view          : UnitDiskView
    public args          : UnitDiskArgs        
    public cache         : TransformationCache // zeigt auf transformation.cache
    public voronoiLayout : d3.VoronoiLayout<N>
    
    public layerStack    : LayerStack
    public HypertreeMetaType = HypertreeMeta
    public cacheMeta
    public pinchcenter

    private mainsvg // d3 select          
        
    constructor(view:UnitDiskView, args : UnitDiskArgs) {
        this.view = view
        this.args = args
        this.cache = args.transformation.cache                        
        this.update.parent()
    }
    
    public api = {
        setTransform: (t:string, tn:string)=> this.mainsvg.attr('transform', t)        
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
        this.mainsvg = d3.select(this.view.parent).append('g')
            .attr('class', this.view.className)
            .attr('transform', this.view.position)
        
        this.mainsvg.append('clipPath')
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
            parent: this.mainsvg,
            unitdisk: this
        })
    }
}

//----------------------------------------------------------------------------------------

export class UnitDiskNav implements IUnitDisk
{
    public view          : UnitDiskView
    public args          : UnitDiskArgs
    public cache         // redircteds NOT xD to view.cache    
    public layerStack
      
    public mainView      : UnitDisk // public wegen hypertreemeta
    public navBackground : UnitDisk // public wegen hypertreemeta
    public navParameter  : UnitDisk // public wegen hypertreemeta

    public HypertreeMetaType = HypertreeMetaNav

    constructor(view:UnitDiskView, args:UnitDiskArgs) {
        this.view = view
        this.args = args

        this.mainView = new UnitDisk(view, args)
        this.cache = this.mainView.cache        
        this.layerStack = this.mainView.layerStack
        
        this.navBackground = new UnitDisk({
            parent:             view.parent,
            className:          'nav-background-disc',
            position:           'translate(95,95) scale(70)',
            hypertree:          view.hypertree
        },
        {
            data:               args.data,
            
            cacheUpdate:        null,
            transformation:     args.transformation,
            transform:          (n:N)=> n.layout.z,
            
            nodeRadius:         ()=> navBgNodeR,
            nodeScale:          args.nodeScale,
            nodeFilter:         args.nodeFilter,
            linkWidth:          args.linkWidth,
            layers:             navBackgroundLayers,
            clipRadius:         1
        })

        var navTransformation =
            new NegTransformation(
                new PanTransformation(args.transformation.state))
        
        //var ncount = 1        
        this.navParameter = new UnitDisk({
            parent:             view.parent,
            className:          'nav-parameter-disc',
            position:           'translate(95,95) scale(70)',
            hypertree:          view.hypertree
        },
        {            
            data:               navdata(),
            layers:             navParameterLayers,
            cacheUpdate:        (ud:UnitDisk, cache:TransformationCache)=> {
                var t0 = performance.now()
                cache.unculledNodes = dfsFlat(ud.args.data)
                function setCacheZ(n:N, v) {
                    n.cache             = v
                    n.cachep            = CktoCp(n.cache)
                    n.strCache          = n.cache.re + ' ' + n.cache.im
                    n.scaleStrText      = ` scale(1)`
                    n.transformStrCache = ` translate(${n.strCache})`
                }
                const spr = 1.08
                setCacheZ(cache.unculledNodes[0], CmulR(args.transformation.state.P, -1))
                //setCacheZ(cache.unculledNodes[0], centernode.layout.)
                setCacheZ(cache.unculledNodes[1], CmulR(args.transformation.state.θ, -spr))
                setCacheZ(cache.unculledNodes[2], CptoCk({ θ:args.transformation.state.λ*2*Math.PI, r:-spr}))                

                cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes)
                cache.cells = <any>cache.voronoiDiagram.polygons()
                ud.cacheMeta = { minWeight:[0], Δ:[performance.now()-t0] }              
            },
            transformation:     navTransformation,
            transform:          (n:any)=> CmulR(n, -1),
            //caption:            (n:N)=> undefined,
            nodeRadius:         ()=> .16,
            nodeScale:          ()=> 1,
            nodeFilter:         ()=> true,
            linkWidth:          args.linkWidth,
            clipRadius:         1.7
        })
    }
    
    public api = {
        setTransform: (t:string, tn:string)=> {
            this.mainView.api.setTransform(t, null)
            this.navBackground.api.setTransform(tn, null)
            this.navParameter.api.setTransform(tn, null)
        }
    }

    update = {
        data: ()=> { 
            this.navBackground.args.data = this.args.data
            this.mainView.args.data = this.args.data

            this.update.layout()
        },
        layout: ()=> {
            this.mainView.update.cache()
            this.navParameter.update.cache()

            this.navBackground.layerStack.update.transformation() 
            this.mainView.layerStack.update.transformation()
            this.navParameter.layerStack.update.transformation()        
        },
        transformation: ()=> {
            this.mainView.update.cache()
            this.navParameter.update.cache()

            this.mainView.layerStack.update.transformation()        
            this.navParameter.layerStack.update.transformation()        
            this.navBackground.layerStack.update.pathes()
        },
        pathes: ()=> {
            this.mainView.update.cache()
            this.mainView.layerStack.update.transformation()
            this.navBackground.layerStack.update.pathes()
            this.navParameter.layerStack.update.transformation() // wegen node hover
        }
    }
}
