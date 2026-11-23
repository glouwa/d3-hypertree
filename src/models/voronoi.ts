import { Delaunay } from 'd3'

// The voronoi diagram of the visible nodes, built with d3-delaunay (d3 v7 has no
// d3.voronoi any more). Same interface as the d3 v4 diagram that the layers and
// the interaction use: polygons() with the node as polygon.data, find(x, y) with
// the node as result.data.

export type VoronoiPolygon<T> = [number, number][] & { data:T }

export interface VoronoiDiagram<T> {
    polygons() : VoronoiPolygon<T>[]
    find(x:number, y:number) : { data:T } | undefined
}

export type VoronoiLayout<T> = (data:T[])=> VoronoiDiagram<T>

type Bounds = [number, number, number, number]   // x0, y0, x1, y1

export function voronoiLayout<T>(x:(d:T)=> number, y:(d:T)=> number, extent:[[number, number], [number, number]]) : VoronoiLayout<T> {
    const bounds:Bounds = [extent[0][0], extent[0][1], extent[1][0], extent[1][1]]
    return (data:T[])=> {
        const c = new Float64Array(data.length * 2)
        data.forEach((d, i)=> { c[2 * i] = x(d); c[2 * i + 1] = y(d) })
        return collinearDiagram(data, c, bounds) || delaunayDiagram(data, c, bounds)
    }
}

function delaunayDiagram<T>(data:T[], c:Float64Array, bounds:Bounds) : VoronoiDiagram<T> {
    const delaunay = new Delaunay(c)
    let polygons:VoronoiPolygon<T>[] = null
    return {
        polygons: ()=> {
            if (polygons) return polygons
            const voronoi = delaunay.voronoi(bounds)
            polygons = []
            for (let i = 0; i < data.length; i++) {
                const ring = voronoi.cellPolygon(i)   // closed: the last point repeats the first
                if (!ring) continue                    // a coincident point has no cell
                const p = <VoronoiPolygon<T>>ring.slice(0, -1)
                p.data = data[i]
                polygons.push(p)
            }
            return polygons
        },
        find: (px:number, py:number)=> {
            if (!data.length) return undefined
            const i = delaunay.find(px, py)
            return i >= 0 ? { data:data[i] } : undefined
        },
    }
}

// Points on one line (a path tree is laid out on a line): d3-delaunay jitters them by
// 1e-8 of the extent, which left most of them without a cell (21 cells for 102 nodes).
// Here the cells are exact: the strip between the perpendicular bisectors to the
// neighbors on the line, clipped to the bounds. Returns undefined if not collinear.
function collinearDiagram<T>(data:T[], c:Float64Array, bounds:Bounds) : VoronoiDiagram<T> | undefined {
    const n = data.length
    if (n < 3) return undefined
    let j = 1
    while (j < n && c[2 * j] === c[0] && c[2 * j + 1] === c[1]) j++
    if (j === n) return undefined
    const ux0 = c[2 * j] - c[0], uy0 = c[2 * j + 1] - c[1], len = Math.hypot(ux0, uy0)
    const ux = ux0 / len, uy = uy0 / len
    for (let i = 0; i < n; i++)
        if (Math.abs(ux * (c[2 * i + 1] - c[1]) - uy * (c[2 * i] - c[0])) > 1e-9) return undefined

    // position along the line, sorted; points at the same position share one cell (the first)
    const t = (px:number, py:number)=> (px - c[0]) * ux + (py - c[1]) * uy
    const order = Array.from({ length: n }, (_, i)=> i).sort((a, b)=> t(c[2 * a], c[2 * a + 1]) - t(c[2 * b], c[2 * b + 1]))
    const ts = order.map(i=> t(c[2 * i], c[2 * i + 1]))
    const distinct:number[] = []                                   // indices into order
    for (let k = 0; k < n; k++) if (k === 0 || ts[k] !== ts[k - 1]) distinct.push(k)

    let polygons:VoronoiPolygon<T>[] = null
    return {
        polygons: ()=> {
            if (polygons) return polygons
            const rect:[number, number][] = [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]]
            polygons = []
            distinct.forEach((k, m)=> {
                const lo = m === 0 ? -Infinity : (ts[distinct[m - 1]] + ts[k]) / 2
                const hi = m === distinct.length - 1 ? Infinity : (ts[k] + ts[distinct[m + 1]]) / 2
                let poly = rect
                if (lo > -Infinity) poly = clip(poly, (px, py)=> t(px, py) - lo)
                if (hi < Infinity)  poly = clip(poly, (px, py)=> hi - t(px, py))
                if (poly.length < 3) return
                const p = <VoronoiPolygon<T>>poly
                p.data = data[order[k]]
                polygons.push(p)
            })
            return polygons
        },
        find: (px:number, py:number)=> {
            // binary search for the nearest position along the line
            const q = t(px, py)
            let lo = 0, hi = distinct.length - 1
            while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ts[distinct[mid]] < q) lo = mid; else hi = mid }
            const k = Math.abs(ts[distinct[lo]] - q) <= Math.abs(ts[distinct[hi]] - q) ? distinct[lo] : distinct[hi]
            return { data:data[order[k]] }
        },
    }
}

// Sutherland-Hodgman: the part of a convex polygon where f(x, y) >= 0 (f linear)
function clip(poly:[number, number][], f:(x:number, y:number)=> number) : [number, number][] {
    const out:[number, number][] = []
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length]
        const fa = f(a[0], a[1]), fb = f(b[0], b[1])
        if (fa >= 0) out.push(a)
        if ((fa >= 0) !== (fb >= 0)) {
            const s = fa / (fa - fb)
            out.push([a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])])
        }
    }
    return out
}
