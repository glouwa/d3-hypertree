import * as d3              from 'd3'
import { ILayer }           from '../layer'
import { N }                from '../../../models/n/n'
import { C, CptoCk, CktoCp,
    CassignC, ArrtoC,
    dfsFlat, CsubC,
    arcCenter, πify,
    sigmoid }               from '../../../hyperbolic-math'

export interface InteractionLayerArgs
{
    unitdisk, 
    mouseRadius,
    onClick
}

export class InteractionLayer implements ILayer
{
    parent
    args:             InteractionLayerArgs    
    name =            'interaction'
   
    update = {
        parent:         ()=> {},        
        data:           ()=> {},
        transformation: ()=> {},
        style:          ()=> {}
    }

    constructor(args : InteractionLayerArgs) {        
        this.args = args 
    }

    public attach(parent) {
        this.parent = parent        
        this.initMouseStuff()
    }

    currMousePosAsArr = ()=> d3.mouse(this.parent._groups[0][0])
    currMousePosAsC = ()=> ArrtoC(this.currMousePosAsArr())
    findNodeByCell = ()=> {
        var m = this.currMousePosAsArr()
        var find = this.args.unitdisk.cache.voronoiDiagram.find(m[0], m[1])
        return find ? find.data : undefined
    }

    private initMouseStuff() {
        var dragStartPoint = null
        var dragStartElement = null
        var drag = d3.drag()
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
            ))

        var zoom = d3.zoom()
            .scaleExtent([.51, 1.49])
            .filter(()=> d3.event.type=='wheel')
         /*   .filter(()=> {
                return d3.event.type=='wheel'
                //console.log(d3.event.touches && d3.event.touches.length == 2)
                return d3.event.type=='wheel'// || ( d3.event.touches && d3.event.touches.length == 2)

                //return d3.event.type==='wheel' //|| d3.event.type!=='touchstart'
                //return d3.event.type!=='dblclick' && d3.event.type!=='mousedown'
                //return d3.event.type!=='dblclick' || d3.event.type=='touchstart'//&& d3.event.type!=='mousedown' && d3.event.type!=='touchstart'
            })*/
            .on("zoom", ()=> this.onDragλ(
                null,
                CptoCk({ θ:d3.event.transform.k * Math.PI*2-Math.PI, r:1 }),
            ))

        this.parent.append('circle')
            .attr("class", "mouse-circle")
            .attr("r", this.args.mouseRadius)
            .on("dblclick",  d=> this.onDblClick(this.findNodeByCell()))
            //.on("click",     d=> this.onClick(findNodeByCell()))
            .on("mousemove", d=> this.args.unitdisk.args.hypertree.updatePath('isHovered', this.findNodeByCell()))
            .on("mouseout",  d=> this.args.unitdisk.args.hypertree.updatePath('isHovered', undefined))
            .call(drag)
            .call(zoom)
    }

    //-----------------------------------------------------------------------------------------

    private onDragStart = (n:N, m:C)=> {
        if (!this.animationTimer)
            this.args.unitdisk.args.transformation.onDragStart(m)
    }

    private onDragλ = (s:C, e:C)=> {
        this.args.unitdisk.args.transformation.onDragλ(s, e)
        this.args.unitdisk.args.hypertree.updateLayout()
    }

    private onDragByNode = (n:N, s:C, e:C)=> {
        if (n && n.name == 'θ') {
            this.args.unitdisk.args.transformation.onDragθ(s, e)
            this.args.unitdisk.args.hypertree.updateTransformation()
        }
        else if (n && n.name == 'λ') {
            this.onDragλ(s, e)
        }
        else {
            this.args.unitdisk.args.transformation.onDragP(s, e)
            this.args.unitdisk.args.hypertree.updateTransformation()
        }
    }

    private onDragEnd = (n:N, s:C, e:C)=> {
        var dc = CsubC(s, e)        
        var dist = Math.sqrt(dc.re*dc.re + dc.im*dc.im)
        
        if (dist < .006)
            this.onClick(n, e) // sollte on click sein und auch timer berücksichtigen oder?        

        // immer?
        this.args.unitdisk.args.transformation.onDragEnd(e)
        this.args.unitdisk.args.hypertree.updateTransformation()
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

        var md = CktoCp(m), initR = md.r, step = 0, steps = 20
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

        if (!this.dblClickTimer) 
            this.dblClickTimer = setTimeout(() => {
                this.dblClickTimer = null
                
                if (n != this.args.unitdisk.args.transformation.cache.centerNode)
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

