import * as d3                    from 'd3'
import { ILayer }                 from '../layerstack/layer'
import { ILayerView }             from '../layerstack/layer'
import { ILayerArgs }             from '../layerstack/layer'
import { LayerStack }             from '../layerstack/layerstack'
import { N }                      from '../../models/n/n'
import { C, Cp, maxR }            from '../../models/transformation/hyperbolic-math'
import { CptoCk, CktoCp, ArrtoC } from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR }    from '../../models/transformation/hyperbolic-math'
import { clone }                  from '../../models/transformation/hyperbolic-math'
import { compose, shift }         from '../../models/transformation/hyperbolic-math'
import { viewToDisk, toView, diskPos, infinityOf } from '../../models/transformation/cayley'

const π = Math.PI


export interface InteractionLayer2Args extends ILayerArgs
{  
    mouseRadius,
    onClick?            // unused: a click calls interaction.clickAction and onNodeClick
}

export class InteractionLayer2 implements ILayer
{
    view:       ILayerView
    args:       InteractionLayer2Args    
    name =      'interaction-2'
    // ms after the last wheel event until the full detail frame
    static wheelSettle = 150
    private wheelSettleTimer : any = undefined

    mousedown:  boolean
    dST
    htapi 
    hoverpath

    constructor(view:ILayerView, args:InteractionLayer2Args) {        
        this.view = view
        this.args = args
        this.htapi = this.view.hypertree.api
        this.hoverpath = this.view.hypertree.args.objects.pathes[0]
        this.mousedown = false
    }

    update = {
        parent:         ()=> this.updateParent(),
        data:           ()=> {},
        transformation: ()=> {},
        style:          ()=> {}
    }
    
    private updateParent() {
        const mousehandlers = de=> de
            .on('wheel',        e=> this.fireMouseWheelEvent(e))

            .on('mousedown',    e=> this.fireMouseDown(e))
            .on('mousemove',    e=> this.fireMouseMove(e))
            .on('mouseup',      e=> this.fireMouseUp(e))
            .on('mouseout',     e=> { this.setHoverNode(undefined); this.htapi.setPathHead(this.hoverpath, undefined) })
            
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
            if (!this.view.hypertree.isInitializing
             && !this.view.hypertree.isAnimationRunning()) {
                // The capture circle (r = 5) reaches far beyond the disk, and the voronoi
                // cells are unbounded: outside the disk no node is hovered.
                // hover strategy: 'pointer' (default) = the node under the mouse, 'none' = no hover
                const p = this.mousePosAsC(e), m = this.toDisk(p)
                const pointer = this.view.hypertree.args.interaction.hover !== 'none'
                const n = pointer && (m.re * m.re + m.im * m.im) <= 1 ? this.findNodeAt(p) : undefined
                this.setHoverNode(n)
                this.htapi.setPathHead(this.hoverpath, n)
            }
        }
    }

    // onNodeHover / onHoverNodeChange: only when the node under the mouse changes
    private hoverNode : N | undefined = undefined
    private setHoverNode(n:N | undefined) {
        if (n === this.hoverNode) return
        this.hoverNode = n
        const i = this.view.hypertree.args.interaction
        if (i.onNodeHover)       i.onNodeHover(n)
        if (i.onHoverNodeChange) i.onHoverNodeChange(n)
    }

    // onNodeHold: pointer pressed for holdDuration ms without moving
    private holdTimer : any = null
    private held = false
    private startHoldTimer(m:C) {
        this.cancelHoldTimer()
        this.held = false
        const i = this.view.hypertree.args.interaction
        if (!i.onNodeHold) return
        this.holdTimer = setTimeout(()=> {
            this.holdTimer = null
            const traces = this.view.hypertree.args.objects.traces
            if (traces.length !== 1 || !this.nopinch) return
            const v = this.toViewPos(m)
            const q = this.view.unitdisk.cache.voronoiDiagram
                && this.view.unitdisk.cache.voronoiDiagram.find(v.re, v.im)
            this.held = true
            i.onNodeHold(q ? q.data : undefined, v, this)
        }, i.holdDuration || 500)
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
        const oldλp = this.view.unitdisk.args.transformation.state.λ
        const Δsens = this.view.hypertree.args.interaction.wheelFactor
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
                const t = this.view.unitdisk.args.transformation            
                const preservingNode = this.findUnculledNodeByCell(m)
                t.onDragλ(newλp)
                this.view.hypertree.updateLayoutPath_(preservingNode) // only path to center
                t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, diskPos(preservingNode))).P
                
                this.view.hypertree.update.transformation()
            })
            //this.view.layerstack.layers['labels-force'].update.force()   
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
    
    /*
    interface DragState: {    
        onPointerStart: (pid:number, m:C)=> void,
        onPointerMove:  (pid:number, m:C)=> void,
        onPointerEnd:  (pid:number, m:C)=> void,
    }
    */
    // NoInteractionState extends Dragstate
    // MouseDownState extends Dragstate
    // PanState extends Dragstate
    // PinchState extends Dragstate
    private pinchState : {
        pinchInitDist:       number,
        pinchInitλp:         number,
        pinchcenter:         C,
        pinchPreservingNode: N
        onPointerStart,
        onPointerMove,
        onPointerEnd
    }
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

        this.view.hypertree.args.objects.traces.push({
            id: pid,
            points: [m]
        })

        if (this.view.hypertree.args.objects.traces.length === 1) {            
            this.view.hypertree.stopAnimation()   // the pointer takes over (see stopAnimation)
            this.dST = clone(this.view.unitdisk.args.transformation.state)
            this.view.unitdisk.isDraging = true
            this.panStart = m
            this.nopinch = true
            this.startHoldTimer(m)
        }
        else if (this.view.hypertree.args.objects.traces.length === 2) {
            this.cancelHoldTimer()
            const t0 = this.view.hypertree.args.objects.traces[0]
            const t0e = t0.points[t0.points.length-1]
            this.pinchcenter = CmulR(CaddC(t0e, m), .5)
            this.view.unitdisk.pinchcenter = this.pinchcenter
            this.pinchPreservingNode = this.findUnculledNodeByCell(this.pinchcenter)            
            this.pinchInitDist = this.dist(t0e, m)
            this.pinchInitλp = this.view.unitdisk.args.transformation.state.λ
            this.nopinch = false
            //console.log('pan » pinch')
        }
        else {}
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

        if (this.view.hypertree.args.objects.traces.length === 1)
        {
            const t = this.view.unitdisk.args.transformation
            t.state.P = compose(this.dST, shift(this.dST, this.panStart, maxR(m, .9))).P
        }
        else if (this.view.hypertree.args.objects.traces.length === 2)
        {
            const t0 = this.view.hypertree.args.objects.traces[0]
            const t0e = t0.points[t0.points.length-1]
            const t1 = this.view.hypertree.args.objects.traces[1]
            const t1e = t1.points[t1.points.length-1]
            const dist = this.dist(t0e, t1e)
            const f = dist / this.pinchInitDist
            // the pan part of the pinch continues at the λbounds, only the zoom stops
            const newλp = this.view.hypertree.clampλ(this.pinchInitλp * f)


            {
                const pinchcenter2 = maxR(CmulR(CaddC(t0e, t1e), .5), this.args.mouseRadius)
                
                const t = this.view.unitdisk.args.transformation
                t.onDragλ(newλp)
                this.view.hypertree.updateLayoutPath_(this.pinchPreservingNode) // only path to center
                t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, diskPos(this.pinchPreservingNode))).P
                t.state.P = compose(t.state, shift(t.state, this.pinchcenter, pinchcenter2)).P

                this.pinchcenter = CmulR(CaddC(this.pinchcenter, pinchcenter2), .5)
                this.view.unitdisk.pinchcenter = this.pinchcenter                
            }
        }
        else {}
        return true
    }

    private onPointerEnd(pid, m)
    {
        this.view.hypertree.args.objects.traces 
            = this.view.hypertree.args.objects.traces.filter(e=> e.id !== pid)

        this.pinchcenter = undefined
        this.view.unitdisk.pinchcenter = this.pinchcenter
        this.pinchPreservingNode = undefined

        if (this.view.hypertree.args.objects.traces.length === 0) 
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
        else if (this.view.hypertree.args.objects.traces.length === 1) 
        {
            const otherPoints = this.view.hypertree.args.objects.traces[0].points
            this.panStart = otherPoints[otherPoints.length-1] //others.lastpoint

            this.dST = clone(this.view.unitdisk.args.transformation.state)
            this.view.unitdisk.isDraging = true            
            //console.log('pinch --> pan')
        }
        else {}
        return true
    }
 
    //-----------------------------------------------------------------------------------------
 
    public ripple(n:N, m:C, ok, useClip=true) { 
        if (useClip && this.view.unitdisk.layerStack.layers['cells'] && !this.view.unitdisk.layerStack.layers['cells'].args.invisible) {
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
        const q = this.view.unitdisk.cache.voronoiDiagram.find(v.re, v.im)
        const n = q ? q.data : undefined

        if (!this.view.hypertree.isAnimationRunning()) {
            const i = this.view.hypertree.args.interaction
            if (n && i.clickAction === 'select') this.view.hypertree.api.toggleSelection(n)
            if (n && i.clickAction === 'goto')   this.view.hypertree.api.gotoNode(n)
            i.onNodeClick(n, v, this)        // v: where it is drawn (e.g. for ripple)
        }
    }

    private findTrace(pid) {
        return this.view.hypertree.args.objects.traces.find(e=> e.id === pid)        
    }

    // half-plane view (geometry.halfPlane): pointer positions are view coordinates; the
    // transformation works in the disk (cayley.ts)
    private get halfPlane() { return !!this.view.hypertree.args.geometry.halfPlane }
    private get infinity() { return infinityOf(this.view.hypertree.args.layout.rootWedge) }
    private toDisk = (p:C) : C => this.halfPlane ? viewToDisk(p, this.infinity) : p
    private toViewPos = (z:C) : C => this.halfPlane ? toView(z, this.infinity) : z

    // position of a mouse event or a touch in the view (the disk unless halfPlane)
    private mousePosAsC = (e:MouseEvent | Touch)=> ArrtoC(d3.pointer(e, this.view.parent.node()))
    private findNodeAt = (m:C)=> {
        var find = this.view.unitdisk.cache.voronoiDiagram.find(m.re, m.im)
        return find ? find.data : undefined
    }

    // The visible node nearest to m: what the voronoi cell under m would give (a
    // voronoi cell is the area nearest to its node), without building a diagram.
    // Used for the node that stays under the pointer while zooming (wheel, pinch).
    private findUnculledNodeByCell = (m:C)=> {
        let best:N = undefined, bestD = Infinity
        for (const n of this.view.unitdisk.cache.unculledNodes) {
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

interface DragState {
    onPointerStart(pid:number, m:C): void
    onPointerMove(pid:number, m:C): void
    onPointerEnd(pid:number, m:C): void
}

class NoInteractionState implements DragState {    
    constructor() {

    }
    public onPointerStart(pid:number, m:C) {

    }
    public onPointerMove(pid:number, m:C) {

    }
    public onPointerEnd(pid:number, m:C) {

    }
}

class MouseDownState implements DragState {
    constructor() {

    }
    public onPointerStart(pid:number, m:C) {

    }
    public onPointerMove(pid:number, m:C) {

    }
    public onPointerEnd(pid:number, m:C) {

    }
}

