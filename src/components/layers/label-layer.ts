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
    background?: any,          // falsy, true (every label, CSS color) or a function of the node: falsy, true or a color
    scale?:       number | ((n)=> number),   // size bound to the data (default 1), times geometry.shrinkAtRim (preset-layers.ts)
    maxLabels?:   number,      // at most this many labels (default filter.maxlabels; preset-layers.ts)
    hoverLabel?:      boolean, // always a label for the node under the mouse (on top of maxLabels)
    hoverPathLabels?: boolean, // always labels on the path from the node under the mouse to the root
    asImage?:    boolean,      // draw each distinct text once as a bitmap and reuse it (emoji layer default: true)
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
                    this.args.name,
                    this.args.background)
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

        // option asImage: every text as a cached bitmap (see textImage)
        if (this.args.asImage) {
            const className = this.args.className
            const linux = navigator.platform.includes('inux')
            this.d3updatePattern = new D3UpdatePattern({
                parent:            this.view.parent,
                layer:             this,
                clip:              this.args.clip,
                data:              this.args.data,
                name:              this.name,
                className:         this.args.className,
                elementType:       'image',
                create:            s=> s.each(function(d) {
                                        const image = textImage(this.parentNode, className + (linux && d.precalc.icon ? ' caption-icon' : ''), $this.args.text(d))
                                        if (!image) return
                                        this.setAttribute('href', image.href)
                                        this.setAttribute('x', String(image.x))
                                        this.setAttribute('y', String(image.y))
                                        this.setAttribute('width', String(image.w))
                                        this.setAttribute('height', String(image.h))
                                    }),
                updateColor:       s=> s,
                updateTransform:   s=> s.attr("transform",       offset)
            })
            return
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
                                    .style("fill",           d=> this.args.color(d) )
                                    .call(markHoveredLabel),
            updateTransform:   s=> s.attr("transform",       offset)
                                    .call(markHoveredLabel)
        })
    }
}

var paddingLeftRight = .08
var paddingTopBottom = .02

/**
 * Text as a bitmap (option asImage, used by the emoji layer). Emoji glyphs drawn as
 * SVG text get re-rasterized on every update, which made the emoji layer the most
 * expensive one. Each distinct text is measured once as SVG text in its layer (so
 * size and position match the text it replaces), drawn once on a canvas in the same
 * font, and then reused as an <image> with a data URL.
 */
const textImages = new Map<string, { href:string, x:number, y:number, w:number, h:number }>()
export function textImage(group:Element, className:string, text:string) {
    const key = className + '\u0000' + text
    let image = textImages.get(key)
    if (image) return image

    const svgText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    svgText.setAttribute('class', className)
    svgText.textContent = text
    group.appendChild(svgText)
    const bb = svgText.getBBox()
    const family = getComputedStyle(svgText).fontFamily
    group.removeChild(svgText)
    if (!bb.width || !bb.height) return undefined          // not rendered (yet)

    const px = 96 * (window.devicePixelRatio || 1)         // crisp up to ~100 px on screen
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = `${px}px ${family}`
    const m = ctx.measureText(text)
    const ascent = m.fontBoundingBoxAscent || px * .9, descent = m.fontBoundingBoxDescent || px * .25
    canvas.width = Math.max(1, Math.ceil(m.width))
    canvas.height = Math.max(1, Math.ceil(ascent + descent))
    ctx.font = `${px}px ${family}`
    ctx.textBaseline = 'alphabetic'
    // center the ink horizontally (the canvas may pick another fallback font with
    // other side bearings than the SVG text; emoji glyphs are centered in their box)
    const inkLeft = m.actualBoundingBoxLeft || 0, inkWidth = (m.actualBoundingBoxRight || m.width) + inkLeft
    ctx.fillText(text, (canvas.width - inkWidth) / 2 + inkLeft, ascent)
    image = { href: canvas.toDataURL(), x: bb.x, y: bb.y, w: bb.width, h: bb.height }
    textImages.set(key, image)
    return image
}

/**
 * Sets the text of label elements. A '\n' in the text gives several lines (tspans
 * below each other, 1.2 em apart); the first line stays where a one-line label is.
 */
export function setLabelText(s, text:(d)=> string) {
    return s.each(function(d) {
        const t = text(d)
        // unchanged text: setting it again would make the browser shape it again
        if (this.__labelText === t && this.__labelText !== undefined) return
        this.__labelText = t
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

/**
 * The label of the hovered node stands out (all label layers): class caption-hovered
 * on its text (an opaque halo, CSS) and an opaque box with a border behind it
 * (rect.caption-hover, in the label's group just before the text, with the text's
 * transform). Called with the layer's text elements on every style and transform
 * update; a label can be hovered by pointing at the label itself
 * (interaction-layer-2.ts: labelNodeAt).
 */
export function markHoveredLabel(s) {
    s.classed('caption-hovered', d=> Boolean(d && d.hovered))
    const first = s.node()
    const group = first && first.parentNode
    if (!group) return
    let hovered:SVGTextElement = null
    s.each(function(d) { if (d && d.hovered) hovered = this })
    let rect = group.querySelector(':scope > rect.caption-hover') as SVGRectElement
    if (!hovered) { if (rect) rect.remove(); return }
    if (!rect) {
        rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement
        rect.setAttribute('class', 'caption-hover')
    }
    if (rect.nextSibling !== hovered) group.insertBefore(rect, hovered)
    // a label with a background (rect.caption-background just before it): the box
    // takes its shape and covers it exactly (it lies between background and text)
    let background = rect.previousElementSibling
    if (background && !background.classList.contains('caption-background')) background = null
    if (background) {
        for (const a of ['x', 'y', 'width', 'height', 'rx', 'ry'])
            rect.setAttribute(a, background.getAttribute(a) || '0')
    }
    else {
        const b = hovered.getBBox()            // in the text's own coordinates
        if (!b.width) { rect.setAttribute('width', '0'); return }
        const pad = b.height * .25
        rect.setAttribute('x', String(b.x - pad))
        rect.setAttribute('y', String(b.y - pad * .5))
        rect.setAttribute('width', String(b.width + 2 * pad))
        rect.setAttribute('height', String(b.height + pad))
        rect.setAttribute('rx', String(pad))
        rect.removeAttribute('ry')
    }
    const t = hovered.getAttribute('transform')
    if (t) rect.setAttribute('transform', t); else rect.removeAttribute('transform')
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
