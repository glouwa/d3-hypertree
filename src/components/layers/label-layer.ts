import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface LabelLayerArgs extends ILayerArgs
{
    name:        string,
    className:   string,
    invisible?:  boolean,
    hideOnDrag?: boolean,
    data:        ()=> any,    
    delta,
    transform,
    text,
    clip?:       string,
    color?:      (d)=> any,
    background?: any,          // falsy, or a function of the node: draw a background rect
    shrinkAtRim?: boolean,     // scale with the distance like the links (to 0 at the rim) instead of the damped scale (1 to 0.5)
}

export class LabelLayer implements ILayer
{    
    view:            ILayerView
    args:            LabelLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string   
    simulation
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> {
            this.d3updatePattern.update.data()

            if (this.args.background)
                this.d3updatePattern.addTextBackgroundRects(
                    paddingLeftRight, 
                    paddingTopBottom,
                    .05,
                    this.args.name)
            //this.d3updatePattern2.update.data()
        },
        transformation: ()=> {            
            this.d3updatePattern.update.transformation()
            //this.d3updatePattern2.update.transformation()
        },
        style:          ()=> { 
            this.d3updatePattern.update.style()
            //this.d3updatePattern2.update.style()
        }
    }

    constructor(view:ILayerView, args:LabelLayerArgs) {
        this.view = view
        this.args = args  
        this.name = args.name
    }

    private attach() {
        const $this = this
        function offset(d, i, v) {
            return $this.args.transform(d, $this.args.delta(d, i, v))
        }

        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text',
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.precalc.icon && navigator.platform.includes('inux'))
                                    //.style("fill",           d=> d.pathes.finalcolor)
                                    .style("stroke",         d=> d.pathes && d.pathes.labelcolor)
                                    .style("fill",           d=> this.args.color(d) )
                                    .call(s=> setLabelText(s, this.args.text)),
            updateColor:       s=> s.style("stroke",         d=> d.pathes && d.pathes.labelcolor)
                                    .style("fill",           d=> this.args.color(d) ),
            updateTransform:   s=> s.attr("transform",       offset)
           //                         .text(                   this.args.text) 
        })
    }
}

var paddingLeftRight = .08
var paddingTopBottom = .02

/**
 * Sets the text of label elements. A '\n' in the text gives several lines (tspans
 * below each other, 1.2 em apart); the first line stays where a one-line label is.
 */
export function setLabelText(s, text:(d)=> string) {
    return s.each(function(d) {
        const t = text(d)
        const lines = typeof t === 'string' ? t.split('\n') : [t]
        if (lines.length === 1) { this.textContent = t === undefined || t === null ? '' : t; return }
        this.textContent = ''
        lines.forEach((line, i)=> {
            const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            span.setAttribute('x', '0')
            if (i > 0) span.setAttribute('dy', '1.2em')
            span.textContent = line
            this.appendChild(span)
        })
    })
}

export var bboxCenter = (d, cacheId='labelslen')=> {
    var w = d.precalc[cacheId]
    var h = .045                  
    console.assert(w)
    return { re:-w/2, im:h/3}        
}

export var bboxOval = (d, cacheId='labelslen', θn=undefined)=> {
    var w = d.precalc[cacheId]
    var h = .045     
    console.assert(w)         
    const θ = θn ? θn.θ : d.cachep.θ
/*
    return CsubC(        
        { 
            re:(w/2+paddingLeftRight/2)*Math.cos(θ), 
            im:(h/2+paddingTopBottom/2)*Math.sin(θ) 
        },
        { re:w/2, im:h/2}
    )
*/    
    const result = {
        re:(paddingLeftRight/2 + w/2) * Math.cos(θ) - w/2,
        im:(paddingTopBottom/2 + h/2) * Math.sin(θ) + h/3
    }
    console.assert(!!result.re)
    return result
}
