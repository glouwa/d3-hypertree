import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType } from '../view/layer'
import { rimScale }        from './label-geometry'
import { setStyle }        from '../view/dom-write'

export interface HighlightMarkerLayerArgs extends ILayerArgs
{
    className?: string,
    // radius at the center of the disk (a number or a function of the layer context, e.g.
    // of geometry.captionHeight), times the rim factor (geometry.shrinkAtRim) where it is
    r?:         number | ((ctx:LayerContext)=> number),
    duration?:  number,       // ms of the way from the old to the new highlighted node (0: it jumps)
    // the colors, lambdas of the highlighted node (undefined: the theme's, class
    // highlight-marker)
    fill?:      (n:N)=> any,
    stroke?:    (n:N)=> any,
}

// A point on the tree: on the link between the nodes a and b, at the share f from a
// (f 0: at a). The marker is always on the tree, so it can go on from where it is.
interface At { a:N, b:N, f:number }

// The highlight marker: a disk on the highlighted node (state/highlight.ts, both
// sources: the mouse and the center node). When the highlight moves on, the disk moves
// along the tree to the new node: up the links to the nearest common ancestor and down
// to the new node, on straight lines between the nodes, in duration ms; a new target on
// the way: it goes on from where it is. Its place is taken from the nodes' current
// positions in every frame, so it stays on the tree while the view moves.
//
// Its own animation draws only itself (no frame of the other layers): it writes the
// disk's position on every animation frame until it arrives. Off by default.
export class HighlightMarkerLayer implements ILayer
{
    static type : LayerType<HighlightMarkerLayerArgs> = {
        defaults: ()=> ({
            invisible:  true,
            hideOnDrag: false,
            className:  'highlight-marker',
            r:          .012,
            duration:   250,
            fill:       n=> undefined,
            stroke:     n=> undefined,
        }),
        create: (ctx, name, args)=> new HighlightMarkerLayer(ctx, name, args),
    }

    view:  LayerContext
    args:  HighlightMarkerLayerArgs
    name:  string
    needs = <const>['data', 'transform', 'style']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.draw(),
        transformation: ()=> this.draw(),
        style:          ()=> this.draw(),
    }

    private circle : SVGCircleElement | null = null
    private target : N | undefined = undefined
    // the way: from a point on the tree along the nodes, the last one the target
    private from : At | null = null
    private way  : N[] = []
    private start = 0
    private animating = false

    constructor(view:LayerContext, name:string, args:HighlightMarkerLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private attach() {
        const g = this.view.parent.append('g').attr('class', this.name).node() as SVGGElement
        this.circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle') as SVGCircleElement
        this.circle.setAttribute('class', this.args.className)
        this.circle.style.display = 'none'
        g.appendChild(this.circle)
    }

    private hidden() : boolean {
        return this.args.invisible || (this.args.hideOnDrag && this.view.hypertree.isAnimationRunning())
    }

    // the share of the way at time t (0..1): starts fast, stops softly
    private ease(t:number) : number { return 1 - Math.pow(1 - t, 3) }

    private progress() : number {
        const d = this.args.duration || 0
        return d <= 0 ? 1 : Math.min(1, (performance.now() - this.start) / d)
    }

    /** The highlight changed: the way from where the marker is to the new target. */
    private retarget(n:N | undefined) {
        const at = this.target && n && this.from ? this.at(this.ease(this.progress())) : null
        this.target = n
        if (!n) { this.from = null; this.way = []; return }
        if (!at) { this.from = { a: n, b: n, f: 0 }; this.way = [n]; this.start = 0; return }
        // go on toward the end of the current link that is nearer to the target (in links)
        const viaA = at.f + treePath(at.a, n).length, viaB = (1 - at.f) + treePath(at.b, n).length
        const first = viaA <= viaB ? at.a : at.b
        this.from = at
        this.way = treePath(first, n)
        this.start = performance.now()
    }

    // the points of the way: the start (on a link) and the nodes, at their current place
    private points() : { at:At, x:number, y:number }[] | null {
        const pos = (n:N)=> n.cache && isFinite(n.cache.re) ? { x: n.cache.re, y: n.cache.im } : null
        const a = pos(this.from.a), b = pos(this.from.b)
        if (!a || !b) return null
        const pts = [{ at: this.from, x: a.x + (b.x - a.x) * this.from.f, y: a.y + (b.y - a.y) * this.from.f }]
        for (const n of this.way) {
            const p = pos(n)
            if (!p) return null
            pts.push({ at: { a: n, b: n, f: 0 }, ...p })
        }
        return pts
    }

    // where the marker is at the share s of the way: the link it is on and its share
    private at(s:number) : At {
        const pts = this.points()
        if (!pts) return { a: this.target, b: this.target, f: 0 }
        const len = pts.slice(1).map((p, i)=> Math.hypot(p.x - pts[i].x, p.y - pts[i].y))
        let rest = s * len.reduce((x, y)=> x + y, 0)
        for (let i = 0; i < len.length; i++) {
            if (rest <= len[i] && len[i] > 0) {
                const q = rest / len[i]
                if (i === 0) {
                    // the first piece lies on the start's link: from its share toward one end
                    const to = this.way[0] === this.from.a ? 0 : 1
                    return { a: this.from.a, b: this.from.b, f: this.from.f + (to - this.from.f) * q }
                }
                return { a: this.way[i - 1], b: this.way[i], f: q }
            }
            rest -= len[i]
        }
        const last = this.way[this.way.length - 1]
        return { a: last, b: last, f: 0 }
    }

    private draw() {
        const c = this.circle
        if (!c) return
        const n = this.view.hypertree.highlighted
        if (n !== this.target) this.retarget(n)
        if (!this.target || this.hidden()) { c.style.display = 'none'; return }
        const at = this.at(this.ease(this.progress()))
        const ca = at.a.cache, cb = at.b.cache
        if (!ca || !cb || !isFinite(ca.re) || !isFinite(cb.re)) { c.style.display = 'none'; return }
        const x = ca.re + (cb.re - ca.re) * at.f, y = ca.im + (cb.im - ca.im) * at.f
        const k = rimScale(this.view, at.a) + (rimScale(this.view, at.b) - rimScale(this.view, at.a)) * at.f
        c.setAttribute('cx', String(x))
        c.setAttribute('cy', String(y))
        const r = typeof this.args.r === 'function' ? this.args.r(this.view) : this.args.r
        c.setAttribute('r', String(r * k))
        setStyle(c, 'fill', this.args.fill(this.target))
        setStyle(c, 'stroke', this.args.stroke(this.target))
        c.style.display = ''
        if (this.progress() < 1) this.animate()
    }

    // its own animation frames until it arrives (only this disk is drawn)
    private animate() {
        if (this.animating) return
        this.animating = true
        requestAnimationFrame(()=> {
            this.animating = false
            this.draw()
        })
    }
}

/** The nodes from u to v along the tree (u first, v last): up to the nearest common ancestor, down to v. */
export function treePath(u:N, v:N) : N[] {
    const vUp = v.ancestors()
    const inV = new Set(vUp)
    const up:N[] = []
    let a = u
    while (a && !inV.has(a)) { up.push(a); a = a.parent }
    if (!a) return [u, v]
    up.push(a)
    const down = vUp.slice(0, vUp.indexOf(a)).reverse()
    return up.concat(down)
}
