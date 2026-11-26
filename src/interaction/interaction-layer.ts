import * as d3                    from 'd3'
import { ILayer, ILayerArgs, LayerContext, LayerType } from '../view/layer'
import { N }                      from '../data/n'
import { C, maxR }                from '../geometry/hyperbolic-math'
import { CktoCp, ArrtoC }         from '../geometry/hyperbolic-math'
import { CaddC, CsubC, CmulR }    from '../geometry/hyperbolic-math'
import { clone }                  from '../geometry/hyperbolic-math'
import { compose, shift }         from '../geometry/hyperbolic-math'
import { diskPos }                from '../geometry/cayley'

// pointing within this many screen pixels of a node's position hits the node, even
// if a label of another node lies over it (nodeAt)
const NODE_HIT_PX = 8

export interface InteractionLayer2Args extends ILayerArgs
{
    mouseRadius?: number,      // the radius of the capture circle around the disk
}

// Mouse, touch and wheel: panning, pinching and zooming change the transformation
// (in the disk; pointer positions are mapped back from the view by the projection),
// hover and click set the node state and call the interaction callbacks.
export class InteractionLayer2 implements ILayer
{
    static type : LayerType<InteractionLayer2Args> = {
        defaults: (ctx)=> ({ mouseRadius: ctx.model.interaction.mouseRadius }),
        create:   (ctx, name, args)=> new InteractionLayer2(ctx, name, args),
    }

    view:       LayerContext
    args:       InteractionLayer2Args
    name:       string
    needs = <const>[]
    // ms after the last wheel event until the full detail frame
    static wheelSettle = 150
    private wheelSettleTimer : any = undefined

    mousedown:  boolean
    dST

    constructor(view:LayerContext, name:string, args:InteractionLayer2Args) {
        this.view = view
        this.args = args
        this.name = name
        this.mousedown = false
    }

    update = {
        parent:         ()=> this.updateParent(),
        data:           ()=> {},
        transformation: ()=> {},
        style:          ()=> {}
    }

    private get interaction() { return this.view.model.interaction }
    private get traces() { return this.view.model.objects.traces }
    private set traces(t) { this.view.model.objects.traces = t }
    private get transformation() { return this.view.unitdisk.args.transformation }

    private updateParent() {
        const mousehandlers = de=> de
            .on('wheel',        e=> this.fireMouseWheelEvent(e))

            .on('mousedown',    e=> this.fireMouseDown(e))
            .on('mousemove',    e=> this.fireMouseMove(e))
            .on('mouseup',      e=> this.fireMouseUp(e))
            .on('mouseout',     e=> { if (this.mousehover) this.view.hypertree.highlighting.clear() })

            .on('touchstart',   e=> this.fireTouchEvent(e, 'onPointerStart'))
            .on('touchmove',    e=> this.fireTouchEvent(e, 'onPointerMove'))
            .on('touchend',     e=> this.fireTouchEvent(e, 'onPointerEnd'))
            .on('touchcancel',  e=> this.fireTouchEvent(e, 'onPointerEnd'))

        this.view.parent
            .append('circle')
                .attr('class',      'mouse-circle')
                .attr('r',          5)
                .call(              mousehandlers)

        this.view.parent
            .append('circle')
                .attr('class',      'mouse-circle-cursor')
                .attr('r',          this.args.mouseRadius)
                .call(              mousehandlers)
    }

    // just to keep the list above clear

    private fireMouseDown(e:MouseEvent) {
        this.mousedown = true
        this.fireMouseEvent(e, 'onPointerStart')
    }

    private fireMouseMove(e:MouseEvent) {
        if (this.mousedown)
            this.fireMouseEvent(e, 'onPointerMove')
        else {
            if (this.mousehover
             && !this.view.hypertree.isInitializing
             && !this.view.hypertree.isAnimationRunning()) {
                // The capture circle (r = 5) reaches far beyond the disk, and the voronoi
                // cells are unbounded: outside the disk no node is hovered.
                // A label under the mouse hovers its node (also outside the disk, where
                // labels at the rim may reach)
                const p = this.mousePosAsC(e), m = this.toDisk(p)
                this.view.hypertree.highlighting.offer(this.nodeAt(p, (m.re * m.re + m.im * m.im) <= 1))
            }
        }
    }

    // highlightNode 'mousehover' (default): the mouse sets the highlighted node
    // (state/highlight.ts; 'center': the center node, 'none': nothing)
    private get mousehover() { return this.interaction.highlightNode === 'mousehover' }

    // onNodeHold: pointer pressed for holdDuration ms without moving
    private holdTimer : any = null
    private held = false
    private startHoldTimer(m:C) {
        this.cancelHoldTimer()
        this.held = false
        const i = this.interaction
        if (!i.onNodeHold) return
        this.holdTimer = setTimeout(()=> {
            this.holdTimer = null
            if (this.traces.length !== 1 || !this.nopinch) return
            const v = this.toViewPos(m)
            this.held = true
            i.onNodeHold(this.nodeAt(v), v, this)
        }, i.holdDuration)
    }
    private cancelHoldTimer() {
        if (this.holdTimer) clearTimeout(this.holdTimer)
        this.holdTimer = null
    }

    private fireMouseUp(e:MouseEvent) {
        this.mousedown = false
        this.fireMouseEvent(e, 'onPointerEnd')
    }

    //-----------------------------------------------------------------------------------------

    private fireMouseEvent(e:MouseEvent, eventName:string) {
        e.stopPropagation()
        e.preventDefault()
        this.enqueuePointerEvent(eventName, 'mouse', this.toDisk(this.mousePosAsC(e)))
    }

    // Pointer events are processed once per animation frame, in order; consecutive
    // moves of the same pointer collapse to the latest position. One update per
    // frame instead of one per event (several mouse or touch moves can arrive per frame).
    private pointerQueue : { name:string, pid, m:C }[] = []
    private pointerFlushScheduled = false
    private enqueuePointerEvent(name:string, pid, m:C) {
        const last = this.pointerQueue[this.pointerQueue.length - 1]
        if (name === 'onPointerMove' && last && last.name === name && last.pid === pid)
            last.m = m
        else
            this.pointerQueue.push({ name, pid, m })
        if (this.pointerFlushScheduled) return
        this.pointerFlushScheduled = true
        requestAnimationFrame(()=> {
            this.pointerFlushScheduled = false
            const queue = this.pointerQueue
            this.pointerQueue = []
            let update = false
            for (const e of queue)
                update = this[e.name](e.pid, e.m) || update
            if (update)
                this.view.hypertree.update.transformation()
        })
    }

    private fireMouseWheelEvent(e:WheelEvent)
    {
        e.stopPropagation()
        e.preventDefault()

        this.view.hypertree.stopAnimation()
        const mΔ = e.deltaY
        const oldλp = this.transformation.state.λ
        const Δsens = this.interaction.wheelFactor
        // zoom stops at interaction.λbounds
        const newλp = this.view.hypertree.clampλ(mΔ>=0 ? oldλp/Δsens : oldλp*Δsens)

        if (newλp !== oldλp)
        {
            const m = this.toDisk(this.mousePosAsC(e))

            // A wheel burst is an interaction like dragging: low detail (no voronoi,
            // no labels, hideOnDrag layers hidden) until no wheel event came for
            // wheelSettle ms, then one full detail frame.
            const ud = this.view.unitdisk
            ud.isWheeling = true
            clearTimeout(this.wheelSettleTimer)
            this.wheelSettleTimer = setTimeout(()=> {
                ud.isWheeling = false
                this.view.hypertree.update.transformation()
            }, InteractionLayer2.wheelSettle)

            requestAnimationFrame(()=> {
                const t = this.transformation
                const preservingNode = this.findUnculledNodeByCell(m)
                t.onDragλ(newλp)
                this.view.hypertree.updateLayoutPath_(preservingNode) // only path to center
                t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, diskPos(preservingNode))).P

                this.view.hypertree.update.transformation()
            })
        }
    }

    private fireTouchEvent(e:TouchEvent, eventName:string) {
        e.stopPropagation()
        e.preventDefault()

        const changedTouches = e.changedTouches
        for (let i=0; i < changedTouches.length; ++i)
            this.enqueuePointerEvent(eventName, changedTouches[i].identifier, this.toDisk(this.mousePosAsC(changedTouches[i])))
    }

    //-----------------------------------------------------------------------------------------

    private panStart:C           = null
    private pinchInitDist:number = null
    private pinchInitλp:number   = null
    private nopinch:boolean      = null
    private pinchcenter:C        = null
    private pinchPreservingNode  = null

    private onPointerStart(pid, m:C)
    {
        if (CktoCp(m).r >= 1)
            return false

        this.traces.push({
            id: pid,
            points: [m]
        })

        if (this.traces.length === 1) {
            this.view.hypertree.stopAnimation()   // the pointer takes over (see stopAnimation)
            this.dST = clone(this.transformation.state)
            this.view.unitdisk.isDraging = true
            this.panStart = m
            this.nopinch = true
            this.startHoldTimer(m)
        }
        else if (this.traces.length === 2) {
            this.cancelHoldTimer()
            const t0 = this.traces[0]
            const t0e = t0.points[t0.points.length-1]
            this.pinchcenter = CmulR(CaddC(t0e, m), .5)
            this.view.unitdisk.pinchcenter = this.pinchcenter
            this.pinchPreservingNode = this.findUnculledNodeByCell(this.pinchcenter)
            this.pinchInitDist = this.dist(t0e, m)
            this.pinchInitλp = this.transformation.state.λ
            this.nopinch = false
        }
        return false
    }

    private onPointerMove(pid, m)
    {
        const trace = this.findTrace(pid)
        if (!trace)   // a pointer that didn't start on the component
            return false
        trace.points.push(m)

        // moving beyond the click threshold cancels a pending hold
        if (this.holdTimer && this.dist(this.panStart, m) >= .006)
            this.cancelHoldTimer()

        if (this.traces.length === 1)
        {
            const t = this.transformation
            t.state.P = compose(this.dST, shift(this.dST, this.panStart, maxR(m, .9))).P
        }
        else if (this.traces.length === 2)
        {
            const t0 = this.traces[0]
            const t0e = t0.points[t0.points.length-1]
            const t1 = this.traces[1]
            const t1e = t1.points[t1.points.length-1]
            const dist = this.dist(t0e, t1e)
            const f = dist / this.pinchInitDist
            // the pan part of the pinch continues at the λbounds, only the zoom stops
            const newλp = this.view.hypertree.clampλ(this.pinchInitλp * f)

            const pinchcenter2 = maxR(CmulR(CaddC(t0e, t1e), .5), this.args.mouseRadius)

            const t = this.transformation
            t.onDragλ(newλp)
            this.view.hypertree.updateLayoutPath_(this.pinchPreservingNode) // only path to center
            t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, diskPos(this.pinchPreservingNode))).P
            t.state.P = compose(t.state, shift(t.state, this.pinchcenter, pinchcenter2)).P

            this.pinchcenter = CmulR(CaddC(this.pinchcenter, pinchcenter2), .5)
            this.view.unitdisk.pinchcenter = this.pinchcenter
        }
        return true
    }

    private onPointerEnd(pid, m)
    {
        this.traces = this.traces.filter(e=> e.id !== pid)

        this.pinchcenter = undefined
        this.view.unitdisk.pinchcenter = this.pinchcenter
        this.pinchPreservingNode = undefined

        if (this.traces.length === 0)
        {
            this.dST = undefined
            this.view.unitdisk.isDraging = false

            this.cancelHoldTimer()
            if (this.held) {        // a hold doesn't end in a click
                this.held = false
                return false
            }

            if (this.dist(this.panStart, m) < .006 && this.nopinch) {
                if (CktoCp(m).r < 1) {
                    this.click(m)
                    return false
                }
            }
        }
        else if (this.traces.length === 1)
        {
            const otherPoints = this.traces[0].points
            this.panStart = otherPoints[otherPoints.length-1]

            this.dST = clone(this.transformation.state)
            this.view.unitdisk.isDraging = true
        }
        return true
    }

    //-----------------------------------------------------------------------------------------

    public ripple(n:N, m:C, ok, useClip=true) {
        const cells = this.view.unitdisk.layerStack.layers['cells']
        if (useClip && cells && !cells.args.invisible) {
            const rippleClip = this.view.parent
                .append('clipPath')
                .attr('id', `cell-clip-${n.mergeId}`)
                .html(`<use xlink:href="#cell-${n.mergeId}"></use>`)

            const rippleCircle = this.view.parent
                .insert('g', ':first-child')
                .attr('class', 'ripple-world')
                .attr('clip-path', `url(#cell-clip-${n.mergeId})`)
                    .append('circle')
                        .attr('class', 'ripple-circle')
                        .attr('r', .1)
                        .attr('cx', m.re)
                        .attr('cy', m.im)
                        .attr('transform-origin', `${m.re}  ${m.im}`)
                        .on('animationend', ()=> {
                            rippleCircle.remove()
                            rippleClip.remove()
                            ok()
                        })
        }
        else {
            const rippleCircle = this.view.parent
                .insert('g', ':first-child')
                .attr('class', 'ripple-world')
                    .append('circle')
                        .attr('class', 'ripple-circle')
                        .attr('r', .1)
                        .attr('cx', m.re)
                        .attr('cy', m.im)
                        .attr('transform-origin', `${m.re}  ${m.im}`)
                        .on('animationend', ()=> {
                            rippleCircle.remove()
                            ok()
                        })
        }
    }

    private click(m:C) {
        const v = this.toViewPos(m)              // the voronoi cells are in view coordinates
        const n = this.nodeAt(v)

        if (!this.view.hypertree.isAnimationRunning()) {
            const i = this.interaction
            if (n && i.clickAction === 'select') this.view.hypertree.api.toggleSelection(n)
            if (n && i.clickAction === 'goto')   this.view.hypertree.api.gotoNode(n)
            i.onNodeClick(n, v, this)        // v: where it is drawn (e.g. for ripple)
        }
    }

    private findTrace(pid) {
        return this.traces.find(e=> e.id === pid)
    }

    // pointer positions are view coordinates; the transformation works in the disk
    private toDisk = (p:C) : C => this.view.projection.toDisk(p)
    private toViewPos = (z:C) : C => this.view.projection.toView(z)

    // position of a mouse event or a touch in the view
    private mousePosAsC = (e:MouseEvent | Touch)=> ArrtoC(d3.pointer(e, this.view.parent.node()))

    // The node at a view position (hover, click, hold):
    //   1. a node drawn right there (within NODE_HIT_PX of its position on the screen)
    //   2. else the node of a label there (a label sits beside its node, often in
    //      another node's cell: pointing at it acts on its own node; labels may lie
    //      over other nodes, which is why 1. comes first)
    //   3. else the node of the voronoi cell (only inside the disk for hover)
    private nodeAt = (v:C, cellToo = true) : N | undefined=> {
        const q = this.view.cache.voronoiDiagram && this.view.cache.voronoiDiagram.find(v.re, v.im)
        const cell:N = q ? q.data : undefined
        if (cell && cell.cache && this.screenDistance(v, cell.cache) <= NODE_HIT_PX) return cell
        return this.labelNodeAt(v) || (cellToo ? cell : undefined)
    }
    // distance of two view positions in screen pixels
    private screenDistance(a:C, b:C) : number {
        const plane = this.view.parent && this.view.parent.node && this.view.parent.node()
        const ctm = plane && plane.getScreenCTM && plane.getScreenCTM()
        const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1
        return Math.hypot(a.re - b.re, a.im - b.im) * scale
    }

    // The node of the drawn label at a view position (labels, labels-force,
    // labels-placed; the text box on the screen, a few pixels larger). Labels have
    // pointer-events: none, this layer gets the events, so the hit is computed. The
    // label drawn last (on top) wins.
    private labelNodeAt(v:C) : N | undefined {
        const plane = this.view.parent && this.view.parent.node && this.view.parent.node()
        const stack = plane && plane.parentNode
        const ctm = plane && plane.getScreenCTM && plane.getScreenCTM()
        if (!stack || !ctm) return undefined
        const x = ctm.a * v.re + ctm.c * v.im + ctm.e
        const y = ctm.b * v.re + ctm.d * v.im + ctm.f
        const PAD = 2
        let hit:N = undefined
        const texts = stack.querySelectorAll('[id="labels"] text, [id="labels-force"] text, [id="labels-placed"] text')
        for (let i = 0; i < texts.length; i++) {
            const t:any = texts[i]
            if (!t.__data__) continue
            const r = t.getBoundingClientRect()
            if (r.width < 2 || r.height < 2) continue          // not drawn, or still growing from 0
            if (x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD) hit = t.__data__
        }
        return hit
    }

    // The visible node nearest to m: what the voronoi cell under m would give (a
    // voronoi cell is the area nearest to its node), without building a diagram.
    // Used for the node that stays under the pointer while zooming (wheel, pinch).
    private findUnculledNodeByCell = (m:C)=> {
        let best:N = undefined, bestD = Infinity
        for (const n of this.view.cache.unculledNodes) {
            const z = diskPos(n)                     // m is a disk position
            const dx = z.re - m.re, dy = z.im - m.im
            const d = dx*dx + dy*dy
            if (d < bestD) { bestD = d; best = n }
        }
        return best
    }

    private dist(a:C, b:C) {
        const diff = CsubC(a, b)
        return Math.sqrt(diff.re*diff.re + diff.im*diff.im)
    }
}
