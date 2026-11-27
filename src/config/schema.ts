// The configuration of a hypertree: the option types (HypertreeArgs), the core
// defaults (coreDefaults) and what a change of an option affects (affects).
//
// Rules (docs/dev/REFACTORING.md, section 2):
//   - a default lives exactly once, next to the definition of the option: the core
//     options here, a layer's options in the layer class (static defaults)
//   - resolve.ts merges the defaults and the overlays (presets, the application) into
//     one complete ResolvedModel; nothing downstream falls back at the place of use
//   - the layers are data (LayerSpec): type, name, cache channel, options

import { N }                   from '../data/n'
import { Path }                from '../state/path'
import { Trace }               from '../state/trace'
import { LoaderFunction }      from '../data/loaders'
import { LayoutFunction }      from '../layout/layouts'
import { layoutBergé }         from '../layout/layouts'
import { C, sigmoid01 }        from '../geometry/hyperbolic-math'
import { Transformation }      from '../geometry/transformation'
import { HyperbolicTransformation } from '../geometry/transformation'
import { IUnitDisk }           from '../view/unitdisk'
import { ILayer }              from '../view/layer'
import { Projection }          from '../projection/projection'

export type ArcCurvature = '+' | '0' | '-' | 'l'

/** A layer of the stack: its type (layerTypes), name, cache channel and options. */
export interface LayerSpec {
    type:       string                   // a registered layer type (layers/index.ts)
    name?:      string                   // the layer's name (default: the type's)
    data?:      string                   // a channel of the frame cache (e.g. 'links'); default from the type
    options?:   { [option:string]: any } // the layer's options, over the type's defaults
    removed?:   boolean                  // taken out of the stack (geometry.removeLayer)
}

export interface HypertreeArgs
{
    langmap?:               {} | null                         // node name -> label text, applied once at initialization
    iconmap?:               {} | null                         // node name (or id) -> emoji, applied once at initialization
    dataloader?:            LoaderFunction
    langloader?:            (ok)=> void
    dataInitBFS:            (ht, n:N)=> void                  // emoji, imghref
    langInitBFS:            (ht, n:N)=> void                  // text, wiki, clickable, cell
    objects: {
        pathes:             Path[]
        selections:         N[]
        traces:             Trace[]
    }
    layout: {
        type:               LayoutFunction
        weight:             (n:N)=> number
        // order of the children in their wedge: 'data' (as given) or 'balanced' (the
        // heaviest child in the middle, the others on the lighter side: the heaviest
        // path runs straight, like a spruce; children-order.ts)
        childOrder:         'data' | 'balanced' | 'alternating'
        // the leaf children of a node with many of them in several rows (a staircase),
        // the node the angle of its columns (true); false: one row, every leaf its own
        // angle (fan-weight.ts)
        multirowHighDegreeNodes: boolean
        // shorter links near the root (layoutBergé): the root's children get this part
        // of a link (e.g. .1), the links to the leaves the whole one, linear in between
        // (by the place between root and leaves). null: the root's children half, all
        // other links whole
        rootLinkLength:     number | null
        initSize:           number                            // the start zoom: the outermost visible node within this part of the disk radius
        rootWedge: {
            orientation:    number
            angle:          number
        }
    }
    filter: {
        cullingRadius:      number
        // the number of visible nodes (rangeNodes) decides what is drawn; null: no
        // weight culling, every node within cullingRadius is visible
        weightFilter: {
            magic?:             number                        // internal: set at initialization so the visible node count is within rangeNodes, then adapted per update
            weight:             (n:N)=> number
            rangeNodes:         { min:number, max:number }
            alpha:              number
        } | null
        focusExtension:     number
        maxFocusRadius:     number
        wikiRadius:         number
        // the weight of a node when the label layers choose which nodes get a label
        // (times the squared display scale): default its subtree weight
        // (precalc.cullingWeight); e.g. a felt importance from the data. A function
        // returning undefined or null for a node falls back to the subtree weight.
        labelScore:         ((n:N)=> number) | null
    }
    geometry: {
        // the projection of the hyperbolic plane onto the screen (projection/): the
        // disk, the rectangular half-plane view, the rectangle (the conformal image
        // of the whole disk, Schwarz–Christoffel), or an own Projection
        projection:         'poincare' | 'cayley' | 'schwarz-christoffel' | Projection
        diskSize:           number                            // the diameter of the disk in the square view (.96); > 1: beyond the view
        // the layer stack in drawing order: specs, or the name of a default layer
        // (layers/index.ts defaultLayers) for its spec
        layers:             (LayerSpec | string)[]
        layerOptions:       { [name:string]: { [option:string]: any } }   // options per layer name, over the specs
        clipRadius:         number
        nodeRadius:         (ud:IUnitDisk, n:N)=> number
        nodeScale:          (n:N)=> number
        nodeFilter:         (n:N)=> boolean                   // which nodes get a disk (layer nodes, show 'leaves')
        linkWidth:          (n:N)=> number
        linkCurvature:      ArcCurvature
        shrinkAtRim:        'none' | 'damped' | 'full'       // labels and emojis toward the rim: constant, 1 to 0.5, like the links (to 0)
        captionBackground:  'all' | 'center' | 'none'
        captionFont:        string                            // only without an SVG to measure in (hypertree.ts captionMetrics)
        captionHeight:      number
        // the labels in screen pixels (null: in the units of the disk): the font is scaled
        // to it, captionHeight set to captionRatio times the font; kept on resize
        captionPx:          number | null
        captionRatio:       number
        transformation:     Transformation<N>
        startPosition:      C | null                          // initial translation (v1: filter.transformation.P)
        // the start view: 'overview' (api.overview) or { P, λ }; the tree zooms up to it
        // and moves there at the start, api.gotoStart() goes back (null: no start
        // animation, gotoStart goes to the view of the initialization)
        startView:          'overview' | { P:C, λ:number } | null
    }
    interaction: {
        mouseRadius:        number
        // strategies that set the node state (n.hovered, n.selected); layers only show it
        // the highlighted node (n.hovered, the hover path and label, onNodeHover):
        // 'mousehover' the node under the mouse, 'center' the node nearest to the
        // center (also while dragging; touch screens), 'none'
        highlightNode:      'mousehover' | 'center' | 'none'
        // when: 'live' at once (every mouse move, every frame while dragging), 'settled'
        // when the view stands still and the mouse / center rested highlightDelay ms
        highlightUpdate:    'live' | 'settled'
        highlightDelay:     number
        // a highlighted node without a label: 'ancestor' shows its nearest ancestor's
        // label (only as the hover label), 'none' no label
        highlightLabelFallback: 'none' | 'ancestor'
        selection:          'none' | 'single' | 'multi'      // 'single': a new selection replaces the old one
        maxSelections:      number                           // 'multi': the oldest selection is dropped beyond this
        clickAction:        'select' | 'goto' | 'none'       // what a click does besides onNodeClick
        onNodeClick:        (n:N, m:C, l:ILayer)=> void
        // every selection change (api.toggleSelection/select/deselect/clearSelection,
        // clickAction 'select', replaced or dropped selections); selected = new state
        onNodeSelect:       (n:N, selected?:boolean)=> void
        // pointer pressed on a node for holdDuration ms without moving; no click follows
        onNodeHold:         ((n:N, m:C, l:ILayer)=> void) | null
        holdDuration:       number
        // node under the mouse changed (undefined when leaving the tree)
        onNodeHover:        (n:N)=> void
        onHoverNodeChange:  (n:N)=> void
        onCenterNodeChange: (n:N, s:string)=> void
        λbounds:            [ number, number ]
        // the center of the view never lies beyond the tip of the tree (the node nearest to
        // the center, if the tree ends there: outside the circle with the diameter
        // center–root*) nor in the root's stem gap: dragging, pinching and the wheel keep
        // the translation on the boundary (interaction/view-bounds.ts; the disk view only)
        keepTreeInView:     boolean
        // the tree never fills less than this share of the disk radius (e.g. .9): the
        // lower λ bound is computed per tree after loading, replacing λbounds[0]
        minFill:            number | null
        // a normal link with its parent in the middle of the disk is at most this long
        // (share of the disk radius, e.g. .5): the upper λ bound, replacing λbounds[1]
        maxLinkLength:      number | null
        animationDuration:  number                            // ms of goto, gotoNode, gotoHome, gotoλ, gotoOverview
        // the curve of those animations: the share of the way at a share of the time,
        // both 0..1 (default: a symmetric sigmoid, tanh, which starts and stops softly)
        animationEasing:    (t:number)=> number
        wheelFactor:        number
    }
}

/** A partial model: an overlay over the defaults (a preset, the application's options). */
export type ModelOverlay = DeepPartial<HypertreeArgs>
export type DeepPartial<T> = { [P in keyof T]?: T[P] extends (...a:any[])=> any ? T[P] : T[P] extends object ? DeepPartial<T[P]> | T[P] : T[P] }

const π = Math.PI
const isLeaf = (n:N)=> !n.children || !n.children.length
const isRoot = (n:N)=> !n.parent
const hasLazy = (n:N)=> n.hasOutChildren && n.isOutλ
const hasCircle = (n:N)=> hasLazy(n) || isRoot(n) || isLeaf(n)

/**
 * The core defaults (everything but the layers; those come from the layer classes,
 * layers/index.ts). A fresh object on every call: a model holds state
 * (transformation, selections).
 */
export const coreDefaults = () : HypertreeArgs => ({
    langloader:  ok=> ok(),
    dataInitBFS: (ht, n:N)=> {
        n.precalc.imageHref = undefined
        n.precalc.icon = undefined
        n.precalc.clickable = true
        n.precalc.cell = true
    },
    langInitBFS: (ht, n:N)=> {
        // the language map's text for the node name (langmap or langloader), set once
        n.precalc.label = ht.langMap && n.data ? ht.langMap[n.data.name] : undefined
        n.precalc.wiki = undefined
    },
    objects: {
        selections:         [],
        pathes:             [],
        traces:             [],
    },
    layout: {
        type:               layoutBergé,
        weight:             (n:N)=> (isLeaf(n) ? 1 : 0),
        childOrder:         'data',
        multirowHighDegreeNodes: true,
        rootLinkLength:     null,
        initSize:           .97,
        rootWedge: {
            orientation:    3*π/2,
            angle:          3*π/2,
        },
    },
    filter: {
        cullingRadius:      .99,
        weightFilter: {
            alpha:              1.05,
            weight:             (n:N)=> (isLeaf(n) ? 1 : n.height*n.height),
            rangeNodes:         { min:150, max:500 },
        },
        focusExtension:     1.6,
        maxFocusRadius:     .85,
        wikiRadius:         .85,
        labelScore:         null,
    },
    geometry: {
        projection:         'poincare',
        diskSize:           .96,
        layers:             [],                   // filled by resolve.ts from the layer types
        layerOptions:       {},
        clipRadius:         1,
        // relative to the width of the node's link (linkWidth includes the distance
        // scale, the node layer scales the radius with nodeScale): inner nodes half the
        // link width, so the disk never sticks out of the link; leaves 1.5 times (a
        // disk three times as wide as the link), else they would be invisible at the
        // end of their thin links
        nodeRadius:         (ud:IUnitDisk, d:N)=> {
                                const linkWidth = ud.args.model.geometry.linkWidth(d) / (d.distScale > 1e-9 ? d.distScale : 1)
                                return linkWidth * (isLeaf(d) ? 1.5 : .5)
                            },
        nodeScale:          (d:N)=> d.distScale * (hasLazy(d) ? .8 : 1),
        nodeFilter:         hasCircle,
        linkWidth:          (d:N)=> .025 * d.distScale * d.precalc.weightScale,
        linkCurvature:      '-',
        shrinkAtRim:        'damped',
        captionBackground:  'all',
        captionFont:        '6.5px Roboto',
        captionHeight:      .04,
        captionPx:          null,
        captionRatio:       1.25,
        transformation:     new HyperbolicTransformation({
            P:              { re: 0, im:0 },
            θ:              { re: 1, im:0 },
            λ:              .1
        }),
        startPosition:      null,
        startView:          null,
    },
    interaction: {
        mouseRadius:        .9,
        highlightNode:      'mousehover',
        highlightUpdate:    'live',
        highlightDelay:     0,
        highlightLabelFallback: 'none',
        selection:          'multi',
        maxSelections:      10,
        clickAction:        'none',
        onNodeClick:        (n:N, m:C)=> {},
        onNodeSelect:       ()=> {},
        onNodeHold:         null,
        holdDuration:       500,
        onNodeHover:        ()=> {},
        onHoverNodeChange:  (n:N)=> {},
        onCenterNodeChange: (n:N)=> {},
        λbounds:            [ 1/40, .45 ],
        keepTreeInView:     true,
        minFill:            null,
        maxLinkLength:      null,
        animationDuration:  750,
        animationEasing:    sigmoid01,
        wheelFactor:        1.175,
    },
})

/**
 * What a change of an option needs (ht.configure): the longest matching path prefix
 * wins.
 *   data:    the tree is initialized again (weights, labels, start zoom)
 *   layout:  the layout weights and the layout
 *   labels:  the labels are measured again
 *   layers:  the layer stack is built again
 *   frame:   a frame (filter and layers)
 *   style:   the hover and selection styles only
 *   none:    read at the next use
 */
export type Effect = 'data' | 'layout' | 'labels' | 'layers' | 'frame' | 'style' | 'none'
export const affects : { [pathPrefix:string]: Effect } = {
    'dataloader':                 'data',
    'langloader':                 'data',
    'langmap':                    'data',
    'iconmap':                    'data',
    'dataInitBFS':                'data',
    'langInitBFS':                'data',
    'objects':                    'style',
    'layout':                     'layout',
    'layout.rootWedge':           'data',       // the root's wedge is set when the data is initialized
    'filter':                     'frame',
    'filter.weightFilter.weight': 'layout',     // the culling weights are summed with the layout weights
    'filter.labelScore':          'frame',
    'geometry':                   'frame',
    'geometry.projection':        'layers',
    'geometry.layers':            'layers',
    'geometry.layerOptions':      'layers',
    'geometry.captionFont':       'labels',
    'geometry.captionHeight':     'labels',
    'geometry.captionPx':         'none',       // configure measures and sets captionHeight (layers/caption-px.ts)
    'geometry.captionRatio':      'none',
    'geometry.startView':         'none',       // read at the start and by api.gotoStart
    'geometry.diskSize':          'layers',
    'geometry.clipRadius':        'layers',
    'geometry.linkCurvature':     'layers',     // the arc layers take it as their default when they are created
    'interaction':                'none',
    'interaction.mouseRadius':    'layers',     // the interaction layer takes it when it is created
    'interaction.λbounds':        'frame',
    'interaction.minFill':        'data',
    'interaction.maxLinkLength':  'data',
}

/** The effect of a changed option path (e.g. 'geometry.captionHeight'). */
export function effectOf(path:string) : Effect {
    let best:Effect = 'frame', bestLen = -1
    for (const prefix in affects)
        if ((path === prefix || path.startsWith(prefix + '.')) && prefix.length > bestLen) { best = affects[prefix]; bestLen = prefix.length }
    return best
}
