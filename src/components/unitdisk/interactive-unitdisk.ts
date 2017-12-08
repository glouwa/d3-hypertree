import * as d3                  from 'd3'
import { N }                    from '../../models/n/n'
import { Transformation,
         TransformationCache }  from '../../hyperbolic-transformation'
import { C, CptoCk, CktoCp,
         CassignC, ArrtoC,
         dfsFlat, CsubC,
         arcCenter, πify,
         sigmoid }              from '../../hyperbolic-math'
import { LayerStack }           from '../layerstack'
import { UnitDiskArgs }         from './'

var html = ` unused
<clipPath id="circle-clip"><circle r="1"></circle></clipPath>
<circle class="background-circle" r="1"></circle>
<g class="layers"><g clip-path="url(#circle-clip)">
    <g class="cells"></g>
    <g class="links"></g>
    <g class="nodes"></g>
    <g class="captions"></g>
</g>`

// InteractiveUnitdisk
class Interaction
{
    args:           UnitDiskArgs
    mainGroup
    focusCircle:    any                  // d3?... SvgCircle
    layerStack:     LayerStack
   
    cache:          TransformationCache // zeigt auf transformation.cache

    updateSelection() {
        this.layerStack.updatePath()
    }

    updateData() : void { 
        console.assert(false) 
    }

    updatePositions() : void {
        this.focusCircle
            .attr("r", πify(CktoCp(this.args.transformation.state.λ).θ) / 2 / Math.PI)

        this.updateCache()
        this.layerStack.updateTransformation()
    }

    // TODO muss hier weg
    private updateCache() {
        this.args.cacheUpdate(this, this.cache)
    }

    constructor(args : UnitDiskArgs) {
        this.args = args
        this.cache = args.transformation.cache

        this.mainGroup = d3.select(args.parent)
        this.mainGroup.append("clipPath")
            .attr("id", "circle-clip"+this.args.clipRadius)
            .append("circle")
                .attr("r", this.args.clipRadius)

        this.mainGroup.append('circle')
            .attr("class", "background-circle")
            .attr("r", this.args.clipRadius)
            .attr("fill", 'url(#exampleGradient)')            
            //.on("mouseout",  d=> this.args.hypertree.updatePath('isHovered', undefined))
     
        if (this.args.parent.getAttribute("class") == 'unitDisc')
            this.focusCircle = this.mainGroup.append('circle')
                .attr("class", "focus-circle")
                .attr("r", πify(CktoCp(this.args.transformation.state.λ).θ) / 2 / Math.PI)
        else
            this.focusCircle = this.mainGroup.select('empty-selection')
    }

    protected initLayerStack() {
        this.updateCache()
        this.layerStack = new LayerStack({
            parent: d3.select(this.args.parent),
            interaction: this
        })
    }
}

export class Interaction2 extends Interaction
{
    args:           UnitDiskArgs    
    voronoiLayout:  d3.VoronoiLayout<N>

    constructor(args : UnitDiskArgs) {
        super(args)
        this.initMouseStuff()
        this.initLayerStack()
    }

    private initMouseStuff() {
        var currMousePosAsArr = ()=> d3.mouse(this.args.parent)
        var currMousePosAsC = ()=> ArrtoC(currMousePosAsArr())
        var findNodeByCell = ()=> {
            var m = currMousePosAsArr()
            var find = this.cache.voronoiDiagram.find(m[0], m[1])
            return find ? find.data : undefined
        }

        var dragStartPoint = null
        var dragStartElement = null
        var drag = d3.drag()
            //.filter(()=> console.log(d3.event.type); return true; )
            .on("start", ()=> this.onDragStart(
                dragStartElement = findNodeByCell(),
                dragStartPoint = currMousePosAsC()
            ))
            .on("end",   ()=> this.onDragEnd(
                dragStartElement,
                dragStartPoint,
                currMousePosAsC()
            ))
            .on("drag",  ()=> this.onDragByNode(
                dragStartElement,
                dragStartPoint,
                currMousePosAsC()
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

        this.voronoiLayout = d3.voronoi<N>()
            .x(d=> { console.assert(typeof d.cache.re === 'number'); return d.cache.re })
            .y(d=> { console.assert(typeof d.cache.re === 'number'); return d.cache.im })
            .extent([[-2,-2], [2,2]])

        // svg elements -------------------------------------------------------------------
          
        this.mainGroup.append('circle')
            .attr("class", "mouse-circle")
            .attr("r", this.args.mouseRadius)
            .on("dblclick",  d=> this.onDblClick(findNodeByCell()))
            //.on("click",     d=> this.onClick(findNodeByCell()))
            .on("mousemove", d=> this.args.hypertree.updatePath('isHovered', findNodeByCell()))
            .on("mouseout",  d=> this.args.hypertree.updatePath('isHovered', undefined))
            .call(drag)
            .call(zoom)
    }

    //-----------------------------------------------------------------------------------------

    private onDragStart = (n:N, m:C)=> {
        if (!this.animationTimer)
            this.args.transformation.onDragStart(m)
    }

    private onDragλ = (s:C, e:C)=> {
        this.args.transformation.onDragλ(s, e)
        this.args.hypertree.updateLayout()
    }

    private onDragByNode = (n:N, s:C, e:C)=> {
        if (n && n.name == 'θ') {
            this.args.transformation.onDragθ(s, e)
            this.args.hypertree.updateTransformation()
        }
        else if (n && n.name == 'λ') {
            this.onDragλ(s, e)
        }
        else {
            this.args.transformation.onDragP(s, e)
            this.args.hypertree.updateTransformation()
        }
    }

    private onDragEnd = (n:N, s:C, e:C)=> {
        var dc = CsubC(s, e)        
        var dist = Math.sqrt(dc.re*dc.re + dc.im*dc.im)
        
        if (dist < .006)
            this.onClick(n, e) // sollte on click sein und auch timer berücksichtigen oder?        
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
            if (step > steps) 
                this.cancelAnimationTimer()            
            else  
                this.onDragByNode(null, m, CptoCk(md))            
        },1)
    }

    //-----------------------------------------------------------------------------------------

    private dblClickTimer = null
    private cancelClickTimer = ()=> {
        clearTimeout(this.dblClickTimer); this.dblClickTimer = null 
    }
    private onClick = (n:N, m) => {
        if (d3.event && d3.event.preventDefault) d3.event.preventDefault()
        m = m || ArrtoC(d3.mouse(this.args.parent))

        if (!this.dblClickTimer) 
            this.dblClickTimer = setTimeout(() => {
                this.dblClickTimer = null
                
                //this.args.onClick(d, m)
                this.animateTo(n, m)
            },
            300)
        else 
            this.cancelClickTimer()
    }

    private onDblClick = (n:N) => {
        d3.event.preventDefault()
        var m = ArrtoC(d3.mouse(this.args.parent))

        this.cancelClickTimer()
        //this.animateTo(n, ArrtoC(d3.mouse(this.args.parent)))
        this.args.onClick(n, m)
    }
}
