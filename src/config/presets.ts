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
}
