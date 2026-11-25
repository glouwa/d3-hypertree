import * as d3 from 'd3'
import { N } from '../data/n'

// Building blocks for information visualization presets: a value per node, mapped
// with d3-scales to colors (links, node disks, label backgrounds, voronoi cells)
// and sizes (node radius, link width, label and emoji size).

export type NodeValue = (n:N)=> number
export type ScaleType = 'linear' | 'sqrt' | 'log'

// values from the structure of the tree (no own data needed)
export const nodeValues : { [name:string]: NodeValue } = {
    weight: n=> n.precalc.visWeight || 1,       // summed layout weight: leaves below the node
    depth:  n=> n.depth,
    height: n=> n.height,
    value:  n=> n.data && typeof n.data.value === 'number' ? n.data.value : NaN,   // own data: n.data.value
}

// 'data.<key>': one function per key (the range caches below use the function as key)
const dataValues = new Map<string, NodeValue>()
const dataValue = (key:string) : NodeValue => {
    if (!dataValues.has(key)) dataValues.set(key, n=> n.data && typeof n.data[key] === 'number' ? n.data[key] : NaN)
    return dataValues.get(key)
}

// [min, max] of a value over the whole tree, computed once per tree and scale type
// (the root is found through the parents, without allocating); log scales count only
// the positive values
const extents = new Map<ScaleType, WeakMap<NodeValue, WeakMap<N, [number, number]>>>()
function extentOf(value:NodeValue, n:N, scale:ScaleType) : [number, number] {
    let root = n
    while (root.parent) root = root.parent
    if (!extents.has(scale)) extents.set(scale, new WeakMap())
    const perScale = extents.get(scale)
    let perRoot = perScale.get(value)
    if (!perRoot) perScale.set(value, perRoot = new WeakMap())
    let e = perRoot.get(root)
    if (!e) {
        const ok = (v:number)=> isFinite(v) && (scale !== 'log' || v > 0)
        const [lo, hi] = d3.extent(root.descendants(), (d:N)=> { const v = value(d); return ok(v) ? v : undefined })
        e = [lo === undefined ? 1 : lo, hi === undefined ? 2 : hi]
        if (e[0] === e[1]) e = [e[0], e[0] * 2 || 1]
        perRoot.set(root, e)
    }
    return e
}

// the value mapped to [0, 1] over the tree's range (clamped; for log: values <= 0
// count as the minimum)
function unit(value:NodeValue, n:N, scale:ScaleType, v:number) : number {
    const domain = extentOf(value, n, scale)
    const s = scale === 'log' ? d3.scaleLog() : scale === 'linear' ? d3.scaleLinear() : d3.scaleSqrt()
    return s.domain(domain).range([0, 1]).clamp(true)(scale === 'log' ? Math.max(v, domain[0]) : v)
}

/** A color per node: the value over the tree's range (linear, sqrt or log scale) into a d3 color interpolator. */
export function colorBy(value:NodeValue, interpolator:(t:number)=> string = d3.interpolateViridis, opacity = 1, scale:ScaleType = 'sqrt') : (n:N)=> string {
    const cache = new WeakMap<N, string>()   // the values don't change: one color per node
    return (n:N)=> {
        if (!n) return undefined
        if (cache.has(n)) return cache.get(n)
        const v = value(n)
        let s:string = undefined
        if (isFinite(v)) {
            const c = d3.color(interpolator(unit(value, n, scale, v)))
            if (opacity < 1) c.opacity = opacity
            s = c.formatRgb()
        }
        cache.set(n, s)
        return s
    }
}

/** A size per node: the value over the tree's range (sqrt: area true to the value, or log) into [min, max]. */
export function sizeBy(value:NodeValue, range:[number, number], scale:ScaleType = 'sqrt') : (n:N)=> number {
    const cache = new WeakMap<N, number>()
    return (n:N)=> {
        if (cache.has(n)) return cache.get(n)
        const v = value(n)
        const s = isFinite(v) ? range[0] + (range[1] - range[0]) * unit(value, n, scale, v) : range[0]
        cache.set(n, s)
        return s
    }
}

// a function, a name of nodeValues ('weight', 'depth', 'height', 'value') or 'data.<key>'
export type ValueOption = NodeValue | string
// per color target: another value, a value with its own interpolator, or false (no color)
export type ColorOption = ValueOption | false | { value?:ValueOption, interpolator?:(t:number)=> string }

export interface InfovisOptions {
    value?:        ValueOption    // size (radius and width); default 'weight'
    radiusValue?:  ValueOption    // node radius; default value
    widthValue?:   ValueOption    // link width; default value
    colorValue?:   ValueOption    // color of links, disks, cells, label backgrounds; default value
    interpolator?: (t:number)=> string   // d3 color interpolator; default d3.interpolateViridis
    scale?:        ScaleType      // 'sqrt' (default) or 'log' (values over many magnitudes)
    colors?:       { links?:ColorOption, nodes?:ColorOption, cells?:ColorOption, labels?:ColorOption }
}

const toValue = (v:ValueOption | undefined, d:NodeValue) : NodeValue =>
    typeof v === 'function' ? v
    : typeof v === 'string' && v.startsWith('data.') ? dataValue(v.slice(5))
    : (typeof v === 'string' && nodeValues[v]) || d

// sizes at the center of the disk (the layers scale them toward the rim)
const radiusRange:[number, number] = [.006, .035]
const widthRange:[number, number]  = [.002, .03]

/**
 * infovis: a value as node radius and link width, a (second) value as color of the
 * links, node disks (every node), voronoi cells and label backgrounds; each color
 * target can have its own value and interpolator (options.colors).
 */
export function infovisModel(o:InfovisOptions = {}) : any {
    const scale = o.scale || 'sqrt'
    const value = toValue(o.value, nodeValues.weight)
    const colorValue = toValue(o.colorValue, value)
    const colorOf = (target:string, opacity = 1) : (n:N)=> string => {
        const c = o.colors && o.colors[target]
        if (c === false) return undefined
        const spec = (c && typeof c === 'object') ? c : { value: c as ValueOption, interpolator: undefined }
        return colorBy(toValue(spec.value, colorValue), spec.interpolator || o.interpolator, opacity, scale)
    }
    const cells = colorOf('cells', .25)
    const radius = sizeBy(toValue(o.radiusValue, value), radiusRange, scale)
    const width = sizeBy(toValue(o.widthValue, value), widthRange, scale)
    return {
        geometry: {
            nodeRadius: (ud, n:N)=> radius(n),
            linkWidth:  (n:N)=> width(n) * n.distScale,
            shrinkAtRim: 'full',     // labels shrink like the links and disks
            layerOptions: {
                'nodes':     { show: 'all', fill: colorOf('nodes'), hover: 'node' },
                'link-arcs': { stroke: colorOf('links') },
                'cells':     { invisible: false, fill: cells ? (p)=> cells(p && p.data) : undefined },
                'labels':    { background: colorOf('labels', .25) || false },
            }
        },
        interaction: {
            clickAction:   'select',   // a click toggles the selection
            selection:     'multi',
            maxSelections: 5,
        }
    }
}

const formatBytes = (b:number)=> {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
    return `${b < 10 && i ? b.toFixed(1) : Math.round(b)} ${units[i]}`
}

/**
 * infovis for a file system tree (nodes with data.size in bytes and data.files, the
 * number of files below; see test/fixtures/filesystem.d3.json): the size as cell
 * color and disk radius, the number of files as link color and width (log scales);
 * folder labels on two lines with their size.
 */
export function infovisFilesModel(o:InfovisOptions = {}) : any {
    const model = infovisModel(Object.assign({
        scale:       'log',
        radiusValue: 'data.size',
        widthValue:  'data.files',
        colorValue:  'data.size',
        colors: {
            cells:  'data.size',
            nodes:  'data.size',
            links:  { value: 'data.files', interpolator: (t:number)=> d3.interpolateYlOrRd(.3 + .7 * t) },
            labels: false,
        },
    }, o))
    model.langInitBFS = (ht, n:N)=> {
        const d = n.data || {}
        n.precalc.label = d.type === 'dir' && typeof d.size === 'number' ? `${d.name}\n${formatBytes(d.size)}` : d.name
    }
    return model
}

/**
 * infovis with emojis: emoji size bound to the value, labels without background,
 * links and disks colored by the (color) value.
 */
export function infovisEmojiModel(o:InfovisOptions = {}) : any {
    const scale = o.scale || 'sqrt'
    const value = toValue(o.value, nodeValues.weight)
    const color = colorBy(toValue(o.colorValue, value), o.interpolator, 1, scale)
    const width = sizeBy(value, widthRange, scale)
    return {
        geometry: {
            linkWidth:     (n:N)=> width(n) * n.distScale,
            linkCurvature: '0',      // straight links
            shrinkAtRim:   'none',   // the emoji size shows the value only, not the distance
            layerOptions: {
                'nodes':     { fill: color },
                'link-arcs': { stroke: color },
                'path-arcs': { hover: 'none' },          // no hover path
                'emojis':    { invisible: false, scale: sizeBy(value, [.7, 1.8], scale) },
                'images':    { invisible: false },       // nodes with precalc.imageHref
                'labels':    { background: false },
            }
        },
        interaction: {
            clickAction:   'select',
            selection:     'single',   // a new selection replaces the old one
        }
    }
}
