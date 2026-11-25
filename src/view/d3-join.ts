import { compositing } from './planes'
import { N } from '../data/n'
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

// The d3 join of a layer's elements: one group per pattern, the elements keyed by
// the node's mergeId; data() joins, transformation() and style() update in place.
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
            // a compositor layer per layer group only in the old mode; normally the
            // layer stack's planes are the compositor layers (planes.ts)
            .style('transform', compositing.mode === 'layers' ? 'translateZ(0)' : null)

        this.elements =
            this.mainSvgGroup
                .selectAll(this.args.elementType)
    }

    private mayEval = d=> typeof d === 'function' ? d() : d
    private updateData() {
        this.data = []
        var isAnimating = this.args.layer.view.hypertree.isAnimationRunning()
        // invisible hides the layer always, hideOnDrag additionally while dragging or animating
        const layerArgs = this.args.layer.args
        if (!layerArgs.invisible && !(isAnimating && layerArgs.hideOnDrag))
        {
            this.data = this.mayEval(this.args.data)
        }

        this.elements = this.elements.data(this.data, d=> d && d.mergeId)
        this.elements
            .exit()
                .remove()

        const newElements = this.elements
            .enter().append(this.args.elementType)
                .attr("class", this.args.className)
                .call(this.args.create)

        this.elements = this.elements
            .merge(newElements)
                .call(this.args.updateTransform)
                .call(this.args.updateColor)
    }

    // background: true (every label, color from the CSS) or a function of the node:
    // falsy = no background, a color string = filled with it, true = CSS color
    public addTextBackgroundRects(paddingLeftRight, paddingTopBottom, height, layername, background:any = true)
    {
        this.mainSvgGroup.selectAll('rect.caption-background').remove()
        var svgRootHere = this.mainSvgGroup
        var geometry = this.args.layer.view.model.geometry

        this.mainSvgGroup.selectAll("text")
        .each(function(d:N, i, v:SVGTextElement[])
        {
            // every label gets a background (an older version limited it to the
            // center node and nodes with r < 0.6)
            var view:any = v[i]
            var w = d.precalc[layername+'len'] || 0
            var lines = view.childElementCount || 1          // multi-line labels: one tspan per line
            var h = geometry.captionHeight * lines

            const b = typeof background === 'function' ? background(d) : background
            // before the text, and before the box of the hovered label
            // (rect.caption-hover, markHoveredLabel), which covers the background
            const text = <Element><unknown>this
            const prev = text.previousElementSibling
            const before = prev && prev.classList.contains('caption-hover') ? prev : text
            if (w && b)   // nodes without a measured label get no background
                svgRootHere.insert('rect', d=> before)
                    .attr("x",         x=> -paddingLeftRight/2)
                    .attr("y",         x=> -paddingTopBottom-geometry.captionHeight/2)   // top of the first line
                    .attr("rx",        x=> .01)
                    .attr("ry",        x=> .03)
                    .attr("width",     x=> w + paddingLeftRight)
                    .attr("height",    x=> h + paddingTopBottom)
                    .attr("transform", x=> view.attributes.transform.value)
                    .classed('caption-background', true)
                    .style('fill', typeof b === 'string' ? b : null)
        })
    }
}
