//import { hierarchy, HierarchyNode } from 'd3-hierarchy'
//import { timer }                    from 'd3-timer'
//import { interpolateHcl, rgb }      from 'd3-color'
import * as d3                     from 'd3'

import { HTML }                from 'duct'
import { N }                   from '../../models/n'
import { LoaderFunction }      from '../../models/n-loaders'
import { LayoutFunction }      from '../../models/n-layouts'
import { C, CktoCp, CptoCk }   from '../../hyperbolic-math'
import { sigmoid }             from '../../hyperbolic-math'
import { Transformation }      from '../../hyperbolic-transformation'

import { Layer }               from '../layers'
import { LayerArgs }           from '../layers'
import { Interaction }         from './mouseAndCache'
import { InteractionArgs }     from './mouseAndCache'

var htmlpreloader = `
    <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
            <div class="circle-clipper left">
                <div class="circle"></div>
            </div>
            <div class="gap-patch">
                <div class="circle"></div>
            </div>
            <div class="circle-clipper right">
                <div class="circle"></div>
            </div>
        </div>
    </div>`

export interface UnitDiskArgs
{
    parent:         any

    dataloader:     LoaderFunction,
    langloader:     (lang)=> (ok)=> void,

    weight:         (n:N) => number,
    layout:         LayoutFunction,
    onNodeSelect:   (n:N) => void,

    decorator:      { new(a: InteractionArgs) : UnitDiskUi & HTMLElement },

    ui : {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:Interaction)=> void,
        caption:        (unitdisk:UnitDisk, n:N)=> string,
        onClick:        (unitdisk:UnitDisk, n:N, m:C)=> void,
        layers:         ((ls:Interaction, parent:d3Sel)=> Layer)[],
    }
}

export interface UnitDiskUi
{
    args:            any,
    updateData:      ()=> void,
    updatePositions: ()=> void,
    updateSelection: ()=> void,
}

/**
* Something like a controller.
*
* all operations must be started here, UnitDisk modifyes
* data, langmap, pathes and then updates the ui.
*
* data->weights->layout
*/
export class UnitDisk
{
    args           : UnitDiskArgs
    ui             : UnitDiskUi & HTMLElement
    infoUi         : HTMLElement & { msg:(idx, msg)=>void, updateModel }
    data           : N
    langMap        : {}
    paths          : { isSelected?:N, isHovered?:N } = {}
    animationTimer : any = true

    constructor(args : UnitDiskArgs) {
        this.args  = args                
        this.infoUi = InfoArea(args)
        this.ui = new args.decorator({
            parent:         args.parent,
            unitdisk:       this,
            mouseRadius:    args.ui.transformation.maxMouseR,
            data:           undefined,            
            transformation: this.args.ui.transformation,
            transform:      (n:N)=> this.ui.args.transformation.transformPoint(n.z),
            layers:         this.args.ui.layers,
            clipRadius:     this.args.ui.clipRadius,
            nodeRadius:     this.args.ui.nodeRadius,
            cacheUpdate:    this.args.ui.cacheUpdate,
            onClick:        (n:N, m:C)=> this.args.ui.onClick(this, n, m),
            caption:        (n:N)=> this.args.ui.caption(this, n),
            captionOffset:  undefined,
        })        
        this.updateData()
        this.updateLang()
    }

    public updateData() : void {
        this.ui.querySelector('.preloader').innerHTML = htmlpreloader
        this.ui.args.data = undefined
        this.ui.updateData()
        this.args.dataloader(d3h=>
        {
            var model = <N & d3.HierarchyNode<N>>d3.hierarchy(d3h)
                            .sum(this.args.weight) // this.updateWeights()

            this.infoUi.updateModel(model)
            this.data = this.args.layout(model, this.args.ui.transformation.state)

            this.ui.querySelector('.preloader').innerHTML = ''
            this.ui.args.data = this.data            

            var endAnimation = ()=> {
                this.animationTimer.stop()
                this.animationTimer = null
                //this.onZoomFitEnd(null, null, null)
            }

            var animateTo = λ=> {
                var π = Math.PI
                var animλ = CptoCk({ θ:2*π*λ, r:1 })
                this.args.ui.transformation.state.λ.re = animλ.re
                this.args.ui.transformation.state.λ.im = animλ.im

                app.toast('Layout')
                this.args.layout(this.data, this.args.ui.transformation.state)
                this.ui.updateData()

                if (this.data.leaves().reduce((max, i)=> Math.max(max, i.cachep.r), 0) > .949)
                    endAnimation()
            }

            var step = 0, steps = 33
            this.animationTimer = d3.timer(()=> {
                if (!this.animationTimer)
                    return

                var p = step++/steps
                if (step > steps)
                   endAnimation()
                else
                   animateTo(.01+p*.98)
            },1)
        })
    }

    public updateLang() : void {
        this.args.langloader(langMap=>
        {
            this.langMap = langMap
            this.updateTransformation()
        })
    }

    private updateWeights() : void {
        //this.data.sum(this.args.weight) // todo: testen ob man das braucht
        this.updateLayout()
    }

    private updateLayout() : void {        
        app.toast('Layout')
        this.args.layout(this.data, this.args.ui.transformation.state)
        this.updateTransformation()        
    }

    private updateTransformation() : void {
        this.ui.updatePositions()
    }

    public updatePath(pathId:string, n:N)
    {
        var old_ =  this.paths[pathId]
        this.paths[pathId] = n
        var new_ =  this.paths[pathId]

        if (old_ && old_.ancestors) for (var pn of old_.ancestors()) pn[pathId] = undefined
        if (new_ && new_.ancestors) for (var pn of new_.ancestors()) pn[pathId] = n

        this.ui.updateSelection()
    }
}

var htmlinfo = `<div class="render-info">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div></div>
        <div></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div></div>
        <div></div>
        <div></div>
    </div>`

class IndoArea
{
}

function InfoArea(args)
{
    var ui = HTML.parse<HTMLElement & { msg, colorScale, updateModel, updateCacheBar, updateCachInfo }>(htmlinfo)()
    args.parent.appendChild(ui)

    ui.colorScale = d3.scaleLinear<d3.ColorCommonInstance>()
        .domain([1, 10])
        .range([d3.rgb('#a5d6a7'), d3.rgb('#e53935')])
        .interpolate(d3.interpolateHcl)
        .clamp(true)

    ui.updateModel = (model)=> {
        var n = model.descendants().length
        var l = model.leaves().length
        var lp = l / n
        var i = n - l
        var h = model.height
        var ø = 0
        model.each(cn=> ø += (cn.children||[]).length/i)
        ui.msg(0, `${lp.toPrecision(2)} leaves, ø${ø.toPrecision(3)}, ↓${h}`)
    }

    ui.updateCacheBar = (n, l, max)=> {
        var a = n / max * 50
        var b = l / max * 50;

        (<HTMLElement>ui.children[0]).style.width = b + '%';
        (<HTMLElement>ui.children[0]).style.backgroundColor = '#a5d6a7';

        (<HTMLElement>ui.children[1]).style.width = a + '%';
        (<HTMLElement>ui.children[1]).style.backgroundColor = '#8d6e63';

        (<HTMLElement>ui.children[2]).style.width = (100 - a - b) + '%';
        (<HTMLElement>ui.children[2]).style.backgroundColor = '#f8f8f8';
    }

    ui.updateCachInfo = (na, cache, max, mw, Δ)=> {
        var n = cache.filteredNodes.length
        var l = cache.leafNodes.length

        var ct = Δ / 20 * 100;
        (<HTMLElement>ui.children[5]).style.width = ct + '%';
        (<HTMLElement>ui.children[5]).style.backgroundColor = ui.colorScale(Δ);

        (<HTMLElement>ui.children[6]).style.width = (100 - ct) + '%';
        (<HTMLElement>ui.children[6]).style.backgroundColor = '#f8f8f8';

        ui.msg(1, `${na} nodes, ${Δ.toPrecision(3)}ms`)
        ui.msg(5, `${mw.toPrecision(3)} max weight → ${l} nodes, ${n} links`)
        ui.updateCacheBar(n, l, max)
    }

    ui.msg = (line, msg)=> {
        ui.children[ui.children.length - 1 - line].innerHTML = msg
    }

    return ui
}
