//import { hierarchy, HierarchyNode } from 'd3-hierarchy'
//import { timer }                    from 'd3-timer'
//import { interpolateHcl, rgb }      from 'd3-color'

import * as d3                 from 'd3'
import { path }                from 'd3'
import { HTML }                from 'ducd'
import { clone, stringhash }   from 'ducd'
import { googlePalette }       from 'ducd'
import { HypertreeArgs }       from '../../models/hypertree/model'
import { N }                   from '../../models/n/n'
import { Path }                from '../../models/path/path'
import { LoaderFunction }      from '../../models/n/n-loaders'
import { LayoutFunction }      from '../../models/n/n-layouts'
import { setZ }                from '../../models/n/n-layouts'
import { dfsFlat, πify }       from '../../models/transformation/hyperbolic-math'
import { C, CktoCp, CptoCk }   from '../../models/transformation/hyperbolic-math'
import { CassignC }            from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR } from '../../models/transformation/hyperbolic-math'
import { sigmoid }             from '../../models/transformation/hyperbolic-math'
import { Transformation }      from '../../models/transformation/hyperbolic-transformation'
import { UnitDiskArgs }        from '../../models/unitdisk/unitdisk-model'

import { ILayer }              from '../layerstack/layer'
import { D3UpdatePatternArgs } from '../layerstack/d3updatePattern'
import { IUnitDisk }           from '../unitdisk/unitdisk'
import { UnitDisk }            from '../unitdisk/unitdisk'
import { UnitDiskNav }         from '../unitdisk/unitdisk'

import { HypertreeMeta }       from '../meta/hypertree-meta/hypertree-meta'
import { NoHypertreeMeta }     from '../meta/hypertree-meta/hypertree-meta'

let globelhtid = 0

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
            <stop offset="58%"  stop-color="rgba(255,255,255, .08)"/>            
            <stop offset="92%"  stop-color="rgba( 96, 96, 96, .08)"/>
            <stop offset="98%"  stop-color="rgba( 36, 36, 36, .08)"/>
            <stop offset="100%" stop-color="rgba( 0, 0, 0, .08)"   />
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

        <div id="meta"></div>        

        <div class="tool-bar">
            <div id="path" class="absolute-center">...</div>
            <!--
            ${btn('btnundo', 'undo')}
            ${btn('btncommit', 'check')}
            -->
            ${btn('btnnav', 'explore', 'tool-seperator')}
            ${btn('btnsize', 'all_out')}
            ${btn('btnmeta', 'layers')}            

            ${btn('btnhome', 'home', 'tool-seperator')}
            ${btn('btnsearch', 'search', 'disabled')}
            ${btn('btndownload', 'file_download', 'disabled')}
            <!--
            ,530, 470
            ${btn('btncut', 'content_cut')}
            ${btn('btncopy', 'content_copy')}
            ${btn('btnpaste', 'content_paste')}
            ${btn('btnbrowse', 'open_with', 'tool-seperator tool-active')}
            ${btn('btnadd', 'add')}
            ${btn('btnedit', 'border_color')}
            ${btn('btndelte', 'delete')}
            -->
        </div> 

        <div id="path-toolbar" class="tool-bar path-bar">            
            ${btn('btn-path-home', 'grade', 'tool-seperator'/*, '#ffee55'*/)}
            ${btn('btn-path-center', 'add_circle', /*, '#b5b5b5'*/)}
        </div> 
        
        <svg width="calc(100% - 3em)" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}
        </svg>        

        <div class="preloader"></div>

    </div>`

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

        btnHome?       : HTMLElement,
        btnMeta?       : HTMLElement,
        btnNav?        : HTMLElement,
        btnSize?       : HTMLElement,

        pathesToolbar? : HTMLElement,
        btnPathHome?   : HTMLElement,

        html?          : HTMLElement,
        unitdisk?      : IUnitDisk,
        hypertreeMeta? : HypertreeMeta,
        /*
        modelMeta,
        langMeta,
        layoutMeta,
        noHypertreeMeta,
        */
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
        setModel: (model: HypertreeArgs)=> {
            this.args = model        
            this.update.view.parent()
        },
        setLangloader: ll=> { 
            this.args.langloader = ll            
            this.args.langloader((langMap, t1, dl)=> {            
                this.langMap = langMap
                this.updateLang_(dl)
                this.update.langloader() 
            })
        },
        setDataloader: dl=> { 
            this.args.dataloader = dl
            const t0 = performance.now()
            this.resetData()
            this.args.dataloader((d3h, t1, dl)=> 
                this.initData(d3h, t0, t1, dl)
            )
        },
        toggleNav: ()=> {
            this.args.decorator = this.args.decorator === UnitDiskNav ? UnitDisk : UnitDiskNav
            this.update.view.unitdisk()
            this.update.data()
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
        toggleSelection: (n:N)=> {
            this.toggleSelection(n)
            this.update.pathes()
        },
        //addPath: (pathid, node:N)=> { this.addPath(pathid, node) },
        //removePath: (pathid, node:N)=> { this.removePath(pathid, node) },
        setPathHead: (pathType:Path, n:N)=> {
            this.setPathHead(pathType, n)
            this.update.pathes()
        },
        gotoHome: ()=>    this.animateTo({ re:0, im:0 }, null), 
        gotoNode: (n:N)=> this.animateTo(CmulR({ re:n.layout.z.re, im:n.layout.z.im }, -1), null),
    }

    // private actions = {} todo: alles mit *_

    /*
    * this functions assume the model/view (this class internal state)
    * has changes, and call the according ui updates (animatin frames)
    */
    private update = {        
        view: {
            parent:         ()=> this.updateParent(),
            unitdisk:       ()=> { this.updateUnitdiskView(); this.updateMetaView(); },
            meta:           ()=> this.updateMetaView(),
        },        
        data:           ()=> requestAnimationFrame(()=> {                            
                            this.unitdisk.update.data()
                        }),        
        langloader:     ()=> requestAnimationFrame(()=> {                            
                            this.hypertreeMeta.update.lang()
                            this.update.transformation()
                        }),        
        layout:         ()=> requestAnimationFrame(()=> {
                            this.unitdisk.update.transformation() 
                            this.hypertreeMeta.update.layout()
                            this.hypertreeMeta.update.transformation()           
                        }),
        transformation: ()=> requestAnimationFrame(()=> {
                            this.unitdisk.update.transformation() 
                            this.hypertreeMeta.update.transformation()     
                        }),
        pathes:         ()=> requestAnimationFrame(()=> {
                            this.unitdisk.update.pathes()
                            this.hypertreeMeta.update.transformation()     
                        })
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
        this.noHypertreeMeta   = new NoHypertreeMeta()
        this.view_.btnMeta     = <HTMLButtonElement>this.view_.html.querySelector('#btnmeta')
        this.view_.btnNav      = <HTMLButtonElement>this.view_.html.querySelector('#btnnav')
        this.view_.btnHome     = <HTMLButtonElement>this.view_.html.querySelector('#btnhome')
        this.view_.btnSize     = <HTMLButtonElement>this.view_.html.querySelector('#btnsize')

        this.view_.pathesToolbar = <HTMLButtonElement>this.view_.html.querySelector('#path-toolbar')        
        this.view_.btnPathHome   = <HTMLButtonElement>this.view_.html.querySelector('#btn-path-home')
                
        this.view_.btnHome.onclick     = ()=> this.api.gotoHome()
        this.view_.btnPathHome.onclick = ()=> this.api.gotoHome()
        this.view_.btnMeta.onclick     = ()=> this.api.toggleMeta()
        this.view_.btnNav.onclick      = ()=> this.api.toggleNav()        
        this.view_.btnSize.onclick     = ()=> {            
            const view = [
                'translate(520,500) scale(470)', // small
                'translate(520,500) scale(490)', // big
                'translate(520,500) scale(720, 490)', // oval 
                'translate(520,500) scale(720, 590)', // overlap
                'translate(520,600) scale(680, 800)', // mobile (vertical)
            ]
            const nav = [
                'translate(95,95) scale(70)',
                'translate(95,95) scale(70)',
                'translate(-150,105) scale(70)',
                'translate(-160,95) scale(70)',
                'translate(-150,105) scale(70)'
            ]
            sizeidx = ++sizeidx % 5
            this.unitdisk.api.setTransform(view[sizeidx], nav[sizeidx])
        }
        let sizeidx = 0

        this.view_.path = <HTMLElement>this.view_.html.querySelector('#path')

        this.updateUnitdiskView()
        this.updateMetaView()    

        this.api.setDataloader(this.args.dataloader)        
        this.api.setLangloader(this.args.langloader)
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
        },
        {            
            data:           null, //this.data,            
            transformation: this.args.geometry.transformation,
            transform:      (n:N)=> this.unitdisk.args.transformation.transformPoint(n.layout.z),
            layers:         this.args.geometry.layers,
            cacheUpdate:    this.args.geometry.cacheUpdate,
            //caption:        (n:N)=> this.args.caption(this, n),
            clipRadius:     this.args.geometry.clipRadius,
            nodeRadius:     this.args.geometry.nodeRadius,
            nodeScale:      this.args.geometry.nodeScale,            
            nodeFilter:     this.args.geometry.nodeFilter,
            linkWidth:      this.args.geometry.linkWidth
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
    //## Sync blocks for async api functions
    //##
    //########################################################################################################

    private resetData() {        
        this.view_.html.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined
     
        this.args.objects.selections = []
        this.args.objects.pathes = []
        this.view_.path.innerText = ''
        this.view_.pathesToolbar.innerHTML = 
            btn('btn-path-home', 'grade', 'tool-seperator', '#e2d773') //'#ffee55'
          + btn('btn-path-center', 'add_circle', 'disabled'/*, '#b5b5b5'*/)
        this.view_.pathesToolbar
            .querySelector<HTMLButtonElement>('#btn-path-home')
            .onclick = ()=> this.api.gotoHome()

        this.update.data()   
    }

    private initData(d3h, t0, t1, dl) {
        var t2 = performance.now()
        var ncount = 1
        globelhtid++
        this.data = <N & d3.HierarchyNode<N>>d3
            .hierarchy(d3h)
            .each((n:any)=> {
                n.mergeId = ncount++
                n.value = null
                n.precalc = {}
                n.layout = null
                n.layoutReference = null
                n.pathes = {}
                n.globelhtid = globelhtid
            })
            //.sum(this.args.weight) // this.updateWeights()

        this.view_.html.querySelector('.preloader').innerHTML = ''
        this.modelMeta = { Δ: [t1-t0, t2-t1, performance.now()-t2], filesize:dl }
        
        var t3 = performance.now()
        this.updateLayout_() // all?
        //this.data = this.args.layout(this.data, this.args.geometry.transformation.state)
        this.unitdisk.args.data = this.data
        this.args.geometry.transformation.cache.N = this.data.descendants().length
        this.updateWeights_()
        this.updateLang_()
        this.updateImgHref_()            
        this.layoutMeta = { Δ: performance.now()-t3 }
        
        this.hypertreeMeta.update.model()
        this.animateUp()
    }

    //########################################################################################################
    //##
    //## Path
    //##
    //########################################################################################################
           
    private btnPathId = (pathType:string, n:N)=> `btn-path-${pathType}` + (pathType === 'SelectionPath' ? `-${n.mergeId}` : '')
    private addIfNotInSafe<ArrET>(arr:ArrET[], newE:ArrET, side='unshift') : ArrET[] {
        if (!arr) return [newE]        
        if (!arr.includes(newE)) arr[side](newE)
        return arr
    }

    private toggleSelection(n:N) {
        if (this.args.objects.selections.includes(n)) {
            //const nidx = this.args.objects.selections.indexOf(n)
            //delete this.args.objects.selections[nidx]
            this.args.objects.selections = this.args.objects.selections.filter(e=> e !== n)
            this.removePath('SelectionPath', n)
        }
        else
        {
            this.args.objects.selections.push(n)
            this.addPath('SelectionPath', n)            
        }    
    }

    // es kann nur einen pro id geben, gibt es bereits einen wird dieser entfernt 
    // (praktisch für hover)
    private setPathHead(path:Path, n:N) {
        const pt = path ? path.type : 'HoverPath'

        const oldPathId = this.btnPathId(pt, n)
        const oldPath = this.args.objects.pathes.find(e=> e.id === oldPathId)

        if (oldPath)
            this.removePath(pt, oldPath.head)
        if (n)
            this.addPath(pt, n)
    }

    private addPath(pathType:string, n:N) {
        const plidx = stringhash(n.precalc.txt)
        const newpath:Path = {
            type:      pathType,
            id:        this.btnPathId(pathType, n),
            icon:      ({ 'HoverPath':'mouse' })[pathType] || 'place',
            head:      n,
            headName:  n.precalc.label,
            ancestors: n.ancestors(),            
            color:     ({ 'HoverPath':'none' })[pathType] || googlePalette(plidx) || 'red' ,            
        }

        // model mod
        this.args.objects.pathes.push(newpath)
        n.pathes.headof = newpath
        if (pathType !== 'HoverPath') 
            n.pathes.finalcolor = n.pathes.labelcolor = newpath.color            
        // model mod: node context        
        n.ancestors().forEach((pn:N)=> {
            pn.pathes.partof = this.addIfNotInSafe(                
                pn.pathes.partof, 
                newpath,                
                pathType === 'HoverPath' ? 'push' : 'unshift'
            )

            if (pathType !== 'HoverPath')
                pn.pathes.finalcolor = newpath.color

            pn.pathes[`isPartOfAny${pathType}`] = true            
        })        
        
        // view: btn   ==> update.btntoolbar()    
        const btnElem = HTML.parse(btn(
            newpath.id, 
            newpath.icon, 
            pathType === 'HoverPath' ? 'disabled' : '', 
            newpath.color))()        
        btnElem.onclick = ()=> this.api.gotoNode(n)
        btnElem.title = `${n.precalc.txt} ${plidx}`
        this.view_.pathesToolbar.insertBefore(btnElem, pathType==='HoverPath' ? null : this.view_.pathesToolbar.firstChild)        
    }

    private removePath(pathType:string, n:N) {
        const pathId = this.btnPathId(pathType, n)
        
        // model mod
        this.args.objects.pathes = this.args.objects.pathes.filter(e=> e.id !== pathId)
        n.pathes.headof = undefined
        if (pathType !== 'HoverPath') 
            n.pathes.labelcolor = undefined
        // model mod: node context        
        n.ancestors().forEach((pn:N)=> {
            pn.pathes.partof = pn.pathes.partof.filter(e=> e.id !== pathId)
            pn.pathes.finalcolor = pn.pathes.partof.length > 0            
                ? pn.pathes.partof[0].color
                : undefined

            if (pn.pathes.finalcolor === 'none') 
                pn.pathes.finalcolor = undefined

            const nodeFlagName = `isPartOfAny${pathType}`         
            pn.pathes[nodeFlagName] = pn.pathes.partof.some(e=> e.type === pathType)
        })

        // btn
        const btnElem = this.view_.pathesToolbar.querySelector(`#${pathId}`)
        this.view_.pathesToolbar.removeChild(btnElem)
    }

    private d3updatePath()
    {
        // this.args.objects.pathes --> Btn[]
    }    

    //########################################################################################################
    //##
    //## internal functions, calles by ...?
    //##
    //########################################################################################################

    private updateLang_(dl=0) : void {
        const t0 = performance.now()
        for (var n of dfsFlat(this.data, n=>true)) {
            n.precalc.txt = null            
            n.precalc.label = this.args.caption(this, n)
            n.precalc.labellen = undefined
        }
        if (dl || !this.langMeta)
            this.langMeta = {
                Δ: [300+performance.now()-t0], 
                map:this.langMap, 
                filesize:dl 
            }
    }

    private updateImgHref_() : void {
        for (var n of dfsFlat(this.data, n=>true)) 
            n.precalc.imageHref = this.args.iconmap.fileName2IconUrl(n.data.name, n.data.type)                    
    }

    private updateWeights_() : void {
        this.data.sum(this.args.weight) // äää besser...
        for (var n of dfsFlat(this.data, n=>true)) 
            // ...hier selber machen
            n.precalc.weightScale = (Math.log2(n.value) || 1) 
                          / (Math.log2(this.data.value || this.data.children.length) || 1)        
    }

    private updateLayout_(/*preservingnode*/) : void {
        //app.toast('Layout')
        var t0 = performance.now()

        const π = Math.PI  
        const startAngle    = 0
        const defAngleWidth = π * 1.999999999999
        const sad           = 2.0
        
        this.data.layout = {
            wedge: {
                α: πify(startAngle - defAngleWidth/sad),
                Ω: πify(startAngle + defAngleWidth/sad)
            }
        }
        setZ(this.data, { re:0, im:0 })

        const count = this.args.layout(this.data, this.args.geometry.transformation.state.λ)                
        console.log(count)

        for (var n of dfsFlat(this.data, n=>true)) {
            console.assert(n.layout.z)
            console.assert(n.layout.wedge)
        }
        //this.unitdiskMeta.update.layout(this.args.geometry.transformation.cache, performance.now() - t0)
        
        const t = this.args.geometry.transformation
        if (t.cache.centerNode) 
            t.state.P = CmulR(t.cache.centerNode.layout.z, -1) 
            
        this.layoutMeta = { Δ: performance.now()-t0 }
    }

    //########################################################################################################
    //##
    //## Animation frames ans animations
    //##
    //########################################################################################################

    private animateUp() : void {
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
                var animλ = λ
                this.args.geometry.transformation.state.λ = animλ                

                //app.toast('Layout')
                //this.args.layout(this.data, this.args.geometry.transformation.state.λ)
                this.updateLayout_()
                
                if (this.data
                    .leaves()
                    .reduce((max, n)=> Math.max(max, CktoCp(n.layout.z).r), 0) > .95)                     
                {
                    // on abort
                    this.animation = false
                    this.data.each((n:N)=> n.layoutReference = clone(n.layout))
                    // on abort - ui.update(s)
                    this.hypertreeMeta.update.transformation()
                    this.hypertreeMeta.update.layout()
                }
                else 
                    requestAnimationFrame(()=> frame())

                // ui.update(s)
                this.update.data()
            }
        }
        requestAnimationFrame(()=> frame())
    }

    private animateTo(newP:C, newλ) : void {
        if (this.animation) return
        else this.animation = true

        const initTS = clone(this.args.geometry.transformation.state)
        const way = CsubC(newP, initTS.P)

        const steps = 16
        let step = 1

        const frame = ()=> {                                                
            const animP = CaddC(initTS.P, CmulR(way, sigmoid(step/steps)))
            CassignC(this.args.geometry.transformation.state.P, animP)
            
            this.update.transformation()

            if (step++ > steps) this.animation = false                    
            else requestAnimationFrame(()=> frame())                
        }
        requestAnimationFrame(()=> frame())
    }

    public isAnimationRunning() : boolean {
        var view = this.unitdisk.args.transformation.isMoving()
        var nav = this.unitdisk.navParameter 
               && this.unitdisk.navParameter.args.transformation.isMoving()
        return view || nav || this.animation
    }  
}

