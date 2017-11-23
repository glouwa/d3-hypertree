//import { hierarchy, HierarchyNode } from 'd3-hierarchy'
//import { timer }                    from 'd3-timer'
//import { interpolateHcl, rgb }      from 'd3-color'

import * as d3                 from 'd3'
import { N }                   from '../models/n'
import { LoaderFunction }      from '../models/n-loaders'
import { LayoutFunction }      from '../models/n-layouts'
import { dfsFlat }             from '../hyperbolic-math'
import { C, CktoCp, CptoCk }   from '../hyperbolic-math'
import { sigmoid }             from '../hyperbolic-math'
import { Transformation }      from '../hyperbolic-transformation'

import { ILayer }              from './layerstack'
import { LayerArgs }           from './layerstack'
import { Interaction }         from './unitdisk/interactive-unitdisk'
import { UnitDiskArgs }        from './unitdisk'

import { InfoArea }            from './perfinfo'

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

export interface HypertreeArgs
{
    parent:         any

    dataloader:     LoaderFunction,
    langloader:     (lang)=> (ok)=> void,

    weight:         (n:N) => number,
    layout:         LayoutFunction,
    onNodeSelect:   (n:N) => void,

    decorator:      { new(a: UnitDiskArgs) : HypertreeUi & HTMLElement },

    ui : {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:Interaction)=> void,
        caption:        (hypertree:Hypertree, n:N)=> string,
        onClick:        (hypertree:Hypertree, n:N, m:C)=> void,
        layers:         ((ls:Interaction)=> ILayer)[],
    }
}

export interface IHypertree
{
    args:                 any,
    updateData:           (data)=> void,
    updateLang:           (langmap)=> void,
    updateSelection:      (selection)=> void,
    updateTransformation: (T)=> void
}

export interface HypertreeUi // = unitdisk :/
{
    args:                 any,
    updateData:           ()=> void,
    updateLang:           ()=> void,
    updateSelection:      ()=> void,
    updateTransformation: ()=> void
}

/**
* Something like a controller.
*
* all operations must be started here, Hypertree modifyes
* data, langmap, pathes and then updates the ui.
*
* data->weights->layout
*/
export class Hypertree
{
    args           : HypertreeArgs
    ui             : HypertreeUi & HTMLElement
    infoUi         : HTMLElement & { msg, updateModel, updateLayout }
    data           : N
    langMap        : {}
    paths          : { isSelected?:N, isHovered?:N } = {}
    animationTimer : any = null

    constructor(args : HypertreeArgs) {
        this.args  = args                
        this.infoUi = InfoArea(args)
        this.ui = new args.decorator({
            parent:         args.parent,
            hypertree:      this,
            data:           undefined,            
            transformation: this.args.ui.transformation,
            transform:      (n:N)=> this.ui.args.transformation.transformPoint(n.z),
            layers:         this.args.ui.layers,
            cacheUpdate:    this.args.ui.cacheUpdate,
            onClick:        (n:N, m:C)=> this.args.ui.onClick(this, n, m),
            caption:        (n:N)=> this.args.ui.caption(this, n),
            clipRadius:     this.args.ui.clipRadius,
            nodeRadius:     this.args.ui.nodeRadius,
            mouseRadius:    args.ui.transformation.maxMouseR,
        })        
        this.updateData()
        this.updateLang()
    }

    public updateData() : void {
        var t0 = performance.now()
        this.ui.querySelector('.preloader').innerHTML = htmlpreloader
        this.ui.args.data = undefined
        this.ui.updateData()
        this.args.dataloader((d3h, t1)=>
        {
            var t2 = performance.now()
            var model = <N & d3.HierarchyNode<N>>d3
                            .hierarchy(d3h)
                            .sum(this.args.weight) // this.updateWeights()

            this.ui.querySelector('.preloader').innerHTML = ''
            this.infoUi.updateModel(model, [t1-t0, t2-t1, performance.now()-t2])

            var t3 = performance.now()
            this.data = this.args.layout(model, this.args.ui.transformation.state)
            this.ui.args.data = this.data
            this.args.ui.transformation.cache.N = this.data.descendants().length
            this.updateLang_()
            this.infoUi.updateLayout(this.args.ui.transformation.cache, performance.now()-t3)

            this.animateUp()
        })
    }

    public updateLang() : void {
        this.args.langloader(langMap=>
        {            
            this.langMap = langMap
            this.updateLang_()
            this.updateTransformation()
        })
    }

    private updateLang_() {
        for (var n of dfsFlat(this.data, n=>true)) {
            n.label = this.args.ui.caption(this, n)
            n.labellen = undefined
        }
    }

    public updatePath(pathId:string, n:N)
    {
        var old_ =  this.paths[pathId]
        this.paths[pathId] = n
        var new_ =  this.paths[pathId]

        if (old_ && old_.ancestors) for (var pn of old_.ancestors()) pn[pathId] = undefined
        if (new_ && new_.ancestors) for (var pn of new_.ancestors()) pn[pathId] = n

        //this.ui.updateSelection()
        requestAnimationFrame(this.ui.updateTransformation)
    }

    private updateWeights() : void {
        //this.data.sum(this.args.weight) // todo: testen ob man das braucht
        this.updateLayout()
    }

    private updateLayout() : void {        
        //app.toast('Layout')
        var t0 = performance.now()
        this.args.layout(this.data, this.args.ui.transformation.state)        
        this.infoUi.updateLayout(this.args.ui.transformation.cache, performance.now()-t0)
        this.updateTransformation()
    }

    private updateTransformation() : void {
        requestAnimationFrame(this.ui.updateTransformation)
    }

    private animateUp()
    {
        this.args.ui.transformation.state.P.re = 0
        this.args.ui.transformation.state.P.im = 0

        var endAnimation = ()=> {
            this.animationTimer.stop()
            this.animationTimer = null
            //this.onZoomFitEnd(null, null, null)
        }

        if (this.animationTimer)
            endAnimation()

        var step = 0, steps = 33
        this.animationTimer = d3.timer(()=> {
            if (!this.animationTimer)
                return

            var animateTo = λ=> {
                var π = Math.PI
                var animλ = CptoCk({ θ:2*π*λ, r:1 })
                this.args.ui.transformation.state.λ.re = animλ.re
                this.args.ui.transformation.state.λ.im = animλ.im

                //app.toast('Layout')
                this.args.layout(this.data, this.args.ui.transformation.state)
                this.ui.updateData()

                if (this.data.leaves().reduce((max, i)=> Math.max(max, i.cachep.r), 0) > .95)
                    endAnimation()
            }

            var p = step++/steps
            if (step > steps)
               endAnimation()
            else
               animateTo(.01+p*.98)
        },1)
    }
}

