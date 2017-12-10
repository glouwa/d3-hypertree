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
import { HypertreeUi }                   from '../hypertree'
import { ILayer }                        from '../layerstack/layerstack'
import { NodeLayer }                     from '../layerstack/layers/node-layer'
import { LabelLayer }                    from '../layerstack/layers/text-rect-layer'
import { InteractionLayer }              from '../layerstack/layers/interaction-layer'
import { Interaction2 }                  from './interactive-unitdisk'
import { LayerStack }                    from '../layerstack/layerstack'

export interface IUnitDisk
{
    args: UnitDiskArgs
    cache
}

export interface UnitDiskArgs
{
    parent:            any,
    position:          string,
    className:         string,
    hypertree,
    data:              N,
    layers:            ((ls:IUnitDisk)=> ILayer)[],

    cacheUpdate:       (interaction:IUnitDisk, cache:TransformationCache)=> void,
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
            interaction: this
        })
    }

    public updateData() {        
        this.args.cacheUpdate(this, this.cache)

        this.layerStack.updateTransformation()
    }

    public updateTransformation() {
        this.args.cacheUpdate(this, this.cache)

        this.layerStack.updateTransformation()
    }

    public updateSelection() {
        this.layerStack.updatePath()
    }
}

//----------------------------------------------------------------------------------------

export class UnitDiskNav
{
    args          : UnitDiskArgs
      
    view          : UnitDisk
    navBackground : UnitDisk
    navParameter  : UnitDisk

    constructor(args : UnitDiskArgs) {
        this.args = args

        this.view = new UnitDisk(args)

        this.navBackground = new UnitDisk({
            parent:             args.parent,
            className:          'nav-background-disc',
            position:           'translate(120,120) scale(60)',
            hypertree:          args.hypertree,
            data:               args.data,
            layers:             args.layers.filter((l, idx)=> 
                                    idx !== 1 && idx !== 2 && idx !== 4 && idx !== 5 && idx !== 7),
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
            (d.name === 'λ' ? ' rotate(-30)' : ' rotate(0)')
        var Pscale =  ls=> d=>
            lengthDilledation(d)
            * (1 - πify(CktoCp(ls.args.transformation.state.λ).θ) / 2 / Math.PI)
            / ls.args.nodeRadius

        this.navParameter = new UnitDisk({
            parent:             args.parent,
            className:          'nav-parameter-disc',
            position:           'translate(120,120) scale(60)',
            hypertree:          args.hypertree,
            data:               obj2data(args.transformation.state),
            layers:             [
                                    (ls:UnitDisk)=> new NodeLayer({
                                        name:        'nodes',
                                        data:        ()=> ls.cache.unculledNodes,
                                        r:           d=> ls.args.nodeRadius * (d.name==='P' ? Pscale(ls)(d) : 1),
                                        transform:   d=> d.transformStrCache,
                                    }),
                                    (ls:UnitDisk)=> new LabelLayer({
                                        data:        ()=> ls.cache.unculledNodes,
                                        text:        d=> ({ P:'+', θ:'🗘', λ:'⚲' })[d.name],
                                        delta:       d=> ({ re:.0025, im:.025 }),
                                        transform:   d=> d.transformStrCache + rotate(d)
                                    }),
                                    (ls:UnitDisk)=> new InteractionLayer({                                        
                                        unitdisk:    ls,
                                        mouseRadius: 1.5,
                                        onClick:     (n:N, m:C)=> {}
                                    })
                                ],
            cacheUpdate:        (ud:UnitDisk, cache:TransformationCache)=> {
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
                                    try { cache.voronoiDiagram = ud.voronoiLayout(cache.unculledNodes) } catch(e) {}
                                },
            transformation:     navTransformation,
            transform:          (n:any)=> CmulR(n, -1),

            caption:            (n:N)=> undefined,
            nodeRadius:         .21,
            clipRadius:         1.5
        })
    }

    public updateData() {
        this.navBackground.args.data = this.args.data
        this.view.args.data = this.args.data

        this.navBackground.updateTransformation()
        this.view.updateTransformation()
        this.navParameter.updateTransformation()
    }

    public updateTransformation() {
        this.view.updateTransformation()
        this.navParameter.updateTransformation()
    }
    public updateSelection() {
        this.view.updateSelection(); /*navBackground.updateSelection();*/
    }        
}


