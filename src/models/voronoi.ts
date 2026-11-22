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

export function voronoiLayout<T>(x:(d:T)=> number, y:(d:T)=> number, extent:[[number, number], [number, number]]) : VoronoiLayout<T> {
    const bounds:[number, number, number, number] = [extent[0][0], extent[0][1], extent[1][0], extent[1][1]]
    return (data:T[])=> {
        const delaunay = Delaunay.from(data, x, y)
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
}
