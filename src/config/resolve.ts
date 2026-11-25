// Merging the configuration: the defaults and the overlays (presets, the application,
// configure() at runtime) into one complete model, with the provenance of every value.
//
// Merge rules (ModelOverlay):
//   - plain objects merge, key by key
//   - arrays, functions and class instances (a Transformation, a Projection) replace
//   - null replaces: the option is off / unset (e.g. filter.weightFilter: null)
//   - undefined is ignored: the value so far stays
// (Until v2 mergeDeep merged arrays by index and class instances key by key, and
// could not express null.)

import { HypertreeArgs, ModelOverlay } from './schema'

const isPlain = (v:any)=> v !== null && typeof v === 'object' && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)

export type Provenance = { [path:string]: string }

/**
 * Merges overlay into target (in place) and records in prov, per option path, the
 * name of the overlay that set it.
 */
export function mergeInto(target:any, overlay:any, source = 'overlay', prov?:Provenance, path = '') : any {
    if (!isPlain(overlay)) return target
    for (const key of Object.keys(overlay)) {
        const v = overlay[key]
        if (v === undefined) continue
        const p = path ? `${path}.${key}` : key
        if (isPlain(v) && isPlain(target[key])) {
            mergeInto(target[key], v, source, prov, p)
            continue
        }
        target[key] = isPlain(v) ? mergeInto({}, v, source, prov, p) : v
        if (prov) prov[p] = source
    }
    return target
}

export interface ResolvedModel {
    model:       HypertreeArgs
    provenance:  Provenance
}

/**
 * The complete model: the defaults with the overlays applied in order. Each overlay
 * is { name, overlay }; the name goes into the provenance ('defaults' for the
 * defaults themselves).
 */
export function resolveModel(defaults:HypertreeArgs, overlays:{ name:string, overlay:ModelOverlay }[]) : ResolvedModel {
    const provenance:Provenance = {}
    const model = mergeInto({}, defaults, 'defaults', provenance)
    for (const o of overlays)
        if (o && o.overlay) mergeInto(model, o.overlay, o.name, provenance)
    return { model, provenance }
}

/** Where an option's value comes from (the longest recorded path prefix). */
export function whence(provenance:Provenance, path:string) : string | undefined {
    let p = path
    while (p) {
        if (provenance[p]) return provenance[p]
        const i = p.lastIndexOf('.')
        p = i < 0 ? '' : p.slice(0, i)
    }
    return undefined
}

/** The option paths an overlay sets (leaves of its plain objects). */
export function pathsOf(overlay:any, path = '', out:string[] = []) : string[] {
    if (!isPlain(overlay)) { if (path) out.push(path); return out }
    for (const key of Object.keys(overlay)) {
        if (overlay[key] === undefined) continue
        pathsOf(overlay[key], path ? `${path}.${key}` : key, out)
    }
    return out
}

/** Several overlays as one (for presets built from parts; the later ones win). */
export function composeOverlays(...overlays:ModelOverlay[]) : ModelOverlay {
    const out = {}
    for (const o of overlays) if (o) mergeInto(out, o)
    return out
}
