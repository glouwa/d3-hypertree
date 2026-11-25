import { LayerStack }          from './layerstack'
import { IUnitDisk }           from './unitdisk'
import { Hypertree }           from '../hypertree'
import { HypertreeArgs }       from '../config/schema'
import { TransformationCache } from '../geometry/transformation'
import { Projection }          from '../projection/projection'

/**
 * What a layer gets to draw with: the group to draw in, the resolved model, the frame
 * cache, the projection and the host objects. Layers read options from ctx.model
 * (never from the hypertree's internals) and geometry from ctx.projection.
 */
export interface LayerContext
{
    parent,                          // the d3 group of the layer's plane (set by the stack)
    layerstack:  LayerStack,
    unitdisk:    IUnitDisk,          // the host: voronoiLayout, pinchcenter, isDraging
    hypertree:   Hypertree,          // the facade: data, api, isAnimationRunning, langMap
    model:       HypertreeArgs,      // the resolved model
    cache:       TransformationCache,
    projection:  Projection,
}

/** The data of a layer: a channel of the frame cache by name, or a function (of the layer). */
export type LayerData = string | ((layer?:ILayer)=> any)

export interface ILayerArgs
{
    invisible?:  boolean,
    hideOnDrag?: boolean,
    plane?:      'disk' | 'content' | 'overlay',   // compositor plane (default by layer name, see planes.ts)
    data?:       LayerData,
}

/** What a frame can ask of a layer (layerstack.ts frame). */
export type FrameReason = 'data' | 'transform' | 'style'

export interface ILayer
{
    view: LayerContext,
    args,
    name: string,
    /** the frames the layer draws on (default: data and transform; style for the hover/selection classes) */
    needs?: readonly FrameReason[],

    update: {
        parent:         ()=> void,
        data:           ()=> void,
        transformation: ()=> void,
        style:          ()=> void,
    }
}

/**
 * A layer type (layers/index.ts layerTypes): its defaults for a context and how to
 * create a layer. A LayerSpec names the type; its options and the model's
 * layerOptions[name] are merged over the defaults.
 */
export interface LayerType<A extends ILayerArgs = any>
{
    defaults:  (ctx:LayerContext)=> A,
    create:    (ctx:LayerContext, name:string, args:A)=> ILayer,
}

/** The data of a layer as an array: the cache channel or the function's result. */
export function layerData(ctx:LayerContext, data:LayerData, layer?:ILayer) : any[] {
    if (typeof data === 'function') return data(layer) || []
    if (typeof data === 'string') return (ctx.cache as any)[data] || []
    return []
}
