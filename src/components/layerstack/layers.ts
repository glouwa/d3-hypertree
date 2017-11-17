import { N }                        from '../../models/n'
import { CsubC, CktoCp }            from '../../hyperbolic-math'
import { arcCenter }                from '../../hyperbolic-math'
import { ILayer }                   from './index'
import { D3UpdateLayer, LayerArgs } from './index'

export namespace Layers
{
    export interface CellLayerArgs
    {
        data,
        clip?:  (l)=> string,
    }

    export class CellLayer implements ILayer
    {
        args: CellLayerArgs
        layer: D3UpdateLayer
        updateData =      ()=> this.layer.updateData()
        updateTransform = ()=> this.layer.updateTransform()
        updateColor =     ()=> this.layer.updateColor()
        name = 'cells'

        constructor(args: CellLayerArgs) {
            this.args = args
        }

        public attach(parent) {
            this.layer = new D3UpdateLayer({
                parent:            parent,
                clip:              this.args.clip,
                data:              this.args.data,
                name:              'cells',
                className:         'cell',
                elementType:       'polygon',
                create:            l=> e=> e.classed("root",      d=> !d.data.parent)
                                            .classed("leaf",      d=> !d.data.children),
                updateColor:       l=> s=> s.classed("hovered",   d=> d.data.isHovered && d.data.parent)
                                            .classed("selected",  d=> d.data.isSelected && d.data.parent),
                updateTransform:   l=> s=> s.attr("points",       d=> d.join(" ")),
            })
        }
    }

    //-----------------------------------------------------------------------------------------

    export type ArcCurvature = '+' | '0' | '-' | 'l'
    export interface ArcLayerArgs
    {
        data:      (l)=> any,
        curvature: (l)=> ArcCurvature,
        width,
        clip?:     (l)=> string,
    }

    export class ArcLayer implements ILayer
    {
        args: ArcLayerArgs
        layer: D3UpdateLayer
        updateData =      ()=> this.layer.updateData()
        updateTransform = ()=> this.layer.updateTransform()
        updateColor =     ()=> this.layer.updateColor()
        name = 'links'

        constructor(args: ArcLayerArgs) {
            this.args = args
        }

        public attach(parent) {
            this.layer = new D3UpdateLayer({
                parent:            parent,
                clip:              this.args.clip,
                data:              this.args.data,
                name:              'links',
                className:         'arc',
                elementType:       this.args.curvature(null) == 'l' ? 'line' : 'path',
                create:            l=> s=> {},
                updateColor:       l=> s=> s.classed("hovered",   d=> d.isHovered)
                                            .classed("selected",  d=> d.isSelected),
                updateTransform:   l=> s=> {
                    if (this.args.curvature(null) == 'l')
                        s.attr('x1',             d=> d.cache.re)
                         .attr('y1',             d=> d.cache.im)
                         .attr('x2',             d=> d.parent.cache.re)
                         .attr('y2',             d=> d.parent.cache.im)
                         .attr("stroke-width",   d=> this.args.width(null)(d))
                         .attr("stroke-linecap", d=> "round")
                    else
                        s.attr("d",              d=> this.arcOptions[this.args.curvature(null)](d))
                         .attr("stroke-width",   d=> this.args.width(null)(d))
                         .attr("stroke-linecap", d=> "round")
                },
            })
        }

        private curvature() {
            return this.args.curvature(this)
        }

        private width(d) {
            return this.arcOptions[this.args.curvature(this)](d)
        }

        private svgArc(a:string, b:string) : (d:N)=> string {
            return function(d) : string {
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

        private svgArcLine(d) {
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
        data,
        r:         (l)=> any,
        transform,
        clip?:     (l)=> string,
    }

    export class NodeLayer implements ILayer
    {
        args: NodeLayerArgs
        layer: D3UpdateLayer
        updateData =      ()=> this.layer.updateData()
        updateTransform = ()=> this.layer.updateTransform()
        updateColor =     ()=> this.layer.updateColor()
        name = 'nodes'

        constructor(args: NodeLayerArgs) {
            this.args = args
        }

        public attach(parent) {
            this.layer = new D3UpdateLayer({
                parent:            parent,
                clip:              this.args.clip,
                data:              this.args.data,
                name:              'nodes',
                className:         'node',
                elementType:       'circle',
                create:            l=> s=> s.attr("r",            d=> this.args.r(null)(d))
                                            .classed("root",      d=> !d.parent)
                                            .classed("lazy",      d=> d.hasOutChildren)
                                            .classed("leaf",      d=> d.parent)
                                            .classed("exit",      d=> (!d.children || !d.children.length)
                                                                      && d.data && d.data.numLeafs),
                updateColor:       l=> s=> s.classed("hovered",   d=> d.isHovered && d.data.parent)
                                            .classed("selected",  d=> d.isSelected && d.data.parent),
                updateTransform:   l=> s=> s.attr("transform",    d=> this.args.transform(null)(d))
                                            .attr("r",            d=> this.args.r(null)(d)),
            })
        }
    }

    //-----------------------------------------------------------------------------------------

    export interface LabelLayerArgs
    {        
        data:     (l)=> any,
        delta,
        transform,
        text,
        clip?:    (l)=> string,
    }

    export class LabelLayer implements ILayer
    {
        args: LabelLayerArgs
        layer: D3UpdateLayer
        updateData =      ()=> this.layer.updateData()
        updateTransform = ()=> this.layer.updateTransform()
        updateColor =     ()=> this.layer.updateColor()
        name = 'captions'

        constructor(args: LabelLayerArgs) {
            this.args = args
        }

        public attach(parent) {
            this.layer = new D3UpdateLayer({
                parent:            parent,
                clip:              this.args.clip,
                data:              this.args.data,
                name:              'captions',
                className:         'caption',
                elementType:       'text',
                create:            l=> s=> s.classed("P",         d=> d.name == 'P')
                                            .classed("caption-icon", d=> d.icon && navigator.platform.includes('inux') ),
                updateColor:       l=> s=> {},
                updateTransform:   l=> s=> s.attr("transform",    d=> this.args.transform(null)(d))
                                            .text(                this.args.text(null))
                                            .attr("dx",           (d, i, v)=> this.args.delta(null)(d, i, v).re)
                                            .attr("dy",           (d, i, v)=> this.args.delta(null)(d, i, v).im)
            })
        }
    }
}

