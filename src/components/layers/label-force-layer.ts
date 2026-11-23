import { N }               from '../../models/n/n'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { setLabelText }    from '../layers/label-layer'
import { Box, outward, labelSize, restCenter, overlap, distanceToBox } from './label-geometry'

export interface LabelForceLayerArgs extends ILayerArgs
{
    name:        string,
    className:   string,
    invisible?:  boolean,
    hideOnDrag?: boolean,
    data:        ()=> any,
    transform,
    text,
    clip?:       string,
    background?: any,          // falsy, or a function of the node: draw a background rect
    scale?:       number | ((n)=> number),   // size bound to the data (default 1), times geometry.shrinkAtRim
    sizeOf?:      (n)=> number,  // the resulting size (set by the preset); default 1
    maxLabels?:   number,      // at most this many labels (default filter.maxlabels; preset-layers.ts)
    hoverLabel?:      boolean, // always a label for the node under the mouse (on top of maxLabels)
    hoverPathLabels?: boolean, // always labels on the path from the node under the mouse to the root
    // a line from a label to its node: 'auto' (default) when the label was pushed away
    // from its node, 'always', 'never'
    leaderLines?: 'auto' | 'always' | 'never',
    // ms: a label that appears grows from size 0, one that disappears shrinks to 0, and
    // the labels it pushes move smoothly (default 250; 0: no animation)
    transition?:  number,
}

var paddingLeftRight = .08
var paddingTopBottom = .02

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
// Appearing and disappearing (option transition): every label has a growth g, 0..1.
// A new label starts at 0 and grows, a label no longer in the data shrinks and is
// drawn until it reaches 0. The relaxation uses the grown size, so a growing label
// pushes its neighbours away gradually. The drawn offset follows the relaxed one
// smoothly (relative to the node: while dragging, labels still follow their node).
// While anything moves, the layer draws itself on every animation frame.
const ITERATIONS_MOVING = 8
const ITERATIONS_SETTLED = 40
const PULL = .25           // share of the way to the rest position per iteration
const INWARD = .25         // weight of a push toward the center (outward pushes: 1)
const MARGIN = .004        // free space between labels
const DEFAULT_TRANSITION = 250
const FOLLOW = 70          // ms: time constant of the drawn offset following the relaxed one

interface LabelState {
    g:    number,          // growth 0..1
    show: boolean,         // in the data (grows) or not (shrinks)
    tx:   number, ty: number,   // offset from the node: result of the relaxation
    dx:   number, dy: number,   // offset from the node: drawn
}

const ease = (g:number)=> g * g * (3 - 2 * g)

export class LabelForceLayer implements ILayer
{
    view:            ILayerView
    args:            LabelForceLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string
    private states = new Map<N, LabelState>()
    private drawn:N[] = []            // the labels drawn: the data and the shrinking ones
    private last = 0                  // time of the last relaxation
    private frame = 0                 // pending animation frame

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
                    this.args.name)
        },
        transformation: ()=> {
            this.update.force()
            this.d3updatePattern.update.transformation()
            this.d3updatePattern2.update.transformation()
        },
        style:          ()=> {
            this.d3updatePattern.update.style()
            this.d3updatePattern2.update.style()
        }
    }

    constructor(view:ILayerView, args:LabelForceLayerArgs) {
        this.view = view
        this.args = args
        this.name = args.name
    }

    private get halfPlane() { return !!this.view.hypertree.args.geometry.halfPlane }
    private get duration() { const t = this.args.transition; return t === undefined || t === null ? DEFAULT_TRANSITION : t }
    private growth(n:N) { const s = this.states.get(n); return s ? ease(s.g) : 1 }
    // the size of a label as drawn: sizeOf (layer option scale times geometry.shrinkAtRim)
    // times its growth
    private size(n:N) { return (this.args.sizeOf ? this.args.sizeOf(n) : 1) * this.growth(n) }
    private box(n:N) : Box {
        const k = this.size(n)
        const { w, h } = labelSize(n, this.args.name + 'len', this.view.hypertree.args.geometry.captionHeight, k)
        const fp = n.forcepoints
        return { x: fp.x, y: fp.y, w: w + paddingLeftRight * k / 2, h }
    }
    private gap(n:N) { return .012 * this.size(n) }

    // which labels are drawn and how far they have grown
    private advance(dt:number) {
        const labels:N[] = this.args.data() || []
        const inData = new Set(labels)
        const visible = new Set<N>(this.view.unitdisk.cache.unculledNodes || [])
        const step = this.duration > 0 ? dt / this.duration : 1
        for (const n of labels) {
            const s = this.states.get(n)
            if (s) s.show = true
            else this.states.set(n, { g: this.duration > 0 ? 0 : 1, show: true, tx: NaN, ty: NaN, dx: NaN, dy: NaN })
        }
        for (const [n, s] of this.states) {
            if (!inData.has(n)) s.show = false
            s.g = Math.max(0, Math.min(1, s.g + (s.show ? step : -step)))
            // gone: shrunk to 0, or its node is no longer visible (its position is not
            // updated any more)
            if (!s.show && (s.g <= 0 || !visible.has(n) || n.outOfView))
                this.states.delete(n)
        }
        // the data first (its order), then the shrinking ones
        this.drawn = labels.concat([...this.states.keys()].filter(n=> !inData.has(n)))
    }

    // the relaxation: labels in n.forcepoints = { x, y } (box center, view coordinates)
    private relax(iterations:number) {
        const now = performance.now()
        const dt = this.last ? Math.min(now - this.last, 100) : 0
        this.last = now
        this.advance(dt)

        const labels = this.drawn
        const half = this.halfPlane
        const rest = new Map<N, { x:number, y:number }>()
        for (const n of labels) {
            const k = this.size(n)
            const { w, h } = labelSize(n, this.args.name + 'len', this.view.hypertree.args.geometry.captionHeight, k)
            const r = restCenter(n, w, h, this.gap(n), half)
            rest.set(n, { x: r.re, y: r.im })
            const s = this.states.get(n)
            n.forcepoints = isNaN(s.tx) ? { x: r.re, y: r.im } : { x: n.cache.re + s.tx, y: n.cache.im + s.ty }
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
                    const ua = outward(labels[i], half), ub = outward(labels[j], half)
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
        const follow = this.duration > 0 ? 1 - Math.exp(-dt / FOLLOW) : 1
        let moving = false
        for (const n of labels) {
            const s = this.states.get(n)
            s.tx = n.forcepoints.x - n.cache.re
            s.ty = n.forcepoints.y - n.cache.im
            if (isNaN(s.dx)) { s.dx = s.tx; s.dy = s.ty }
            else { s.dx += (s.tx - s.dx) * follow; s.dy += (s.ty - s.dy) * follow }
            if (Math.abs(s.tx - s.dx) + Math.abs(s.ty - s.dy) > 1e-4) moving = true
            else { s.dx = s.tx; s.dy = s.ty }
            if (s.show ? s.g < 1 : s.g > 0) moving = true
            n.forcepoints = { x: n.cache.re + s.dx, y: n.cache.im + s.dy }
        }
        if (moving) this.requestFrame()
    }

    // while labels grow, shrink or move: draw the layer on the next animation frame
    // (unless the hypertree updates it in that frame anyway)
    private requestFrame() {
        if (this.frame || typeof requestAnimationFrame === 'undefined') return
        this.frame = requestAnimationFrame(()=> {
            this.frame = 0
            if (performance.now() - this.last < 8) { this.requestFrame(); return }
            if (!this.d3updatePattern) return
            this.update.data()
        })
    }

    private labellen(d)
    {
        return d.precalc[this.args.name+'len']||0
    }

    // leaderLines 'auto': when the label is farther from its node than at its rest place
    private showsLine(d:N) : boolean {
        const mode = this.args.leaderLines || 'auto'
        if (mode === 'never' || !d.forcepoints) return false
        if (mode === 'always') return true
        return distanceToBox({ re: d.cache.re, im: d.cache.im }, this.box(d)) > this.gap(d) * 1.8
    }

    private attach() {
        const T = this
        function calctransform(d, i, v) {
            if (!d.forcepoints)
                return ` translate(${d.cache.re} ${d.cache.im})`
            // size of the label (sizeOf, from the preset: layer option scale times
            // geometry.shrinkAtRim, times its growth), centered on its force point
            const k = T.size(d)
            return ` translate(${(d.forcepoints.x||0)-T.labellen(d)/2*k} ${d.forcepoints.y||0}) scale(${k})`
        }

        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              ()=> this.drawn,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text',
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.precalc.icon && navigator.platform.includes('inux'))
                                    .style("fill",         d=> d.pathes && d.pathes.labelcolor)
                                    .call(s=> setLabelText(s, this.args.text))
                                    .attr("transform",       calctransform),
            updateColor:       s=> s.style("fill",         d=> d.pathes && d.pathes.labelcolor),
            updateTransform:   s=> s.attr("transform",       calctransform)
                                    .call(s=> setLabelText(s, this.args.text))
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
            clip:              this.args.clip,
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
