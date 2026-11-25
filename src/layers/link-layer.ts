import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { StateDisplay, showsState } from './state-display'
import { ArcCurvature }    from '../projection/projection'

export type { ArcCurvature }

export interface ArcLayerArgs extends ILayerArgs
{
    className?:  string,
    // 'links': the links of the tree; 'paths': the hover and selection paths (drawn
    // over the links, thicker, in the path's color)
    role?:       'links' | 'paths',
    curvature?:  ArcCurvature,          // default geometry.linkCurvature
    stroke?:     (d)=> any,
    strokeWidth?:(d)=> number,          // default geometry.linkWidth
    hover?:      StateDisplay,   // links: how hover is shown; paths: false / 'none' leaves out the hover path
    selection?:  StateDisplay,   // same for the selection
}

// The links of the tree (or the hover and selection paths) as geodesics of the
// projection: arcs in the disk, semicircles in the half-plane view, lines ('l').
export class ArcLayer implements ILayer
{
    static links : LayerType<ArcLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:   false,
            hideOnDrag:  false,
            data:        'links',
            className:   'arc',
            role:        'links',
            curvature:   ctx.model.geometry.linkCurvature,
            stroke:      n=> undefined,
            strokeWidth: (d:N)=> ctx.model.geometry.linkWidth(d),
            hover:       'path',
            selection:   'path',
        }),
        create: (ctx, name, args)=> new ArcLayer(ctx, name, args),
    }
    static paths : LayerType<ArcLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:   false,
            hideOnDrag:  false,
            data:        'paths',
            className:   'arc',
            role:        'paths',
            curvature:   ctx.model.geometry.linkCurvature,
            stroke:      n=> undefined,
            strokeWidth: (d:N)=> ctx.model.geometry.linkWidth(d) + (.013 * d.dampedDistScale),
            hover:       'path',
            selection:   'path',
        }),
        create: (ctx, name, args)=> new ArcLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            ArcLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform', 'style']

    constructor(view:LayerContext, name:string, args:ArcLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        // the paths change with the hover and selection state: their data
        style:          ()=> this.args.role === 'paths' ? this.d3updatePattern.update.data() : this.d3updatePattern.update.style()
    }

    // paths: layer options hover / selection false or 'none' leave out the hover path
    // or the selection paths (other paths, e.g. a query, are always drawn)
    private data() : N[] {
        const nodes = layerData(this.view, this.args.data, this)
        if (this.args.role !== 'paths') return nodes
        const off = m=> m === false || m === 'none'
        if (!off(this.args.hover) && !off(this.args.selection)) return nodes
        return nodes.filter(d=> d.pathes.partof.some(p=>
            p.type === 'HoverPath'     ? !off(this.args.hover) :
            p.type === 'SelectionPath' ? !off(this.args.selection) : true))
    }

    private path(d:N) : string {
        const p = this.view.projection
        return d.parent ? p.geodesic(d.cache, d.parent.cache, this.args.curvature) : p.stem(d.cache, this.args.curvature)
    }

    private attach() {
        const style = this.args.role === 'paths'
            ? (s)=> s.classed("hovered-path",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                     .classed("selected-path", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                     .style("stroke",          d=> d.pathes && d.pathes.finalcolor)
            : (s)=> s.style("stroke",     d=> (d.pathes && d.pathes.finalcolor) || this.args.stroke(d))
                     .classed("hovered",   d=> showsState(this.args.hover, d, 'hover'))
                     .classed("selected",  d=> showsState(this.args.selection, d, 'selection'))
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.role === 'links' ? '#circle-clip' + this.view.model.geometry.clipRadius : undefined,
            data:              ()=> this.data(),
            name:              this.name,
            className:         this.args.className,
            elementType:       this.args.curvature === 'l' ? 'line' : 'path',
            create:            s=> s.attr("stroke-linecap", "round"),   // constant: set once
            updateColor:       style,
            updateTransform:   s=> {
                if (this.args.curvature == 'l')
                    s.attr('x1',             d=> d.cache.re)
                     .attr('y1',             d=> d.cache.im)
                     .attr('x2',             d=> d.parent ? d.parent.cache.re : d.cache.re)
                     .attr('y2',             d=> d.parent ? d.parent.cache.im : 1)
                     .attr("stroke-width",   d=> this.args.strokeWidth(d))
                else
                    s.attr("d",              d=> this.path(d))
                     .attr("stroke-width",   d=> this.args.strokeWidth(d))
            },
        })
    }
}
