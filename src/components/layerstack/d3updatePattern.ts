import { N } from '../../models/n/n'
import { ILayer } from './layer'
import { CaddC, CsubC } from '../../models/transformation/hyperbolic-math'

export interface D3UpdatePatternArgs
{
    parent:          any,
    layer:           ILayer,

    name:            string,    
    className:       string,
    elementType:     string,
    data:            any,
    clip?:           string,

    create:          (s)=> any,
    updateTransform: (s)=> any,
    updateColor:     (s)=> any,    
}

export class D3UpdatePattern
{
    args                 : D3UpdatePatternArgs
    data                 : any    
    update = {
        parent:         ()=> this.updateParent(),        
        data:           ()=> this.updateData(),
        transformation: ()=> this.elements.call(this.args.updateTransform),
        style:          ()=> this.elements.call(this.args.updateColor)
    }

    private mainSvgGroup : d3.Selection<SVGElement, N, SVGElement, undefined>
    private elements     : any    
    
    constructor(args : D3UpdatePatternArgs) {
        this.args = args
        this.updateParent()
    }

    private updateParent() {
        this.mainSvgGroup = this.args.parent.append('g')
            .attr('id', this.args.name)
            .attr('clip-path', (this.args.clip ? `url(${this.args.clip})` : undefined))
            .style('transform', 'translateZ(0)')

        this.elements =
            this.mainSvgGroup
                .selectAll(this.args.elementType)
    }
    
    private mayEval = d=> typeof d === 'function' ? d() : d
    private updateData() {
        this.data = []
        var isAnimating = this.args.layer.view.hypertree.isAnimationRunning()
        if ((!isAnimating && !this.args.layer.args.invisible) ||
             (isAnimating && !this.args.layer.args.hideOnDrag)) 
        {
            this.data = this.mayEval(this.args.data)
        }
        
        this.elements = this.elements.data(this.data, d=> d && d.mergeId)
        const removedElements = this.elements
            .exit()
                /*.transition()
                .duration(1000)
                .attr("fill-opacity", 0)
                .attr("stroke-opacity", 0)*/            
                .remove()

        const newElements = this.elements
            .enter().append(this.args.elementType)
                .attr("class", this.args.className)
                .call(this.args.create)

        this.elements = this.elements
            .merge(newElements)
                //.call(this.all)
                .call(this.args.updateTransform)
                .call(this.args.updateColor)
        
// extrashit
        if (this.args.name === 'labels-force' && true) this.addTextBackgroundRects()
        if (this.args.name === 'labels' && true)       this.addTextBackgroundRects()
    }

    private addTextBackgroundRects()
    { 
        this.mainSvgGroup.selectAll('rect').remove()
        var svgRootHere = this.mainSvgGroup
        var T = this
        var geometry =  T.args.layer.view.hypertree.args.geometry
        
        if (T.args.layer.view.unitdisk) {
            this.mainSvgGroup.selectAll("text")
            .each(function(d:N, i, v:SVGTextElement[]) 
            {
                if (true ||   d === T.args.layer.view.unitdisk.cache.centerNode 
                    || d.cachep.r < 0.6)
                {
                    var view:any = v[i]
                    var w = d.precalc.labellen //= d.precalc.labellen || view.getComputedTextLength()
                    var h = geometry.captionHeight
                    
                    svgRootHere.insert('rect', d=> this)
                        .attr("x",         x=> -paddingLeftRight/2)
                        .attr("y",         x=> -paddingTopBottom-h/2)
                        .attr("rx",        x=> .01) //.009
                        .attr("ry",        x=> .03) //.009
                        .attr("width",     x=> w + paddingLeftRight)
                        .attr("height",    x=> h + paddingTopBottom)
                        .attr("transform", x=> view.attributes.transform.value)//d.transformStrCache + d.scaleStrText)
                        .classed('caption-background', true)                    
                }
            })
        }
    }
}

var paddingLeftRight = .08
var paddingTopBottom = .02

export var bboxCenter = (d, cacheId='labellen')=> {
    var w = d.precalc[cacheId]
    var h = .045              
    return { re:-w/2, im:h/3}        
}

export var bboxOval = (d, cacheId='labellen', θn=undefined)=> {
    var w = d.precalc[cacheId]
    var h = .045              
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
    console.assert(result.re)
    return result
}
