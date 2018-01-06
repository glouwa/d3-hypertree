//import { hierarchy, HierarchyNode } from 'd3-hierarchy'
//import { timer }                    from 'd3-timer'
//import { interpolateHcl, rgb }      from 'd3-color'

import * as d3                 from 'd3'
import { HTML }                from 'ducd'
import { clone }               from 'ducd'
import { N }                   from '../../models/n/n'
import { LoaderFunction }      from '../../models/n/n-loaders'
import { LayoutFunction }      from '../../models/n/n-layouts'
import { dfsFlat }             from '../../hyperbolic-math'
import { C, CktoCp, CptoCk }   from '../../hyperbolic-math'
import { CassignC, CmulR }     from '../../hyperbolic-math'
import { sigmoid }             from '../../hyperbolic-math'
import { Transformation }      from '../../hyperbolic-transformation'

import { ILayer }              from '../layerstack/layer'
import { D3UpdatePatternArgs } from '../layerstack/d3updatePattern'
import { UnitDiskArgs }        from '../unitdisk/unitdisk'
import { IUnitDisk }           from '../unitdisk/unitdisk'
import { UnitDisk }            from '../unitdisk/unitdisk'
import { UnitDiskNav }         from '../unitdisk/unitdisk'


import { HypertreeMeta }       from '../meta/hypertree-meta/hypertree-meta'
import { NoHypertreeMeta }     from '../meta/hypertree-meta/hypertree-meta'

const π = Math.PI

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
            <stop offset="98%"   stop-color="rgba( 36, 36, 36, .08)"/>
            <stop offset="100%"  stop-color="rgba( 0, 0, 0, .08)"/>
        </radialGradient>
    </defs>` 

export interface HypertreeArgs
{
    parent:         any,

    iconmap:        any,
    dataloader:     LoaderFunction,
    langloader:     (lang)=> (ok)=> void,

    weight:         (n:N) => number,
    layout:         LayoutFunction,
    onNodeSelect:   (n:N) => void,

    selection:      N[],

    decorator:      { new(a: UnitDiskArgs) : IUnitDisk },

    ui : {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:IUnitDisk)=> void,
        caption:        (hypertree:Hypertree, n:N)=> string,       
        layers:         ((ls:IUnitDisk)=> ILayer)[],
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

var btn = (name, icon, classes='')=>
    `<button id="${name}" class="btn btn-small waves-effect waves-orange pn ${classes}">        
        <i class="material-icons">${icon}</i>
    </button>`

// explore | near_me | fingerprint
// edit | content_cut | border_color | edit_location
// pan_tool | open_with | search | settings_overscan

//${btn('btnupload', 'cloud_upload')}
//${btn('btndownload', 'cloud_download')}                   

var hypertreehtml =
    `<div class="unitdisk-nav">        
        <div class=tool-bar>
            <!--${btn('btnundo', 'undo')}
            ${btn('btncommit', 'check')}-->
            ${btn('btnnav', 'explore', 'tool-seperator')}
            ${btn('btnmeta', 'layers')}
            ${btn('btnhome', 'home', 'tool-seperator')}
            ${btn('btnsearch', 'search', 'disabled')}
            ${btn('btndownload', 'file_download', 'disabled')}
            <!--${btn('btncut', 'content_cut')}
            ${btn('btncopy', 'content_copy')}
            ${btn('btnpaste', 'content_paste')}
            ${btn('btnbrowse', 'open_with', 'tool-seperator tool-active')}
            ${btn('btnadd', 'add')}
            ${btn('btnedit', 'border_color')}
            ${btn('btndelte', 'delete')}-->
        </div> 
        <svg width="calc(100% - 3em)" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}
        </svg>        
        <div class="preloader"></div>        
        <div id="meta"></div>        
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
    hypertreeMeta  : HypertreeMeta
    data           : N
    langMap        : {}
    view           : HTMLElement
    animation      : boolean = false    
    magic          = 1/160
    paths          : { 
        isSelected?:N, 
        isHovered?:N 
    }              = {}    
    modelMeta
    langMeta
    layoutMeta
    noHypertreeMeta

    constructor(args : HypertreeArgs) {
        this.args = args        
        this.update.parent()
    }

    update = {
        parent:         ()=> this.updateParent(),
        unitdiskView:   ()=> { this.updateUnitdiskView(); this.updateMetaView(); },
        metaView:       ()=> this.updateMetaView(),

        data:           ()=> this.updateData(),
        lang:           ()=> this.updateLang(),        
        layout:         ()=> this.updateLayout(),
        transformation: ()=> this.updateTransformation(),
        pathes:         ()=> this.updatePath(null, null)
    }

    private updateParent()
    {
        this.view = HTML.parse<HTMLElement>(hypertreehtml)()
        this.args.parent.innerHTML = ''
        this.args.parent.appendChild(this.view)
        var btnMeta = <HTMLButtonElement>this.view.querySelector('#btnmeta')
        var btnNav = <HTMLButtonElement>this.view.querySelector('#btnnav')
        var btnHome = <HTMLButtonElement>this.view.querySelector('#btnhome')
        
        btnHome.onclick = ()=> this.api.animateTo({ re:0, im:0 }, null)
        btnMeta.onclick = ()=> {
            this.noHypertreeMeta = this.noHypertreeMeta ? undefined : new NoHypertreeMeta()            
            this.update.metaView()
            this.hypertreeMeta.update.model()
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
        }
        btnNav.onclick = ()=> {
            this.args.decorator = this.args.decorator === UnitDiskNav ? UnitDisk : UnitDiskNav
            this.update.unitdiskView()
            this.unitdisk.update.data()
            this.hypertreeMeta.update.model()
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
        }

        this.updateUnitdiskView()
        this.updateMetaView()        

        this.updateData()
        this.updateLang()
    }

    private updateUnitdiskView()
    {
        var p = this.view.querySelector('.unitdisk-nav > svg')
        p.innerHTML = bubbleSvgDef
        this.unitdisk = new this.args.decorator({
            parent:         p,
            className:      'unitDisc',
            position:       'translate(520,500) scale(470)',
            hypertree:      this,
            data:           this.data,            
            transformation: this.args.ui.transformation,
            transform:      (n:N)=> this.unitdisk.args.transformation.transformPoint(n.z),
            layers:         this.args.ui.layers,
            cacheUpdate:    this.args.ui.cacheUpdate,
            caption:        (n:N)=> this.args.ui.caption(this, n),
            clipRadius:     this.args.ui.clipRadius,
            nodeRadius:     this.args.ui.nodeRadius            
        })
    }

    private updateMetaView()
    {
        var p = this.view.querySelector('.unitdisk-nav > #meta')
        p.innerHTML = ''
        this.hypertreeMeta = 
            this.noHypertreeMeta ||
            new this.unitdisk.HypertreeMetaType({ 
                view: { parent:p },
                model: this
            })
    }

    public updateData() : void {
        var t0 = performance.now()
        this.view.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined
        this.args.selection = []
        this.paths.isSelected = undefined
        this.paths.isHovered= undefined
        this.unitdisk.update.data()

        this.args.dataloader((d3h, t1, dl)=> {
            var t2 = performance.now()
            var ncount = 1
            this.data = <N & d3.HierarchyNode<N>>d3
                .hierarchy(d3h)
                .each((n:any)=> n.mergeId = ncount++)
                //.sum(this.args.weight) // this.updateWeights()

            this.view.querySelector('.preloader').innerHTML = ''
            this.modelMeta = { Δ: [t1-t0, t2-t1, performance.now()-t2], filesize:dl }
            
            var t3 = performance.now()
            this.data = this.args.layout(this.data, this.args.ui.transformation.state)
            this.unitdisk.args.data = this.data
            this.args.ui.transformation.cache.N = this.data.descendants().length
            this.updateWeights()
            this.updateLang_()
            this.updateImgHref_()            
            this.layoutMeta = { Δ: performance.now()-t3 }
            
            this.hypertreeMeta.update.model()
            this.animateUp()
        })
    }

    public updateLang() : void {
        this.args.langloader((langMap, t1, dl)=> {            
            this.langMap = langMap
            this.updateLang_(dl)

            this.hypertreeMeta.update.lang()
            this.updateTransformation()
        })
    }

    public updateLangData()
    {
        // das was von data und lang abhängt: wiki nodes in this file...
    }

    private updateLang_(dl=0) {
        const t0 = performance.now()
        for (var n of dfsFlat(this.data, n=>true)) {
            n.label = this.args.ui.caption(this, n)
            n.labellen = undefined
        }
        this.langMeta = { Δ: [300+performance.now()-t0], map:this.langMap, filesize:dl }
    }

    private updateImgHref_() {
        for (var n of dfsFlat(this.data, n=>true)) 
            n.imageHref = this.args.iconmap.fileName2IconUrl(n.data.name, n.data.type)                    
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
        this.layoutMeta = { Δ: performance.now()-t0 }
        //this.unitdiskMeta.update.layout(this.args.ui.transformation.cache, performance.now() - t0)
        
        if (this.args.ui.transformation.cache.centerNode) {
            this.args.ui.transformation.state.P.re = -this.args.ui.transformation.cache.centerNode.z.re
            this.args.ui.transformation.state.P.im = -this.args.ui.transformation.cache.centerNode.z.im
        }

        requestAnimationFrame(()=> {
            this.unitdisk.update.transformation() 
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
            //this.unitdiskMeta.update.layout()
            //this.unitdiskMeta.update.transformation()
            //this.layerStackMeta2.update.data()
            //this.layerStackMeta.update.data()            
        })
    }

    public updateTransformation() : void {
        requestAnimationFrame(()=> {
            this.unitdisk.update.transformation() 
            this.hypertreeMeta.update.transformation()
            //this.unitdiskMeta.update.transformation()
            //this.layerStackMeta2.update.data()
            //this.layerStackMeta.update.data()            
        })
    }

    public updatePath(pathId:string, n:N)
    {
        var old_ =  this.paths[pathId]
        this.paths[pathId] = n
        var new_ =  this.paths[pathId]

        if (pathId === 'isSelected')
            this.args.selection = [n]

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
            this.unitdisk.update.pathes()
            this.hypertreeMeta.update.transformation()
            //this.unitdiskMeta.update.transformation()
            //this.layerStackMeta2.update.data()
            //this.layerStackMeta.update.data()            
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
            if (step > steps)             
                this.animation = false
            
            else 
            {
                // new P, λ values
                var λ = .03 + p * .98
                var animλ = CptoCk({ θ:2*π*λ, r:1 })
                this.args.ui.transformation.state.λ.re = animλ.re
                this.args.ui.transformation.state.λ.im = animλ.im

                //app.toast('Layout')
                this.args.layout(this.data, this.args.ui.transformation.state)
                
                if (this.data
                    .leaves()
                    .reduce((max, n)=> Math.max(max, CktoCp(n.z).r), 0) > .95)                     
                {
                    // on abort
                    this.animation = false
                    this.data.each((n:any)=> { 
                        n.zRef = n.z
                        n.zRefp = CktoCp(n.z)
                        n.strCacheZref = `${n.z.re} ${n.z.im}`
                    })
                    // on abort - ui.update(s)
                    this.hypertreeMeta.update.transformation()
                    this.hypertreeMeta.update.layout()
                }
                else 
                    requestAnimationFrame(()=> frame())

                // ui.update(s)
                this.unitdisk.update.data()
            }
        }
        requestAnimationFrame(()=> frame())
    }

    api = {
        animateTo: (newP, newλ)=> 
        {   
            if (this.animation) return
            else this.animation = true

            const initTS = clone(this.args.ui.transformation.state)            
            const steps = 16
            let step = 1

            const frame = ()=> {                                                
                const animP = CmulR(initTS.P, 1-sigmoid(step/steps))
                CassignC(this.args.ui.transformation.state.P, animP)
                
                this.updateTransformation()

                if (step++ > steps) this.animation = false                    
                else requestAnimationFrame(()=> frame())                
            }
            requestAnimationFrame(()=> frame())
        }        
    }

    public isAnimationRunning() {
        var view = this.unitdisk.args.transformation.isMoving()
        var nav = this.unitdisk.navParameter 
               && this.unitdisk.navParameter.args.transformation.isMoving()
        return view || nav || this.animation
    }
}

