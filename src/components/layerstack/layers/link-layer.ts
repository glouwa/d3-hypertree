import { N }              from '../../../models/n/n'
import { CsubC, CktoCp }  from '../../../hyperbolic-math'
import { arcCenter }      from '../../../hyperbolic-math'
import { ILayer }         from '../layer'
import { D3UpdateLayer }  from '../layer'

export type ArcCurvature = '+' | '0' | '-' | 'l'
export interface ArcLayerArgs
{
    data:      ()=> any,
    name:      string,
    curvature: ArcCurvature,
    classed:   (s,w)=> void,
    width,
    clip?:     string,
}

export class ArcLayer implements ILayer
{    
    args: ArcLayerArgs
    layer: D3UpdateLayer
    name:             string
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args: ArcLayerArgs) {
        this.args = args
        this.name = args.name
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         'arc',
            elementType:       this.args.curvature == 'l' ? 'line' : 'path',
            create:            s=> {},
            updateColor:       s=> this.args.classed(s, this.args.width),
            updateTransform:   s=> {
                if (this.args.curvature == 'l')
                    s.attr('x1',             d=> d.cache.re)
                     .attr('y1',             d=> d.cache.im)
                     .attr('x2',             d=> d.parent.cache.re)
                     .attr('y2',             d=> d.parent.cache.im)
                     .attr("stroke-width",   d=> this.args.width(d))
                     .attr("stroke-linecap", d=> "round")
                else
                    s.attr("d",              d=> this.arcOptions[this.args.curvature](d))
                     .attr("stroke-width",   d=> this.args.width(d))
                     .attr("stroke-linecap", d=> "round")
            },
        })
    }

    private curvature() {
        return this.args.curvature
    }

    private width(d) {
        return this.arcOptions[this.args.curvature](d)
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
        var s = d.strCache
        var e = d.parent.strCache
        return `M ${s} L ${e}`
    }

    private arcOptions = {
        '+': this.svgArc('1', '0'),
        '-': this.svgArc('0', '1'),
        '0': this.svgArcLine,
    }
}
