//import { hierarchy, HierarchyNode } from 'd3-hierarchy'
//import { timer }                    from 'd3-timer'
//import { interpolateHcl, rgb }      from 'd3-color'

import * as d3                     from 'd3'
import { N }                   from '../models/n'
import { LoaderFunction }      from '../models/n-loaders'
import { LayoutFunction }      from '../models/n-layouts'
import { C, CktoCp, CptoCk }   from '../hyperbolic-math'
import { sigmoid }             from '../hyperbolic-math'
import { Transformation }      from '../hyperbolic-transformation'

import { Layer }               from './layerstack'
import { LayerArgs }           from './layerstack'
import { Interaction }         from './unitdisk/interactive-unitdisk'
import { InteractionArgs }     from './unitdisk/interactive-unitdisk'

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

    decorator:      { new(a: InteractionArgs) : HypertreeUi & HTMLElement },

    ui : {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:Interaction)=> void,
        caption:        (hypertree:Hypertree, n:N)=> string,
        onClick:        (hypertree:Hypertree, n:N, m:C)=> void,
        layers:         ((ls:Interaction, parent:d3Sel)=> Layer)[],
    }
}

export interface HypertreeUi
{
    args:                 any,
    updateData:           ()=> void,
    updateTransformation: ()=> void,
    updateSelection:      ()=> void,
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
        })        
        this.updateData()
        this.updateLang()
    }

    public updateData() : void {
        var t0 = performance.now()
        this.ui.querySelector('.preloader').innerHTML = htmlpreloader
        this.ui.args.data = undefined
        this.ui.updateData()
        this.args.dataloader(d3h=>
        {
            var t1 = performance.now()
            var model = <N & d3.HierarchyNode<N>>d3.hierarchy(d3h)
                            .sum(this.args.weight) // this.updateWeights()

            this.ui.querySelector('.preloader').innerHTML = ''
            this.infoUi.updateModel(model, [t1-t0, performance.now()-t1])

            var t2 = performance.now()
            this.data = this.args.layout(model, this.args.ui.transformation.state)
            this.ui.args.data = this.data
            this.args.ui.transformation.cache.N = this.data.descendants().length
            this.infoUi.updateLayout(this.args.ui.transformation.cache, performance.now()-t2)

            this.animateUp()
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
        var t0 = performance.now()
        this.args.layout(this.data, this.args.ui.transformation.state)        
        this.infoUi.updateLayout(this.args.ui.transformation.cache, performance.now()-t0)
        this.updateTransformation()
    }

    private updateTransformation() : void {
        this.ui.updateTransformation()
    }

    public updatePath(pathId:string, n:N)
    {
        var old_ =  this.paths[pathId]
        this.paths[pathId] = n
        var new_ =  this.paths[pathId]

        if (old_ && old_.ancestors) for (var pn of old_.ancestors()) pn[pathId] = undefined
        if (new_ && new_.ancestors) for (var pn of new_.ancestors()) pn[pathId] = n

        //this.ui.updateSelection()
        this.ui.updateTransformation()
    }

    private animateUp()
    {
        this.args.ui.transformation.state.P.re = 0
        this.args.ui.transformation.state.P.im = 0

        if (this.animationTimer)
            endAnimation()

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

            if (this.data.leaves().reduce((max, i)=> Math.max(max, i.cachep.r), 0) > .95)
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
    }
}

