import { IUnitDisk }   from './unitdisk'
import { ILayer, LayerContext, FrameReason } from './layer'
import { LayerSpec }   from '../config/schema'
import { mergeInto }   from '../config/resolve'
import { layerTypes, defaultLayers } from '../layers'
import { planes, planeOf, compositedPlanes, compositing } from './planes'

export interface LayerStackArgs
{
    parent,
    unitdisk: IUnitDisk
}

// The layers of a unit disk, built from the model's layer specs (geometry.layers,
// layerOptions), grouped in compositor planes, drawn by frame(reason).
export class LayerStack
{
    args:         LayerStackArgs
    mainSvgGroup: any
    planes:       { [key:string]: any }       // compositor planes (see planes.ts)
    layers:       { [key:string]: ILayer }
    d3meta

    public update = {
        parent: ()=> this.updateLayers(),
        data:   ()=> this.frame('data'),
        pathes: ()=> this.frame('style'),
    }

    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.mainSvgGroup = this.args.parent.append('g')
        this.updateLayers()
    }

    private context() : LayerContext {
        const ud = this.args.unitdisk
        return {
            parent:     this.mainSvgGroup,
            layerstack: this,
            unitdisk:   ud,
            hypertree:  ud.view.hypertree,
            model:      ud.args.model,
            cache:      ud.cache,
            projection: ud.args.projection,
        }
    }

    /**
     * A layer from a spec: the type's defaults, the spec's options, the model's
     * layerOptions[name]. A string is the name of a default layer (its spec).
     */
    private createLayer(spec:LayerSpec | string | ((ctx, ud)=> ILayer), layerOptions:{ [name:string]: any }) : ILayer | undefined {
        const ctx = this.context()
        if (typeof spec === 'string') {
            const name = spec
            spec = defaultLayers().find(s=> s.name === name)
            if (!spec) { console.warn(`d3-hypertree: no default layer ${name}`); return undefined }
        }
        if (typeof spec === 'function') {            // an own layer, created by a function
            const layer = spec(ctx, this.args.unitdisk)
            const options = layerOptions[layer.name]
            if (options && options.removed) return undefined
            if (options) mergeInto(layer.args, options)
            return layer
        }
        const name = spec.name || spec.type
        const type = layerTypes[spec.type]
        if (!type) { console.warn(`d3-hypertree: unknown layer type ${spec.type} (layer ${name})`); return undefined }
        const options = layerOptions[name]
        if (spec.removed || (options && options.removed)) return undefined
        const args = mergeInto({}, type.defaults(ctx))
        if (spec.data !== undefined) args.data = spec.data
        mergeInto(args, spec.options)
        mergeInto(args, options)
        return type.create(ctx, name, args)
    }

    private updateLayers() : void
    {
        this.layers = {}
        const model = this.args.unitdisk.args.model
        const layerOptions = model.geometry.layerOptions || {}
        for (const spec of <any[]>model.geometry.layers) {
            const layer = this.createLayer(spec, layerOptions)
            if (layer) this.layers[layer.name] = layer
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

    /**
     * Draws the frame: every layer that needs the reason ('data': the visible set may
     * have changed, 'transform': positions changed, 'style': the hover and selection
     * state changed). A layer declares its needs (default: data and transform).
     */
    public frame(reason:FrameReason) {
        const timings = [], names = []
        for (var l in this.layers) {
            const layer = this.layers[l]
            const needs = layer.needs || ['data', 'transform']
            if (!needs.includes(reason)) continue
            const t0 = performance.now()
            if (reason === 'style') layer.update.style()
            else layer.update.data()
            timings.push(performance.now() - t0)
            names.push(layer.name)
        }
        this.d3meta = { Δ:timings, names:names }
    }
}
