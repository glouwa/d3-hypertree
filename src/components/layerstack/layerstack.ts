import * as d3       from 'd3'
import { N }         from '../../models/n/n'
import { IUnitDisk } from '../unitdisk/unitdisk'
import { ILayer }    from './layer'

export interface LayerStackArgs
{
    parent,
    unitdisk: IUnitDisk
}

export class LayerStack
{
    args:         LayerStackArgs
    mainSvgGroup: any
    layers:       { [key:string]: ILayer }
    d3meta

    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.mainSvgGroup = this.args.parent.append('g')        

        this.layers = {}
        for (var layerfactoryfunc of this.args.unitdisk.args.layers) {            
            var layer = layerfactoryfunc(this.args.unitdisk)
            layer.layerStack = this
            this.layers[layer.name] = layer
        }
        this.updateLayers()
    }

    private updateLayers() : void
    {        
        this.mainSvgGroup.selectAll('*').remove();

        for (var l in this.layers) {
            var layer = this.layers[l]            
            layer.attach(this.mainSvgGroup)            
        }
    }

    public updateTransformation() {
        var timings = []
        var names = []

        for (var l in this.layers) {
            var layer = this.layers[l]            
            var beginTime = performance.now()
            layer.update.data()

            timings.push(performance.now() - beginTime)
            names.push(layer.name)
        }

        this.d3meta = { Δ: timings, names: names }
    }

    public updatePath() {
        if (this.layers['path-arcs']) this.layers['path-arcs'].update.data()
        if (this.layers['link-arcs-focus']) this.layers['link-arcs-focus'].update.data()

        //if (this.layers['link-lines']) this.layers['link-lines'].update.style()            
        //if (this.layers.nodes) this.layers.nodes.update.style()        
    }
}
