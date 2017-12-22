//import { hierarchy, HierarchyNode } from 'd3-hierarchy'
//import { timer }                    from 'd3-timer'
//import { interpolateHcl, rgb }      from 'd3-color'

import * as d3                 from 'd3'
import { HTML }                from 'ducd'
import { N }                   from '../models/n/n'
import { LoaderFunction }      from '../models/n/n-loaders'
import { LayoutFunction }      from '../models/n/n-layouts'
import { dfsFlat }             from '../hyperbolic-math'
import { C, CktoCp, CptoCk }   from '../hyperbolic-math'
import { sigmoid }             from '../hyperbolic-math'
import { Transformation }      from '../hyperbolic-transformation'

import { ILayer }              from './layerstack/layer'
import { LayerArgs }           from './layerstack/layer'
import { UnitDiskArgs }        from './unitdisk/unitdisk'
import { UnitDisk }            from './unitdisk/unitdisk'
import { IUnitDisk }           from './unitdisk/unitdisk'

import { InfoArea }            from './meta/unitdisk-meta/unitdisk-meta'
import { LayerInfo }           from './meta/layerstack-meta/layerstack-meta'

var htmlpreloader = `
    <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-red-only">
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

var bubbleSvgDef =
    `<defs>
        <radialGradient id="exampleGradient">            
            <stop offset="58%"   stop-color="rgba(255,255,255, .08)"/>            
            <stop offset="92%"   stop-color="rgba( 96, 96, 96, .08)"/>
            <stop offset="99.8%" stop-color="rgba( 36, 36, 36, .08)"/>
            <stop offset="100%"  stop-color="rgba( 35, 35, 35, .08)"/>
        </radialGradient>
    </defs>` 

export interface HypertreeArgs
{
    parent:         any

    dataloader:     LoaderFunction,
    langloader:     (lang)=> (ok)=> void,

    weight:         (n:N) => number,
    layout:         LayoutFunction,
    onNodeSelect:   (n:N) => void,

    decorator:      { new(a: UnitDiskArgs) : IUnitDisk },

    ui : {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:UnitDisk)=> void,
        caption:        (hypertree:Hypertree, n:N)=> string,       
        layers:         ((ls:UnitDisk)=> ILayer)[],
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

var hypertreehtml =
    `<div class="unitdisk-nav">        
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}            
        </svg>        
        <div class="preloader"></div>        
    </div>`

/**
* pipeline implementation:
* ajax -> weights -> layout -> transformation -> unitdisk / langmaps
*
* states: pipeline, interaction*
*/
export class Hypertree 
{
    args           : HypertreeArgs
    unitdisk       : IUnitDisk
    infoUi         : HTMLElement & { msg, updateModel, updateLayout }
    layerInfo      : HTMLElement & { updateModel }
    data           : N
    langMap        : {}
    view           : HTMLElement
    animation      : boolean = false
    paths          : { 
        isSelected?:N, 
        isHovered?:N 
    }              = {}    

    constructor(args : HypertreeArgs) {
        this.args = args
        this.infoUi = InfoArea(args, 'data')
        
        this.view = HTML.parse<HTMLElement>(hypertreehtml)()
        args.parent.appendChild(this.view)

        this.unitdisk = new args.decorator({
            parent:         this.view.querySelector('.unitdisk-nav > svg'),
            className:      'unitDisc',
            position:       'translate(520,500) scale(470)',
            hypertree:      this,
            data:           undefined,            
            transformation: this.args.ui.transformation,
            transform:      (n:N)=> this.unitdisk.args.transformation.transformPoint(n.z),
            layers:         this.args.ui.layers,
            cacheUpdate:    this.args.ui.cacheUpdate,
            caption:        (n:N)=> this.args.ui.caption(this, n),
            clipRadius:     this.args.ui.clipRadius,
            nodeRadius:     this.args.ui.nodeRadius            
        })        

        this.layerInfo = new LayerInfo({
            view: { parent:this.args.parent, className: 'data' },
            model: this.unitdisk
        })
        if (this.unitdisk.navParameter)
            this.layerInfo2 = new LayerInfo({
                view: { parent:this.args.parent, className: 'nav' },
                model: this.unitdisk.navParameter
            }) 
            
        this.updateData()
        this.updateLang()
    }

    public updateData() : void {
        var t0 = performance.now()
        this.view.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined
        this.paths.isSelected = undefined
        this.paths.isHovered= undefined
        this.unitdisk.updateData()

        this.args.dataloader((d3h, t1)=> {
            var t2 = performance.now()
            var ncount = 1
            var model = <N & d3.HierarchyNode<N>>d3
                            .hierarchy(d3h)
                            .each((n:any)=> n.mergeId = ncount++)
                            //.sum(this.args.weight) // this.updateWeights()

            this.view.querySelector('.preloader').innerHTML = ''
            this.infoUi.updateModel(model, [t1-t0, t2-t1, performance.now()-t2])

            var t3 = performance.now()
            this.data = this.args.layout(model, this.args.ui.transformation.state)
            this.unitdisk.args.data = this.data
            this.args.ui.transformation.cache.N = this.data.descendants().length
            this.updateWeights()
            this.updateLang_()
            this.updateImgHref_()
            this.infoUi.updateLayout(this.args.ui.transformation.cache, performance.now()-t3)

            this.animateUp()
        })
    }

    public updateLang() : void {
        this.args.langloader(langMap=> {            
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

    private updateImgHref_() {
        for (var n of dfsFlat(this.data, n=>true)) 
            n.imageHref = app.iconmap.fileName2IconUrl(n.data.name, n.data.type)                    
    }

    public updatePath(pathId:string, n:N)
    {
        var old_ =  this.paths[pathId]
        this.paths[pathId] = n
        var new_ =  this.paths[pathId]

        if (old_)
            if (old_.ancestors) 
                for (var pn of old_.ancestors())
                    pn[pathId] = undefined
            else
                old_[pathId] = undefined

        if (new_)
            if (new_.ancestors) 
                for (var pn of new_.ancestors()) 
                    pn[pathId] = true // könnte alles sein oder?
            else
                new_[pathId] = true // könnte alles sein oder?

        //this.ui.updateSelection()        
        //requestAnimationFrame(()=> this.unitdisk.updateTransformation())
        requestAnimationFrame(()=> {
            this.layerInfo2.update.all()
            this.layerInfo.update.all()
            this.unitdisk.updateSelection()
        })
    }

    private updateWeights() : void {
        this.data.sum(this.args.weight)
        for (var n of dfsFlat(this.data, n=>true)) {
            n.weightScale = (Math.log2(n.value) || 1)
                / (Math.log2(this.data.value || this.data.children.length) || 1)
        }
        this.updateLayout()
    }

    private updateLayout() : void {        
        //app.toast('Layout')
        var t0 = performance.now()

        this.args.layout(this.data, this.args.ui.transformation.state)        
        this.infoUi.updateLayout(this.args.ui.transformation.cache, performance.now() - t0)
        
        if (this.args.ui.transformation.cache.centerNode) {
            this.args.ui.transformation.state.P.re = -this.args.ui.transformation.cache.centerNode.z.re
            this.args.ui.transformation.state.P.im = -this.args.ui.transformation.cache.centerNode.z.im
        }

        this.updateTransformation()
    }

    public updateTransformation() : void {
        requestAnimationFrame(()=> {
            this.layerInfo2.update.all()
            this.layerInfo.update.all()
            this.unitdisk.updateTransformation() 
        })
    }

    private animateUp()
    {
        this.args.ui.transformation.state.P.re = 0
        this.args.ui.transformation.state.P.im = 0

        this.animation = true
        var step = 0, steps = 16
        var frame = ()=>
        {
            var p = step++/steps
            if (step > steps) {
                this.animation = false
            }
            else {
                var λ = .03 + p * .98
                var π = Math.PI
                var animλ = CptoCk({ θ:2*π*λ, r:1 })
                this.args.ui.transformation.state.λ.re = animλ.re
                this.args.ui.transformation.state.λ.im = animλ.im

                //app.toast('Layout')
                this.args.layout(this.data, this.args.ui.transformation.state)
                this.unitdisk.updateData()

                if (this.data
                    .leaves()
                    .reduce((max, n)=> Math.max(max, CktoCp(n.z).r), 0) > .995)
                    this.animation = false
                else
                    requestAnimationFrame(()=> {
                        this.layerInfo2.update.all()
                        this.layerInfo.update.all()
                        frame()
                    })
            }
        }
        requestAnimationFrame(()=> frame())
    }

    public isAnimationRunning() {
        var view = this.unitdisk.args.transformation.dST
        var nav = this.unitdisk.navParameter && this.unitdisk.navParameter.args.transformation.dST
        return view || nav
    }
}

