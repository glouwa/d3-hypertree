import { N }                              from '../data/n'
import { VoronoiDiagram, VoronoiPolygon } from './voronoi'

// The result of a frame of the filter (filter/culling.ts cacheUpdate): the visible
// nodes, the center node, the groups the layers draw (links, paths, labels, emojis,
// cells) and the weight filter's state between frames. Held by the transformation
// (navigation/transformation.ts) for historical reasons, filled by the filter, read
// by the layers. The name is v1's and part of the public API.
export class TransformationCache
{
    N:              number
    focusR:         number
    centerNode:     N
    unculledNodes:  N[]
    // the weight filter's last selection (magic-filter.ts adjustMagic): the magic at
    // which the next visible node is hidden, the next hidden one shows (null: none)
    nextHideAt?:    number | null
    nextShowAt?:    number | null
    // of the visible nodes those drawn whatever their weight (in the focus circle or a
    // child of a node in it); adjustMagic counts only the others against rangeNodes
    focusCount?:    number
    links:          N[]
    leafOrLazy:     N[]
    spezialNodes:   N[]
    paths:          N[]
    weights:        N[]
    labels:         N[]
    labelsByMax?:   { [max:number]: N[] }   // labels of layers with their own maxLabels
    emojis:         N[]
    images:         N[]

    voronoiDiagram: VoronoiDiagram<N>
    cells:          VoronoiPolygon<N>[] = []
}
