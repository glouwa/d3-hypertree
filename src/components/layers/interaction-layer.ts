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
    nohover: boolean,
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

    currMousePosAsArr = ()=> d3.mouse(this.view.parent.node())
    currMousePosAsC = ()=> ArrtoC(this.currMousePosAsArr())
    findNodeByCell = ()=> {
        var m = this.currMousePosAsArr()
        var find = this.view.unitdisk.cache.voronoiDiagram.find(m[0], m[1])
        return find ? find.data : undefined
    }

    private initMouseStuff() {
        var dragStartPoint = null
        var dragStartElement = null
        /*var drag = d3.drag()
            //.filter(()=> console.log(d3.event.type); return true; )
            .on("start", ()=> this.onDragStart(
                dragStartElement = this.findNodeByCell(),
                dragStartPoint = this.currMousePosAsC()
            ))
            .on("end",   ()=> this.onDragEnd(
                dragStartElement,
                dragStartPoint,
                this.currMousePosAsC()
            ))
            .on("drag",  ()=> this.onDragByNode(
                dragStartElement,
                dragStartPoint,
                this.currMousePosAsC()
            ))*/

        let lasttransform = null
        var zoom = d3.zoom() // zoomevents: start, end, mulitiple, 
            //.scaleExtent([.51, 1.49])      
            .on("zoom", ()=> {
                console.assert(d3.event)
                /*
                const tid = d3.event.sourceEvent.touches[0].identifier || 'mouse'
                */

                if (d3.event && 
                    d3.event.sourceEvent && 
                    d3.event.sourceEvent.type === 'wheel')
                {
                    const mΔ = d3.event.sourceEvent.deltaY
                    const λΔ = mΔ/100*2*Math.PI/16                
                    const oldλp = this.view.unitdisk.args.transformation.state.λ
                    const newλp = oldλp - λΔ
                    
                    const min = .1 * Math.PI
                    const max = .8 * Math.PI*2
                    //if (newλp.θ >= max) console.log('to big')
                    //if (newλp.θ <= min) console.log('to small')

                    if (newλp < max && newλp > min) 
                        this.onDragλ(newλp)
                } 
                //               
                else if (d3.event && 
                    d3.event.sourceEvent && 
                    d3.event.sourceEvent.type === 'touchmove') {
                    // :D                    
                    if (d3.event.transform.k !== lasttransform) {
                        lasttransform = d3.event.transform.k

                        const newλp = d3.event.transform.k+.5
                        
                        //console.log('touch zoom', newλp.θ)
                        const min = .1 * Math.PI
                        const max = .8 * Math.PI*2
                        //if (newλp.θ >= max) console.log('to big')
                        //if (newλp.θ <= min) console.log('to small')

                        if (newλp.θ < max && newλp.θ > min) 
                            this.onDragλ(newλp)                        
                    }
                    else {
                        //console.log('touch drag')
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
            .on("start", ()=> {
                //console.log('start')
                this.onDragStart(
                    dragStartElement = this.findNodeByCell(),
                    dragStartPoint = this.currMousePosAsC()
            )})
            .on("end",   ()=> { 
                //console.log('end')
                this.onDragEnd(
                    dragStartElement,
                    dragStartPoint,
                    this.currMousePosAsC() 
            )})

        //var transform = d3.zoomTransform(selection.node());
        //var transform = d3.zoomTransform(this); in event sinks
        const htapi = this.view.hypertree.api
        //const hoverpath = this.view.hypertree.args.objects.pathes.firstornull(e=> type==='HoverPath')[0]
        const hoverpath = this.view.hypertree.args.objects.pathes[0]

        if (this.args.nohover) //.args.className === 'nav-parameter-disc')
            this.view.parent.append('circle')
                .attr("class", "mouse-circle")
                .attr("r", this.args.mouseRadius)                
                .call(zoom)
                .on("dblclick.zoom", null)
        else
            this.view.parent.append('circle')
                .attr("class", "mouse-circle")
                .attr("r", this.args.mouseRadius)
                .on("dblclick",  d=> this.onDblClick(this.findNodeByCell()))
                //.on("click",     d=> this.onClick(findNodeByCell()))
                .on("mousemove", d=> htapi.setPathHead(hoverpath, this.findNodeByCell()))
                .on("mouseout",  d=> htapi.setPathHead(hoverpath, undefined))
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
        if (d3.event && d3.event.preventDefault) 
            d3.event.preventDefault()
            
        m = m || this.currMousePosAsC()
        //m = n.cache

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
        d3.event.preventDefault()
        var m = this.currMousePosAsC()

        this.cancelClickTimer()
        //this.animateTo(n, ArrtoC(d3.mouse(this.args.parent)))
        this.args.onClick(n, m)
    }    
}

