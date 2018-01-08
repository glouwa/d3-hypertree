import { N }              from '../../models/n/n'
import { CsubC, CktoCp }  from '../../hyperbolic-math'
import { C }              from '../../hyperbolic-math'
import { arcCenter }      from '../../hyperbolic-math'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern }from '../layerstack/d3updatePattern'

export type ArcCurvature = '+' | '0' | '-' | 'l'
export interface ArcLayerArgs
{
    data:       ()=> any,
    name:       string,
    className:  string,
    curvature:  ArcCurvature,
    nodePos:    (n)=> C,
    nodePosStr: (n)=> string,
    classed:    (s,w)=> void,
    width,
    clip?:      string,
}

export class ArcLayer implements ILayer
{   
    view:            ILayerView 
    args:            ArcLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
  
    constructor(view:ILayerView, args:ArcLayerArgs) {
        this.view = view
        this.args = args
        this.name = args.name
    }

    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         this.args.className,
            elementType:       this.args.curvature == 'l' ? 'line' : 'path',
            create:            s=> {},
            updateColor:       s=> this.args.classed(s, this.args.width),
            updateTransform:   s=> {                
                if (this.args.curvature == 'l')
                    s.attr('x1',             d=> this.args.nodePos(d).re)
                     .attr('y1',             d=> this.args.nodePos(d).im)
                     .attr('x2',             d=> this.args.nodePos(d.parent).re)
                     .attr('y2',             d=> this.args.nodePos(d.parent).im)
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

    private arcOptions = {
        '+': this.svgArc('1', '0'),
        '-': this.svgArc('0', '1'),
        '0': this.svgArcLine,
    }

    private svgArc(a:string, b:string) : (d:N)=> string {
        var $this = this        
        return function(d) : string {
            var arcP1 = $this.args.nodePos(d)
            var arcP2 = $this.args.nodePos(d.parent)
            var arcC = arcCenter(arcP1, arcP2)

            var r = CktoCp(CsubC(arcP2, arcC.c)).r; if (isNaN(r)) r = 0;            
            var f = arcC.d>0 ? a : b
            var s = $this.args.nodePosStr(d)
            var e = $this.args.nodePosStr(d.parent)
            return `M ${s} A ${r} ${r}, 0, 0, ${f}, ${e}`
        }
    }

    private svgArcLine(d) {
        var s = this.args.nodePosStr(d)
        var e = this.args.nodePosStr(d.parent)
        return `M ${s} L ${e}`
    }
}
