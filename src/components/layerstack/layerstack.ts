import * as d3       from 'd3'
import { N }         from '../../models/n/n'
import { IUnitDisk } from '../unitdisk/unitdisk'
import { ILayer }    from './layer'
import { mergeDeep } from '../../ducd'
import { planes, planeOf, compositedPlanes, compositing } from './planes'

export interface LayerStackArgs
{
    parent,
    unitdisk: IUnitDisk
}

export class LayerStack
{
    args:         LayerStackArgs
    mainSvgGroup: any
    planes:       { [key:string]: any }       // compositor planes (see planes.ts)
    layers:       { [key:string]: ILayer }
    d3meta
    
    public update = {
        parent: ()=> this.updateLayers(),
        data:   ()=> this.updateData(),
        pathes: ()=> this.updatePath()
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
                parent:     this.mainSvgGroup,
                layerstack: this,
                unitdisk:   this.args.unitdisk,
                hypertree:  this.args.unitdisk.view.hypertree
            }
            const layer = layerfactoryfunc(view, this.args.unitdisk)
            const options = (this.args.unitdisk.args.layerOptions || {})[layer.name]
            if (options && options.removed)   // geometry.removeLayer
                continue
            if (options)
                mergeDeep(layer.args, options)
            this.layers[layer.name] = layer
        }

        // one group per compositor plane, the layer groups in their plane (in order)
        this.mainSvgGroup.selectAll('*').remove()
        this.planes = {}
        for (const plane of planes) {
            const g = this.mainSvgGroup.append('g').attr('class', `plane plane-${plane}`)
            if (compositing.mode === 'planes' && compositedPlanes.includes(plane))
                g.style('will-change', 'transform')
            this.planes[plane] = g
        }
        for (var l in this.layers) {
            const layer = this.layers[l]
            layer.view.parent = this.planes[planeOf(layer)]
            layer.update.parent()
        }
    }

    private updateData() {
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
        if (this.layers['link-arcs']) 
            this.layers['link-arcs'].update.style()

        if (this.layers['stem-arc'])
            this.layers['stem-arc'].update.style()

        // hovered and selected classes of cells, nodes and symbols
        // (otherwise they only changed with the next transformation update)
        if (this.layers['cells'])
            this.layers['cells'].update.style()
        if (this.layers['nodes'])
            this.layers['nodes'].update.style()
        if (this.layers['symbols'])
            this.layers['symbols'].update.style()

        if (this.layers['path-arcs'])
            this.layers['path-arcs'].update.data()

        var t1 = performance.now()
        // navigation background disk
        if (this.layers['link-arcs-focus']) 
            this.layers['link-arcs-focus'].update.data()

        // navigation params, ok, aber die normale disk?
        var t2 = performance.now()
        if (this.layers['labels']) 
            this.layers['labels'].update.data()
        // force labels: their data only when they show the hovered node or its path;
        // otherwise the style (the hovered label is highlighted: markHoveredLabel)
        for (const name of ['labels-force', 'labels-placed']) {
            const l = this.layers[name]
            if (!l || !l.args) continue
            if (l.args.hoverLabel || l.args.hoverPathLabels) l.update.data()
            else l.update.style()
        }
        
        var t3 = performance.now()
        this.d3meta = { 
            Δ:[t1-t0, t2-t1, t3-t2], 
            names:['path-arcs', 'link-arcs-focus', 'labels'] 
        }

    }
}
