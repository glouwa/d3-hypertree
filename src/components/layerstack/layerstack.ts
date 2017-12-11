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
    args:      LayerStackArgs
    layersSvg: any
    layers:    { [key:string]: ILayer }
    
    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.layers = {}
        this.layersSvg = this.args.parent.append('g')        
        for (var layerfactoryfunc of this.args.unitdisk.args.layers) {            
            var layer = layerfactoryfunc(this.args.unitdisk)                        
            this.layers[layer.name] = layer
        }
        this.updateLayers()
    }

    public updateLayers() : void
    {        
        this.layersSvg.selectAll('*').remove();

        for (var l in this.layers) {
            var layer = this.layers[l]
            if (!layer.args.invisible)
                layer.attach(this.layersSvg)            
        }
    }

    public updateTransformation()
    {
        var timings = []
        var names = []

        for (var l in this.layers) {
            var beginTime = performance.now()

            var layer = this.layers[l]
            if (!layer.args.invisible) 
                layer.updateData()

            timings.push(performance.now() - beginTime)
            names.push(layer.name)
        }

        if (this.args.unitdisk.cache.unculledNodes.length != 3)
            this.args.unitdisk.args.hypertree.infoUi.updateD3Info(
                10, timings, this.args.unitdisk.cache, names
            )
    }

    public updatePath()
    {
        if (this.layers.cells)    this.layers.cells.updateData()
        if (this.layers.links)    this.layers.links.updateColor()
        if (this.layers.nodes)    this.layers.nodes.updateColor()
        if (this.layers.captions) this.layers.captions.updateData()
        //Materialize.toast("updatePath", 2500)
    }
}
