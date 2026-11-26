import * as d3                     from 'd3'
import { N }                       from '../data/n'
import { voronoiLayout, VoronoiLayout } from '../filter/voronoi'
import { C }                       from '../geometry/hyperbolic-math'
import { TransformationCache }     from '../geometry/transformation'
import { LayerStack }              from './layerstack'
import { FrameReason }             from './layer'
import { UnitDiskArgs }            from './unitdisk-model'
import { UnitDiskView }            from './unitdisk-model'
import { cacheUpdate }             from '../filter/culling'

//----------------------------------------------------------------------------------------

export interface IUnitDisk
{
    view:               UnitDiskView
    args:               UnitDiskArgs

    cache:              TransformationCache
    cacheMeta?          // timings of the last cache update (magic-filter.ts)
    voronoiLayout :     VoronoiLayout<N>
    layerStack:         LayerStack
    pinchcenter?:       C
    isDraging?:         boolean
    isWheeling?:        boolean          // during a wheel burst (low detail, like dragging)

    api: {
        setTransform: (t:string, tn:string)=> void
    }

    /** A frame: the filter (unless style only), then the layers that need the reason. */
    frame(reason:FrameReason): void
    update: {
        cache:          ()=> void,
        data:           ()=> void,
        layout:         ()=> void,
        transformation: ()=> void,
        pathes:         ()=> void
    }
}

//----------------------------------------------------------------------------------------

// The host of the layer stack: the plane's group in the svg, the clip and the voronoi
// extent of the projection, and the frame.
export class UnitDisk implements IUnitDisk
{
    public view          : UnitDiskView
    public args          : UnitDiskArgs
    public cache         : TransformationCache // the transformation's cache
    public voronoiLayout : VoronoiLayout<N>

    public layerStack    : LayerStack
    public pinchcenter   : C
    public isDraging     : boolean
    public isWheeling    : boolean          // during a wheel burst (low detail, like dragging)
    public cacheMeta

    private mainsvg // d3 select

    constructor(view:UnitDiskView, args : UnitDiskArgs) {
        this.view = view
        this.args = args
        this.cache = args.transformation.cache
        this.update.parent()
    }

    public api = {
        setTransform: (t:string, tn:string)=> this.mainsvg.attr('transform', t)
    }

    /**
     * A frame. 'data' and 'transform': the filter selects the visible nodes (the
     * frame cache), then the layers draw them; 'style': the hover and selection state
     * changed, the filter runs (the paths are part of the visible set) and only the
     * layers that show the state draw.
     */
    public frame(reason:FrameReason) {
        this.view.hypertree.highlightFramePending = false
        cacheUpdate(this, this.cache)
        this.layerStack.frame(reason)
    }

    public update = {
        parent:         ()=> this.updateParent(),
        cache:          ()=> cacheUpdate(this, this.cache),
        data:           ()=> this.frame('data'),
        layout:         ()=> this.frame('data'),
        transformation: ()=> this.frame('transform'),
        pathes:         ()=> this.frame('style'),
    }

    private updateParent() {
        this.mainsvg = d3.select(this.view.parent).append('g')
            .attr('class', this.view.className)
            .attr('transform', this.view.position)

        const projection = this.args.projection, clipRadius = this.args.model.geometry.clipRadius
        const clip = this.mainsvg.append('clipPath').attr('id', 'circle-clip' + clipRadius)
        projection.clip(clip, clipRadius)

        this.voronoiLayout = voronoiLayout<N>(d=> d.cache.re, d=> d.cache.im, projection.voronoiExtent())

        this.layerStack = new LayerStack({
            parent: this.mainsvg,
            unitdisk: this
        })
    }
}
