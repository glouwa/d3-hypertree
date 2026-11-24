import { N }               from '../../models/n/n'
import { C }               from '../../models/transformation/hyperbolic-math'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { setLabelText, markHoveredLabel } from '../layers/label-layer'
import { Box, outward, labelSize, restCenter, besideNode, overlapping, distanceToBox } from './label-geometry'
import { LabelTransitions, DEFAULT_TRANSITION } from './label-transition'
import { labelWeight }     from '../../models/hypertree/preset-process'

export interface LabelPlacementLayerArgs extends ILayerArgs
{
    name:        string,
    className:   string,
    invisible?:  boolean,
    hideOnDrag?: boolean,
    data:        ()=> N[],
    text:        (n:N)=> string,
    clip?:       string,
    background?: any,          // falsy, true or a function of the node: draw a background rect
    scale?:       number | ((n)=> number),   // size bound to the data (default 1), times geometry.shrinkAtRim
    sizeOf?:      (n)=> number,  // the resulting size (set by the preset); default 1
    maxLabels?:   number,
    hoverLabel?:      boolean,
    hoverPathLabels?: boolean,
    // a line from a label to its node: 'auto' (default) for labels placed away from
    // their node, 'always', 'never'
    leaderLines?: 'auto' | 'always' | 'never',
    // ms: a label that appears grows from size 0, one that disappears shrinks to 0, a
    // label that changes its place glides there (default 250; 0: no animation)
    transition?:  number,
}

var paddingLeftRight = .08
var paddingTopBottom = .02
const MARGIN = .004

// Labels placed like on a map (no simulation): every label has a list of candidate
// positions around its node, ordered by the distance to its rest position
// (label-geometry.ts: above the node in the center, outward toward the rim). The
// labels are placed in the order of their importance (the hovered node, its path to
// the root, then the label selection's score: weight × distScale²); each takes the
// first candidate that overlaps no label placed before. A label without a free
// candidate is not drawn: the drawn labels never overlap. The candidate of the last
// frame comes first while it is free, so labels don't jump between candidates.
//
// Option transition (label-transition.ts): a placed label grows from size 0, a label
// that is no longer placed shrinks to 0, a label that changes its candidate glides
// there. The placement uses the full size (full-grown labels never overlap); a
// shrinking label no longer takes a place, so it may cross a growing one.
export class LabelPlacementLayer implements ILayer
{
    view:            ILayerView
    args:            LabelPlacementLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string
    placed:          N[] = []
    private drawn:   N[] = []                // the placed labels and the shrinking ones
    private boxes = new Map<N, Box>()        // drawn box of each drawn label (center, full size)
    private last = new Map<N, string>()      // candidate id of the last frame
    private transitions = new LabelTransitions(
        ()=> { const t = this.args.transition; return t === undefined || t === null ? DEFAULT_TRANSITION : t },
        ()=> this.update.data(),
        ()=> !!this.d3updatePattern && !this.args.invisible)

    update = {
        parent:         ()=> this.attach(),
        data:           ()=> { this.place(); this.redraw(true) },
        transformation: ()=> { if (this.place()) this.redraw(true); else this.redraw(false) },
        style:          ()=> { this.d3updatePattern.update.style(); this.d3updatePattern2.update.style() }
    }

    constructor(view:ILayerView, args:LabelPlacementLayerArgs) {
        this.view = view
        this.args = args
        this.name = args.name
    }

    private get halfPlane() { return !!this.view.hypertree.args.geometry.halfPlane }
    private size(n:N) { return this.args.sizeOf ? this.args.sizeOf(n) : 1 }
    private gap(n:N) { return .012 * this.size(n) }
    // the drawn box: centered on the drawn position, scaled by the growth
    private drawnBox(n:N) : Box | undefined {
        const b = this.boxes.get(n), g = this.transitions.growth(n)
        return b && { x: b.x, y: b.y, w: b.w * g, h: b.h * g }
    }

    private priority(n:N) : number {
        if (n.hovered) return 3e15
        if (n.pathes && n.pathes.isPartOfAnyHoverPath) return 2e15 + (1e3 - n.depth)
        if (!n.parent) return 1e15
        return labelWeight(this.view.unitdisk, n) * n.distScale * n.distScale
    }

    // candidate box centers with ids: the rest position, 8 directions next to the
    // node, outward at growing distances (straight and turned); nearest to rest first
    private candidates(n:N, w:number, h:number) : { id:string, c:C }[] {
        const gap = this.gap(n), half = this.halfPlane
        const rest = restCenter(n, w, h, gap, half)
        const list:{ id:string, c:C }[] = [{ id: 'rest', c: rest }]
        for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 4
            list.push({ id: 'd' + i, c: besideNode(n, { re: Math.cos(a), im: Math.sin(a) }, w, h, gap) })
        }
        const u = outward(n, half)
        for (const turn of [0, .45, -.45])
            for (const far of [1, 1.8, 2.6]) {
                const v = { re: u.re * Math.cos(turn) - u.im * Math.sin(turn), im: u.re * Math.sin(turn) + u.im * Math.cos(turn) }
                list.push({ id: `o${turn}:${far}`, c: besideNode(n, v, w, h, gap + (far - 1) * (h + w * .3)) })
            }
        const d = (c:C)=> Math.hypot(c.re - rest.re, c.im - rest.im)
        return list.sort((a, b)=> d(a.c) - d(b.c))
    }

    /** Places the labels; returns true if the set of drawn labels changed. */
    private place() : boolean {
        const before = this.placed
        const labels = (this.args.data() || []).slice().sort((a, b)=> this.priority(b) - this.priority(a))
        const captionHeight = this.view.hypertree.args.geometry.captionHeight
        const boxes:Box[] = []
        const placed:N[] = []
        const last = new Map<N, string>()
        for (const n of labels) {
            const k = this.size(n)
            const { w, h } = labelSize(n, this.args.name + 'len', captionHeight, k)
            if (!w) continue
            const W = w + paddingLeftRight * k / 2
            const cands = this.candidates(n, W, h)
            const prev = this.last.get(n)
            if (prev) { const i = cands.findIndex(c=> c.id === prev); if (i > 0) cands.unshift(cands.splice(i, 1)[0]) }
            for (const cand of cands) {
                const b = { x: cand.c.re, y: cand.c.im, w: W, h }
                if (boxes.some(o=> overlapping(o, b, MARGIN))) continue
                boxes.push(b)
                placed.push(n)
                n.placedLabel = b
                last.set(n, cand.id)
                break
            }
        }
        this.last = last
        this.placed = placed

        // drawn: the placed labels (growing, gliding to their place) and the shrinking ones
        const visible = new Set<N>(this.view.unitdisk.cache.unculledNodes || [])
        const drawn = this.transitions.advance(placed, n=> visible.has(n) && !n.outOfView)
        const isPlaced = new Set(placed)
        const drawnBoxes = new Map<N, Box>()
        for (const n of drawn) {
            const b = isPlaced.has(n) ? n.placedLabel : this.boxes.get(n)
            if (!b) continue
            const o = isPlaced.has(n)
                ? this.transitions.follow(n, b.x - n.cache.re, b.y - n.cache.im)
                : this.transitions.follow(n)
            drawnBoxes.set(n, { x: n.cache.re + o.dx, y: n.cache.im + o.dy, w: b.w, h: b.h })
        }
        const prev = this.drawn
        this.drawn = drawn.filter(n=> drawnBoxes.has(n))
        this.boxes = drawnBoxes
        this.transitions.finish()
        return prev.length !== this.drawn.length || prev.some((n, i)=> n !== this.drawn[i])
    }

    private redraw(dataChanged:boolean) {
        if (dataChanged) {
            this.d3updatePattern.update.data()
            this.d3updatePattern2.update.data()
            if (this.args.background)
                this.d3updatePattern.addTextBackgroundRects(paddingLeftRight, paddingTopBottom, .05, this.args.name, this.args.background)
        }
        else {
            this.d3updatePattern.update.transformation()
            this.d3updatePattern2.update.transformation()
        }
    }

    private showsLine(d:N) : boolean {
        const mode = this.args.leaderLines || 'auto'
        const b = this.drawnBox(d)
        if (mode === 'never' || !b) return false
        if (mode === 'always') return true
        return distanceToBox({ re: d.cache.re, im: d.cache.im }, b) > this.gap(d) * 1.8
    }

    private attach() {
        const transform = (d:N)=> {
            const b = this.boxes.get(d), k = this.size(d) * this.transitions.growth(d)
            const w = (d.precalc[this.args.name + 'len'] || 0) * k
            return b ? ` translate(${b.x - w / 2} ${b.y}) scale(${k})` : ` translate(${d.cache.re} ${d.cache.im})`
        }
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              ()=> this.drawn,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text',
            create:            s=> s.style("fill", d=> d.pathes && d.pathes.labelcolor)
                                    .call(s=> setLabelText(s, this.args.text))
                                    .attr("transform", transform),
            updateColor:       s=> s.style("fill", d=> d.pathes && d.pathes.labelcolor)
                                    .call(markHoveredLabel),
            updateTransform:   s=> s.attr("transform", transform)
                                    .call(s=> setLabelText(s, this.args.text))
                                    .call(markHoveredLabel)
        })
        const lineEnd = (d:N)=> {
            const b = this.drawnBox(d)
            return { x: Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, d.cache.re)),
                     y: Math.max(b.y - b.h / 2, Math.min(b.y + b.h / 2, d.cache.im)) }
        }
        this.d3updatePattern2 = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              ()=> this.drawn,
            name:              this.name + '-link',
            className:         'label-link',
            elementType:       'line',
            create:            s=> {},
            updateColor:       s=> {},
            updateTransform:   s=> s.style('display', d=> this.showsLine(d) ? null : 'none')
                                    .style('opacity', d=> { const g = this.transitions.growth(d); return g < 1 ? g : null })
                                    .attr('x1', d=> lineEnd(d).x).attr('y1', d=> lineEnd(d).y)
                                    .attr('x2', d=> d.cache.re).attr('y2', d=> d.cache.im)
        })
    }
}
