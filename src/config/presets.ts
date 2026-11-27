// The presets of the library: generic overlays over the defaults. An application's
// presets live with the application (hypertree-of-life: src/presets.ts).

import { HypertreeArgs, ModelOverlay } from './schema'
import { coreDefaults }                from './schema'
import { defaultLayers }               from '../layers'
import { infovisModel, infovisEmojiModel, infovisFilesModel, InfovisOptions } from './infovis'

/** The complete defaults: the core options and the default layer stack (a fresh object). */
export function defaults() : HypertreeArgs {
    const d = coreDefaults()
    d.geometry.layers = defaultLayers()
    return d
}

export const presets : { [key:string]: (options?:any)=> ModelOverlay } =
{
    /** the defaults (every option, for reading them; as an overlay it changes nothing) */
    modelBase:      ()=> defaults(),

    // information visualization with d3-scales (options: value, colorValue,
    // interpolator; see preset-infovis.ts)
    infovis:        (o?:InfovisOptions)=> infovisModel(o),
    infovisEmoji:   (o?:InfovisOptions)=> infovisEmojiModel(o),
    // a file system tree: size as cell color, number of files as link color
    infovisFiles:   (o?:InfovisOptions)=> infovisFilesModel(o),

    // how the highlighted node (interaction.highlightNode) is shown: its voronoi cell,
    // or a disk on it that moves along the tree to the next one (layer highlight-marker)
    highlightCell:  ()=> highlightCell(),
    highlightDisk:  (o?:HighlightDiskOptions)=> highlightDisk(o),
}

/** The highlighted node shown by its voronoi cell (the theme's .hovered.cell), no disk. */
export function highlightCell() : ModelOverlay {
    return { geometry: { layerOptions: {
        'cells':            { invisible: false, hover: true },
        'highlight-marker': { invisible: true },
    } } }
}

export interface HighlightDiskOptions {
    size?:     number      // the disk's height in label lines (geometry.captionHeight / captionRatio: the font) in the center; default 3
    duration?: number      // ms of its way to the next node; default 250
}

/**
 * The highlighted node shown by a disk on it (layer highlight-marker), size times the
 * label font high in the center of the disk; it moves along the tree to the next
 * highlighted node. The cells do not show it (they keep their own colors).
 */
export function highlightDisk(o:HighlightDiskOptions = {}) : ModelOverlay {
    const size = o.size || 3
    return { geometry: { layerOptions: {
        'cells':            { hover: false },
        'highlight-marker': { invisible: false, duration: o.duration === undefined ? 250 : o.duration,
                              r: (ctx)=> size / 2 * ctx.model.geometry.captionHeight / ctx.model.geometry.captionRatio },
    } } }
}
