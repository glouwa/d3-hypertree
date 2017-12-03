import * as d3 from 'd3'
import { N } from '../../models/n/n'
import { Interaction } from '../unitdisk/interactive-unitdisk'

export interface ILayer
{
    name:            string,
    attach:          (parent)=> void,
    updateData:      ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
}

export interface LayerStackArgs
{
    parent,
    interaction: Interaction
}

export class LayerStack
{
    args: LayerStackArgs

    layers:         any

    cells:          ILayer // set on create
    links:          ILayer
    nodes:          ILayer
    captions:       ILayer
    specials:       ILayer

    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.layers = this.args.parent.append('g')
        this.updateLayers()
    }

    private updateLayers() : void
    {
        for (var layerfactoryfunc of this.args.interaction.args.layers)
        {
            var argscpy = Object.assign({ parent:this.layers }, this.args.interaction)
            var newL = layerfactoryfunc(this.args.interaction)
            if (newL.attach) newL.attach(this.layers)
            this[newL.name] = newL // todo newL.args is a workaround
        }
    }

    public updateTransformation()
    {
        var t0 = performance.now()
        if (this.cells)    this.cells.updateData()
        var t1 = performance.now()
        if (this.links)    this.links.updateData()
        var t2 = performance.now()
        if (this.nodes)    this.nodes.updateData()
        var t3 = performance.now()
        if (this.captions) this.captions.updateData()
        var t4 = performance.now()
        if (this.specials) this.specials.updateData()

        if (this.args.interaction.cache.unculledNodes.length != 3)
            this.args.interaction.args.hypertree.infoUi.updateD3Info(
                10, [t1-t0, t2-t1, t3-t2, performance.now() - t3], this.args.interaction.cache)
    }

    public updatePath()
    {
        if (this.cells)    this.cells.updateData()
        if (this.links)    this.links.updateColor()
        if (this.nodes)    this.nodes.updateColor()
        if (this.captions) this.captions.updateData()
        //Materialize.toast("updatePath", 2500)
    }
}

//-------------------------------------------------------------------------------------------------

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
    args : LayerArgs
    rootSVG : d3.Selection<SVGElement, N, SVGElement, undefined>
    update : any
    data : any

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
                    .data(this.data)
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
                .data(this.data, d=> d)

        this.update.exit().remove()
        var n = this.update
            .enter().append(this.args.elementType)
                .attr("class", this.args.className)
                .call(this.args.create)

        this.update = this.update.merge(n)
        this.update.call(this.all)

// extrashit
        //if (this.args.name === 'captions')
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
                .attr("x",         x=> view.attributes.dx.value - paddingLeftRight*.5 - w*.5)
                .attr("y",         x=> view.attributes.dy.value - paddingTopBottom*.5 - h*.75)
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
    var h = 0.045
    var paddingLeftRight = .08
    var paddingTopBottom = .02
    return {
        re:(paddingLeftRight/2 + w/2) * Math.cos(d.cachep.θ),
        im:(paddingTopBottom/2 + h/2) * Math.sin(d.cachep.θ)
    }
}

