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
    
    public update = {
        parent:         ()=> this.updateLayers(),
        transformation: ()=> this.updateTransformation(),
        pathes:         ()=> this.updatePath()
    }

    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.mainSvgGroup = this.args.parent.append('g')        
        this.updateLayers()
    }

    private updateLayers() : void
    {
        this.layers = {}
        for (var layerfactoryfunc of this.args.unitdisk.args.layers) {
            const view = {
                parent:this.mainSvgGroup,
                layerstack:this,
                unitdisk:this.args.unitdisk,
                hypertree:this.args.unitdisk.args.hypertree
            }
            const layer = layerfactoryfunc(view, this.args.unitdisk)            
            this.layers[layer.name] = layer
        }

        this.mainSvgGroup.selectAll('*').remove()
        for (var l in this.layers) 
            this.layers[l].update.parent()
    }

    private updateTransformation() {
        const timings = []
        const names = []

        for (var l in this.layers) {
            var layer = this.layers[l]            
            var beginTime = performance.now()
            layer.update.data()

            timings.push(performance.now() - beginTime)
            names.push(layer.name)
        }

        this.d3meta = { Δ:timings, names:names }
    }

    private updatePath() {
        var t0 = performance.now()
        if (this.layers['path-arcs']) 
            this.layers['path-arcs'].update.data()

        var t1 = performance.now()
        if (this.layers['link-arcs-focus']) 
            this.layers['link-arcs-focus'].update.data()

        var t2 = performance.now()
        if (this.layers['labels']) 
            this.layers['labels'].update.data()

        var t3 = performance.now()
        this.d3meta = { 
            Δ:[t1-t0, t2-t1, t3-t2], 
            names:['path-arcs', 'link-arcs-focus', 'labels'] 
        }
        //if (this.layers['link-lines']) this.layers['link-lines'].update.style()            
        //if (this.layers.nodes) this.layers.nodes.update.style()        
    }
}
