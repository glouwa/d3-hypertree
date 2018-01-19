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
const htmlpreloader = `
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

const bubbleSvgDef =
    `<defs>
        <radialGradient id="exampleGradient">            
            <stop offset="58%"   stop-color="rgba(255,255,255, .08)"/>            
            <stop offset="92%"   stop-color="rgba( 96, 96, 96, .08)"/>
            <stop offset="98%"   stop-color="rgba( 36, 36, 36, .08)"/>
            <stop offset="100%"  stop-color="rgba( 0, 0, 0, .08)"/>
        </radialGradient>
    </defs>` 

const btn = (name, icon, classes='', iconColor=undefined)=>
    `<button id="${name}" class="btn btn-small waves-effect waves-orange pn ${classes}">        
        <i class="material-icons" ${iconColor?'style="color:'+iconColor+';"':''}>${icon}</i>
    </button>`

// explore | near_me | fingerprint
// edit | content_cut | border_color | edit_location
// pan_tool | open_with | search | settings_overscan

//${btn('btnupload', 'cloud_upload')}
//${btn('btndownload', 'cloud_download')}                   

const hypertreehtml =
    `<div class="unitdisk-nav">        
        <div class="tool-bar">
            <div id="path" class="absolute-center">...</div>
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
        <div class="tool-bar path-bar">
            ${btn('btn-path-s0', 'trending_up', '', '#ff9800')}
            ${btn('btn-path-s1', 'trending_up', '', '#2196F3')}
            ${btn('btn-path-home', 'grade', 'tool-seperator')}            
            ${btn('btn-path-center', 'add_circle_outline', 'disabled')}
            ${btn('btn-path-hover', 'mouse', 'disabled')}
        </div> 
        <svg width="calc(100% - 3em)" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}
        </svg>        
        <div class="preloader"></div>        
        <div id="meta"></div>        
    </div>`

export interface HypertreeArgs
{
    parent:       HTMLElement,
    iconmap:      any,

    dataloader:   LoaderFunction,
    data:         N,
    langloader:   (lang)=> (ok)=> void,
    langmap:      {},
    weight:       (n:N) => number,
    layout:       LayoutFunction,
    magic:        number,

    caption:      (hypertree:Hypertree, n:N)=> string,
    onNodeSelect: (n:N)=> void,
    decorator:    { new(a: UnitDiskArgs) : IUnitDisk },

    objects: {
        pathes: {
            centerNode: N[],       // readonly
            hover:      N[],            // readonly
            //['selection-*']: N[],
        },
        selections: N[],
    },   
    
    geometry: {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:IUnitDisk)=> void,        
        layers:         ((ls:IUnitDisk)=> ILayer)[],
    }
}

/**
* pipeline implementation:
* ajax -> weights -> layout -> transformation -> unitdisk / langmaps
*
* states: pipeline, interaction*
*
* --> model (N, lang, layout, weights, nav, layers, pathes|selection, T)
*/
export class Hypertree 
{
    args            : HypertreeArgs    
    view_: {
        parent         : HTMLElement,
        path?          : HTMLElement,

        html?          : HTMLElement,
        unitdisk?      : IUnitDisk,
        hypertreeMeta? : HypertreeMeta,
/*
        modelMeta,
        langMeta,
        layoutMeta,
        noHypertreeMeta,*/
    }
    animation      : boolean = false
    
    // todo: move to view
    modelMeta
    langMeta
    layoutMeta
    noHypertreeMeta
    
    unitdisk       : IUnitDisk
    hypertreeMeta  : HypertreeMeta
    // end todo

    // todo: move to args    
    data           : N
    langMap        : {}    
    whateveritis          : { isSelected?:N, isHovered?:N } = {}    
    // end todo

    constructor(view:{ parent:HTMLElement }, args:HypertreeArgs) {
        this.view_ = view
        this.args = args        
        this.update.view.parent()
    }

    /*
    * this functions modyfy model/view (this class internal state)
    * and call the according update function(s)
    */    
    public api = {        
        setLangloader: ll=> { 
            this.args.langloader = ll
            this.update.langloader() 
        },
        setDataloader: dl=> { 
            this.args.dataloader = dl
            this.update.dataloader() 
        },
        setLoaders: (dl, ll)=> { 
            this.args.dataloader = dl
            this.args.langloader = ll
            this.update.langloader() 
        },
        //setLang: (langmap)
        //setData: (N*)        
        //setLayout (l)
        //setWeigths (w)
        toggleNav: ()=> {
            this.args.decorator = this.args.decorator === UnitDiskNav ? UnitDisk : UnitDiskNav
            this.update.view.unitdisk()
            this.unitdisk.update.data()
            this.hypertreeMeta.update.model()
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
        },
        toggleMeta: ()=> {
            this.noHypertreeMeta = this.noHypertreeMeta ? undefined : new NoHypertreeMeta()
            this.update.view.meta()
            this.hypertreeMeta.update.model()
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
        },

        toggleSelection: (n:N)=> this.toggleSelection(n),        
        addPath: (pathid, node:N)=> this.addPath(pathid, node),
        removePath: (pathid)=> this.removePath(pathid),

        gotoHome: ()=> this.animateTo({ re:0, im:0 }, null),
/*
        gotoT (TS)

        beginAT (TS)
        AT (TS)
        endAT (TS)*/
    }

    /*
    * this functions assume the model/view (this class internal state)
    * has changes, and call the according ui updates (animatin frames)
    */
    private update = {        
        view: {
            parent:     ()=> this.updateParent(),
            unitdisk:   ()=> { this.updateUnitdiskView(); this.updateMetaView(); },
            meta:       ()=> this.updateMetaView(),
        },
        dataloader:     ()=> this.updateDataloader(),
        langloader:     ()=> this.updateLangloader(),
        
        layout:         ()=> this.updateLayout(),
        transformation: ()=> this.updateTransformation(),
        pathes:         ()=> this.updatePathes()
    }

    //########################################################################################################
    //##
    //## View Updates
    //##
    //########################################################################################################

    private updateParent()
    {
        this.view_.parent.innerHTML = '' // actually just remove this.view if present ... do less
        this.view_.html = HTML.parse<HTMLElement>(hypertreehtml)()
        this.view_.parent.appendChild(this.view_.html)
        this.noHypertreeMeta = new NoHypertreeMeta()
        var btnMeta = <HTMLButtonElement>this.view_.html.querySelector('#btnmeta')
        var btnNav = <HTMLButtonElement>this.view_.html.querySelector('#btnnav')
        var btnHome = <HTMLButtonElement>this.view_.html.querySelector('#btnhome')

        this.view_.path = <HTMLElement>this.view_.html.querySelector('#path')
                
        btnHome.onclick = ()=> this.api.gotoHome()
        btnMeta.onclick = ()=> this.api.toggleMeta()
        btnNav.onclick  = ()=> this.api.toggleNav()

        this.updateUnitdiskView()
        this.updateMetaView()    

        this.update.dataloader()
        this.update.langloader()
    }

    private updateUnitdiskView()
    {
        var udparent = this.view_.html.querySelector('.unitdisk-nav > svg')
        udparent.innerHTML = bubbleSvgDef
        this.unitdisk = new this.args.decorator({
            parent:         udparent,
            className:      'unitDisc',
            position:       'translate(520,500) scale(470)',
            hypertree:      this,
            data:           this.data,            
            transformation: this.args.geometry.transformation,
            transform:      (n:N)=> this.unitdisk.args.transformation.transformPoint(n.z),
            layers:         this.args.geometry.layers,
            cacheUpdate:    this.args.geometry.cacheUpdate,
            caption:        (n:N)=> this.args.caption(this, n),
            clipRadius:     this.args.geometry.clipRadius,
            nodeRadius:     this.args.geometry.nodeRadius            
        })
    }

    private updateMetaView()
    {
        var metaparent = this.view_.html.querySelector('.unitdisk-nav > #meta')
        metaparent.innerHTML = ''
        this.hypertreeMeta = this.noHypertreeMeta || new this.unitdisk.HypertreeMetaType({ 
                view: { parent:metaparent },
                model: this
            })
    }

    //########################################################################################################
    //##
    //## Async Stuff
    //##
    //########################################################################################################

    private updateDataloader() : void {
        var t0 = performance.now()
        this.view_.html.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined

        this.view_.path.innerText = ''
        this.args.objects.selections = []
        this.whateveritis.isSelected = undefined
        this.whateveritis.isHovered= undefined
        this.unitdisk.update.data()

        this.args.dataloader((d3h, t1, dl)=> {
            var t2 = performance.now()
            var ncount = 1
            this.data = <N & d3.HierarchyNode<N>>d3
                .hierarchy(d3h)
                .each((n:any)=> n.mergeId = ncount++)
                //.sum(this.args.weight) // this.updateWeights()

            this.view_.html.querySelector('.preloader').innerHTML = ''
            this.modelMeta = { Δ: [t1-t0, t2-t1, performance.now()-t2], filesize:dl }
            
            var t3 = performance.now()
            this.data = this.args.layout(this.data, this.args.geometry.transformation.state)
            this.unitdisk.args.data = this.data
            this.args.geometry.transformation.cache.N = this.data.descendants().length
            this.updateWeights()
            this.updateLang_()
            this.updateImgHref_()            
            this.layoutMeta = { Δ: performance.now()-t3 }
            
            this.hypertreeMeta.update.model()
            this.animateUp()
        })
    }

    private updateLangloader() : void {
        this.args.langloader((langMap, t1, dl)=> {            
            this.langMap = langMap
            this.updateLang_(dl)

            this.hypertreeMeta.update.lang()
            this.updateTransformation()
        })
    }

    private addPath(pathId:string, n:N) {
        if (n.ancestors) 
            for (var pn of n.ancestors()) 
                pn[pathId] = true // könnte alles sein oder?
        else
            n[pathId] = true // könnte alles sein oder?
    }
    private removePath(pathId:string, n:N) {
        if (n.ancestors) 
            for (var pn of n.ancestors())
                pn[pathId] = undefined
        else
            n[pathId] = undefined
    }

    private toggleSelection(n:N) {
        // set selection
        // reserve/free color
        // add/remove path
    }

    private updatePath(pathId:string, n:N) {

        if (pathId === 'isSelected')
            this.args.objects.selections = [n]
        
        var old_ = this.whateveritis[pathId]
        if (old_)
            this.removePath(pathId, old_)

        this.whateveritis[pathId] = n
        var new_ = n
        if (new_)
            this.addPath(pathId, new_)
        
        this.update.pathes()
    }

    //########################################################################################################
    //##
    //## internal functions, calles by ...?
    //##
    //########################################################################################################

    private updateLangData() {
        // das was von data und lang abhängt: wiki nodes in this file...
    }

    private updateLang_(dl=0) {
        const t0 = performance.now()
        for (var n of dfsFlat(this.data, n=>true)) {
            n.label = this.args.caption(this, n)
            n.labellen = undefined
        }
        if (dl || !this.langMeta)
            this.langMeta = {
                Δ: [300+performance.now()-t0], 
                map:this.langMap, 
                filesize:dl 
            }
    }

    private updateImgHref_() {
        for (var n of dfsFlat(this.data, n=>true)) 
            n.imageHref = this.args.iconmap.fileName2IconUrl(n.data.name, n.data.type)                    
    }

    //########################################################################################################
    //##
    //## Animation frames ans animations
    //##
    //########################################################################################################

    private updateWeights() : void {
        this.data.sum(this.args.weight) // äää besser...
        for (var n of dfsFlat(this.data, n=>true)) 
            // ...hier selber machen
            n.weightScale = (Math.log2(n.value) || 1) / (Math.log2(this.data.value || this.data.children.length) || 1)
        
        this.updateLayout()
    }

    private updateLayout() : void {        
        //app.toast('Layout')
        var t0 = performance.now()
        this.args.layout(this.data, this.args.geometry.transformation.state)        
        this.layoutMeta = { Δ: performance.now()-t0 }
        //this.unitdiskMeta.update.layout(this.args.geometry.transformation.cache, performance.now() - t0)
        
        const t = this.args.geometry.transformation
        if (t.cache.centerNode) {
            t.state.P.re = -t.cache.centerNode.z.re
            t.state.P.im = -t.cache.centerNode.z.im
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

    private updateTransformation() : void {
        requestAnimationFrame(()=> {
            this.unitdisk.update.transformation() 
            this.hypertreeMeta.update.transformation()
            //this.unitdiskMeta.update.transformation()
            //this.layerStackMeta2.update.data()
            //this.layerStackMeta.update.data()            
        })
    }

    private updatePathes() {
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
    
    private animateUp() {
        this.args.geometry.transformation.state.P.re = 0
        this.args.geometry.transformation.state.P.im = 0

        this.animation = true
        var step = 0, steps = 16
        var frame = ()=>
        {
            var p = step++/steps
            if (step > steps)
                this.animation = false
            
            else {
                // new P, λ values
                var λ = .03 + p * .98
                var animλ = CptoCk({ θ:2*π*λ, r:1 })
                this.args.geometry.transformation.state.λ.re = animλ.re
                this.args.geometry.transformation.state.λ.im = animλ.im

                //app.toast('Layout')
                this.args.layout(this.data, this.args.geometry.transformation.state)
                
                if (this.data.leaves()
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

    private animateTo(newP, newλ) {
        if (this.animation) return
        else this.animation = true

        const initTS = clone(this.args.geometry.transformation.state)            
        const steps = 16
        let step = 1

        const frame = ()=> {                                                
            const animP = CmulR(initTS.P, 1-sigmoid(step/steps))
            CassignC(this.args.geometry.transformation.state.P, animP)
            
            this.updateTransformation()

            if (step++ > steps) this.animation = false                    
            else requestAnimationFrame(()=> frame())                
        }
        requestAnimationFrame(()=> frame())
    }

    public isAnimationRunning() {
        var view = this.unitdisk.args.transformation.isMoving()
        var nav = this.unitdisk.navParameter 
               && this.unitdisk.navParameter.args.transformation.isMoving()
        return view || nav || this.animation
    }
}

