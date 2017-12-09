import * as d3                  from 'd3'
import { N }                    from '../../models/n/n'
import { Transformation,
         TransformationCache }  from '../../hyperbolic-transformation'
import { C, CptoCk, CktoCp,
         CassignC, ArrtoC,
         dfsFlat, CsubC,
         arcCenter, πify,
         sigmoid }              from '../../hyperbolic-math'
import { LayerStack }           from '../layerstack/layerstack'
import { UnitDiskArgs }         from './unitdisk'

export class Interaction2
{
    args          : UnitDiskArgs
    mainGroup
    voronoiLayout : d3.VoronoiLayout<N>
    layerStack    : LayerStack
    cache         : TransformationCache // zeigt auf transformation.cache

    updateSelection() {
        this.layerStack.updatePath()
    }

    updateData() : void { 
        console.assert(false)
    }

    updatePositions() : void {
        this.args.cacheUpdate(this, this.cache)
        this.layerStack.updateTransformation()
    }

    constructor(args : UnitDiskArgs) {
        this.args = args
        this.cache = args.transformation.cache

        this.voronoiLayout = d3.voronoi<N>()
            .x(d=> { console.assert(typeof d.cache.re === 'number'); return d.cache.re })
            .y(d=> { console.assert(typeof d.cache.re === 'number'); return d.cache.im })
            .extent([[-2,-2], [2,2]])

        this.mainGroup = d3.select(args.parent)
        this.mainGroup.append('clipPath')
            .attr('id', 'circle-clip' + this.args.clipRadius)
            .append('circle')
                .attr('r', this.args.clipRadius)       

        this.initLayerStack()
    }

    protected initLayerStack() {
        this.args.cacheUpdate(this, this.cache)
        this.layerStack = new LayerStack({
            parent: this.mainGroup,
            interaction: this
        })
    }
}