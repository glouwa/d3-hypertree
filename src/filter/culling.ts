import { N }                        from '../data/n'
import { IUnitDisk }                from '../view/unitdisk'
import { dfs2, dfsFlat2, dfsFlat }  from '../geometry/hyperbolic-math'
import { TransformationCache }      from '../geometry/transformation'
import { C, CptoCk, CktoCp, πify }  from '../geometry/hyperbolic-math'
import { CassignC }                 from '../geometry/hyperbolic-math'

import { doVoronoiStuff }           from './labels'
import { doLabelStuff }             from './labels'
import { doImageStuff }             from './labels'

// Bounds of the internal factor magic, only a safety net: magic must not grow without
// end for a tree that never reaches rangeNodes.min (or shrink to 0). Wide enough that
// rangeNodes alone decides the number of visible nodes (until v1 the option
// weightFilter.rangeCullingWeight, default 4..500, stopped it early).
const MAGIC_MIN = 1e-12
const MAGIC_MAX = 1e12
// the share of rangeNodes kept for the nodes magic decides on, however many the focus
// circle holds (adjustMagic)
const FOCUS_FLOOR = .25

// One step of magic per update (× or ÷ alpha) toward rangeNodes.
//
// Many nodes can share one weight: then a single step shows or hides all of them, and
// may jump over the whole range (below min -> above max). The next step went back, and
// the visible set flipped on every update (the Metatheria branch of the Tree of Life
// flickered). So a step that overshoots is remembered as a limit: the threshold it
// crossed (lastAt: nextShowAt / nextHideAt, see below), no step crosses it again (the
// magic it reached was the limit until steps could jump: a jump landed beside it and a
// plain step slipped past, Mammalia stayed at 1303 of 750..1000); the filter then
// stays at the state below the range: fewer nodes rather than too many. The limits hold while the view stays comparable: while the
// number of visible nodes in the state where the filter stopped changes by less than
// 10 % (stoppedAt: the count when it stopped, kept while it stays stopped), and each
// limit only while the count and λ are within 10 % of the state it was learned in
// (upN/upλ: before the overshooting step). stoppedAt used to follow the
// count on every frame and the limits had no state of their own: a limit learned
// zoomed in held after zooming out, the filter stopped far above max (zoomed fully in
// and out, Mammalia showed up to 1699 nodes of 750..1000; zoomed in fast 389). Not
// tied to the center node: dragging changes it often, which reset the limits and
// brought the flicker back (dragging the Wombat on the Metatheria branch); dragging
// keeps λ.
//
// Where a step can change something is known from the last selection. A node is hidden
// when its weight <= W / magic (W: the weight of its branch point on the path to the
// center, highway[0]), outside the focus circle, its parent too; so at magic <= W / w:
//   - nextHideAt: the largest W / w of the visible nodes a smaller magic would hide
//     (the first to go). None: every visible node is in the focus circle (a flat
//     tree zoomed out, e.g. Coleoptera: 7669 nodes in the focus): no step down helps.
//     magic used to sink toward 0 then; moved away from the center, nothing was drawn.
//   - nextShowAt: the smallest W / w of the nodes hidden by their weight only. None:
//     every node that can be visible is (a small tree, the cullingRadius).
// A step jumps to the magic where that node changes when a plain step would change
// nothing: many nodes share a weight (all leaves 1), and zoomed fully in magic grew so
// far that zoomed out it took a factor of 27 before the first node was hidden.
type MagicLimits = { up:number, last:number, stoppedAt:number, lastN?:number,
                     upN?:number, upλ?:number, lastAt?:number }
// the state a limit was learned in: count n is not comparable to it
const differs = (a:number, learned:number|undefined)=> !!learned && Math.abs(a - learned) > .1 * learned
const magicLimits = new WeakMap<object, MagicLimits>()

function adjustMagic(ud:IUnitDisk, cache:TransformationCache) {
    const filter = ud.args.model.filter.weightFilter
    if (filter === null || !cache.unculledNodes)   // no weight culling / nothing drawn yet
        return

    // Only the nodes magic decides on count against rangeNodes. The nodes in the focus
    // circle and their children are drawn whatever their weight (cache.focusCount); a
    // fan in the focus (zoomed out on a flat tree: Coleoptera, 780 of 808 nodes) filled
    // the range alone, magic kept everything else hidden (W / magic 58755 of 226332), and
    // dragging the fan out of the focus left 65 nodes, sometimes almost none, until magic
    // had climbed back over many frames. Now the nodes magic decides on keep at least
    // FOCUS_FLOOR of the range, beside the focus.
    const focus = Math.min(cache.focusCount || 0, cache.unculledNodes.length)
    const n = cache.unculledNodes.length - focus
    const λ = ud.args.transformation.state.λ
    const full = filter.rangeNodes
    const range = { min: Math.max(full.min - focus, full.min * FOCUS_FLOOR),
                    max: Math.max(full.max - focus, full.max * FOCUS_FLOOR) }
    const alpha = filter.alpha
    const fresh = ()=> ({ up: MAGIC_MAX, last: 0, stoppedAt: 0 })
    let b = magicLimits.get(filter)
    if (!b || (b.stoppedAt && Math.abs(n - b.stoppedAt) > .1 * b.stoppedAt))
        magicLimits.set(filter, b = fresh())
    const eps = 1e-9   // magic / alpha * alpha is not exactly magic
    // while the start zoom is searched: plain steps, as until then (jumps changed it)
    const plainOnly = ud.view.hypertree.findingInitλ

    if (n > range.max) {
        if (b.last > 0) { b.up = Math.min(b.up, b.lastAt || filter.magic); b.upN = b.lastN; b.upλ = λ }   // the step up overshot
        // a step; when it would hide nothing, half a step past nextHideAt (the first
        // visible node to be hidden); none: nothing can be hidden. Always down, even
        // when it overshoots below min: fewer rather than too many (a limit for steps
        // down kept the filter above max: the limit up expired, the one down not)
        const next = plainOnly ? undefined : cache.nextHideAt, plain = filter.magic / alpha, at = next || 0
        const m = next === null ? 0 : !at || plain <= at ? plain : at / Math.sqrt(alpha)
        if (m > MAGIC_MIN) { filter.magic = m; b.last = -1; b.lastAt = at; b.stoppedAt = 0 } else { b.last = 0; b.stoppedAt = b.stoppedAt || n }
    }
    else if (n < range.min) {
        // the overshoot up was learned in another state: try again
        if (differs(n, b.upN) || differs(λ, b.upλ)) { b.up = MAGIC_MAX; b.upN = b.upλ = undefined }
        // a step; when it would show nothing, half a step past nextShowAt (the first
        // hidden node to show); none: nothing more can be shown
        const next = plainOnly ? undefined : cache.nextShowAt, plain = filter.magic * alpha, at = next || 0
        const m = next === null ? Infinity : !at || plain > at ? plain : at * Math.sqrt(alpha)
        if (m < b.up * (1 - eps)) { filter.magic = m; b.last = 1; b.lastAt = at; b.stoppedAt = 0 } else { b.last = 0; b.stoppedAt = b.stoppedAt || n }
    }
    else { b.last = 0; b.stoppedAt = 0 }
    b.lastN = n
    updates.set(ud, (updates.get(ud) || 0) + 1)
    stepping.set(ud, b.last !== 0)
    if (b.last !== 0 && !plainOnly) settle(ud)
}

// A step shows its effect on the next update only. Updates come from interaction and
// animation; when they end (zooming stops at the λ bound, the mouse rests) the filter
// stopped wherever the last update left it (zoomed fully in, dragged, zoomed out:
// Mammalia 1699 nodes of 750..1000, the next 60 updates brought it to 984). So after a
// step one more update is requested for the next frame; when another update came in
// between, it waits a frame more (that update could not request one: one was pending).
// It ends when the count is in the range or a limit stops the steps.
//
// When the view stands still (no drag, pinch, wheel or animation: nothing else draws),
// the remaining steps run at once without drawing, as settleMagic before the first
// frame, and one frame shows the result. One full frame per step (every layer drawn,
// the labels relaxed) made 10-18 frames after a wheel burst: 0.5-0.8 s of main thread
// on a desktop, 1.8 s on a phone. While the view moves, the frames come anyway.
const updates = new WeakMap<object, number>()     // adjustMagic calls per unit disk
const stepping = new WeakMap<object, boolean>()   // the last call took a step
const settling = new WeakSet<object>()            // a frame is requested
const SETTLE_STEPS = 50                           // steps at once; more go on frame by frame
function settle(ud:IUnitDisk) {
    if (settling.has(ud) || typeof requestAnimationFrame === 'undefined') return
    settling.add(ud)
    const seen = updates.get(ud)
    requestAnimationFrame(()=> {
        settling.delete(ud)
        if (!stepping.get(ud)) return
        if (updates.get(ud) !== seen) { settle(ud); return }
        if (!ud.view.hypertree.isAnimationRunning()) settleMagic(ud, ud.cache, SETTLE_STEPS)
        ud.view.hypertree.update.transformation()
    })
}

function collectNodesByWeight(ud:IUnitDisk, cache:TransformationCache, path:N[])
{
    const normλ =     ud.args.transformation.state.λ
    cache.focusR = Math.min(normλ * ud.args.model.filter.focusExtension, ud.args.model.filter.maxFocusRadius)

    console.assert(cache.focusR < 1 && cache.focusR > 0)    
    adjustMagic(ud, cache)

    // select visible nodes
    
    const startNode =     path[0]
    cache.unculledNodes = []    
    cache.spezialNodes =  [ud.args.data, startNode].filter(e=> e)
    cache.emojis =        []
    cache.cells =         []
  
    const mf = ud.view.hypertree.isAnimationRunning() ? 1:1 // todo: make configurable
    // for adjustMagic: where the next node is hidden / shows (W / w, see adjustMagic)
    let nextHideAt:number|null = null, nextShowAt:number|null = null
    // the visible nodes drawn whatever their weight: in the focus circle, or a child of
    // a node in it (for adjustMagic)
    let focusCount = 0

    function abortfilter(n, idx, highway) { // return false to abort
        const wf = ud.args.model.filter.weightFilter
        n.minWeight = wf === null ? 0                     // no weight culling
                    : highway[0].precalc.cullingWeight / wf.magic / mf
        peocessNodeTransformation(ud, cache, n)
        peocessNode(ud, cache, n, cache.focusR, n.minWeight)
        if (!n.isOut && (!n.isOutλ || (n.parent && !n.parent.isOutλ))) focusCount++
        if (n !== startNode && !n.isOut99 && n.precalc.cullingWeight > 0) {
            const at = highway[0].precalc.cullingWeight / n.precalc.cullingWeight
            if (n.isOut && n.isOutWeight) {                                         // hidden by its weight
                if (nextShowAt === null || at < nextShowAt) nextShowAt = at
            }
            else if (!n.isOut && n.isOutλ && (!n.parent || n.parent.isOutλ)) {      // visible, hideable
                if (nextHideAt === null || at > nextHideAt) nextHideAt = at
            }
        }
        // the start node (nearest visible node on the path to the center) always: an
        // empty tree is never right
        return !n.isOut || n === startNode
    }

    // dont do it before pathToLastVisible. it uses centerNode
    const lastCenter = cache.centerNode
    cache.centerNode = undefined// ud.args.data
    
    const t1 = performance.now()    
    // select visible nodes - rootnode extra
    if (ud.args.data) {
        peocessNodeTransformation(ud, cache, ud.args.data)
        peocessNode(ud, cache, ud.args.data, cache.focusR, 0)
        // root ist nicht in uncullednodes! (gut)
    }
    
    // centernode will be set at this point

    // select visible nodes - alle anderen (von startnode bis abortfilter)
    dfs2({
        node:        startNode,
        abortFilter: abortfilter,
        preAction:   n=> cache.unculledNodes.push(n),
        highway:     path
    })

    cache.nextHideAt = nextHideAt
    cache.nextShowAt = nextShowAt
    cache.focusCount = focusCount

    // Hysteresis for the center node: it decides the path the next frame starts from
    // (and so the weight each branch is compared with). When two nodes are about
    // equally near the center, e.g. while dragging, the center switched between them
    // on every frame and branches showed and hid with it (flicker). The last center
    // stays while it is visible and no node is clearly nearer.
    const centerMargin = .02
    if (lastCenter && cache.centerNode && lastCenter !== cache.centerNode
     && !lastCenter.isOut && lastCenter.cachep
     && lastCenter.cachep.r < cache.centerNode.cachep.r + centerMargin
     && cache.unculledNodes.includes(lastCenter))
        cache.centerNode = lastCenter
    return t1
}

function addPathToUnculled(ud:IUnitDisk, cache:TransformationCache, p)
{
    if (p.type !== 'HoverPath') {
        const pathnodes = []
        // go down
        let n = p.head
        while (n.parent && !cache.unculledNodes.includes(n)) {                
            pathnodes.push(n)
            n = n.parent
        }
        // go up and transform
        pathnodes.reverse().forEach(n=> {
            peocessNodeTransformation(ud, cache, n)
            peocessNode(ud, cache, n, cache.focusR, 0)
        })
        cache.unculledNodes = cache.unculledNodes.concat(pathnodes)            
    }   
}

/**
 * Settles weightFilter.magic before the first frame.
 *
 * magic decides how much smaller than the focus a node's culling weight may be
 * before the node is hidden (minWeight = weight at the focus / magic): a larger
 * magic shows more nodes. adjustMagic changes it by one step (× or ÷ alpha) per
 * update until the number of visible nodes lies within rangeNodes. Done frame by
 * frame, the visible set kept changing for many frames after loading.
 *
 * This runs the same steps right away, without drawing, until magic doesn't
 * change any more: the number of visible nodes is within rangeNodes, or magic
 * reached its internal bound, or every node is visible already. The
 * result equals the state the frame-by-frame adaptation used to settle in.
 * Returns the number of steps.
 */
export function settleMagic(ud:IUnitDisk, cache:TransformationCache, maxSteps = 1000) : number {
    const filter = ud.args.model.filter.weightFilter
    const total = ud.args.data ? ud.args.data.descendants().length : 0
    for (let step = 0; step < maxSteps; step++) {
        const before = filter.magic
        collectNodesByWeight(ud, cache, pathToLastVisible(ud, cache))   // one adjustMagic step + selection
        if (filter.magic === before) return step
        // every node visible: a larger magic can't show more
        if (cache.unculledNodes.length + 1 >= total && cache.unculledNodes.length < filter.rangeNodes.min) return step
    }
    return maxSteps
}

export function cacheUpdate(ud:IUnitDisk, cache:TransformationCache) {
    // constants 
    const t0 =   performance.now()   
    const path = pathToLastVisible(ud, cache)
    const t1 =   collectNodesByWeight(ud, cache, path) // also updates centernode
    const t2 =   performance.now()

    // add pathes to unculled nodes    
    ud.args.model.objects.pathes.forEach(p=> addPathToUnculled(ud, cache, p))   

    // the projection (geometry.view): from here on the drawn positions are view
    // positions (the half-plane view maps them; the disk keeps them); the filter above
    // worked in the disk. Nodes outside the view get no emoji or symbol.
    cache.unculledNodes = ud.args.projection.project(cache.unculledNodes)
    // the root is laid out on every frame but is in unculledNodes only while it is within
    // the culling radius; it is drawn anyway (spezialNodes: its node, its stem, the
    // selected path to it), so it is projected too. Before, the half-plane view drew it
    // at its disk position: zoomed in at the leaves the root stood in the middle of the
    // view with a line down from it and a piece of path, none of them connected to the tree
    const root = ud.args.data
    if (root && root.cache && !cache.unculledNodes.includes(root)) ud.args.projection.project([root])
    const inView = (n:N)=> !n.outOfView
    cache.emojis = cache.emojis.filter(inView)
    cache.spezialNodes = cache.spezialNodes.filter(inView)

    // groups of nodes
    cache.links =      cache.unculledNodes.slice(1)
    cache.leafOrLazy = cache.unculledNodes.filter(ud.args.model.geometry.nodeFilter)
    cache.paths =      cache.links.filter((n:N)=> n.pathes.partof && n.pathes.partof.length)
    cache.weights =    []
    
    const t3 = performance.now()

    if (!ud.view.hypertree.isAnimationRunning() ||
        (ud.layerStack && ud.layerStack.layers['labels-force'] && !ud.layerStack.layers['labels-force'].args.hideOnDrag) ||
        (ud.layerStack && ud.layerStack.layers['labels'] && !ud.layerStack.layers['labels'].args.hideOnDrag)) 
        doLabelStuff(ud, cache)        

    /*
    voro wrid gebraucht:
    - mouse up: um click voro zu berechnen
    - celllayer still enabled
    - cellayer anitmation enabled        
    */
    if (!ud.view.hypertree.isAnimationRunning() || 
        (ud.layerStack && ud.layerStack.layers['cells'] && !ud.layerStack.layers['cells'].args.hideOnDrag)) 
        doVoronoiStuff(ud, cache) 

        doImageStuff(ud, cache)
    
    if (cache.centerNode)         
        ud.view.hypertree.update.centernode(cache.centerNode)   

    // only for meta view
    ud.cacheMeta = {
        minWeight: path.map(n=> ud.args.model.filter.weightFilter
                                ? n.precalc.cullingWeight / ud.args.model.filter.weightFilter.magic : 0),
        Δ: [t1-t0, t2-t1, t3-t2, performance.now()-t3]
    }

    // what this update was computed for (cacheUpdateStyle)
    const sig = updateSignature(ud)
    if (sig === null) fullUpdates.delete(cache)
    else fullUpdates.set(cache, { sig, data: ud.args.data })
}

// A 'style' frame (the hover or selection state changed, view/unitdisk.ts) whose
// transformation, data, filter and selection paths are those of the last full update
// keeps its visible set, its voronoi cells and its positions: only the labels are
// selected again (the label fallback may have lent one) and the links on paths
// collected (cache.paths). The hover path's nodes are visible already: a visible node
// and its ancestors up to the culling radius. Until v2.0 every hover change ran the
// full update, the DFS over the tree with all its transformations and the voronoi
// diagram: 5 of 8 ms per change on a desktop, 13-15 long tasks per mouse sweep on a
// phone. Not while the view moves (labels and cells may have been left out).
const fullUpdates = new WeakMap<object, { sig:string, data:N | undefined }>()
function updateSignature(ud:IUnitDisk) : string | null {
    if (ud.view.hypertree.isAnimationRunning()) return null
    const s = ud.args.transformation.state
    const wf = ud.args.model.filter.weightFilter
    const paths = ud.args.model.objects.pathes
        .filter(p=> p.type !== 'HoverPath')
        .map(p=> p.type + ':' + (p.head ? p.head.mergeId : ''))
        .join(',')
    return `${s.P.re}|${s.P.im}|${s.θ}|${s.λ}|${wf ? wf.magic : ''}|${paths}`
}
/** The light update of a 'style' frame; false: the full cacheUpdate is needed. */
export function cacheUpdateStyle(ud:IUnitDisk, cache:TransformationCache) : boolean {
    const last = fullUpdates.get(cache), sig = updateSignature(ud)
    if (!last || sig === null || last.sig !== sig || last.data !== ud.args.data || !cache.unculledNodes) return false
    const t0 = performance.now()
    doLabelStuff(ud, cache)
    cache.paths = cache.links.filter((n:N)=> n.pathes.partof && n.pathes.partof.length)
    ud.cacheMeta = { minWeight: ud.cacheMeta ? ud.cacheMeta.minWeight : [], Δ: [0, 0, 0, performance.now() - t0] }
    return true
}

function pathToLastVisible(ud:IUnitDisk, cache:TransformationCache) {
    let startNode : N = null
    let path = []
    if (ud.args.data) {
        startNode = cache.centerNode || ud.args.data        
        path.push(startNode)

        while (true) {
            peocessNodeTransformation(ud, cache, startNode) 

            if (startNode.cachep.r >= ud.args.model.filter.cullingRadius) {
                path = path.slice(0, -1)
                break
            }
            if(!startNode.parent) 
                break
           
            startNode = startNode.parent
            path.push(startNode)
        }
    }
    return path.reverse()
}

/**
 * Lays out n (its position and its children's wedges) unless the stored layout is
 * still valid: computed by the same layout function, with the same λ, and from the
 * parent's current position (setZ creates a new position object on every layout,
 * so a relaid parent invalidates its children). Panning doesn't change λ, so while
 * dragging the layout isn't recomputed (phase 3).
 */
export function layoutNode(ht, n:N, λ:number) {
    const type = ht.args.layout.type
    const L = <any>n.layout
    const basis = n.parent && n.parent.layout ? n.parent.layout.z : null
    if (L && L.z && L.λ === λ && L.basis === basis && L.type === type)
        return
    type(n, λ, true)
    const L2 = <any>n.layout
    L2.λ = λ
    L2.basis = n.parent && n.parent.layout ? n.parent.layout.z : null
    L2.type = type
}

function peocessNodeTransformation(ud:IUnitDisk, cache:TransformationCache, n:N) {
    n.cache = n.cache || { re:0, im:0 }
    n.cacheDisk = undefined
    n.outOfView = undefined
    layoutNode(ud.view.hypertree, n, ud.args.transformation.state.λ)
    CassignC(n.cache, ud.args.transform(n)) 
    n.cachep = CktoCp(n.cache)   
}

function peocessNode(ud:IUnitDisk, cache:TransformationCache, n:N, focusR, minWeight) {    
    n.strCache =                   `${n.cache.re} ${n.cache.im}`    
    n.transformStrCache =          ` translate(${n.strCache})`
    n.transformStrCacheZ =         ` translate(${n.layout.zStrCache})`
    
    n.isOutλ =                     n.cachep.r >= focusR
    n.isOut99 =                    n.cachep.r >= ud.args.model.filter.cullingRadius
    n.isOutWeight =                n.precalc.cullingWeight <= minWeight
    n.distScale =                  ud.args.transformation.transformDist(n.cache)
    n.dampedDistScale =            n.distScale * (.5 / n.distScale + .5)
    n.scaleStrText =               ` scale(${n.dampedDistScale})`
    n.isOut =                      !(!(n.isOut99 || n.isOutWeight) || !n.isOutλ || (n.parent && !n.parent.isOutλ))

    n.hasOutPeriChildren = n.hasOutWeightChildren = n.hasOutChildren = false

    if (n.parent && n.isOut99)     n.parent.hasOutPeriChildren = true
    if (n.parent && n.isOutWeight) n.parent.hasOutWeightChildren = true
    if (n.parent && n.isOut)       n.parent.hasOutChildren = true

    if (!cache.centerNode || cache.centerNode.cachep.r > n.cachep.r)
        cache.centerNode = n

    if (n.precalc.icon && !n.isOut)
        cache.emojis.push(n)
}
