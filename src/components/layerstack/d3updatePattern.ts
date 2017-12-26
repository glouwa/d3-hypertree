import { N } from '../../models/n/n'
import { ILayer } from './layer'

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
    args    : D3UpdatePatternArgs
    data    : any
    private rootSVG : d3.Selection<SVGElement, N, SVGElement, undefined>
    private elements  : any    
    private mayEval = d=> typeof d === 'function' ? d() : d

    /*all             = ()=> this.elements.call(this.args.updateTransform)
                                      .call(this.args.updateColor)
    updateAll       = ()=> this.elements.call(this.all)*/
    updateTransform = ()=> this.elements.call(this.args.updateTransform)
    updateColor     = ()=> this.elements.call(this.args.updateColor)

    
    update = {
        parent:         ()=> this.updateParent(),        
        data:           ()=> this.updateData(),
        transformation: ()=> this.elements.call(this.args.updateTransform),
        style:          ()=> this.elements.call(this.args.updateColor)
    }

    constructor(args : D3UpdatePatternArgs) {
        this.args = args
        this.updateParent()
    }

    private updateParent() {
        this.rootSVG = this.args.parent.append('g')
            .attr('clip-path', (this.args.clip ? `url(${this.args.clip})` : undefined))
            .style('transform', 'translateZ(0)')  
            // rotateZ(360deg)
            // scale(1, 1)
            // translateZ(0)
            // translate3d(0,0,0)
            // -webkit-font-smoothing: antialiased;

        this.data = this.mayEval(this.args.data)
        this.elements =
            this.rootSVG
                .selectAll(this.args.elementType)
                    .data(this.data, (d:any)=> d.mergeId)
                        .enter().append(this.args.elementType)

        this.elements
            .attr("class", this.args.className)
            .call(this.args.create)            
            .call(this.args.updateTransform)
            .call(this.args.updateColor)
    }
    
    private updateData() {
        this.data = []
        var isAnimating = this.args.layer.layerStack.args.unitdisk.args.hypertree.isAnimationRunning()
        if (!isAnimating && !this.args.layer.args.invisible)
            this.data = this.mayEval(this.args.data)
        if (isAnimating && !this.args.layer.args.hideOnDrag)
            this.data = this.mayEval(this.args.data)

        this.elements = this.elements.data(this.data, d=> d.mergeId)

        this.elements.exit().remove()
        var newElements = this.elements.enter().append(this.args.elementType)
                .attr("class", this.args.className)
                .call(this.args.create)

        this.elements = this.elements.merge(newElements)
        this.elements
            //.call(this.all)
            .call(this.args.updateTransform)
            .call(this.args.updateColor)
        
// extrashit
        if (this.args.name === 'labels')
            this.addTextBackgroundRects()
    }

    private addTextBackgroundRects()
    { 
        this.rootSVG.selectAll('rect').remove()

        var svgRootHere = this.rootSVG
        var T = this
        
        if (T.args.layer.args.ud) 
        {
            this.rootSVG.selectAll("text").each(function(d:N, i, v:SVGTextElement[])
            {              
                if (   d === T.args.layer.args.ud.cache.centerNode 
                    /*|| d.cachep.r < 0.6*/)
                {
                    var view:any = v[i]
                    var w = d.labellen = d.labellen || view.getComputedTextLength()
                    var h = 0.04
                    var paddingLeftRight = .08
                    var paddingTopBottom = .02

                    svgRootHere.insert('rect', d=> this)
                        .attr("x",         x=> -paddingLeftRight/2)
                        .attr("y",         x=> -paddingTopBottom*2)
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

export var bboxOffset = d=> v=> {
    var w = d.labellen = d.labellen || v.getComputedTextLength()  //var bb = v.getBBox() war schlechter
    var h = .045
    var paddingLeftRight = .08
    var paddingTopBottom = .02
    return {
        re:(paddingLeftRight/2 + w/2) * Math.cos(d.cachep.θ) - w/2,
        im:(paddingTopBottom/2 + h/2) * Math.sin(d.cachep.θ) + h/3
    }
}

