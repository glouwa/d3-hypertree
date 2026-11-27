// The layer types and the default layer stack (docs/dev/REFACTORING.md, section 2.2).
//
// A layer is data: { type, name, data, options } (LayerSpec, config/schema.ts). The
// type names a LayerType here; its defaults (in the layer class) are merged with the
// spec's options and the model's geometry.layerOptions[name]. Applications add their
// own types to layerTypes and their own specs to geometry.layers.

import { LayerSpec }            from '../config/schema'
import { LayerType, LayerContext } from '../view/layer'
import { BackgroundLayer }      from './background-layer'
import { CellLayer }            from './cell-layer'
import { FocusLayer }           from './focus-layer'
import { NodeLayer }            from './node-layer'
import { ArcLayer }             from './link-layer'
import { StemLayer }            from './stem-layer'
import { SymbolLayer }          from './symbol-layer'
import { ImageLayer }           from './image-layer'
import { LabelLayer }           from './label-layer'
import { LabelForceLayer }      from './label-force-layer'
import { LabelPlacementLayer }  from './label-placement-layer'
import { EmojiBackgroundLayer } from './emoji-background-layer'
import { InteractionLayer2 }    from '../interaction/interaction-layer'
import { TraceLayer }           from './trace-layer'
import { HighlightMarkerLayer } from './highlight-marker-layer'

export const layerTypes : { [type:string]: LayerType } = {
    'background':     BackgroundLayer.type,
    'cells':          CellLayer.type,
    'focus':          FocusLayer.type,
    'nodes':          NodeLayer.type,
    'arcs':           ArcLayer.links,
    'paths':          ArcLayer.paths,
    'stem':           StemLayer.type,
    'symbols':        SymbolLayer.type,
    'images':         ImageLayer.type,
    'labels':         LabelLayer.text,
    'emojis':         LabelLayer.emoji,
    'emoji-backgrounds': EmojiBackgroundLayer.type,
    'labels-force':   LabelForceLayer.type,
    'labels-placed':  LabelPlacementLayer.type,
    'interaction':    InteractionLayer2.type,
    'traces':         TraceLayer.type,
    'highlight-marker': HighlightMarkerLayer.type,
}

/** The default layer stack, in drawing order (a fresh list on every call). */
export const defaultLayers = () : LayerSpec[] => [
    { type: 'background', name: 'background' },
    { type: 'cells',      name: 'cells' },
    // indicator circles of the disk (hidden; the playground shows them)
    { type: 'focus',      name: 'culling-r',  options: { r: (ctx:LayerContext)=> ctx.model.filter.cullingRadius } },
    { type: 'focus',      name: 'mouse-r',    options: { r: (ctx:LayerContext)=> ctx.model.interaction.mouseRadius } },
    { type: 'focus',      name: 'focus-r',    options: { r: (ctx:LayerContext)=> ctx.cache.focusR } },
    { type: 'focus',      name: 'labels-r-𝐖', options: { r: (ctx:LayerContext)=> ctx.model.filter.wikiRadius } },
    // the λ circle at the point of the last pinch (the center while not pinching)
    { type: 'focus',      name: 'λ',          options: { invisible: false, hideOnDrag: false,
                                                         r:      (ctx:LayerContext)=> ctx.model.geometry.transformation.state.λ,
                                                         center: (ctx:LayerContext)=> ctx.unitdisk.pinchcenter || { re: 0, im: 0 } } },
    { type: 'focus',      name: '(0,0)',      options: { invisible: false, hideOnDrag: false, className: 'zerozero-circle', r: ()=> .004 } },
    { type: 'nodes',      name: 'center-node', options: { invisible: true, hideOnDrag: true, className: 'center-node', r: ()=> .1,
                                                          data: (layer)=> layer.view.cache.centerNode ? [layer.view.cache.centerNode] : [] } },
    { type: 'paths',      name: 'path-arcs' },
    { type: 'arcs',       name: 'link-arcs' },
    { type: 'stem',       name: 'stem-arc' },
    { type: 'nodes',      name: 'nodes' },
    { type: 'symbols',    name: 'symbols' },
    // a disk on the highlighted node that moves along the tree (off by default)
    { type: 'highlight-marker', name: 'highlight-marker' },
    { type: 'images',     name: 'images' },
    // a disk under every emoji (off by default)
    { type: 'emoji-backgrounds', name: 'emoji-backgrounds' },
    { type: 'emojis',     name: 'emojis' },
    { type: 'labels',     name: 'labels' },
    { type: 'labels-force',  name: 'labels-force' },
    { type: 'labels-placed', name: 'labels-placed' },
    // mouse, touch and wheel; a click calls interaction.clickAction and onNodeClick
    { type: 'interaction', name: 'interaction-2' },
    { type: 'traces',     name: 'traces' },
]
