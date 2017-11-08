import { Layer, LayerArgs }     from './../layers'
import { Interaction }          from './mouseAndCache'
import { N }                    from '../../models/n'
import { CsubC, CktoCp }        from '../../hyperbolic-math'
import { arcCenter }            from '../../hyperbolic-math'

export interface LayerStackArgs
{
    parent,
    interaction: Interaction
}

export class LayerStack
{
    args: LayerStackArgs

    layers:         any

    cells:          Layer // set on create
    links:          Layer
    nodes:          Layer
    captions:       Layer

    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.layers = this.args.parent.append('g')
        this.updateLayers()
    }

    private updateLayers() : void
    {        
        for (var layerfactoryfunc of this.args.interaction.args.layers)
        {
            var argscpy = Object.assign({ parent:this.layers }, this.args.interaction)
            var newL = layerfactoryfunc(this.args.interaction, this.layers)
            this[newL.args.name] = newL
        }        
    }

    public updatePath()
    {
        if (this.cells)    this.cells.updateData()
        if (this.links)    this.links.updateColor()
        if (this.nodes)    this.nodes.updateColor()
        if (this.captions) this.captions.updateData()
        //Materialize.toast("updatePath", 2500)
    }

    public updateTransformation()
    {
        var t0 = performance.now()
        if (this.cells)    this.cells.updateData()
        var t1 = performance.now()
        if (this.links)    this.links.updateData()
        var t2 = performance.now()
        if (this.nodes)    this.nodes.updateData()
        var t3 = performance.now()
        if (this.captions) this.captions.updateData()
        this.args.interaction.args.unitdisk.infoUi.updateD3Info(10, [t1-t0, t2-t1, t3-t2, performance.now() - t3])
    }
}


export namespace Layers
{
    export interface CellLayerArgs
    {
        parent,
        data,
        clip?:  (l)=> string,
    }

    export class CellLayer extends Layer
    {
        constructor(args: CellLayerArgs)
        {
            super({
                parent: args.parent,
                clip: args.clip,
                data: args.data,
                name:              'cells',
                className:         'cell',
                elementType:       'polygon',
                create:            l=> e=> e.classed("root",      d=> !d.data.parent)
                                            .classed("leaf",      d=> !d.data.children),
                updateColor:       l=> s=> s.classed("hovered",   d=> d.data.isHovered)
                                            .classed("selected",  d=> d.data.isSelected),
                updateTransform:   l=> s=> s.attr("points",       d=> d.join(" ")),
            })
        }
    }

    //-----------------------------------------------------------------------------------------

    export type ArcCurvature = '+' | '0' | '-' | 'l'
    export interface ArcLayerArgs
    {
        parent,
        data:      (l)=> any,
        curvature: (l)=> ArcCurvature,
        width,
        clip?:     (l)=> string,
    }

    export class ArcLayer extends Layer
    {
        args: ArcLayerArgs
        constructor(args: ArcLayerArgs)
        {
            super({
                parent: args.parent,
                clip: args.clip,
                data: args.data,
                name:              'links',
                className:         'arc',
                elementType:       args.curvature(null) == 'l' ? 'line' : 'path',
                create:            l=> s=> {},
                updateColor:       l=> s=> s.classed("hovered",   d=> d.isHovered)
                                            .classed("selected",  d=> d.isSelected),
                updateTransform:   l=> s=> {
                    if (args.curvature(null) == 'l')
                        s.attr('x1',           d=> d.cache.re)
                         .attr('y1',           d=> d.cache.im)
                         .attr('x2',           d=> d.parent.cache.re)
                         .attr('y2',           d=> d.parent.cache.im)
                         .attr("stroke-width", d=> args.width(null)(d))
                         .attr("stroke-linecap", d=> "round")
                    else
                        s.attr("d",            d=> this.arcOptions[args.curvature(null)](d))
                         .attr("stroke-width", d=> args.width(null)(d))
                         .attr("stroke-linecap", d=> "round")
                },
            })
        }

        private curvature()
        {
            return this.args.curvature(this)
        }

        private width(d)
        {
            return this.arcOptions[this.args.curvature(this)](d)
        }

        private svgArc(a:string, b:string) : (d:N)=> string
        {
            return function(d) : string
            {
                var arcP1 = d.cache
                var arcP2 = d.parent.cache
                var arcC = arcCenter(arcP1, arcP2)

                var r = CktoCp(CsubC(arcP2, arcC.c)).r; if (isNaN(r)) r = 0;
                var s = d.strCache
                var f = arcC.d>0 ? a : b
                var e = d.parent.strCache
                return `M ${s} A ${r} ${r}, 0, 0, ${f}, ${e}`
            }
        }

        private svgArcLine(d)
        {
            var s = d.strCache                                  //this.t(d)
            var e = d.parent.strCache                           //this.t(d.parent)
            return `M ${s} L ${e}`
        }

        private arcOptions = {
            '+': this.svgArc('1', '0'),
            '-': this.svgArc('0', '1'),
            '0': this.svgArcLine,
        }
    }

    //-----------------------------------------------------------------------------------------

    export interface NodeLayerArgs
    {
        parent,
        data,
        r:         (l)=> any,
        transform,
        clip?:     (l)=> string,
    }

    export class NodeLayer extends Layer
    {
        constructor(args: NodeLayerArgs)
        {
            super({
                parent: args.parent,
                clip: args.clip,
                data: args.data,
                name:              'nodes',
                className:         'node',
                elementType:       'circle',
                create:            l=> s=> s.attr("r",            d=> args.r(null)(d))
                                            .classed("root",      d=> !d.parent)
                                            .classed("lazy",      d=> d.hasOutChildren)
                                            .classed("leaf",      d=> d.parent)
                                            .classed("exit",      d=> (!d.children || !d.children.length)
                                                                      && d.data && d.data.numLeafs),
                updateColor:       l=> s=> s.classed("hovered",   d=> d.isHovered)
                                            .classed("selected",  d=> d.isSelected),
                updateTransform:   l=> s=> s.attr("transform",    d=> args.transform(null)(d))
                                            .attr("r",            d=> args.r(null)(d)),
            })
        }
    }

    //-----------------------------------------------------------------------------------------

    export interface LabelLayerArgs
    {
        parent,
        data:     (l)=> any,
        delta,
        transform,
        text,
        clip?:    (l)=> string,
    }

    export class LabelLayer extends Layer
    {
        constructor(args: LabelLayerArgs)
        {
            super({
                parent: args.parent,
                clip: args.clip,
                data: args.data,
                name:              'captions',
                className:         'caption',
                elementType:       'text',
                create:            l=> s=> s.classed("P",         d=> d.name == 'P')
                                            .classed("caption-icon",      d=> d.icon && navigator.platform.includes('inux') ),
                updateColor:       l=> s=> {},
                updateTransform:   l=> s=> s.attr("transform",    d=> args.transform(null)(d))
                                            .text(                args.text(null))
                                            .attr("dx",           (d, i, v)=> args.delta(null)(d, i, v).re)
                                            .attr("dy",           (d, i, v)=> args.delta(null)(d, i, v).im)
            })
        }
    }
}

