import { N }               from '../data/n'
import { C }               from '../geometry/hyperbolic-math'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { setClass, setStyle } from '../view/dom-write'
import { labelsWithHover } from '../filter/labels'
import { DEFAULT_MAX_LABELS } from '../filter/labels'
import { sizeAt, offsetFactor, labelOffset, paddingLeftRight, paddingTopBottom } from './label-geometry'
import { captionBox }      from './label-measure'

export interface LabelLayerArgs extends ILayerArgs
{
    className?:  string,
    // 'text': the labels (precalc.label) beside their node; 'emoji': the emojis
    // (precalc.icon) centered on their node, as bitmaps (asImage)
    kind?:       'text' | 'emoji',
    text?:       (d:N)=> string,
    delta?:      (d:N, i?, v?)=> C,    // the offset from the node (measured at the damped scale)
    color?:      (d:N)=> any,
    background?: any,          // falsy, true (every label, CSS color) or a function of the node: falsy, true or a color
    scale?:       number | ((n:N)=> number),   // size bound to the data (default 1), times geometry.shrinkAtRim
    maxLabels?:   number,      // at most this many labels
    hoverLabel?:      boolean, // always a label for the node under the mouse (counts in maxLabels)
    hoverPathLabels?: boolean, // labels on the path from the node under the mouse to the root, first in maxLabels
    asImage?:    boolean,      // draw each distinct text once as a bitmap and reuse it
}

// Labels at their node (option kind 'text') or emojis (kind 'emoji'), without placement
// against each other; the layers labels-force and labels-placed place labels apart.
export class LabelLayer implements ILayer
{
    static text : LayerType<LabelLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:  false,
            hideOnDrag: false,
            className:  'caption',
            kind:       'text',
            data:       (layer:LabelLayer)=> labelsWithHover(ctx.unitdisk, layer.args),
            text:       (d:N)=> d.precalc.label,
            delta:      (d:N)=> labelOffset(ctx, d, 'labelslen'),
            color:      ()=> undefined,
            background: false,
            scale:      1,
            maxLabels:  DEFAULT_MAX_LABELS,
            hoverLabel: false,
            hoverPathLabels: false,
            asImage:    false,
        }),
        create: (ctx, name, args)=> new LabelLayer(ctx, name, args),
    }
    // each distinct emoji drawn once as a bitmap: emoji glyphs as SVG text were
    // re-rasterized on every update (the most expensive layer by far)
    static emoji : LayerType<LabelLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:  false,
            hideOnDrag: false,
            className:  'caption',
            kind:       'emoji',
            data:       'emojis',
            text:       (d:N)=> d.precalc.icon,
            // the middle of the emoji on the node (the bitmap and the text are centered;
            // until v2 the box offset bboxCenter, which missed the emoji's double size)
            delta:      ()=> ({ re: 0, im: 0 }),
            color:      ()=> undefined,
            background: false,
            scale:      1,
            asImage:    true,
        }),
        create: (ctx, name, args)=> new LabelLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            LabelLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform', 'style']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> {
            this.d3updatePattern.update.data()
            if (this.args.background)
                this.d3updatePattern.addTextBackgroundRects(
                    paddingLeftRight,
                    paddingTopBottom,
                    .05,
                    this.name,
                    this.args.background)
        },
        transformation: ()=> this.d3updatePattern.update.transformation(),
        // the labels change with the hover state (hoverLabel, hoverPathLabels): their data
        style:          ()=> this.update.data()
    }

    constructor(view:LayerContext, name:string, args:LabelLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    // the size: layer option scale times geometry.shrinkAtRim (sizeAt); the offset
    // follows the rim factor; emojis twice as large
    private transform(d:N, i?, v?) : string {
        const f = offsetFactor(this.view, d), delta = this.args.delta(d, i, v)
        const k = sizeAt(this.view, this.args.scale, d) * (this.args.kind === 'emoji' ? 2 : 1)
        return ` translate(${d.cache.re + delta.re*f} ${d.cache.im + delta.im*f}) scale(${k})`
    }

    private attach() {
        const $this = this
        const offset = (d, i, v)=> this.transform(d, i, v)
        const data = ()=> typeof this.args.data === 'function' ? (<any>this.args.data)(this) || [] : layerData(this.view, this.args.data)

        // option asImage: every text as a cached bitmap (see textImage)
        if (this.args.asImage) {
            const className = this.args.className
            const linux = navigator.platform.includes('inux')
            this.d3updatePattern = new D3UpdatePattern({
                parent:            this.view.parent,
                layer:             this,
                data,
                name:              this.name,
                className:         this.args.className,
                elementType:       'image',
                create:            s=> s.each(function(d) {
                                        const image = textImage(this.parentNode, className + (linux && d.precalc.icon ? ' caption-icon' : ''), $this.args.text(d), $this.args.kind === 'emoji')
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
            data,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text',
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.precalc.icon && navigator.platform.includes('inux'))
                                    // emojis as text: centered on the node
                                    .attr("text-anchor",       this.args.kind === 'emoji' ? 'middle' : null)
                                    .attr("dominant-baseline", this.args.kind === 'emoji' ? 'central' : null)
                                    .style("stroke",         d=> d.pathes && d.pathes.labelcolor)
                                    .style("fill",           d=> this.args.color(d) )
                                    .call(s=> setLabelText(s, this.args.text)),
            // (on every frame while dragging: written only when changed, dom-write.ts)
            updateColor:       s=> s.each(function(d) {
                                        setStyle(this, 'stroke', d.pathes && d.pathes.labelcolor)
                                        setStyle(this, 'fill', $this.args.color(d))
                                    })
                                    .call(markHoveredLabel, this),
            updateTransform:   s=> s.attr("transform",       offset)
                                    .call(markHoveredLabel, this)
        })
    }
}

/**
 * Text as a bitmap (option asImage, used by the emoji layer). Emoji glyphs drawn as
 * SVG text get re-rasterized on every update, which made the emoji layer the most
 * expensive one. Each distinct text is measured once as SVG text in its layer (so
 * size and position match the text it replaces), drawn once on a canvas in the same
 * font, and then reused as an <image> with a data URL.
 */
const textImages = new Map<string, { href:string, x:number, y:number, w:number, h:number }>()
/**
 * centered: the bitmap holds only the ink of the text and is centered on the origin
 * (the emojis: their middle exactly on the node). Otherwise it covers the text's box
 * at the text's own position (labels).
 */
export function textImage(group:Element, className:string, text:string, centered = false) {
    const key = className + '\u0000' + text + (centered ? '\u0000c' : '')
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
    if (centered) {
        // the ink box (actualBoundingBox: left and ascent are positive toward the
        // left and up), one pixel of margin; its size in SVG units by the ratio of the
        // SVG text's box to the font box
        const left = m.actualBoundingBoxLeft || 0, right = m.actualBoundingBoxRight || m.width
        const up = m.actualBoundingBoxAscent || ascent, down = m.actualBoundingBoxDescent || descent
        const pad = 1, inkW = left + right, inkH = up + down
        canvas.width = Math.max(1, Math.ceil(inkW + 2*pad))
        canvas.height = Math.max(1, Math.ceil(inkH + 2*pad))
        ctx.font = `${px}px ${family}`
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(text, pad + left, pad + up)
        const unit = bb.height / (ascent + descent)
        const w = canvas.width * unit, h = canvas.height * unit
        image = { href: canvas.toDataURL(), x: -w/2, y: -h/2, w, h }
        textImages.set(key, image)
        return image
    }
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
 *
 * layer: the label layer (its name: the measured width precalc.<name>len), for the box
 * without measuring in the DOM (hoveredBox).
 */
export function markHoveredLabel(s, layer?:{ name:string, view:LayerContext }) {
    s.each(function(d) { setClass(this, 'caption-hovered', d && d.hovered) })   // only when changed
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
        // the text's box in its own coordinates, from the widths measured at the
        // initialization (hoveredBox)
        const b = hoveredBox(hovered, layer)
        if (!b) { rect.setAttribute('width', '0'); return }
        if (rect.dataset.box !== b.key) {
            const pad = b.height * .25
            rect.setAttribute('x', String(b.x - pad))
            rect.setAttribute('y', String(b.y - pad * .5))
            rect.setAttribute('width', String(b.width + 2 * pad))
            rect.setAttribute('height', String(b.height + pad))
            rect.setAttribute('rx', String(pad))
            rect.removeAttribute('ry')
            rect.dataset.box = b.key
        }
    }
    const t = hovered.getAttribute('transform')
    if (t) rect.setAttribute('transform', t); else rect.removeAttribute('transform')
}

// The box of a label's text in its own coordinates (the text starts at x 0 on the
// baseline; its transform places and scales it, so geometry.shrinkAtRim and the layer
// option scale are in the transform, the box is the same for 'none', 'damped' and
// 'full'). Computed from what the initialization measured (label-measure.ts): the
// width precalc.<layer>len and the line box (captionBox: its middle and height, the
// distance of the lines), with no measuring in the DOM: getBBox forced a layout for
// every newly highlighted label (with highlightNode 'center' on every change of the
// center node while dragging). Not measured (another text, no SVG yet): getBBox, once
// per text, class and font size.
const boxes = new WeakMap<SVGTextElement, { key:string, x:number, y:number, width:number, height:number }>()
function hoveredBox(text:SVGTextElement, layer?:{ name:string, view:LayerContext }) {
    const d = (text as any).__data__ as N
    const w = layer && d && d.precalc && d.precalc[layer.name + 'len']
    const m = layer && captionBox(layer.view.hypertree)
    if (w && m && (text as any).__labelText === d.precalc.label) {
        const lines = text.childElementCount || 1
        const height = m.height + (lines - 1) * m.line
        const x = text.getAttribute('text-anchor') === 'middle' ? -w / 2 : 0
        return { key: `${w}\0${lines}\0${m.center}\0${m.height}`, x, y: m.center - m.height / 2, width: w, height }
    }
    const svg = text.ownerSVGElement
    const key = `${text.textContent}\0${text.getAttribute('class')}\0${svg ? svg.style.fontSize : ''}`
    const known = boxes.get(text)
    if (known && known.key === key) return known.width ? known : null
    const b = text.getBBox()
    const box = { key, x: b.x, y: b.y, width: b.width, height: b.height }
    boxes.set(text, box)
    return box.width ? box : null
}
