import * as d3                  from 'd3'
import { N }                    from '../../models/n/n'
import { TransformationCache }  from '../../hyperbolic-transformation'
import { LayerStack }           from '../layerstack/layerstack'
import { UnitDiskArgs }         from './unitdisk'

export class Interaction2
{
    args          : UnitDiskArgs    
    
    voronoiLayout : d3.VoronoiLayout<N>
    layerStack    : LayerStack
    cache         : TransformationCache // zeigt auf transformation.cache
    
    constructor(args : UnitDiskArgs) {
        this.args = args
        this.cache = args.transformation.cache
        var mainGroup = d3.select(args.parent)

        this.voronoiLayout = d3.voronoi<N>()
            .x(d=> d.cache.re)
            .y(d=> d.cache.im)
            .extent([[-2,-2], [2,2]])

        mainGroup.append('clipPath')
            .attr('id', 'circle-clip' + this.args.clipRadius)
            .append('circle')
                .attr('r', this.args.clipRadius)       

        this.args.cacheUpdate(this, this.cache)
        this.layerStack = new LayerStack({
            parent: mainGroup,
            interaction: this
        })
    }

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
}