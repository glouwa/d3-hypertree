import { N } from '../../models/n/n'

export interface ILayer
{
    name:            string,
    args,
    updateTime?:     number,

    attach:          (parent)=> void,
    updateData:      ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
}

export interface LayerArgs
{
    parent:          any,
    name:            string,    
    className:       string,
    elementType:     string,
    data:            any,
    create:          (s)=> any,
    updateTransform: (s)=> any,
    updateColor:     (s)=> any,
    clip?:           string,
}

export class D3UpdateLayer
{
    args    : LayerArgs
    rootSVG : d3.Selection<SVGElement, N, SVGElement, undefined>
    update  : any
    data    : any

    all             = ()=> this.update.call(this.args.updateTransform)
                                      .call(this.args.updateColor)
    updateAll       = ()=> this.update.call(this.all)
    updateTransform = ()=> this.update.call(this.args.updateTransform)
    updateColor     = ()=> this.update.call(this.args.updateColor)

    constructor(args : LayerArgs) {
        this.args = args
        this.rootSVG = args.parent.append('g')
            .attr("clip-path", this.args.clip ? `url(${this.args.clip})` : undefined)

        this.data = this.args.data
        this.update =
            this.rootSVG
                .selectAll(this.args.elementType)
                    .data(this.data, d=> d.mergeId)
                        .enter().append(args.elementType)

        this.update
            .attr("class", this.args.className)
            .call(this.args.create)
            .call(this.all)
    }

    updateData() {
        var oldElements = this.update

        this.data = this.args.data
        this.update =
            this.update
                .data(this.data, d=> d.mergeId)

        this.update.exit().remove()
        var n = this.update
            .enter().append(this.args.elementType)
                .attr("class", this.args.className)
                .call(this.args.create)

        this.update = this.update.merge(n)
        this.update.call(this.all)
        
// extrashit
        //if (this.args.name === 'labels')
        //    this.addTextBackgroundRects()
    }

    private addTextBackgroundRects()
    {
        this.rootSVG.selectAll('rect').remove()

        var svgRootHere = this.rootSVG
        this.rootSVG.selectAll("text").each(function(d:N, i, v:SVGTextElement[])
        {
            var view:any = v[i]
            var w = d.labellen = d.labellen || view.getComputedTextLength()
            var h = 0.045
            var paddingLeftRight = .08
            var paddingTopBottom = .02
            svgRootHere.insert('rect', d=> this)
                //.attr("x",         x=> view.attributes.dx.value - paddingLeftRight*.5 - w*.5)
                //.attr("y",         x=> view.attributes.dy.value - paddingTopBottom*.5 - h*.75)
                .attr("rx",        x=> .012)
                .attr("ry",        x=> .012)
                .attr("width",     x=> w + paddingLeftRight)
                .attr("height",    x=> h + paddingTopBottom)
                .attr("transform", x=> d.transformStrCache + d.scaleStrText)
                .classed('caption-background', true)
        })
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

