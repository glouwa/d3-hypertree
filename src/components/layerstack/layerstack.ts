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
    
    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.layers = {}
        this.mainSvgGroup = this.args.parent.append('g')        
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
            var beginTime = performance.now()

            var layer = this.layers[l]            
            layer.update.data()

            timings.push(performance.now() - beginTime)
            names.push(layer.name)
        }

        if (this.args.unitdisk.cache.unculledNodes.length != 3)
            this.args.unitdisk.args.hypertree.unitdiskMeta.updateD3Info(
                10, timings, this.args.unitdisk.cache, names
            )
    }

    public updatePath() {
        if (this.layers['link-arcs']) this.layers['link-arcs'].update.style()
        if (this.layers['link-lines']) this.layers['link-lines'].update.style()            
        if (this.layers.nodes) this.layers.nodes.update.style()        
    }
}
