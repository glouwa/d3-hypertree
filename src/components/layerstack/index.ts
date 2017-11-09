import * as d3 from 'd3'
import { N } from '../../models/n'
import { Interaction } from '../unitdisk/interactive-unitdisk'

//export * from './layerStack'

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

export var bboxOffset = d=> v=> {
    var w = v.getComputedTextLength() * 1.2 //var bb = v.getBBox() war schlechter
    var h = 0.025
    var paddingLeftRight = .05
    var paddingTopBottom = .02
    return {
        re:(paddingLeftRight/2 + w/2) * Math.cos(d.cachep.θ),
        im:(paddingTopBottom/2 + h/2) * Math.sin(d.cachep.θ)
    }
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

    cells:          Layer // set on create
    links:          Layer
    nodes:          Layer
    captions:       Layer

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
            var newL = layerfactoryfunc(this.args.interaction, this.layers)
            this[newL.args.name] = newL
        }
    }

    public updatePath()
    {
        if (this.cells)    this.cells.updateData()
        if (this.links)    this.links.updateColor()
        if (this.nodes)    this.nodes.updateColor()
        if (this.captions) this.captions.updateData()
        //Materialize.toast("updatePath", 2500)
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
        if (this.args.interaction.cache.filteredNodes.length != 3)
        this.args.interaction.args.hypertree.infoUi.updateD3Info(
            10, [t1-t0, t2-t1, t3-t2, performance.now() - t3], this.args.interaction.cache)
    }
}
