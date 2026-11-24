import * as d3                 from 'd3'
import { HTML }                from '../../ducd'
import { clone, stringhash }   from '../../ducd'
import { googlePalette }       from '../../ducd'
import { HypertreeArgs }       from '../../models/hypertree/model'
import { N }                   from '../../models/n/n'
import { Path }                from '../../models/path/path'
import { setZ }                from '../../models/n/n-layouts'
import { dfsFlat, πify }       from '../../models/transformation/hyperbolic-math'
import { C }                   from '../../models/transformation/hyperbolic-math'
import { CassignC }            from '../../models/transformation/hyperbolic-math'
import { CaddC, CsubC, CmulR } from '../../models/transformation/hyperbolic-math'
import { sigmoid, sigmoid01 }  from '../../models/transformation/hyperbolic-math'
import { IUnitDisk }           from '../unitdisk/unitdisk'
import { presets }             from '../../models/hypertree/preset-base'
import { settleMagic }         from '../../models/hypertree/magic-filter'
import { applyDocumentedOptions } from '../../models/hypertree/model-compat'
import { balanceChildren }     from '../../models/n/children-order'
import { overview, OverviewOptions, OverviewView } from '../../models/hypertree/overview'
import { mergeDeep }           from '../../ducd'

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
        this.view_ = view        
        this.initPromise = this.api.setModel(args)
    }
 
    /*
    * this functions modyfy model/view (this class internal state)
    * and call the according update function(s)
    */    
    public api = {
        setModel: (model: HypertreeArgs)=> new Promise<void>((ok, err)=> {            
            this.isInitializing = true
            const base = presets.modelBase()
            if (model && model.filter && model.filter.weightFilter && model.filter.weightFilter.magic !== undefined)
                console.warn('d3-hypertree: filter.weightFilter.magic is set internally and ignored; '
                           + 'configure the number of visible nodes with filter.weightFilter.rangeNodes')

            // documented option names (deprecated aliases, addLayer/removeLayer, langmap, ...)
            const compat = applyDocumentedOptions(model)
            this.args = mergeDeep(base, compat.model)
            if (compat.weightFilterNull)
                this.args.filter.weightFilter = null   // no weight culling

            // wenn parent updatedated hat wraum ist da nich eine alte transformations in der disk            
            this.update.view.parent()
            this.api.setDataloader(ok, err, this.args.dataloader) // resetData is hier drin 🤔 
            this.api.setLangloader(ok, err, this.args.langloader)
        }),
        setLangloader: (ok, err, ll)=> { 
            this.args.langloader = ll

            this.args.langloader((langMap, t1, dl)=> {
                this.langMap = langMap || {}
                this.updateLang_(dl)                
                this.update.data()
                
                if (this.data) { this.isInitializing=false;  ok() }
            })
        },
        setDataloader: (ok, err, dl)=> {            
            this.args.dataloader = dl
            const t0 = performance.now()
            this.resetData()
            
            this.args.dataloader((d3h, t1, dl)=> {
                // no data (e.g. the file could not be loaded; the loader reported why):
                // initPromise fails instead of a TypeError deep in the initialization
                if (!d3h) {
                    this.isInitializing = false
                    err(new Error('d3-hypertree: the dataloader delivered no data'))
                    return
                }
                this.initData(d3h, t0, t1, dl)

                // If the language map arrived first (the default langloader is
                // synchronous), its callback found no data and didn't render;
                // render now. Without this, asynchronously loaded data (CSV,
                // SKOS, TreeML files) stayed invisible until the next interaction.
                if (this.langMap) { this.update.data(); this.isInitializing=false;  ok() }
            })
        },
        // Selection goes through the strategy interaction.selection ('none', 'single',
        // 'multi' with interaction.maxSelections); it keeps objects.selections and the
        // node state n.selected in sync and fires onNodeSelect for every change.
        toggleSelection: (n:N)=> this.select_(n, !this.args.objects.selections.includes(n)),
        select:          (n:N)=> this.select_(n, true),
        deselect:        (n:N)=> this.select_(n, false),
        clearSelection:  ()=> {
            for (const s of [...this.args.objects.selections]) this.setSelected_(s, false)
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
        gotoλ:    (l)=>    new Promise((ok, err)=> this.animateToλ(ok, err, l)),
        /**
         * A view with a good overview of the tree structure: { P, λ } with the root
         * at the bottom, the main branchings in the middle, the branches filling the
         * disk (models/hypertree/overview.ts). Only computes; the view stays.
         */
        overview: (o?:OverviewOptions) : OverviewView=> {
            const state = this.args.geometry.transformation.state
            const v = overview(this.data, (n, λ)=> this.args.layout.type(n, λ), this.args.layout.rootWedge.orientation,
                state.λ, this.args.interaction.λbounds, o)
            this.args.layout.type(this.data, state.λ)          // the layout of the current view again
            return v
        },
        /** Animates to api.overview(). */
        gotoOverview: (o?:OverviewOptions)=> {
            const v = this.api.overview(o)
            return new Promise((ok, err)=> this.animateTo(ok, err, v.P, v.λ))
        }
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
        this.view_.parent.innerHTML = '' // actually just remove this.view if present ... do less
        this.view_.html = HTML.parse<HTMLElement>(hypertreehtml)()
        this.view_.parent.appendChild(this.view_.html)
       
        this.updateUnitdiskView()
    }

    // The view: a square for the disk; for the half-plane (geometry.halfPlane) a
    // rectangle with the aspect ratio of the parent element, kept on resize. The view
    // coordinates stay: y from about −1 to 1, x as wide as the rectangle.
    private viewPosition() : string {
        const svg = this.view_.html.querySelector('.unitdisk-nav > svg')
        if (!this.args.geometry.halfPlane) {
            svg.setAttribute('viewBox', '0 0 1000 1000')
            return 'translate(500,500) scale(480)'
        }
        const r = this.view_.parent.getBoundingClientRect()
        const aspect = r.width > 0 && r.height > 0 ? r.width / r.height : 1.6
        const w = Math.round(1000 * aspect)
        svg.setAttribute('viewBox', `0 0 ${w} 1000`)
        if (!this.onResize) {
            this.onResize = ()=> {
                if (!this.args.geometry.halfPlane || !this.view_.html) return
                const p = this.viewPosition()
                const g = this.view_.html.querySelector('.unitdisk-nav > svg > .unitDisc')
                if (g) g.setAttribute('transform', p)
            }
            window.addEventListener('resize', this.onResize)
        }
        return `translate(${w / 2},500) scale(480)`
    }
    private onResize : ()=> void = null

    protected updateUnitdiskView()
    {
        var udparent = this.view_.html.querySelector('.unitdisk-nav > svg')
        udparent.innerHTML = bubbleSvgDef
        this.unitdisk = new this.args.geometry.decorator({
            parent:             udparent,
            className:          'unitDisc',
            position:           this.viewPosition(),
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
        this.view_.html.querySelector('.preloader').innerHTML = htmlpreloader
        this.unitdisk.args.data = undefined
        this.data = undefined 
        this.langMap = undefined
        
        this.args.geometry.transformation.state.λ = .001
        this.args.geometry.transformation.state.P.re = 0
        this.args.geometry.transformation.state.P.im = 0        
        if (this.args.filter.weightFilter) this.args.filter.weightFilter.magic = 20
        this.args.geometry.transformation.cache.centerNode = undefined

        this.args.objects.selections = []
        this.args.objects.pathes = []
        this.args.objects.traces = []
        
        requestAnimationFrame(()=> this.update.data())
    }

    protected initData(d3h, t0, t1, dl) {
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
        // layout.childOrder 'balanced': after dataInitBFS (which may reorder children)
        if (this.args.layout.childOrder === 'balanced')
            balanceChildren(this.data)
        // iconmap: an emoji per node name (or id), applied once
        const iconmap = this.args.iconmap
        if (iconmap) this.data.each(n=> {
            const icon = iconmap[n.data.name] !== undefined ? iconmap[n.data.name] : iconmap[n.data.id]
            if (icon !== undefined) n.precalc.icon = icon
        })
        this.modelMeta = { 
            Δ: [t1-t0, t2-t1, t3-t2, performance.now()-t3], 
            filesize: dl,
            nodecount: ncount-1
        }
        // von rest trennen, da lang alleine benötigt wird
        // langInitBFS:
        // - lang
        // - wiki*
        // - labelslen automatisch
        // - clickable=selectable*
        // - cell* default = clickable? oder true?
        this.updateLang_()
        
        // hmm, wird niergens mitgemessen :(
        this.applyMinFill_()
        this.findInitλ_()
        
        this.view_.html.querySelector('.preloader').innerHTML = ''        
    }

    protected updateWeights_() : void {
        // sum dinger
        this.sum(this.data, this.args.layout.weight, 'layoutWeight')
        // without a weight filter every node weighs 1 (used for label sizes, not culling)
        this.sum(this.data, this.args.filter.weightFilter ? this.args.filter.weightFilter.weight : (n=> 1), 'cullingWeight')
        this.sum(this.data, this.args.layout.weight, 'visWeight')

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

    /**
     * interaction.minFill: the lower λ bound at which the visible tree, with the root in
     * the middle, still reaches minFill of the disk radius (its farthest visible node:
     * the filter decides what is visible at that zoom, as in findInitλ_; the radius
     * grows with λ, so a bisection). Zooming out further would leave the tree a small
     * spot in the middle. A tree that never reaches it gets λbounds[1].
     */
    protected applyMinFill_() : void {
        if (!this.data) return
        // interaction.maxLinkLength: the upper bound. In layoutBergé a link whose parent
        // is in the middle is λ long (a normal link; leaves among many siblings get an
        // extra length L, staggered outward, and are not the measure: bounding those
        // made the normal links a third as long), so λ = maxLinkLength
        const maxLink = this.args.interaction.maxLinkLength
        if (maxLink)
            this.args.interaction.λbounds = [this.args.interaction.λbounds[0], maxLink]
        const fill = this.args.interaction.minFill
        if (!fill) {
            const [lo, hi] = this.args.interaction.λbounds
            if (lo > hi) this.args.interaction.λbounds = [hi, hi]
            return
        }
        const max = this.args.interaction.λbounds[1]
        const λstart = this.args.geometry.transformation.state.λ
        const reach = (λ:number)=> {
            this.args.geometry.transformation.state.λ = λ
            this.updateLayoutPath_(this.data)
            this.unitdisk.args.cacheUpdate(this.unitdisk, this.unitdisk.cache)
            const visible = this.args.geometry.transformation.cache.unculledNodes || []
            return visible.reduce((m, n)=> Math.max(m, n.layout && n.layout.zp ? n.layout.zp.r : 0), 0)
        }
        let λ = max
        if (reach(max) > fill) {
            let lo = 1e-5, hi = max
            for (let i = 0; i < 40; i++) {
                const mid = Math.sqrt(lo * hi)
                if (reach(mid) >= fill) hi = mid; else lo = mid
            }
            λ = hi
        }
        // a new array: λbounds may be shared with a preset
        this.args.interaction.λbounds = [λ, max]
        this.args.geometry.transformation.state.λ = λstart
        this.updateLayoutPath_(this.data)
    }

    protected findInitλ_() : void {
        // the largest λ (zoom) at which the outermost visible node stays within
        // layout.initSize of the disk radius
        const initSize = this.args.layout.initSize || .95
        const maxRAt = (λ:number)=> {
            this.args.geometry.transformation.state.λ = λ
            this.updateLayoutPath_(this.data)
            this.unitdisk.args.cacheUpdate(this.unitdisk, this.unitdisk.cache)
            const unculledNodes = this.args.geometry.transformation.cache.unculledNodes
            return unculledNodes.reduce((max, n)=> Math.max(max, n.layout.zp.r), 0)
        }
        let fitting:number = undefined, tooLarge:number = undefined
        for (let i=0; i<50; i++) {
            const λ = .02 + sigmoid(i/50) * .75
            if (maxRAt(λ) > initSize) { tooLarge = λ; break }
            fitting = λ
        }
        // the coarse steps used to stop at the first λ beyond initSize: refine
        // between the last fitting and the first too large step (bisection)
        if (fitting !== undefined && tooLarge !== undefined) {
            let lo = fitting, hi = tooLarge
            for (let i=0; i<12; i++) {
                const mid = (lo + hi) / 2
                if (maxRAt(mid) <= initSize) lo = mid; else hi = mid
            }
            maxRAt(lo)
        }
        // the start zoom obeys interaction.λbounds like every other zoom
        const fitλ = this.args.geometry.transformation.state.λ
        const startλ = this.clampλ(fitλ)
        if (startλ !== fitλ) {
            this.args.geometry.transformation.state.λ = startλ
            this.updateLayoutPath_(this.data)
            this.unitdisk.args.cacheUpdate(this.unitdisk, this.unitdisk.cache)
        }
        // geometry.startPosition: initial translation (documented as filter.transformation.P)
        const start = this.args.geometry.startPosition
        if (start) {
            this.args.geometry.transformation.state.P = { re: start.re, im: start.im }
            this.unitdisk.args.cacheUpdate(this.unitdisk, this.unitdisk.cache)
        }
        // the filter's magic settles now, so the first frame shows the final visible set
        if (this.args.filter.weightFilter)
            settleMagic(this.unitdisk, this.unitdisk.cache)
        this.data.each((n:N)=> n.layoutReference = clone(n.layout))

    }

    //########################################################################################################
    //##
    //## internal functions, calles by ...?
    //##
    //########################################################################################################

    private virtualCanvas = undefined
    private virtualCanvasContext = undefined
    private waitingForFonts = false

    /**
     * The canvas font and the factor from canvas pixels to the units of the SVG labels,
     * from a caption measured in this tree's SVG: the font the labels are drawn with
     * (family, weight and size from the CSS, e.g. the larger :lang(zh) size), so the
     * widths fit for every language and screen scaling. Until v1 the widths came from
     * geometry.captionFont divided by devicePixelRatio: too narrow on scaled screens
     * (125 %, 150 %) and with the CSS weight 300 vs 400, so label backgrounds were too
     * small for their text.
     */
    private captionMetrics(context:CanvasRenderingContext2D) : { font:string, factor:number, probe:string } | null {
        const html = this.view_ && this.view_.html
        const svg = html && (html.querySelector('.unitdisk-nav svg') || html.querySelector('svg'))
        if (!svg) return null
        const sample = 'Hyperbolic Tree of Life 0123456789'
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('class', 'caption')
        text.textContent = sample
        const parent = svg.querySelector('.unitDisc') || svg
        parent.appendChild(text)
        let width = 0, cs:CSSStyleDeclaration
        try { width = text.getBBox().width; cs = getComputedStyle(text) } catch (e) { width = 0 }
        parent.removeChild(text)
        if (!width || !cs) return null
        const font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`
        context.font = font
        const canvasWidth = context.measureText(sample).width
        return canvasWidth ? { font, factor: width / canvasWidth, probe: `${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}` } : null
    }

    protected updateLabelLen_() : void {
        var canvas = this.virtualCanvas
            || (this.virtualCanvas = document.createElement("canvas"))
        var context = this.virtualCanvasContext
            || (this.virtualCanvasContext = canvas.getContext("2d"))
        const metrics = this.captionMetrics(context)
        // no SVG yet: the geometry font, calibrated by hand for a screen without scaling
        const font = metrics ? metrics.font : this.args.geometry.captionFont
        const factor = metrics ? metrics.factor : 1/200
        context.font = font
        // the web font (e.g. Roboto) not loaded yet: measured with a fallback; loaded now
        // (the canvas does not request it, the SVG text may not have yet) and measured
        // again when it is there. Before, a page measured with Roboto or the fallback,
        // depending on the cache, and the labels sat a few pixels apart.
        const fonts = document.fonts
        if (metrics && fonts && !this.waitingForFonts) {
            let missing = false
            try { missing = !fonts.check(metrics.probe) } catch (e) { missing = false }
            if (missing) {
                this.waitingForFonts = true
                fonts.load(metrics.probe).catch(()=> {}).then(()=> {
                    this.waitingForFonts = false
                    if (!this.data) return
                    let still = false
                    try { still = !fonts.check(metrics.probe) } catch (e) {}
                    if (still) return                  // not available: the fallback stays
                    this.updateLabelLen_()
                    this.update.data()
                })
            }
        }

        const updateLabelLen_ = (txtprop, lenprop)=>
        {
            this.data.each(n=> {
                if (n.precalc[txtprop]) {
                    // multi-line labels ('\n'): the width of the longest line
                    const lines = String(n.precalc[txtprop]).split('\n')
                    const width = Math.max(...lines.map(l=> context.measureText(l).width))
                    n.precalc[lenprop] = width * factor
                    console.assert(typeof n.precalc[lenprop] === 'number')
                }
                else
                    n.precalc[lenprop] = undefined
            })
        }
        updateLabelLen_('label', 'labels-forcelen')
        updateLabelLen_('label', 'labelslen')
        updateLabelLen_('label', 'labels-placedlen')
        updateLabelLen_('icon', 'emojislen')
    }

    public updateLayoutPath_(preservingnode:N) : void {
        const t = this.args.geometry.transformation
        console.assert(!!preservingnode)
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
        this.setSelected_(n, !this.args.objects.selections.includes(n))
    }

    /** Selects or deselects n according to interaction.selection, then redraws. */
    protected select_(n:N, selected:boolean) {
        const mode = this.args.interaction.selection || 'multi'
        if (!n || mode === 'none') return
        if (selected === this.args.objects.selections.includes(n)) return
        if (selected) {
            if (mode === 'single')
                for (const s of [...this.args.objects.selections]) this.setSelected_(s, false)
            this.setSelected_(n, true)
            const max = this.args.interaction.maxSelections || 10
            while (mode === 'multi' && this.args.objects.selections.length > max)
                this.setSelected_(this.args.objects.selections[0], false)   // the oldest
        }
        else
            this.setSelected_(n, false)
        this.update.pathes()
    }

    /** The single place that changes the selection state of a node. */
    protected setSelected_(n:N, selected:boolean) {
        const selections = this.args.objects.selections
        if (selected === selections.includes(n)) return
        if (selected) {
            selections.push(n)
            this.addPath('SelectionPath', n)
        }
        else {
            this.args.objects.selections = selections.filter(e=> e !== n)
            this.removePath('SelectionPath', n)
        }
        n.selected = selected
        if (this.args.interaction.onNodeSelect)
            this.args.interaction.onNodeSelect(n, selected)
    }

    // es kann nur einen pro id geben, gibt es bereits einen wird dieser entfernt 
    // (praktisch für hover)
    protected setPathHead(path:Path, n:N) {
        const pt = path ? path.type : 'HoverPath'

        const oldPathId = this.btnPathId(pt, n)
        const oldPath = this.args.objects.pathes.find(e=> e.id === oldPathId)

        if (oldPath) {
            this.removePath(pt, oldPath.head)
            if (pt === 'HoverPath') oldPath.head.hovered = false
        }
        if (n) {
            this.addPath(pt, n)
            if (pt === 'HoverPath') n.hovered = true
        }
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

    /** λ limited to interaction.λbounds [min, max] (inclusive). */
    public clampλ(λ:number) : number {
        const [min, max] = this.args.interaction.λbounds
        return Math.min(max, Math.max(min, λ))
    }

    public animateToλ(ok, err, newλ) : void {
        newλ = this.clampλ(newλ)
        const initλ = this.args.geometry.transformation.state.λ
        const way = initλ - newλ
        new Animation({
            name: 'animateToλ',
            hypertree: this,
            duration: 750,            
            resolve: ok,
            reject: err,
            frame: (progress01)=> {
                const waydone01 = 1-sigmoid01(progress01)
                console.assert(waydone01 >= 0 && waydone01 <= 1)
                const waydone = way * waydone01
                const λ = newλ + waydone
                this.args.geometry.transformation.state.λ = λ
                this.updateLayoutPath_(this.args.geometry.transformation.cache.centerNode)              
                this.update.transformation()
            }            
        })
    }
    
    /** Animates the translation to newP and, if newλ is given, the zoom to newλ. */
    public animateTo(resolve, reject, newP:C, newλ:number) : void {
        const state = this.args.geometry.transformation.state
        const initTS = clone(state)
        const way = CsubC(initTS.P, newP)
        const zoom = newλ !== null && newλ !== undefined
        const targetλ = zoom ? this.clampλ(newλ) : undefined
        const wayλ = zoom ? initTS.λ - targetλ : 0
        new Animation({
            name: 'animateTo',
            resolve: resolve,
            reject: reject,
            hypertree: this,
            duration: 750,
            frame: (progress01)=> {
                const waydone01 = 1-sigmoid01(progress01)
                console.assert(waydone01 >= 0 && waydone01 <= 1)
                if (zoom) {
                    // as animateToλ: the layout depends on λ. updateLayoutPath_ also
                    // recenters the center node, so the translation is set afterwards.
                    state.λ = targetλ + wayλ * waydone01
                    this.updateLayoutPath_(this.args.geometry.transformation.cache.centerNode)
                }
                const waydone = CmulR(way, waydone01)
                const animP = CaddC(newP, waydone)
                state.P = { re: state.P.re, im: state.P.im }   // updateLayoutPath_ may have replaced it
                CassignC(state.P, animP)
                this.update.transformation()
            }
        })
    }

    /**
     * Stops a running animation (goto, gotoλ, ...) where it is. Called when a drag,
     * pinch or wheel starts: an animation that kept running fought with the drag, both
     * set the translation, and the tree jumped between both states on every frame
     * (flickering branches; e.g. dragging right after a click that started a goto).
     */
    public stopAnimation() : void {
        if (this.transition) {
            this.transition.cancel()
            this.transition = undefined
        }
    }

    public isAnimationRunning() : boolean {
        const view = this.unitdisk && this.unitdisk.isDraging
        const nav = this.unitdisk && this.unitdisk.isDraging
        const wheel = this.unitdisk && this.unitdisk.isWheeling
        const lowdetail = this.transition?this.transition.lowdetail:false        
        return view || nav || wheel || lowdetail 
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
        if (this.hypertree.transition === this)   // not a newer one started after a cancel
            this.hypertree.transition = undefined
    }

    // stops the animation at its current state (its next frame ends it, resolved)
    public cancelled = false
    public cancel() { this.cancelled = true }
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
            console.warn("d3-hypertree: an animation is already running, the new one is ignored")
            return            
        }
        
        args.hypertree.transition = this
        this.hypertree.log.push(this.hypertree.transition)
        
        const frame = ()=> 
        {
            if (this.cancelled) {   // stopAnimation: a pointer took over
                this.end()
                args.resolve()
                return
            }
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
                args.resolve()                
            }
            else {
                args.frame(p01)                
                requestAnimationFrame(()=> frame())                
            }
                             
            this.currentframe = undefined
            //console.groupEnd()
        }

        requestAnimationFrame(()=> frame())
    }
}

