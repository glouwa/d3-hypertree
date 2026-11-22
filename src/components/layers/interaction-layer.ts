import * as d3              from 'd3'
import { ILayer }           from '../layerstack/layer'
import { ILayerView }       from '../layerstack/layer'
import { ILayerArgs }           from '../layerstack/layer'
import { LayerStack }           from '../layerstack/layerstack'
import { N }                    from '../../models/n/n'
import { C, CptoCk, CktoCp }    from '../../models/transformation/hyperbolic-math'  
import { ArrtoC, CsubC, CmulR } from '../../models/transformation/hyperbolic-math'   
import { πify, sigmoid }        from '../../models/transformation/hyperbolic-math'

export interface InteractionLayerArgs extends ILayerArgs
{ 
    mouseRadius,
    onClick
}

export class InteractionLayer implements ILayer
{
    view:       ILayerView
    args:       InteractionLayerArgs    
    name =      'interaction'
   
    constructor(view:ILayerView, args:InteractionLayerArgs) {        
        this.view = view
        this.args = args 
    }

    update = {
        parent:         ()=> this.initMouseStuff(),
        data:           ()=> {},
        transformation: ()=> {},
        style:          ()=> {}
    }

    // d3 v7 passes the event to the handlers (no this.ev): the last one, for the helpers below
    private ev:any = null
    currMousePosAsArr = ()=> d3.pointer(this.ev, this.view.parent.node())
    currMousePosAsC = ()=> ArrtoC(this.currMousePosAsArr())
    findNodeByCell = ()=> {
        var m = this.currMousePosAsArr()
        var find = this.view.unitdisk.cache.voronoiDiagram.find(m[0], m[1])
        return find ? find.data : undefined
    }

    private initMouseStuff() {
        var dragStartPoint = null
        var dragStartElement = null

        let lasttransform = null
        var zoom = d3.zoom() // zoomevents: start, end, mulitiple, 
            //.scaleExtent([.51, 1.49])      
            .on("zoom", e=> {
                this.ev = e

                if (this.ev && 
                    this.ev.sourceEvent && 
                    this.ev.sourceEvent.type === 'wheel')
                {
                    const mΔ = this.ev.sourceEvent.deltaY
                    const λΔ = mΔ/100*2*Math.PI/16                
                    const oldλp = this.view.unitdisk.args.transformation.state.λ
                    const newλp = oldλp - λΔ
                    
                    const min = .1 * Math.PI
                    const max = .8 * Math.PI*2

                    if (newλp < max && newλp > min) 
                        this.onDragλ(newλp)
                } 
                //               
                else if (this.ev && 
                    this.ev.sourceEvent && 
                    this.ev.sourceEvent.type === 'touchmove') {
                    // :D                    
                    if (this.ev.transform.k !== lasttransform) {
                        lasttransform = this.ev.transform.k

                        const newλp = this.ev.transform.k+.5
                        
                        const min = .1 * Math.PI
                        const max = .8 * Math.PI*2

                        if (newλp.θ < max && newλp.θ > min) 
                            this.onDragλ(newλp)                        
                    }
                    else {
                        this.onDragByNode(
                            dragStartElement,
                            dragStartPoint,
                            this.currMousePosAsC()
                        )
                    }
                }
                //
                else {
                    this.onDragByNode(
                        dragStartElement,
                        dragStartPoint,
                        this.currMousePosAsC()
                    )
                }
            })
            .on("start", e=> {
                this.ev = e
                this.onDragStart(
                    dragStartElement = this.findNodeByCell(),
                    dragStartPoint = this.currMousePosAsC()
            )})
            .on("end",   e=> {
                this.ev = e
                this.onDragEnd(
                    dragStartElement,
                    dragStartPoint,
                    this.currMousePosAsC() 
            )})

        const htapi = this.view.hypertree.api
        const hoverpath = this.view.hypertree.args.objects.pathes[0]

        this.view.parent.append('circle')
            .attr("class", "mouse-circle")
            .attr("r", this.args.mouseRadius)
            .on("dblclick",  e=> { this.ev = e; this.onDblClick(this.findNodeByCell()) })
            //.on("click",     d=> this.onClick(findNodeByCell()))
            .on("mousemove", e=> { this.ev = e; htapi.setPathHead(hoverpath, this.findNodeByCell()) })
            .on("mouseout",  e=> htapi.setPathHead(hoverpath, undefined))
            //.call(drag)
            .call(zoom)
            .on("dblclick.zoom", null)
    }

    //-----------------------------------------------------------------------------------------

    private ping(p:C) {
        /*
        if (this.view.hypertree.args.objects.traces.length === 0)
            this.view.hypertree.args.objects.traces.push({
                id: 'gibt eh nur ans',
                points: []
            })
        this.view.hypertree.args.objects.traces[0].points.push(p)
        */
    }

    private onDragStart = (n:N, m:C)=> {
        this.ping(m)                                             //#####################
        
        if (!this.animationTimer)
            this.view.unitdisk.args.transformation.onDragStart(m)
    }

    private onDragλ = (l:number)=> {
        this.view.unitdisk.args.transformation.onDragλ(l)
        this.view.hypertree.updateLayoutPath_(this.view.unitdisk.args.transformation.cache.centerNode) // hmmm?
        this.view.hypertree.update.transformation()
    }

    private onDragByNode = (n:N, s:C, e:C)=> {  
        if (n && n.name == 'θ') {
            this.view.unitdisk.args.transformation.onDragθ(s, e)
            this.view.hypertree.update.transformation()
        }
        else if (n && n.name == 'λ') {            
            this.onDragλ(πify(CktoCp(CmulR(e, -1)).θ)/2/Math.PI)
        }
        else {
            this.view.unitdisk.args.transformation.onDragP(s, e)
            this.view.hypertree.update.transformation()
            this.ping(e)                                         //#####################            
        }
    }

    private onDragEnd = (n:N, s:C, e:C)=> {
        
        const ti3 = d3.timer(()=> {                              //#####################            
            ti3.stop()
            this.view.hypertree.args.objects.traces.length = 0            
            this.view.hypertree.update.transformation()
        }, 2000)

        this.ping(e)                                             //#####################
        
        var dc = CsubC(s, e)        
        var dist = Math.sqrt(dc.re*dc.re + dc.im*dc.im)
        
        if (dist < .006)
            this.onClick(n, e) // sollte on click sein und auch timer berücksichtigen oder?        

        // immer?
        this.view.unitdisk.args.transformation.onDragEnd(e)
        this.view.hypertree.update.transformation()
    }

    private animationTimer = null
    private cancelAnimationTimer = ()=> { 
        this.animationTimer.stop(); this.animationTimer = null 
    }
    private animateTo(n:N, m:C) : void
    {
        if (this.animationTimer)
            return

        this.onDragStart(n, m)

        var md = CktoCp(m), initR = md.r, step = 1, steps = 20
        this.animationTimer = d3.timer(()=> {            
            md.r = initR * (1 - sigmoid(step++/steps))
            if (step > steps) {
                this.cancelAnimationTimer()    
                this.onDragEnd(n, m, CptoCk(md))
            }
            else  
                this.onDragByNode(n, m, CptoCk(md))
        },1)
    }

    //-----------------------------------------------------------------------------------------

    private dblClickTimer = null
    private cancelClickTimer = ()=> {
        clearTimeout(this.dblClickTimer); this.dblClickTimer = null 
    }
    private onClick = (n:N, m) => {
        if (this.ev && this.ev.preventDefault) 
            this.ev.preventDefault()
            
        m = m || this.currMousePosAsC()

        if (!this.dblClickTimer) 
            this.dblClickTimer = setTimeout(() => {
                this.dblClickTimer = null
                
                if (n != this.view.unitdisk.args.transformation.cache.centerNode)
                    this.animateTo(n, m)
                else                
                    this.args.onClick(n, m)
            },
            300)
        else 
            this.cancelClickTimer()
    }

    private onDblClick = (n:N) => {
        this.ev.preventDefault()
        var m = this.currMousePosAsC()

        this.cancelClickTimer()
        this.args.onClick(n, m)
    }    
}

