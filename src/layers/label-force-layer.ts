import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { setClass, setStyle } from '../view/dom-write'
import { setLabelText, markHoveredLabel } from './label-layer'
import { Box, outward, labelSize, restCenter, overlap, distanceToBox, sizeAt } from './label-geometry'
import { paddingLeftRight, paddingTopBottom, paddingsFor } from './label-geometry'
import { LabelTransitions, DEFAULT_TRANSITION } from './label-transition'
import { labelsWithHover, DEFAULT_MAX_LABELS } from '../filter/labels'

export interface LabelForceLayerArgs extends ILayerArgs
{
    className?:  string,
    text?:       (d:N)=> string,
    color?:      (d:N)=> string | undefined,   // the text color (undefined: the theme's), as the labels layer
    background?: any,          // falsy, or a function of the node: draw a background rect
    scale?:       number | ((n:N)=> number),   // size bound to the data (default 1), times geometry.shrinkAtRim
    maxLabels?:   number,      // at most this many labels
    hoverLabel?:      boolean, // always a label for the node under the mouse (counts in maxLabels)
    hoverPathLabels?: boolean, // labels on the path from the node under the mouse to the root, first in maxLabels
    // a line from a label to its node: 'auto' when the label was pushed away from its
    // node, 'always', 'never'
    leaderLines?: 'auto' | 'always' | 'never',
    // ms: a label that appears grows from size 0, one that disappears shrinks to 0, and
    // the labels it pushes move smoothly (0: no animation)
    transition?:  number,
    // false: the label of the node under the mouse without that animation (it is there
    // at once and goes at once); the other labels keep it
    hoverTransition?: boolean,
}

// Labels placed by a relaxation (force) layout:
//   - each label is pulled toward its rest position (label-geometry.ts: above its node
//     in the center, outward beyond its node toward the rim)
//   - overlapping labels push each other apart along the axis of the smaller overlap,
//     as rectangles of their real size; a push toward the center counts little, so
//     labels give way outward
//   - positions are kept between frames as an offset from the node (warm start): a few
//     iterations per update during interaction, more when the view settles
// Until v1 every update restarted from the node and ran 175 steps of a d3 force
// simulation with circles of a fixed radius (jumping labels, overlaps of long ones).
//
// Appearing and disappearing (option transition, label-transition.ts): a new label
// grows from size 0, a label no longer in the data shrinks to 0. The relaxation uses
// the grown size, so a growing label pushes its neighbours away gradually; the drawn
// offset follows the relaxed one smoothly.
const ITERATIONS_MOVING = 8
const ITERATIONS_SETTLED = 40
const PULL = .25           // share of the way to the rest position per iteration
const INWARD = .25         // weight of a push toward the center (outward pushes: 1)
const MARGIN = .004        // free space between labels

export class LabelForceLayer implements ILayer
{
    static type : LayerType<LabelForceLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:   true,
            hideOnDrag:  true,
            className:   'caption caption-label',
            data:        (layer:LabelForceLayer)=> labelsWithHover(ctx.unitdisk, layer.args),
            text:        (d:N)=> d.precalc.label,
            color:       (d:N)=> undefined,
            background:  (n:N)=> !n.parent,
            scale:       1,
            maxLabels:   DEFAULT_MAX_LABELS,
            hoverLabel:  false,
            hoverPathLabels: false,
            leaderLines: 'auto',
            transition:  DEFAULT_TRANSITION,
            hoverTransition: true,
        }),
        create: (ctx, name, args)=> new LabelForceLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            LabelForceLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform', 'style']
    private drawn:N[] = []            // the labels drawn: the data and the shrinking ones
    private transitions = new LabelTransitions(
        ()=> this.args.transition,
        ()=> this.update.data(),
        ()=> !!this.d3updatePattern && !this.args.invisible,
        (n:N)=> this.args.hoverTransition === false && !!n.hovered)

    update = {
        parent:         ()=> this.attach(),
        force:          ()=> {
            if (this.args.invisible)
                return
            if (this.view.hypertree.isAnimationRunning() && this.args.hideOnDrag)
                return
            this.relax(this.view.hypertree.isAnimationRunning() ? ITERATIONS_MOVING : ITERATIONS_SETTLED)
        },
        data:           ()=> {
            this.update.force()
            this.d3updatePattern.update.data()
            this.d3updatePattern2.update.data()

            if (this.args.background)
                this.d3updatePattern.addTextBackgroundRects(
                    paddingLeftRight,
                    paddingTopBottom,
                    .05,
                    this.name)
        },
        transformation: ()=> {
            this.update.force()
            this.d3updatePattern.update.transformation()
            this.d3updatePattern2.update.transformation()
        },
        // the hover state: the labels change when the layer shows the hovered node or
        // its path, else only the highlighted label (markHoveredLabel)
        style:          ()=> {
            if (this.args.hoverLabel || this.args.hoverPathLabels) { this.update.data(); return }
            this.d3updatePattern.update.style()
            this.d3updatePattern2.update.style()
        }
    }

    constructor(view:LayerContext, name:string, args:LabelForceLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private growth(n:N) { return this.transitions.growth(n) }
    // the size of a label as drawn: layer option scale times geometry.shrinkAtRim, times
    // its growth
    private size(n:N) { return sizeAt(this.view, this.args.scale, n) * this.growth(n) }
    private box(n:N) : Box {
        const k = this.size(n)
        const { w, h } = labelSize(n, this.name + 'len', this.view.model.geometry.captionHeight, k)
        const fp = n.forcepoints
        return { x: fp.x, y: fp.y, w: w + paddingsFor(this.view.model.geometry.captionHeight).lr * k / 2, h }
    }
    private gap(n:N) { return .012 * this.size(n) }
    private data() : N[] { return layerData(this.view, this.args.data, this) }

    // the relaxation: labels in n.forcepoints = { x, y } (box center, view coordinates)
    private relax(iterations:number) {
        const visible = new Set<N>(this.view.cache.unculledNodes || [])
        const labels = this.drawn = this.transitions.advance(this.data(), n=> visible.has(n) && !n.outOfView)
        const proj = this.view.projection
        const rest = new Map<N, { x:number, y:number }>()
        for (const n of labels) {
            const k = this.size(n)
            const { w, h } = labelSize(n, this.name + 'len', this.view.model.geometry.captionHeight, k)
            const r = restCenter(n, w, h, this.gap(n), proj)
            rest.set(n, { x: r.re, y: r.im })
            const t = this.transitions.target(n)
            n.forcepoints = t ? { x: n.cache.re + t.dx, y: n.cache.im + t.dy } : { x: r.re, y: r.im }
        }
        const grown = labels.map(n=> this.growth(n))
        for (let it = 0; it < iterations; it++) {
            // pull toward the rest position
            for (const n of labels) {
                const r = rest.get(n), fp = n.forcepoints
                fp.x += (r.x - fp.x) * PULL
                fp.y += (r.y - fp.y) * PULL
            }
            // separate overlapping labels (n is small: all pairs)
            const boxes = labels.map(n=> this.box(n))
            for (let i = 0; i < labels.length; i++)
                for (let j = i + 1; j < labels.length; j++) {
                    const a = boxes[i], b = boxes[j]
                    const o = overlap(a, b, MARGIN * Math.min(grown[i], grown[j]))
                    if (o.x <= 0 || o.y <= 0) continue
                    // along the axis of the smaller overlap, away from each other
                    const alongX = o.x < o.y
                    const s = alongX ? o.x : o.y
                    const sign = alongX ? Math.sign(a.x - b.x || 1) : Math.sign(a.y - b.y || 1)
                    const da = alongX ? { re: sign, im: 0 } : { re: 0, im: sign }
                    // a push toward the center weighs little: labels give way outward
                    const ua = outward(labels[i], proj), ub = outward(labels[j], proj)
                    const wa = (da.re * ua.re + da.im * ua.im) < 0 ? INWARD : 1
                    const wb = (-da.re * ub.re - da.im * ub.im) < 0 ? INWARD : 1
                    const sa = s * wa / (wa + wb), sb = s * wb / (wa + wb)
                    const fa = labels[i].forcepoints, fb = labels[j].forcepoints
                    fa.x += da.re * sa; fa.y += da.im * sa
                    fb.x -= da.re * sb; fb.y -= da.im * sb
                    a.x = fa.x; a.y = fa.y; b.x = fb.x; b.y = fb.y
                }
        }

        // keep the relaxed offsets; the drawn offsets follow them
        for (const n of labels) {
            const o = this.transitions.follow(n, n.forcepoints.x - n.cache.re, n.forcepoints.y - n.cache.im)
            n.forcepoints = { x: n.cache.re + o.dx, y: n.cache.im + o.dy }
        }
        this.transitions.finish()
    }

    private labellen(d)
    {
        return d.precalc[this.name+'len']||0
    }

    // leaderLines 'auto': when the label is farther from its node than at its rest place
    private showsLine(d:N) : boolean {
        const mode = this.args.leaderLines
        if (mode === 'never' || !d.forcepoints) return false
        if (mode === 'always') return true
        return distanceToBox({ re: d.cache.re, im: d.cache.im }, this.box(d)) > this.gap(d) * 1.8
    }

    private attach() {
        const T = this
        function calctransform(d, i, v) {
            if (!d.forcepoints)
                return ` translate(${d.cache.re} ${d.cache.im})`
            // size of the label (layer option scale times geometry.shrinkAtRim, times its
            // growth), centered on its force point
            const k = T.size(d)
            return ` translate(${(d.forcepoints.x||0)-T.labellen(d)/2*k} ${d.forcepoints.y||0}) scale(${k})`
        }

        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              ()=> this.drawn,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text',
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.precalc.icon && navigator.platform.includes('inux'))
                                    .style("fill",         d=> (d.pathes && d.pathes.labelcolor) || this.args.color(d))
                                    .call(s=> setLabelText(s, this.args.text))
                                    .attr("transform",       calctransform),
            // (on every frame while dragging: written only when changed, dom-write.ts)
            updateColor:       s=> s.each(function(d) { setStyle(this, 'fill', (d.pathes && d.pathes.labelcolor) || T.args.color(d)) })
                                    .call(markHoveredLabel),
            updateTransform:   s=> s.attr("transform",       calctransform)
                                    .call(s=> setLabelText(s, this.args.text))
                                    .call(markHoveredLabel)
        })

        // leader lines from the label (nearest point of its box) to its node; they fade
        // in and out with their label
        const lineEnd = (d:N)=> {
            const b = this.box(d)
            return { x: Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, d.cache.re)),
                     y: Math.max(b.y - b.h / 2, Math.min(b.y + b.h / 2, d.cache.im)) }
        }
        this.d3updatePattern2 = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              ()=> this.drawn,
            name:              'label-link',
            className:         'label-link',
            elementType:       'line',
            create:            s=> {},
            updateColor:       s=> {},
            updateTransform:   s=> s.style('display',      d=> this.showsLine(d) ? null : 'none')
                                    .style('opacity',      d=> { const g = this.growth(d); return g < 1 ? g : null })
                                    .attr('x1',             d=> d.forcepoints ? lineEnd(d).x : d.cache.re)
                                    .attr('y1',             d=> d.forcepoints ? lineEnd(d).y : d.cache.im)
                                    .attr('x2',             d=> d.cache.re)
                                    .attr('y2',             d=> d.cache.im)
        })
    }
}
