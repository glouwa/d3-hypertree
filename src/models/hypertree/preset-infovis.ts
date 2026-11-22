import * as d3 from 'd3'
import { N } from '../n/n'

// Building blocks for information visualization presets: a value per node, mapped
// with d3-scales to colors (links, node disks, label backgrounds, voronoi cells)
// and sizes (node radius, link width, label and emoji size).

export type NodeValue = (n:N)=> number

// values from the structure of the tree (no own data needed)
export const nodeValues : { [name:string]: NodeValue } = {
    weight: n=> n.precalc.visWeight || 1,       // summed layout weight: leaves below the node
    depth:  n=> n.depth,
    height: n=> n.height,
    value:  n=> n.data && typeof n.data.value === 'number' ? n.data.value : NaN,   // own data: n.data.value
}

// [min, max] of a value over the whole tree, computed once per tree (the root is
// found through the parents, without allocating)
const extents = new WeakMap<NodeValue, WeakMap<N, [number, number]>>()
function extentOf(value:NodeValue, n:N) : [number, number] {
    let root = n
    while (root.parent) root = root.parent
    let perRoot = extents.get(value)
    if (!perRoot) extents.set(value, perRoot = new WeakMap())
    let e = perRoot.get(root)
    if (!e) {
        const [lo, hi] = d3.extent(root.descendants(), (d:N)=> { const v = value(d); return isFinite(v) ? v : undefined })
        e = [lo === undefined ? 0 : lo, hi === undefined ? 1 : hi]
        if (e[0] === e[1]) e = [e[0], e[0] + 1]
        perRoot.set(root, e)
    }
    return e
}

/** A color per node: value -> d3.scaleSequentialSqrt(interpolator) over the tree's range. */
export function colorBy(value:NodeValue, interpolator:(t:number)=> string = d3.interpolateViridis, opacity = 1) : (n:N)=> string {
    const cache = new WeakMap<N, string>()   // the values don't change: one color per node
    return (n:N)=> {
        if (!n) return undefined
        if (cache.has(n)) return cache.get(n)
        const v = value(n)
        let s:string = undefined
        if (isFinite(v)) {
            const c = d3.color(d3.scaleSequentialSqrt(interpolator).domain(extentOf(value, n))(v))
            if (opacity < 1) c.opacity = opacity
            s = c.formatRgb()
        }
        cache.set(n, s)
        return s
    }
}

/** A size per node: value -> d3.scaleSqrt (area true to the value) into [min, max]. */
export function sizeBy(value:NodeValue, range:[number, number]) : (n:N)=> number {
    const cache = new WeakMap<N, number>()
    return (n:N)=> {
        if (cache.has(n)) return cache.get(n)
        const v = value(n)
        const s = isFinite(v) ? d3.scaleSqrt().domain(extentOf(value, n)).range(range).clamp(true)(v) : range[0]
        cache.set(n, s)
        return s
    }
}

export interface InfovisOptions {
    value?:        NodeValue | string    // size (radius, width); default 'weight'
    colorValue?:   NodeValue | string    // color; default: the same as value
    interpolator?: (t:number)=> string   // d3 color interpolator; default d3.interpolateViridis
}

const toValue = (v:NodeValue | string | undefined, d:NodeValue)=>
    typeof v === 'function' ? v : (typeof v === 'string' && nodeValues[v]) || d

// sizes at the center of the disk (the layers scale them toward the rim)
const radiusRange:[number, number] = [.006, .035]
const widthRange:[number, number]  = [.002, .03]

/**
 * infovis: a value as node radius and link width, a (second) value as color of the
 * links, node disks (every node), voronoi cells and label backgrounds.
 */
export function infovisModel(o:InfovisOptions = {}) : any {
    const value = toValue(o.value, nodeValues.weight)
    const colorValue = toValue(o.colorValue, value)
    const color = colorBy(colorValue, o.interpolator)
    const tint = colorBy(colorValue, o.interpolator, .25)
    const radius = sizeBy(value, radiusRange)
    const width = sizeBy(value, widthRange)
    return {
        geometry: {
            nodeRadius: (ud, n:N)=> radius(n),
            linkWidth:  (n:N)=> width(n) * n.distScale,
            shrinkAtRim: 'full',     // labels shrink like the links and disks
            layerOptions: {
                'nodes':     { show: 'all', fill: color, hover: 'node' },
                'link-arcs': { stroke: color },
                'cells':     { invisible: false, fill: (p)=> tint(p && p.data) },
                'labels':    { background: tint },
            }
        },
        interaction: {
            clickAction:   'select',   // a click toggles the selection
            selection:     'multi',
            maxSelections: 5,
        }
    }
}

/**
 * infovis with emojis: emoji size bound to the value, labels without background,
 * links and disks colored by the (color) value.
 */
export function infovisEmojiModel(o:InfovisOptions = {}) : any {
    const value = toValue(o.value, nodeValues.weight)
    const colorValue = toValue(o.colorValue, value)
    const color = colorBy(colorValue, o.interpolator)
    const width = sizeBy(value, widthRange)
    return {
        geometry: {
            linkWidth:     (n:N)=> width(n) * n.distScale,
            linkCurvature: '0',      // straight links
            shrinkAtRim:   'none',   // the emoji size shows the value only, not the distance
            layerOptions: {
                'nodes':     { fill: color },
                'link-arcs': { stroke: color },
                'path-arcs': { hover: 'none' },          // no hover path
                'emojis':    { invisible: false, scale: sizeBy(value, [.7, 1.8]) },
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
