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
    }

    public addTextBackgroundRects(paddingLeftRight, paddingTopBottom, height, layername)
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
                    var w = d.precalc[layername+'len'] || 0
                    var h = geometry.captionHeight
                    
                    if (!w)
                        console.warn("labellen == 0", d)                    

                    else
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

