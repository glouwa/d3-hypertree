import * as d3 from 'd3'
import { N }   from '../../models/n'

export interface LayerArgs
{
    parent:          any,
    name:            string,
    className:       string,
    elementType:     string,    
    data:            (l)=> any,
    create:          (l)=> (s)=> any,
    updateTransform: (l)=> (s)=> any,
    updateColor:     (l)=> (s)=> any,
    clip?:           (l)=> string,
}

export interface ILayer
{
    updateAll:       ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
}

export class Layer implements ILayer
{
    args : LayerArgs    
    rootSVG : d3.Selection<SVGElement, N, SVGElement, undefined>
    update : any
    data : any

    constructor(args : LayerArgs) {
        this.args = args
        this.rootSVG = args.parent.append('g')
            .attr("clip-path", this.args.clip ? `url(${this.args.clip(this)})` : undefined)

        this.data = this.args.data(this)
        this.update =
            this.rootSVG
                .selectAll(this.args.elementType)
                    .data(this.data)
                        .enter().append(args.elementType)

        this.update
            .attr("class", this.args.className)
            .call(this.args.create(this))
            .call(this.all)
    }

    updateData() {
        var oldElements = this.update

        this.data = this.args.data(this)
        this.update =
            this.update            
                .data(this.data, d=> d)

        this.update.exit().remove()
        var n = this.update
            .enter().append(this.args.elementType)
                .attr("class", this.args.className)
                .call(this.args.create(this))

        this.update = this.update.merge(n)
        this.update.call(this.all)

// extrashit
        this.rootSVG.selectAll('rect').remove()

        var svgRootHere = this.rootSVG
        this.rootSVG.selectAll("text").each(function(d:N, i, v:SVGTextElement[])
        {
            var view:any = v[i]
            var w = view.getComputedTextLength() * 1.2
            var h = 0.025
            var paddingLeftRight = .05
            var paddingTopBottom = .02
            svgRootHere.insert('rect', d=> this)
                .attr("x",         x=> view.attributes.dx.value - paddingLeftRight/2 - w/2)
                .attr("y",         x=> view.attributes.dy.value - paddingTopBottom/2 - .02)
                .attr("rx",        x=> .012)
                .attr("ry",        x=> .012)                
                .attr("width",     x=> w + paddingLeftRight)
                .attr("height",    x=> h + paddingTopBottom + .007)
                .attr("transform", x=> d.transformStrCache + d.scaleStrText)
                .classed('caption-background', true)
        })
    }

    all             = ()=> this.update.call(this.args.updateTransform(this)).call(this.args.updateColor(this))
    updateAll       = ()=> this.update.call(this.all)
    updateTransform = ()=> this.update.call(this.args.updateTransform(this))
    updateColor     = ()=> this.update.call(this.args.updateColor(this))
}
