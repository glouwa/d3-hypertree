import * as d3                    from 'd3'
import { ILayer }                 from '../layerstack/layer'
import { ILayerView }             from '../layerstack/layer'
import { ILayerArgs }             from '../layerstack/layer'
import { LayerStack }             from '../layerstack/layerstack'
import { N }                      from '../../models/n/n'
import { C }                      from '../../models/transformation/hyperbolic-math'
import { CptoCk, CktoCp, ArrtoC } from '../../models/transformation/hyperbolic-math'
import { CsubC, πify, sigmoid }   from '../../models/transformation/hyperbolic-math'

export interface InteractionLayer2Args extends ILayerArgs
{    
    nohover: boolean,
    mouseRadius,
    onClick
}

const π = Math.PI

export class InteractionLayer2 implements ILayer
{
    view:       ILayerView
    args:       InteractionLayer2Args    
    name =      'interaction-2'
   
    mousedown:  boolean
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
        if (!this.args.nohover) 
            this.view.parent.append('circle')
                .attr("class", "mouse-circle")
                .attr("r", this.args.mouseRadius)       
                .on('click',        e=> this.fireMouseWheelEvent())         
                .on('wheel',        e=> this.fireMouseWheelEvent())
                .on("mousedown",    e=> this.fireMouseDown())
                .on("mousemove",    e=> this.fireMouseMove())
                .on("mouseup",      e=> this.fireMouseUp())
                .on("mouseout",     e=> this.htapi.setPathHead(this.hoverpath, undefined))                
                .on("touchstart",   e=> this.fireTouchEvent('onPointerStart'))
                .on("touchmove",    e=> this.fireTouchEvent('onPointerMove'))
                .on("touchend",     e=> this.fireTouchEvent('onPointerEnd'))
                .on("touchcancel",  e=> this.fireTouchEvent('onPointerEnd'))
    }

    //-----------------------------------------------------------------------------------------

    private fireMouseDown() {
        this.mousedown = true
        this.fireMouseEvent('onPointerStart')
    }
    
    private fireMouseMove() {
        
        if (this.mousedown)
            this.fireMouseEvent('onPointerMove')                    
        else
            this.htapi.setPathHead(this.hoverpath, this.findNodeByCell())
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
        this[eventName]('mouse', m)
        this.view.hypertree.update.transformation()        
    }

    private fireTouchEvent(eventName:string) {
        d3.event.stopPropagation()
        d3.event.preventDefault()

        const changedTouches = d3.event.changedTouches
        for (let i=0; i < changedTouches.length; ++i) 
        {            
            const t = changedTouches[i]
            const pid = t.identifier   
            const m = ArrtoC(d3.touches(this.view.parent.node(), changedTouches)[i])
         
            this[eventName](pid, m)
        }
        if (changedTouches.length === 2)
            this.view.hypertree.update.layout()
        else
            this.view.hypertree.update.transformation()        
    }

    private minλ = .1 * π
    private maxλ = .8 * π*2
    private fireMouseWheelEvent()
    {
        const mΔ = d3.event.deltaY
        const λΔ = mΔ/100 * 2 * π / 16
        const oldλp = CktoCp(this.view.unitdisk.args.transformation.state.λ)
        const newλp = { θ:πify(oldλp.θ - λΔ), r:1 }
        
        if (newλp.θ < this.maxλ && newλp.θ > this.minλ) 
        {
            this.view.unitdisk.args.transformation.onDragλ(null, CptoCk(newλp))
            this.view.hypertree.updateLayout_()
            this.view.hypertree.update.layout()
        }
    }

    //-----------------------------------------------------------------------------------------

    private pinchInitDist = null
    private pinchInitλp = null
    private onPointerStart(pid, m) 
    {        
        this.view.hypertree.args.objects.traces.push({
            id: pid,
            points: [m]
        })        

        if (this.view.hypertree.args.objects.traces.length === 1) {
            this.view.unitdisk.args.transformation.onDragStart(m)
        }
        else if (this.view.hypertree.args.objects.traces.length === 2) {
            const t0 = this.view.hypertree.args.objects.traces[0]
            this.pinchInitDist = this.dist(t0.points[t0.points.length-1], m) 
            this.pinchInitλp = CktoCp(this.view.unitdisk.args.transformation.state.λ)
        }
        else {
        }
    }

    private onPointerMove(pid, m) 
    {
        const trace = this.findTrace(pid)
        trace.points.push(m)

        if (this.view.hypertree.args.objects.traces.length === 1) 
        {            
            this.view.unitdisk.args.transformation.onDragP(trace.points[0], m)
        }
        if (this.view.hypertree.args.objects.traces.length === 2) 
        {
            const t1 = this.view.hypertree.args.objects.traces[0]
            const t0 = this.view.hypertree.args.objects.traces[1]
            const dist = this.dist(t0.points[t0.points.length-1], t1.points[t1.points.length-1])

            const f = dist / this.pinchInitDist
            const newλp = { θ:πify(this.pinchInitλp.θ * f), r:1 }

            if (newλp.θ < this.maxλ && newλp.θ > this.minλ) 
            {
                console.log(f, this.pinchInitλp.θ/2/π, newλp.θ/2/π)
                this.view.unitdisk.args.transformation.onDragλ(null, CptoCk(newλp))
                this.view.hypertree.updateLayout_()
            }
        }
    }

    private onPointerEnd(pid, m)
    {
        this.view.hypertree.args.objects.traces 
            = this.view.hypertree.args.objects.traces.filter(e=> e.id !== pid)

        if (this.view.hypertree.args.objects.traces.length === 0) {
            this.view.unitdisk.args.transformation.onDragEnd(m)
        }
        else if (this.view.hypertree.args.objects.traces.length === 1) {
            this.view.unitdisk.args.transformation.onDragStart(m)
        }
        else {
        }
    }

    //-----------------------------------------------------------------------------------------
 
    private findTrace(pid) 
    {
        return this.view.hypertree.args.objects.traces.find(e=> e.id === pid)        
    }

    private currMousePosAsArr = ()=> d3.mouse(this.view.parent.node())
    private currMousePosAsC = ()=> ArrtoC(this.currMousePosAsArr())
    private findNodeByCell = ()=> {
        var m = this.currMousePosAsArr()
        var find = this.view.unitdisk.cache.voronoiDiagram.find(m[0], m[1])
        return find ? find.data : undefined
    }

    private dist(a:C, b:C) {
        const diff = CsubC(a, b)
        return Math.sqrt(diff.re*diff.re + diff.im*diff.im)
    }
}

