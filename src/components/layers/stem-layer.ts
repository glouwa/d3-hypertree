import { N }               from '../../models/n/n'
import { CsubC, CktoCp }   from '../../models/transformation/hyperbolic-math'
import { C }               from '../../models/transformation/hyperbolic-math'
import { arcCenter }       from '../../models/transformation/hyperbolic-math'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export type ArcCurvature = '+' | '0' | '-' | 'l'
export interface StemLayerArgs extends ILayerArgs
{
    data:       ()=> any,
    name:       string,
    className:  string,
    curvature:  ArcCurvature,
    nodePos:    (n:N)=> C,
    nodePosStr: (n:N)=> string,
    classed:    (s,w)=> void,
    classed2:   (s,w)=> void,
    width,
    clip?:      string,
}

export class StemLayer implements ILayer
{   
    view:            ILayerView 
    args:            StemLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string
  
    constructor(view:ILayerView, args:StemLayerArgs) {
        this.view = view
        this.args = args
        this.name = args.name
    }

    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> { 
            this.d3updatePattern.update.data() 
            this.d3updatePattern2.update.data() 
        },
        transformation: ()=> { 
            this.d3updatePattern.update.transformation() 
            this.d3updatePattern2.update.transformation() 
        },
        style:          ()=> { 
            this.d3updatePattern.update.style() 
            this.d3updatePattern2.update.style() 
        }
    }

    private attach() {
        const straincurvature : string = '-' // this.args.curvature
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              ()=> this.view.hypertree.data?[this.view.hypertree.data]:[],
            name:              'stem-link', 
            className:         this.args.className,
            elementType:       straincurvature === 'l' ? 'line' : 'path',
            create:            s=> {},
            updateColor:       s=> this.args.classed(s, this.args.width),
            updateTransform:   s=> {                
                if (straincurvature === 'l')
                    s.attr('x1',             d=> this.args.nodePos(d).re)
                     .attr('y1',             d=> this.args.nodePos(d).im)
                     .attr('x2',             d=> this.args.nodePos(d).re)
                     .attr('y2',             d=> 1)
                     .attr("stroke-width",   d=> this.args.width(d)+.01)
                     .attr("stroke-linecap", d=> "round")
                else 
                    s.attr("d",              d=> this.arcOptions[this.args.curvature](d))
                     .attr("stroke-width",   d=> this.args.width(d)+.015)
                     .attr("stroke-linecap", d=> "round")
            },
        })        
        this.d3updatePattern2 = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              ()=> this.view.hypertree.data?[this.view.hypertree.data]:[],
            name:              'stem-path hovered-path',
            className:         this.args.className,
            elementType:       straincurvature === 'l' ? 'line' : 'path',
            create:            s=> {},
            updateColor:       s=> this.args.classed2(s, this.args.width),
            updateTransform:   s=> {                
                if (straincurvature === 'l')
                    s.attr('x1',             d=> this.args.nodePos(d).re)
                     .attr('y1',             d=> this.args.nodePos(d).im)
                     .attr('x2',             d=> this.args.nodePos(d).re)
                     .attr('y2',             d=> 1)
                     .attr("stroke-width",   d=> this.args.width(d)+.01)
                     .attr("stroke-linecap", d=> "round")
                else 
                    s.attr("d",              d=> this.arcOptions[this.args.curvature](d))
                     .attr("stroke-width",   d=> this.args.width(d)+.015)
                     .attr("stroke-linecap", d=> "round")
            },
        })
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
            var arcP2 = d.parent 
                      ? $this.args.nodePos(d.parent)
                      : { re:arcP1.re, im:1 }
            console.assert(arcP1)
            console.assert(arcP2)
            var arcC = arcCenter(arcP1, arcP2)

            var r = CktoCp(CsubC(arcP2, arcC.c)).r; if (isNaN(r) || r > 1000) r = 0;            
            var f = arcC.d>0 ? a : b
            var s = $this.args.nodePosStr(d)
            var e = d.parent 
                  ? $this.args.nodePosStr(d.parent)
                  : `${arcP1.re} 1` 
            return `M ${s} A ${r} ${r}, 0, 0, ${f}, ${e}`
        }
    }

    private svgArcLine(d:N) {
        var s = this.args.nodePosStr(d)
        var e = this.args.nodePosStr(d.parent)
        return `M ${s} L ${e}`
    }
}
