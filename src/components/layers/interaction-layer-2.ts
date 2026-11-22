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

const π = Math.PI


export interface InteractionLayer2Args extends ILayerArgs
{  
    mouseRadius,
    onClick
}

export class InteractionLayer2 implements ILayer
{
    view:       ILayerView
    args:       InteractionLayer2Args    
    name =      'interaction-2'

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
            .on('wheel',        e=> this.fireMouseWheelEvent())

            .on('mousedown',    e=> this.fireMouseDown())
            .on('mousemove',    e=> this.fireMouseMove())
            .on('mouseup',      e=> this.fireMouseUp())
            .on('mouseout',     e=> { this.setHoverNode(undefined); this.htapi.setPathHead(this.hoverpath, undefined) })
            
            .on('touchstart',   e=> this.fireTouchEvent('onPointerStart'))
            .on('touchmove',    e=> this.fireTouchEvent('onPointerMove'))
            .on('touchend',     e=> this.fireTouchEvent('onPointerEnd'))
            .on('touchcancel',  e=> this.fireTouchEvent('onPointerEnd'))
        
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

    private fireMouseDown() {
        this.mousedown = true
        this.fireMouseEvent('onPointerStart')
    }
    
    private fireMouseMove() {
        if (this.mousedown) 
            this.fireMouseEvent('onPointerMove')                    
        else {
            if (!this.view.hypertree.isInitializing
             && !this.view.hypertree.isAnimationRunning()) {
                // The capture circle (r = 5) reaches far beyond the disk, and the voronoi
                // cells are unbounded: outside the disk no node is hovered.
                // hover strategy: 'pointer' (default) = the node under the mouse, 'none' = no hover
                const m = this.currMousePosAsC()
                const pointer = this.view.hypertree.args.interaction.hover !== 'none'
                const n = pointer && (m.re * m.re + m.im * m.im) <= 1 ? this.findNodeByCell() : undefined
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
            const q = this.view.unitdisk.cache.voronoiDiagram
                && this.view.unitdisk.cache.voronoiDiagram.find(m.re, m.im)
            this.held = true
            i.onNodeHold(q ? q.data : undefined, m, this)
        }, i.holdDuration || 500)
    }
    private cancelHoldTimer() {
        if (this.holdTimer) clearTimeout(this.holdTimer)
        this.holdTimer = null
    }

    private fireMouseUp() {
        this.mousedown = false
        this.fireMouseEvent('onPointerEnd')
    }

    //-----------------------------------------------------------------------------------------

    private fireMouseEvent(eventName:string) {
        d3.event.stopPropagation()
        d3.event.preventDefault()
        
        const m = this.currMousePosAsC()
        requestAnimationFrame(()=> {            
            if (this[eventName]('mouse', m))
                this.view.hypertree.update.transformation()
        })
    }

    private fireMouseWheelEvent()
    {
        d3.event.stopPropagation()
        d3.event.preventDefault()
        
        const mΔ = d3.event.deltaY
        const oldλp = this.view.unitdisk.args.transformation.state.λ
        const Δsens = this.view.hypertree.args.interaction.wheelFactor
        // zoom stops at interaction.λbounds
        const newλp = this.view.hypertree.clampλ(mΔ>=0 ? oldλp/Δsens : oldλp*Δsens)

        if (newλp !== oldλp)
        {
            const m = this.currMousePosAsArr()
            
            requestAnimationFrame(()=> {
                const t = this.view.unitdisk.args.transformation            
                const preservingNode = this.findUnculledNodeByCell(ArrtoC(m))
                t.onDragλ(newλp)
                this.view.hypertree.updateLayoutPath_(preservingNode) // only path to center
                t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, preservingNode.cache)).P
                
                this.view.hypertree.update.transformation()
            })
            //this.view.layerstack.layers['labels-force'].update.force()   
        }
    }
    
    private fireTouchEvent(eventName:string) {
        d3.event.stopPropagation()
        d3.event.preventDefault()

        const changedTouches = d3.event.changedTouches
        let update = false
        for (let i=0; i < changedTouches.length; ++i) 
        {
            const t = changedTouches[i]
            const pid = t.identifier   
            const m = ArrtoC(d3.touches(this.view.parent.node(), changedTouches)[i])
         
            update = this[eventName](pid, m) || update
        }
        requestAnimationFrame(()=> {
            if (update)
                this.view.hypertree.update.transformation()            
        })
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
            //this.view.unitdisk.args.transformation.onDragStart(m)
            this.dST = clone(this.view.unitdisk.args.transformation.state)
            this.view.unitdisk.isDraging = true
            //console.log(still » pan || pinch » pan)
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
        if (!trace) {
            console.warn('onPointerMove ')
            return false
        }
        trace.points.push(m)

        // moving beyond the click threshold cancels a pending hold
        if (this.holdTimer && this.dist(this.panStart, m) >= .006)
            this.cancelHoldTimer()

        if (this.view.hypertree.args.objects.traces.length === 1)
        {
            //this.view.unitdisk.args.transformation.onDragP(this.panStart, m)
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
                t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, this.pinchPreservingNode.cache )).P
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
            //this.view.unitdisk.args.transformation.onDragEnd(m)
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
            //this.view.unitdisk.args.transformation.onDragStart(m)
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
        const q = this.view.unitdisk.cache.voronoiDiagram.find(m.re, m.im)
        const n = q ? q.data : undefined

        if (!this.view.hypertree.isAnimationRunning()) {
            const i = this.view.hypertree.args.interaction
            if (n && i.clickAction === 'select') this.view.hypertree.api.toggleSelection(n)
            if (n && i.clickAction === 'goto')   this.view.hypertree.api.gotoNode(n)
            i.onNodeClick(n, m, this)
        }
    }

    private findTrace(pid) {
        return this.view.hypertree.args.objects.traces.find(e=> e.id === pid)        
    }

    private currMousePosAsArr = ()=> d3.mouse(this.view.parent.node())
    private currMousePosAsC = ()=> ArrtoC(this.currMousePosAsArr())
    private findNodeByCell = ()=> {
        var m = this.currMousePosAsArr()
        var find = this.view.unitdisk.cache.voronoiDiagram.find(m[0], m[1])
        return find ? find.data : undefined
    }

    private findUnculledNodeByCell = (m:C)=> {   
        const voronoiLayout = d3.voronoi<N>()
            .x(d=> { console.assert(typeof d.cache.re === 'number'); return d.cache.re; })
            .y(d=> { console.assert(typeof d.cache.re === 'number'); return d.cache.im; })
            //.x(d=> d.cache.re)
            //.y(d=> d.cache.im)
            .extent([[-2,-2], [2,2]])             
        const voronoiDiagram = voronoiLayout(this.view.unitdisk.cache.unculledNodes)
        const find = voronoiDiagram.find(m.re, m.im)
        return find ? find.data : undefined
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

/*
class PanState implements DragState {    
    private panStart:C    
    constructor() {

    }
    public onPointerStart(pid:number, m:C) {
        //this.view.unitdisk.args.transformation.onDragStart(m)
        this.dST = clone(this.view.unitdisk.args.transformation.state)
        this.view.unitdisk.args.transformation.dST = this.dST
        //console.log(still » pan || pinch » pan)
        this.panStart = m
        this.nopinch = true
    }
    public onPointerMove(pid:number, m:C) {
        //this.view.unitdisk.args.transformation.onDragP(this.panStart, m)
        const t = this.view.unitdisk.args.transformation
        t.state.P = compose(this.dST, shift(this.dST, this.panStart, maxR(m, .9))).P
    }
    public onPointerEnd(pid:number, m:C) {
        //this.view.unitdisk.args.transformation.onDragEnd(m)
        this.dST = undefined
        this.view.unitdisk.args.transformation.dST = undefined

        if (this.dist(this.panStart, m) < .006 && this.nopinch)
            if (CktoCp(m).r < 1)
                this.click(m)
    }
}

class PinchState implements DragState {    
    pinchInitDist:       number
    pinchInitλp:         number
    pinchcenter:         C
    pinchPreservingNode: N
    constructor() {

    }
    public onPointerStart(pid:number, m:C) {
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
    public onPointerMove(pid:number, m:C) {
        const t0 = this.view.hypertree.args.objects.traces[0]
        const t0e = t0.points[t0.points.length-1]
        const t1 = this.view.hypertree.args.objects.traces[1]
        const t1e = t1.points[t1.points.length-1]
        const dist = this.dist(t0e, t1e)
        const f = dist / this.pinchInitDist
        const newλp = this.view.hypertree.clampλ(this.pinchInitλp * f)

        {
            const pinchcenter2 = maxR(CmulR(CaddC(t0e, t1e), .5), this.args.mouseRadius)
            
            const t = this.view.unitdisk.args.transformation
            t.onDragλ(newλp)
            this.view.hypertree.updateLayoutPath_(this.pinchPreservingNode) // only path to center
            t.state.P = compose(t.state, shift(t.state, { re:0, im:0 }, this.pinchPreservingNode.cache )).P
            t.state.P = compose(t.state, shift(t.state, this.pinchcenter, pinchcenter2)).P

            this.pinchcenter = CmulR(CaddC(this.pinchcenter, pinchcenter2), .5)
            this.view.unitdisk.pinchcenter = this.pinchcenter                
        }
    }
    public onPointerEnd(pid:number, m:C) {
        //this.view.unitdisk.args.transformation.onDragStart(m)
        const otherPoints = this.view.hypertree.args.objects.traces[0].points
        this.panStart = otherPoints[otherPoints.length-1] //others.lastpoint

        this.dST = clone(this.view.unitdisk.args.transformation.state)
        this.view.unitdisk.args.transformation.dST = this.dST
        //console.log(still » pan || pinch » pan)            
        this.nopinch = true
    }
}
*/