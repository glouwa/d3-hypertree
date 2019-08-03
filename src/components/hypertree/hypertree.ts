import * as d3                 from 'd3'
import { HTML }                from 'ducd'
import { clone, stringhash }   from 'ducd'
import { googlePalette }       from 'ducd'
import { HypertreeArgs }       from '../../models/hypertree/model'
import { N }                   from '../../models/n/n'
import { Path }                from '../../models/path/path'
import { setZ }                from '../../models/n/n-layouts'
import { dfsFlat, πify }       from '../../models/transformation/hyperbolic-math'
import { C }                   from '../../models/transformation/hyperbolic-math'
import { CassignC }            from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR } from '../../models/transformation/hyperbolic-math'
import { sigmoid }             from '../../models/transformation/hyperbolic-math'
import { IUnitDisk }           from '../unitdisk/unitdisk'
import { presets }             from '../../models/hypertree/preset-base'
import { mergeDeep }           from 'ducd'

let globelhtid = 0
 
const π = Math.PI
const htmlpreloader = `
    <div class="spinner">
        <div class="double-bounce1"></div>
        <div class="double-bounce2"></div>
    </div>`

const bubbleSvgDef_old =
    `<defs>
        <radialGradient id="exampleGradient">            
            <stop offset="58%"  stop-color="rgb(255,255,255)" stop-opacity=".08"/>            
            <stop offset="92%"  stop-color="rgb( 96, 96, 96)" stop-opacity=".08"/>
            <stop offset="98%"  stop-color="rgb( 36, 36, 36)" stop-opacity=".08"/>
            <stop offset="100%" stop-color="rgb(  0,  0,  0)" stop-opacity=".08"/>
        </radialGradient>
    </defs>` 

const grad = [255,96,36,0]
const bubbleSvgDef = 
    `<defs>
        <radialGradient id="exampleGradient">            
            <stop offset="58%"  stop-color="rgb(${grad[0]},${grad[0]},${grad[0]})" stop-opacity=".15"/>            
            <stop offset="92%"  stop-color="rgb(${grad[1]},${grad[1]},${grad[1]})" stop-opacity=".15"/>
            <stop offset="98%"  stop-color="rgb(${grad[2]},${grad[2]},${grad[2]})" stop-opacity=".15"/>
            <stop offset="100%" stop-color="rgb(${grad[3]},${grad[3]},${grad[3]})" stop-opacity=".15"/>
        </radialGradient>
    </defs>` 

const hypertreehtml =
    `<div class="unitdisk-nav">        
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}
        </svg>
        <div class="preloader"></div>
    </div>`

export class Hypertree
{
    args           : HypertreeArgs    
    data           : N
    langMap        : {}

    view_: {
        parent         : HTMLElement,   
        html?          : HTMLElement,
        //unitdisk?      : IUnitDisk,        
    }

    unitdisk       : IUnitDisk
    transition     : Transition
    log            = []

    modelMeta
    langMeta
    layoutMeta 

    initPromise : Promise<void>
    initPromisHandler : { resolve, reject }
    isInitializing = false

    lastCenterNode = undefined
    
    constructor(view:{ parent:HTMLElement }, args:HypertreeArgs) {
        console.group("hypertree constructor")
        this.view_ = view        
        this.initPromise = this.api.setModel(args)
        console.groupEnd()
    }
 
    /*
    * this functions modyfy model/view (this class internal state)
    * and call the according update function(s)
    */    
    public api = {
        setModel: (model: HypertreeArgs)=> new Promise<void>((ok, err)=> {            
            //model = mergeDeep_(presets[model.baseCfg], model)
            this.isInitializing = true
            const base = presets.modelBase()
            console.group("set model: merging ", model, ' into ', base)

            //this.args = mergeDeep(model, base)
            this.args = mergeDeep(base, model)
            console.log('merge result: ', this.args)

            // wenn parent updatedated hat wraum ist da nich eine alte transformations in der disk            
            this.update.view.parent()
            this.api.setDataloader(ok, err, this.args.dataloader) // resetData is hier drin 🤔 
            this.api.setLangloader(ok, err, this.args.langloader)
            console.groupEnd()
        }),
        setLangloader: (ok, err, ll)=> { 
            console.group("langloader initiate")
            this.args.langloader = ll

            this.args.langloader((langMap, t1, dl)=> {
                console.group("langloader", langMap && Object.keys(langMap).length || 0)
                this.langMap = langMap || {}
                this.updateLang_(dl)                
                //requestAnimationFrame(()=> this.update.data())
                this.update.data()
                console.groupEnd()
                
                if (this.data) { this.isInitializing=false;  ok() }
            })
            console.groupEnd()
        },
        setDataloader: (ok, err, dl)=> {            
            console.group("dataloader initiate")
            this.args.dataloader = dl
            const t0 = performance.now()
            this.resetData()
            
            this.args.dataloader((d3h, t1, dl)=> {
                console.group("dataloader")
                this.initData(d3h, t0, t1, dl)                                
                console.groupEnd()

                if (this.langMap) { this.isInitializing=false;  ok() }
            })
            console.groupEnd()
        },
        toggleSelection: (n:N)=> {
            this.toggleSelection(n)
            if (this.args.objects.pathes.length > 10+1) {
                const toremove = this.args.objects.selections[0]
                this.args.objects.selections = this.args.objects.selections.filter(e=> e !== toremove)
                this.removePath('SelectionPath', toremove)
            }
            this.update.pathes()
        },
        //addPath: (pathid, node:N)=> { this.addPath(pathid, node) },
        //removePath: (pathid, node:N)=> { this.removePath(pathid, node) },
        setPathHead: (pathType:Path, n:N)=> {
            if (!this.isInitializing && !this.isAnimationRunning()) {
                this.setPathHead(pathType, n)
                this.update.pathes()
            }
        },
        selectQuery: (query:string, prop:string)=> {
            const lq = query ? query.toLowerCase() : null
            this.data.each(n=> {
                n.pathes.partof = []
                n.pathes.headof = undefined
                n.pathes.labelcolor = undefined
                n.pathes.finalcolor = undefined                
                n.pathes.isPartOfAnyQuery = false                
            })
            console.log('QUERY:', lq)
            this.args.objects.pathes = []
            this.data.each(n=> {                
                if (n.data) {
                    if (n.data.name.toLowerCase().includes(lq))
                        this.addPath('Query', n)
                    if (n.precalc && n.precalc.label)
                        if (n.precalc.label.toLowerCase().includes(lq))
                        this.addPath('Query', n)
                }
            })
            this.update.pathes()
        },
        gotoHome: ()=>     new Promise((ok, err)=> this.animateTo(ok, err, { re:0, im:0 }, null)), 
        gotoNode: (n:N)=>  new Promise((ok, err)=> this.animateTo(ok, err, CmulR({ re:n.layout.z.re, im:n.layout.z.im }, -1), null)),

        goto:     (p, l)=> new Promise((ok, err)=> this.animateTo(ok, err, p, l)),
        gotoλ:    (l)=>    new Promise((ok, err)=> this.animateToλ(ok, err, l))
    }

    /*
    * this functions assume the model/view (this class internal state)
    * has changes, and call the according ui updates (animatin frames)
    */    
    public update = {
        view: {
            parent:     ()=> this.updateParent(),
            unitdisk:   ()=> this.updateUnitdiskView(),
        },        
        data:           ()=> this.unitdisk.update.data(),        
        transformation: ()=> this.unitdisk.update.transformation(),
        pathes:         ()=> this.unitdisk.update.pathes(),
        centernode:     (centerNode)=> {            
            if (this.lastCenterNode && this.lastCenterNode.mergeId == centerNode.mergeId)
                return

            this.lastCenterNode = centerNode
            const pathStr = centerNode
                .ancestors()
                .reduce((a, e)=> `${e.precalc.label?("  "+e.precalc.label+"  "):''}${a?"›":""}${a}`, '') 

            //this.view_.path.innerText = pathStr // todo: html m frame?
            if (this.args.interaction.onCenterNodeChange) 
                this.args.interaction.onCenterNodeChange(centerNode, pathStr)            
        }
    }

    //########################################################################################################
    //##
    //## View Updates
    //##
    //########################################################################################################

    protected updateParent()
    {
        console.log("_updateParent")
        this.view_.parent.innerHTML = '' // actually just remove this.view if present ... do less
        this.view_.html = HTML.parse<HTMLElement>(hypertreehtml)()
        this.view_.parent.appendChild(this.view_.html)
       
        this.updateUnitdiskView()
    }

    protected updateUnitdiskView()
    {
        console.log("_updateUnitdiskView")
        var udparent = this.view_.html.querySelector('.unitdisk-nav > svg')
        udparent.innerHTML = bubbleSvgDef
        this.unitdisk = new this.args.geometry.decorator({
            parent:             udparent,
            className:          'unitDisc',
            position:           'translate(500,500) scale(480)',
            hypertree:          this,
        },  
        {
            data:               null, //this.data,
            decorator:          null,       
            transformation:     this.args.geometry.transformation,
            transform:          (n:N)=> this.unitdisk.args.transformation.transformPoint(n.layout.z),
            layers:             this.args.geometry.layers,
            layerOptions:       this.args.geometry.layerOptions,
            cacheUpdate:        this.args.geometry.cacheUpdate,            
            clipRadius:         this.args.geometry.clipRadius,
            nodeRadius:         this.args.geometry.nodeRadius,
            nodeScale:          this.args.geometry.nodeScale,            
            nodeFilter:         this.args.geometry.nodeFilter,
            linkWidth:          this.args.geometry.linkWidth,
            linkCurvature:      this.args.geometry.linkCurvature,
            offsetEmoji:        this.args.geometry.offsetLabels,
            offsetLabels:       this.args.geometry.offsetLabels,
            captionBackground:  this.args.geometry.captionBackground,
            captionFont:        this.args.geometry.captionFont,   
            captionHeight:      this.args.geometry.captionHeight,
        })
    }

    //########################################################################################################
    //##
    //## Sync blocks for async api functions
    //##
    //########################################################################################################

    protected resetData() {        
        console.log("_resetData")
        this.view_.html.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined
        this.data = undefined 
        this.langMap = undefined
        
        this.args.geometry.transformation.state.λ = .001
        this.args.geometry.transformation.state.P.re = 0
        this.args.geometry.transformation.state.P.im = 0        
        this.args.filter.weightFilter.magic = 20
        this.args.geometry.transformation.cache.centerNode = undefined
        //this.args.geometry.transformation.cache.hoverNode = undefined

        this.args.objects.selections = []
        this.args.objects.pathes = []
        this.args.objects.traces = []
        
        requestAnimationFrame(()=> this.update.data())
    }

    protected initData(d3h, t0, t1, dl) {
        console.log("_initData")
        var t2 = performance.now()
        var ncount = 1
        globelhtid++
        this.data = <N & d3.HierarchyNode<N>>d3
            .hierarchy(d3h)
            .each((n:any)=> {
                n.globelhtid = globelhtid
                n.mergeId = ncount++
                n.data = n.data || {}
                n.precalc = {}
                n.pathes = {}
                n.layout = null
                n.layoutReference = null
            })        
        this.unitdisk.args.data = this.data
        this.args.geometry.transformation.cache.N = this.data.descendants().length

        // layout initiialisation
        const startAngle    = this.args.layout.rootWedge.orientation
        const defAngleWidth = this.args.layout.rootWedge.angle
        this.data.layout = {
            wedge: {
                α: πify(startAngle - defAngleWidth/2),
                Ω: πify(startAngle + defAngleWidth/2)
            }
        }
        setZ(this.data, { re:0, im:0 })

        // PRECALC:
        var t3 = performance.now()
        this.updateWeights_()

        // cells können true initialisert werden        
        this.data.each(n=> n.precalc.clickable = true) 
        // dataInitBFS:
        // - emoji*
        // - img*
        this.data.each(n=> this.args.dataInitBFS(this, n))        
        this.modelMeta = { 
            Δ: [t1-t0, t2-t1, t3-t2, performance.now()-t3], 
            filesize: dl,
            nodecount: ncount-1
        }
        // von rest trennen, da lang alleine benötigt wird
        // langInitBFS:
        // - lang
        // - wiki*
        // - labellen automatisch
        // - clickable=selectable*
        // - cell* default = clickable? oder true?
        this.updateLang_()
        
        // hmm, wird niergens mitgemessen :(
        this.findInitλ_()
        
        this.view_.html.querySelector('.preloader').innerHTML = ''        
    }

    protected updateWeights_() : void {
        console.log("_updateWeights")        
        // sum dinger
        this.sum(this.data, this.args.layout.weight, 'layoutWeight')
        this.sum(this.data, this.args.filter.weightFilter.weight, 'cullingWeight')
        this.sum(this.data, this.args.layout.weight, 'visWeight')
        //this.sum(this.data, this.args.geometry.weight[0], (n, s)=> n.visprop[0] = s)

        // node dinger
        // for arc width and node radius in some cases, not flexible enough
        this.data.each(n=> n.precalc.weightScale = (Math.log2(n.precalc.visWeight) || 1) 
            / (Math.log2(this.data.precalc.visWeight || this.data.children.length) || 1))
    }

    private sum(data, value, target) {
        data.eachAfter(node=> {
            let sum = +value(node) || 0
            const children = node.children
            var i = children && children.length
            while (--i >= 0) sum += children[i].precalc[target]
            node.precalc[target] = sum            
        })
    }

    protected updateLang_(dl=0) : void {
        console.log("_updateLang")
        const t0 = performance.now()

        if (this.data) {
            this.data.each(n=> this.args.langInitBFS(this, n))
            this.updateLabelLen_()
        }

        if (dl || !this.langMeta) this.langMeta = {
            Δ: [performance.now()-t0], 
            map:this.langMap, 
            filesize:dl 
        }        
    }

    protected findInitλ_() : void {
        console.groupCollapsed('_findInitλ')

        for (let i=0; i<50; i++)
        {
            const progress01 = i/50            
            const λ = .02 + sigmoid(progress01) * .75
            //console.log('#'+progress01, λ)
            this.args.geometry.transformation.state.λ = λ
            this.updateLayoutPath_(this.data)
            this.unitdisk.args.cacheUpdate(this.unitdisk, this.unitdisk.cache)
            const unculledNodes = this.args.geometry.transformation.cache.unculledNodes
            const maxR = unculledNodes.reduce((max, n)=> Math.max(max, n.layout.zp.r), 0)           
                
            if (maxR > (this.args.layout.initSize || .95)) {
                console.info('MaxR at abort', maxR)
                break
            }
        }
        this.data.each((n:N)=> n.layoutReference = clone(n.layout))                
        
        console.groupEnd()
        console.info('auto λ = ', this.args.geometry.transformation.state.λ)
    }

    //########################################################################################################
    //##
    //## internal functions, calles by ...?
    //##
    //########################################################################################################

    private virtualCanvas = undefined
    private virtualCanvasContext = undefined
    protected updateLabelLen_() : void {
        console.log("_updateLabelLen")
        var canvas = this.virtualCanvas 
            || (this.virtualCanvas = document.createElement("canvas"))
        var context = this.virtualCanvasContext 
            || (this.virtualCanvasContext = canvas.getContext("2d"))
        context.font = this.args.geometry.captionFont
        //context.textBaseLine = 'middle'
        //context.textAlign = 'center' 

        const updateLabelLen_ = (txtprop, lenprop)=>
        {
            this.data.each(n=> {
                if (n.precalc[txtprop]) {
                    const metrics = context.measureText(n.precalc[txtprop])
                    n.precalc[lenprop] = metrics.width/200/window.devicePixelRatio
                }
                else
                    n.precalc[lenprop] = undefined 
            })    
        }
        updateLabelLen_('label', 'labellen')
        updateLabelLen_('label2', 'label2len')
        /*
        this.data.each(n=> {
            if (n.precalc.label) {
                const metrics = context.measureText(n.precalc.label)
                n.precalc.labellen = metrics.width/200/window.devicePixelRatio
            }
            else
                n.precalc.labellen = 0 
        })

        this.data.each(n=> {
            if (n.precalc.label2) {
                const metrics = context.measureText(n.precalc.label2)
                n.precalc.label2len = metrics.width/200/window.devicePixelRatio
            }
            else
                n.precalc.label2len = undefined 
        })*/
    }

    public updateLayoutPath_(preservingnode:N) : void {
        const t = this.args.geometry.transformation
        //console.log("_updateLayoutPath_", t.state.λ)        
        console.assert(preservingnode)
        const t0 = performance.now()        

        preservingnode.ancestors().reverse().forEach(n=> this.args.layout.type(n, t.state.λ, true))
        t.state.P = CmulR(preservingnode.layout.z, -1) // set preserving node back to .... zero? no, orig pos?

        this.layoutMeta = { Δ: performance.now()-t0 }
    }    

    //########################################################################################################
    //##
    //## Path
    //##
    //########################################################################################################
           
    protected btnPathId = (pathType:string, n:N)=> `btn-path-${pathType}` + (pathType === 'SelectionPath' ? `-${n.mergeId}` : '')
    protected addIfNotInSafe<ArrET>(arr:ArrET[], newE:ArrET, side='unshift') : ArrET[] {
        if (!arr) return [newE]        
        if (!arr.includes(newE)) arr[side](newE)
        return arr
    }

    protected toggleSelection(n:N) {
        if (this.args.objects.selections.includes(n)) 
        {
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
    protected setPathHead(path:Path, n:N) {
        const pt = path ? path.type : 'HoverPath'

        const oldPathId = this.btnPathId(pt, n)
        const oldPath = this.args.objects.pathes.find(e=> e.id === oldPathId)

        if (oldPath)
            this.removePath(pt, oldPath.head)
        if (n)
            this.addPath(pt, n)
    }

    protected addPath(pathType:string, n:N) {
        const plidx = stringhash(n.precalc.label)
        const color = ({
            'HoverPath': 'none', 
            'Query': googlePalette(15) 
        })[pathType] || googlePalette(plidx) || googlePalette(1) 

        const newpath:Path = {
            type:      pathType,
            id:        this.btnPathId(pathType, n),
            icon:      ({ 'HoverPath':'mouse' })[pathType] || 'place',
            head:      n,
            headName:  n.precalc.label,
            ancestors: n.ancestors(),            
            color:     color,
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
        return newpath
    }

    protected removePath(pathType:string, n:N) {
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
    }

    //########################################################################################################
    //##
    //## Animation frames ans animations
    //##
    //########################################################################################################

    public drawDetailFrame()
    {        
        this.update.data()
    }

    public animateUp(ok, err) : void {
        const newλ = this.args.geometry.transformation.state.λ 
        this.args.geometry.transformation.state.λ = .001
        this.animateToλ(ok, err, newλ)
    }

    public animateToλ(ok, err, newλ) : void {
        const initλ = this.args.geometry.transformation.state.λ
        const way = initλ - newλ
        new Animation({
            name: 'animateToλ',
            hypertree: this,
            duration: 750,            
            resolve: ok,
            reject: err,
            frame: (progress01)=> {
                const waydone01 = 1-sigmoid(progress01)
                console.assert(waydone01 >= 0 && waydone01 <= 1)
                const waydone = way * waydone01
                const λ = newλ + waydone
                this.args.geometry.transformation.state.λ = λ
                this.updateLayoutPath_(this.args.geometry.transformation.cache.centerNode)              
                this.update.transformation()
            }            
        })
    }
    
    public animateTo(resolve, reject, newP:C, newλ:number) : void {
        const initTS = clone(this.args.geometry.transformation.state)
        const way = CsubC(initTS.P, newP)
        new Animation({      
            name: 'animateTo',            
            resolve: resolve,
            reject: reject,
            hypertree: this,
            duration: 750,
            frame: (progress01)=> {
                const waydone01 = 1-sigmoid(progress01)
                console.assert(waydone01 >= 0 && waydone01 <= 1)
                const waydone = CmulR(way, waydone01)
                const animP = CaddC(newP, waydone)
                CassignC(this.args.geometry.transformation.state.P, animP)            
                this.update.transformation()
            }
        })
    }

    public isAnimationRunning() : boolean {
        const view = this.unitdisk && this.unitdisk.isDraging
        const nav = this.unitdisk && this.unitdisk.isDraging
        const lowdetail = this.transition?this.transition.lowdetail:false        
        return view || nav || lowdetail 
    }  
}

/*
class TransitionModel {
    public hypertree : Hypertree
    public type : 'animation' | 'interaction' | 'script'
    public frames : Frame[] = []
    public lowdetail = true
    public currentframe : Frame    
    public beginTime
    public endTime
}*/

export class Transition
{    
    public hypertree : Hypertree
    public type : 'animation' | 'interaction' | 'script'
    public frames : Frame[] = []
    public lowdetail = true
    public currentframe : Frame    
    public beginTime
    public endTime

    constructor(hypertree) 
    {
        this.hypertree = hypertree
    }

    protected begin()
    {
        this.beginTime = performance.now()
        
    }

    protected end()
    {
        this.currentframe = undefined
        this.hypertree.transition = undefined        
        console.groupEnd()
    }
}

export class Frame
{
    nr: number
    created: number
    begin: number
    end: number
    calculations: number
    uiupdate: number
    cachestats: {
        n,
        //countof culled, labels, cells whatnot
    }
    constructor(nr:number)
    {
        this.nr = nr
        this.created = performance.now()
    }
}

class Animation extends Transition
{
    resolve
    reject
    constructor(args)
    {
        super(args.hypertree)
        if (args.hypertree.transition) {            
            console.warn("Animaiion collision")
            return            
        }
        
        console.group('Transition: ' + args.name)
        args.hypertree.transition = this
        this.hypertree.log.push(this.hypertree.transition)
        
        const frame = ()=> 
        {
            //console.group("Frame")            
            
            this.currentframe = new Frame(0)
            this.frames.push(this.currentframe)

            const now = performance.now()   
            if (!this.beginTime) {
                this.begin()
                this.endTime = now + args.duration                
            }
            
            const done = now - this.beginTime
            const p01 = done / args.duration
            
            if (now > this.endTime) {
                args.frame(1)
                this.end()
                console.log('resolve by: time (maybe jump at end)')
                args.resolve()                
            }
            else {
                args.frame(p01)                
                requestAnimationFrame(()=> frame())                
            }
                             
            this.currentframe = undefined
            //console.groupEnd()
            console.debug('frame end', )
        }

        requestAnimationFrame(()=> frame())
    }
}

