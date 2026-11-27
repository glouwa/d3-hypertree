export { Hypertree }     from "./hypertree"
export type { NamedOverlay } from "./hypertree"
export type { HypertreeArgs, ModelOverlay, LayerSpec } from "./config/schema"
export { coreDefaults, affects, effectOf } from './config/schema'
export { resolveModel, mergeInto, composeOverlays, whence, pathsOf } from './config/resolve'
export { migrate } from './config/migrate'
export { presets, defaults } from './config/presets'

export * from './geometry/hyperbolic-math'
export * from './geometry/transformation'
export { toHalfPlane, toView, viewToDisk, viewScale, infinityOf, circleToView } from './geometry/cayley'
export { RectangleMap, ellipticK, carlsonRF } from './geometry/schwarz-christoffel'
export type { Projection, ViewBox } from './projection/projection'
export { PoincareProjection, CayleyProjection, SchwarzChristoffelProjection, GlatzhoferProjection, createProjection } from './projection'
export { colorBy, sizeBy, nodeValues } from './config/infovis'
export { voronoiLayout } from './filter/voronoi'
 
export * from './data/n'
export * from './data/loaders'
export * from './layout/layouts'

export * from './view/layerstack'
export * from './view/d3-join'
export type { LayerContext, ILayer, ILayerArgs, LayerType } from './view/layer'
export { layerData } from './view/layer'
export { layerTypes, defaultLayers } from './layers'

import * as cell from './layers/cell-layer'
import * as arc  from './layers/link-layer'
import * as node from './layers/node-layer'
import * as img  from './layers/image-layer'
import * as sym  from './layers/symbol-layer'
import * as text from './layers/label-layer'
import * as textf from './layers/label-force-layer'
import * as textp from './layers/label-placement-layer'
import * as bg   from './layers/background-layer'
import * as foc  from './layers/focus-layer'
import * as int2  from './interaction/interaction-layer'

export namespace layers
{
    export const CellLayer = cell.CellLayer
    export type CellLayerArgs        = cell.CellLayerArgs
    export const ArcLayer = arc.ArcLayer
    export type ArcLayerArgs         = arc.ArcLayerArgs
    export const NodeLayer = node.NodeLayer
    export type NodeLayerArgs        = node.NodeLayerArgs
    export const ImageLayer = img.ImageLayer
    export type ImageLayerArgs       = img.ImageLayerArgs
    export const SymbolLayer = sym.SymbolLayer
    export type SymbolLayerArgs      = sym.SymbolLayerArgs
    export const LabelLayer = text.LabelLayer
    export type LabelLayerArgs       = text.LabelLayerArgs 
    export const LabelForceLayer = textf.LabelForceLayer
    export type LabelForceLayerArgs  = textf.LabelForceLayerArgs 
    export const LabelPlacementLayer = textp.LabelPlacementLayer
    export type LabelPlacementLayerArgs = textp.LabelPlacementLayerArgs
    export const BackgroundLayer = bg.BackgroundLayer
    export type BackgroundLayerArgs  = bg.BackgroundLayerArgs 
    export const FocusLayer = foc.FocusLayer
    export type FocusLayerArgs       = foc.FocusLayerArgs
    export const InteractionLayer2 = int2.InteractionLayer2
    export type InteractionLayer2Args = int2.InteractionLayer2Args
}

export * from './view/unitdisk'

import * as loaders_ from './data/loaders'
import * as layouts_ from './layout/layouts'
export var loaders = loaders_
export var layouts = layouts_

export { bboxCenter, bboxOval, labelOffset, sizeAt, rimScale } from './layers/label-geometry'
export { labelsWithHover, labelsFor, labelWeight, DEFAULT_MAX_LABELS } from './filter/labels'
