import * as d3                 from 'd3'
import { HTML }                from './util/ducd'
import { clone }               from './util/ducd'
import { HypertreeArgs, ModelOverlay, Effect, effectOf } from './config/schema'
import { resolveModel, mergeInto, pathsOf, Provenance } from './config/resolve'
import { migrate }             from './config/migrate'
import { defaults }            from './config/presets'
import { Projection }          from './projection/projection'
import { createProjection }    from './projection'
import { N }                   from './data/n'
import { Path }                from './state/path'
import { computeWeights }      from './data/weights'
import { balanceChildren }     from './data/children-order'
import { setZ }                from './layout/layouts'
import { applyλBounds, findInitλ } from './layout/fit'
import { overview, OverviewOptions, OverviewView } from './layout/overview'
import { πify }                from './geometry/hyperbolic-math'
import { C }                   from './geometry/hyperbolic-math'
import { CassignC }            from './geometry/hyperbolic-math'
import { CaddC, CsubC, CmulR } from './geometry/hyperbolic-math'
import { sigmoid01 }           from './geometry/hyperbolic-math'
import { IUnitDisk, UnitDisk } from './view/unitdisk'
import { measureLabels }       from './layers/label-measure'
import { Animation, Transition } from './interaction/animation'
import * as selection          from './state/selection'

export { Transition, Frame } from './interaction/animation'

/** An overlay with the name it gets in the provenance (a preset, the application). */
export interface NamedOverlay { name:string, overlay:ModelOverlay }

let globelhtid = 0

const htmlpreloader = `
    <div class="spinner">
        <div class="double-bounce1"></div>
        <div class="double-bounce2"></div>
    </div>`

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

// the order of the effects of configure(): the strongest wins
const effectOrder : Effect[] = ['data', 'layout', 'labels', 'layers', 'frame', 'style', 'none']

/**
 * The hypertree: wires the stages (config, data, layout, filter, projection, layers,
 * interaction, animation) and exposes the api.
 *
 * Configuration: the model given to the constructor is an overlay over the defaults
 * (config/schema.ts); args is the resolved model, provenance says where each value
 * came from, configure() changes options at runtime.
 */
export class Hypertree
{
    args           : HypertreeArgs             // the resolved model
    provenance     : Provenance                // option path -> 'defaults' | 'app' (or the stack's names) | 'configure'
    projection     : Projection                // geometry.view
    data           : N
    langMap        : {}

    view_: {
        parent         : HTMLElement,
        html?          : HTMLElement,
    }

    unitdisk       : IUnitDisk
    transition     : Transition
    log            = []

    modelMeta
    langMeta
    layoutMeta

    initPromise : Promise<void>
    isInitializing = false

    lastCenterNode = undefined

    /**
     * @param args  the application's overlay over the defaults, or a stack of named
     *              overlays [{ name, overlay }] applied in order (the name goes into
     *              the provenance; e.g. presets and the application's own options)
     */
    constructor(view:{ parent:HTMLElement }, args:ModelOverlay | NamedOverlay[]) {
        this.view_ = view
        this.initPromise = this.api.setModel(args)
    }

    public api = {
        setModel: (model:ModelOverlay | NamedOverlay[])=> new Promise<void>((ok, err)=> {
            this.isInitializing = true
            const stack:NamedOverlay[] = Array.isArray(model) ? model : [{ name: 'app', overlay: model }]
            for (const { overlay } of stack)
                if (overlay && overlay.filter && overlay.filter.weightFilter && overlay.filter.weightFilter.magic !== undefined)
                    console.warn('d3-hypertree: filter.weightFilter.magic is set internally and ignored; '
                               + 'configure the number of visible nodes with filter.weightFilter.rangeNodes')

            // v1 option names (deprecated aliases, addLayer/removeLayer, langmap, ...),
            // then the defaults with the overlays
            const resolved = resolveModel(defaults(), stack.map(o=> ({ name: o.name, overlay: migrate(o.overlay) })))
            this.args = resolved.model
            this.provenance = resolved.provenance
            this.projection = createProjection(this.args.geometry.view, this.args.layout.rootWedge)

            this.update.view.parent()
            this.api.setDataloader(ok, err, this.args.dataloader)
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
        // the selection (state/selection.ts): interaction.selection decides
        toggleSelection: (n:N)=> selection.select(this, n, !this.args.objects.selections.includes(n)),
        select:          (n:N)=> selection.select(this, n, true),
        deselect:        (n:N)=> selection.select(this, n, false),
        clearSelection:  ()=> selection.clearSelection(this),
        setPathHead: (pathType:Path, n:N)=> {
            if (!this.isInitializing && !this.isAnimationRunning()) {
                selection.setPathHead(this, pathType, n)
                this.update.pathes()
            }
        },
        selectQuery: (query:string, prop?:string)=> selection.selectQuery(this, query),
        gotoHome: ()=>     new Promise((ok, err)=> this.animateTo(ok, err, { re:0, im:0 }, null)),
        gotoNode: (n:N)=>  new Promise((ok, err)=> this.animateTo(ok, err, CmulR({ re:n.layout.z.re, im:n.layout.z.im }, -1), null)),

        goto:     (p, l)=> new Promise((ok, err)=> this.animateTo(ok, err, p, l)),
        gotoλ:    (l)=>    new Promise((ok, err)=> this.animateToλ(ok, err, l)),
        /**
         * A view with a good overview of the tree structure: { P, λ } with the root
         * at the bottom, the main branchings in the middle, the branches filling the
         * disk (layout/overview.ts). Only computes; the view stays.
         */
        overview: (o?:OverviewOptions) : OverviewView=> {
            const state = this.args.geometry.transformation.state
            const v = overview(this.data, (n, λ)=> this.args.layout.type(n, λ), this.args.layout.rootWedge.orientation,
                state.λ, this.args.interaction.λbounds, o)
            this.args.layout.type(this.data, state.λ)          // the layout of the current view again
            v.P = this.projection.overviewClamp(v.P)            // the root in the picture
            return v
        },
        /** Animates to api.overview(). */
        gotoOverview: (o?:OverviewOptions)=> {
            const v = this.api.overview(o)
            return new Promise((ok, err)=> this.animateTo(ok, err, v.P, v.λ))
        }
    }

    /**
     * Changes options at runtime: the overlay is merged into the model (v1 names are
     * migrated) and what the changed options affect is updated (config/schema.ts
     * affects: the data, the layout, the label measures, the layer stack, a frame, the
     * styles). Returns the effect applied.
     */
    public configure(overlay:ModelOverlay) : Effect {
        const migrated = migrate(overlay)
        mergeInto(this.args, migrated, 'configure', this.provenance)
        const effects = pathsOf(migrated).map(effectOf)
        const effect = effectOrder.find(e=> effects.includes(e)) || 'none'
        this.applyEffect(effect)
        return effect
    }

    private applyEffect(effect:Effect) {
        if (!this.data) return                      // not loaded yet: read at initialization
        const state = this.args.geometry.transformation.state
        switch (effect) {
            case 'data':
                this.api.setDataloader(()=> {}, ()=> {}, this.args.dataloader)
                this.api.setLangloader(()=> {}, ()=> {}, this.args.langloader)
                break
            case 'layout':
                computeWeights(this.data, this.args)
                if (this.args.layout.childOrder === 'balanced') balanceChildren(this.data)
                this.args.layout.type(this.data, state.λ)
                this.update.data()
                break
            case 'labels':
                measureLabels(this)
                this.update.data()
                break
            case 'layers':
                this.projection = createProjection(this.args.geometry.view, this.args.layout.rootWedge)
                this.update.view.unitdisk()
                this.unitdisk.args.data = this.data
                this.update.data()
                break
            case 'frame':
                this.update.data()
                break
            case 'style':
                this.update.pathes()
                break
        }
    }

    // findInitλ runs (the weight filter takes plain steps, filter/culling.ts)
    public findingInitλ = false

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
    //## View
    //##
    //########################################################################################################

    protected updateParent()
    {
        this.view_.parent.innerHTML = ''
        this.view_.html = HTML.parse<HTMLElement>(hypertreehtml)()
        this.view_.parent.appendChild(this.view_.html)

        this.updateUnitdiskView()
    }

    // The view: the projection's viewBox for the drawn box (geometry.diskSize); a
    // projection that follows the size (the half-plane: the aspect ratio of the box)
    // is updated on resizes.
    private viewPosition() : string {
        const svg = this.view_.html.querySelector('.unitdisk-nav > svg')
        // the svg's own box (the parent element can be larger: other content in it)
        const s = svg.getBoundingClientRect(), p = this.view_.parent.getBoundingClientRect()
        const r = s.width > 0 && s.height > 0 ? s : p
        const v = this.projection.viewBox(r.width, r.height, this.args.geometry.diskSize)
        svg.setAttribute('viewBox', v.viewBox)
        if (this.projection.followsSize && !this.onResize) {
            this.onResize = ()=> {
                if (!this.projection.followsSize || !this.view_.html) return
                const p = this.viewPosition()
                const g = this.view_.html.querySelector('.unitdisk-nav > svg > .unitDisc')
                if (g) g.setAttribute('transform', p)
            }
            window.addEventListener('resize', this.onResize)
            // the element changes size without the window too (a splitter: the tree
            // next to the Wikipedia panel); the view kept the old aspect ratio and part
            // of the half-plane was outside it
            if (typeof ResizeObserver !== 'undefined') {
                const o = new ResizeObserver(()=> this.onResize())
                o.observe(this.view_.parent)
                o.observe(svg)                  // the box that is drawn (it can differ)
            }
        }
        return v.transform
    }
    private onResize : ()=> void = null

    protected updateUnitdiskView()
    {
        var udparent = this.view_.html.querySelector('.unitdisk-nav > svg')
        udparent.innerHTML = bubbleSvgDef
        this.unitdisk = new UnitDisk({
            parent:             udparent,
            className:          'unitDisc',
            position:           this.viewPosition(),
            hypertree:          this,
        },
        {
            data:               null,
            transformation:     this.args.geometry.transformation,
            transform:          (n:N)=> this.unitdisk.args.transformation.transformPoint(n.layout.z),
            model:              this.args,
            projection:         this.projection,
        })
    }

    //########################################################################################################
    //##
    //## Data
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

        // the root wedge (layout.rootWedge) and the root in the center
        const startAngle    = this.args.layout.rootWedge.orientation
        const defAngleWidth = this.args.layout.rootWedge.angle
        this.data.layout = {
            wedge: {
                α: πify(startAngle - defAngleWidth/2),
                Ω: πify(startAngle + defAngleWidth/2)
            }
        }
        setZ(this.data, { re:0, im:0 })

        var t3 = performance.now()
        computeWeights(this.data, this.args)

        this.data.each(n=> n.precalc.clickable = true)
        // dataInitBFS: emoji, imageHref, ...
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
        // langInitBFS (the labels) separately: the language can change alone
        this.updateLang_()

        applyλBounds(this)
        findInitλ(this)
        this.data.each((n:N)=> n.layoutReference = clone(n.layout))

        this.view_.html.querySelector('.preloader').innerHTML = ''
    }

    protected updateLang_(dl=0) : void {
        const t0 = performance.now()

        if (this.data) {
            this.data.each(n=> this.args.langInitBFS(this, n))
            measureLabels(this)
        }

        if (dl || !this.langMeta) this.langMeta = {
            Δ: [performance.now()-t0],
            map:this.langMap,
            filesize:dl
        }
    }

    /** Measures the labels again (layers/label-measure.ts), e.g. after a font change. */
    public updateLabelLen_() : void { measureLabels(this) }

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
    //## Animations (interaction/animation.ts)
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
            duration: this.args.interaction.animationDuration,
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
            duration: this.args.interaction.animationDuration,
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
        const wheel = this.unitdisk && this.unitdisk.isWheeling
        const lowdetail = this.transition?this.transition.lowdetail:false
        return view || wheel || lowdetail
    }
}
