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
            <stop offset="58%"  stop-color="rgb(255,255,255)" stop-opacity=".08"/>            
            <stop offset="92%"  stop-color="rgb( 96, 96, 96)" stop-opacity=".08"/>
            <stop offset="98%"  stop-color="rgb( 36, 36, 36)" stop-opacity=".08"/>
            <stop offset="100%" stop-color="rgb(  0,  0,  0)" stop-opacity=".08"/>
        </radialGradient>
    </defs>` 

const hypertreehtml =
    `<div class="unitdisk-nav">        
        <svg width="calc(100% - 3em)" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}
        </svg>
        <div class="preloader"></div>
    </div>`

function shuffleArray(array, n) {        
    if (array)
    for (let i = array.length - 1; i > 0; i--) {
        let r = (i * i + n.height) % array.length 
        //let r = Math.random()
        let j = Math.floor(r);
        [array[i], array[j]] = [array[j], array[i]];
    }
}

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
    animation      : boolean = false

    modelMeta
    langMeta
    layoutMeta
    
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
            this.args.dataloader((d3h, t1, dl)=> {
                this.initData(d3h, t0, t1, dl)
                this.animateUp()
            })
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
        gotoHome: ()=>    this.animateTo({ re:0, im:0 }, null), 
        gotoNode: (n:N)=> this.animateTo(CmulR({ re:n.layout.z.re, im:n.layout.z.im }, -1), null),
    }

    /*
    * this functions assume the model/view (this class internal state)
    * has changes, and call the according ui updates (animatin frames)
    */
    public update = {
        view: {
            parent:         ()=> this.updateParent(),
            unitdisk:       ()=> this.updateUnitdiskView(),            
        },        
        data:           ()=> requestAnimationFrame(()=> this.unitdisk.update.data()),        
        langloader:     ()=> requestAnimationFrame(()=> this.update.data()),        
        layout:         ()=> requestAnimationFrame(()=> this.unitdisk.update.transformation()),
        transformation: ()=> requestAnimationFrame(()=> this.unitdisk.update.transformation()),
        pathes:         ()=> requestAnimationFrame(()=> this.unitdisk.update.pathes())
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
       
        this.updateUnitdiskView()

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
            position:       'translate(500,520) scale(470)',
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

    //########################################################################################################
    //##
    //## Sync blocks for async api functions
    //##
    //########################################################################################################

    private resetData() {        
        this.view_.html.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined
        this.data = undefined 
        //if (this.view_.unitdisk && this.view_.unitdisk.cache)
        //    this.view_.unitdisk.cache.centerNode = undefined

        this.args.geometry.transformation.state.λ = .001
        this.args.geometry.transformation.state.P.re = 0
        this.args.geometry.transformation.state.P.im = 0        
        this.args.magic = 250
        this.args.geometry.transformation.cache.centerNode = undefined

        this.args.objects.selections = []
        this.args.objects.pathes = []
        
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
                n.data = n.data || {}
                n.precalc = {}
                n.layout = null
                n.layoutReference = null
                n.pathes = {}
                n.globelhtid = globelhtid
                shuffleArray(n.children, n) // get index
            })
            //.sum(this.args.weight) // this.updateWeights()

        const startAngle    = 3 * π / 2
        const defAngleWidth = 1.5 * π //* 1.999999999999
        const sad           = 2.0
        this.data.layout = {
            wedge: {
                α: πify(startAngle - defAngleWidth/sad),
                Ω: πify(startAngle + defAngleWidth/sad)
            }
        }
        setZ(this.data, { re:0, im:0 })

        this.view_.html.querySelector('.preloader').innerHTML = ''
        this.modelMeta = { Δ: [t1-t0, t2-t1, performance.now()-t2], filesize:dl }
        
        var t3 = performance.now()
        //this.updateLayout_() // all?
        //this.data = this.args.layout(this.data, this.args.geometry.transformation.state)
        this.unitdisk.args.data = this.data
        this.args.geometry.transformation.cache.N = this.data.descendants().length
        this.updateWeights_()
        this.updateLang_()
        this.updateImgHref_()        
        this.layoutMeta = { Δ: performance.now()-t3 }
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
        const color = ({
            'HoverPath':'none', 
            'Query':googlePalette(1) 
        })[pathType] || googlePalette(plidx) || 'red'

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
        
        if (pathType === 'Query') return     
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

        this.updateLabelLen_()
    }

    private virtualCanvas = undefined
    private virtualCanvasContext = undefined
    private updateLabelLen_() : void {
        var canvas = this.virtualCanvas 
            || (this.virtualCanvas = document.createElement("canvas"))
        var context = this.virtualCanvasContext 
            || (this.virtualCanvasContext = canvas.getContext("2d"))
        context.font = ".002em Roboto";
        console.log(window.devicePixelRatio)

        for (var n of dfsFlat(this.data, n=>true)) {
            if (n.precalc.txt2) {
                const metrics = context.measureText(n.precalc.txt2)
                n.precalc.labellen = metrics.width/200/window.devicePixelRatio
            }
            else
                n.precalc.labellen = 0 
        }
    }

    private updateImgHref_() : void {
        if (this.args.iconmap)
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

    public updateLayout_(preservingnode?:N) : void {
        //app.toast('Layout')
        const t0 = performance.now()        
        const t = this.args.geometry.transformation
        preservingnode = preservingnode || t.cache.centerNode

        if (preservingnode)
            preservingnode.ancestors().reverse().forEach(n=> {
                this.args.layout(n, this.args.geometry.transformation.state.λ, true)    
            })
        else
            this.args.layout(this.data, this.args.geometry.transformation.state.λ)
               
        if (preservingnode) 
            t.state.P = CmulR(preservingnode.layout.z, -1) 
        else
            console.warn('no layout compensation')
            
        this.layoutMeta = { Δ: performance.now()-t0 }
    }

    //########################################################################################################
    //##
    //## Animation frames ans animations
    //##
    //########################################################################################################

    private animateUp() : void {        
        this.animation = true
        var step = 0, steps = 25
        var frame = ()=>
        {
            const p = sigmoid(step++/steps)
            if (step > steps)
                this.animation = false
            
            else {                
                var λ = .02 + p * .7
                var animλ = λ
                this.args.geometry.transformation.state.λ = animλ                

                this.updateLayout_()
                
                const maxR = this.args.geometry.transformation.cache.unculledNodes                    
                    .reduce((max, n)=> Math.max(max, n.layout.zp.r), 0)
                
                if (maxR > (this.args.initMaxL || .85)) { // on abort                    
                    this.animation = false
                    this.data.each((n:N)=> n.layoutReference = clone(n.layout))                    
                }
                else {
                    requestAnimationFrame(()=> frame())
                }
                
                this.update.data()
            }
        }
        requestAnimationFrame(()=> frame())
    }

    private animateTo_old(newP:C, newλ) : void {
        if (this.animation) return
        
        this.animation = true
        const steps = 20
        let step = 1

        const initTS = clone(this.args.geometry.transformation.state)
        const way = CsubC(initTS.P, newP)        

        const frame = ()=> {                                                
            const waydone01 = step === steps ? 0 : 1-sigmoid(step/steps)
            const waydone = CmulR(way, waydone01)
            const animP = CaddC(newP, waydone)
            CassignC(this.args.geometry.transformation.state.P, animP)
            
            if (step++ >= steps) 
                this.animation = false                    
            else                 
                requestAnimationFrame(()=> frame())

            this.update.transformation()
        }
        requestAnimationFrame(()=> frame())
    }
 

    private animateTo(newP:C, newλ:number) : void {
        const initTS = clone(this.args.geometry.transformation.state)
        const way = CsubC(initTS.P, newP)
        new Animation({
            hypertree: this,
            duration: 1000,
            frame: (progress01)=> {
                const waydone01 = 1-sigmoid(progress01)
                const waydone = CmulR(way, waydone01)
                const animP = CaddC(newP, waydone)
                CassignC(this.args.geometry.transformation.state.P, animP)            
                this.update.transformation()
            },
            lastframe: ()=> {                
                const animP = newP
                CassignC(this.args.geometry.transformation.state.P, animP)            
                this.update.transformation()
            }
        })
    }

    public isAnimationRunning() : boolean {        
        var view = this.unitdisk 
               && this.unitdisk.args.transformation.isMoving()

        var nav = this.unitdisk
               && this.unitdisk.navParameter 
               && this.unitdisk.navParameter.args.transformation.isMoving()

        return view || nav || this.animation
    }  
}

class Transition
{
}

class Animation extends Transition
{    
    constructor(args)
    {
        super()
        if (args.hypertree.animation) 
            return
        
        args.hypertree.animation = true
        const steps = 20
        let step = 1

        const frame = ()=> {            
            if (step++ >= steps) {
                args.hypertree.animation = false
                args.frame(step/steps)                
            }
            else {
                args.lastframe()
                requestAnimationFrame(()=> frame())                
            }
        }
        requestAnimationFrame(()=> frame())        
    }
}