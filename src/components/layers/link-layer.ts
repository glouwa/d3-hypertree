import { N }               from '../../models/n/n'
import { CsubC, CktoCp }   from '../../models/transformation/hyperbolic-math'
import { C }               from '../../models/transformation/hyperbolic-math'
import { arcCenter }       from '../../models/transformation/hyperbolic-math'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { StateDisplay }    from './state-display'
import { BORDER_Y }        from '../../models/transformation/cayley'

export type ArcCurvature = '+' | '0' | '-' | 'l'
export interface ArcLayerArgs extends ILayerArgs
{
    data:       ()=> any,
    name:       string,
    className:  string,
    curvature:  ArcCurvature,
    nodePos:    (n:N)=> C,
    nodePosStr: (n:N)=> string,
    classed:    (s, w, c?)=> void,
    width?,
    clip?:      string,
    stroke?:     (d)=> any,
    strokeWidth?:(d)=> any,
    hover?:      StateDisplay,   // link-arcs: how hover is shown; path-arcs: false / 'none' leaves out the hover path
    selection?:  StateDisplay,   // same for the selection
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
            elementType:       this.args.curvature === 'l' ? 'line' : 'path',
            create:            s=> s.attr("stroke-linecap", "round"),   // constant: set once
            //updateColor:       s=> this.args.classed(s, this.args.width),
            updateColor:       s=> this.args.classed(s, this.args.width, this.args.stroke),
            updateTransform:   s=> {
                const c = d=> this.args.curvature

                if (this.args.curvature == 'l')
                    s.attr('x1',             d=> this.args.nodePos(d).re)
                     .attr('y1',             d=> this.args.nodePos(d).im)
                     .attr('x2',             d=> this.args.nodePos(d.parent).re)
                     .attr('y2',             d=> this.args.nodePos(d.parent).im)
                     .attr("stroke-width",   d=> this.args.strokeWidth(d))
                else
                    s.attr("d",              d=> this.arcOptions[c(d)](d))
                     .attr("stroke-width",   d=> this.args.strokeWidth(d))

                //this.args.classed(s, this.args.width)
            },
        })
    }

    private arcOptions = {
        '+': this.svgArc('1', '0'),
        '-': this.svgArc('0', '1'),
        '0': (d:N)=> this.svgArcLine(d),   // straight line as a path (was called without this)
    }

    private svgArc(a:string, b:string) : (d:N)=> string {
        var $this = this
        return function(d) : string {
            if ($this.view.hypertree.args.geometry.halfPlane)
                return $this.halfPlaneArc(d)
            var arcP1 = $this.args.nodePos(d)
            var arcP2 = d.parent 
                      ? $this.args.nodePos(d.parent)
                      : { re:arcP1.re, im:1 }
            console.assert(!!arcP1)
            console.assert(!!arcP2)
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

    // half-plane view (cayley.ts): geodesics are semicircles centered on the real axis
    // (the top edge, view y = −1), or vertical lines. View (X, Y) = w (X, Y + 1).
    private halfPlaneArc(d:N) : string {
        const p1 = this.args.nodePos(d)
        if (!d.parent) return `M ${p1.re} ${p1.im} L ${p1.re} 3`        // the root's stem: into the wedge gap, at infinity below
        const p2 = this.args.nodePos(d.parent)
        const x1 = p1.re, y1 = p1.im - BORDER_Y, x2 = p2.re, y2 = p2.im - BORDER_Y
        if (Math.abs(x1 - x2) < 1e-9 * (1 + Math.abs(x1)))
            return `M ${x1} ${p1.im} L ${x2} ${p2.im}`
        const c = (x1 * x1 + y1 * y1 - x2 * x2 - y2 * y2) / (2 * (x1 - x2))
        const r = Math.hypot(x1 - c, y1)
        // the arc hangs below the border: from left to right is counterclockwise on
        // screen (sweep 0)
        return `M ${x1} ${p1.im} A ${r} ${r}, 0, 0, ${x1 < x2 ? 0 : 1}, ${x2} ${p2.im}`
    }

    private svgArcLine(d:N) {
        var s = this.args.nodePosStr(d)
        var e = d.parent                             // like svgArc: the root's stem goes down
              ? this.args.nodePosStr(d.parent)
              : `${this.args.nodePos(d).re} 1`
        return `M ${s} L ${e}`
    }
}
