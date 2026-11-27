// How the hyperbolic plane appears on the screen (docs/dev/REFACTORING.md, section 4).
//
// Layout, filter and transformation work in the Poincaré disk. A projection maps the
// disk positions of a frame into view coordinates at the end of the pipeline, maps
// pointer input back, and draws the geometric primitives (geodesics, circles, the
// background) in view coordinates. The layers ask the projection; they hold no
// knowledge of the view: PoincareProjection (projection/poincare.ts) is the disk itself,
// CayleyProjection (projection/cayley.ts) the half-plane view, SchwarzChristoffelProjection the rectangle.
//
// Selected by geometry.projection: 'poincare' | 'cayley' | 'schwarz-christoffel' | an own Projection.

import { N } from '../data/n'
import { C } from '../geometry/hyperbolic-math'

export type ArcCurvature = '+' | '0' | '-' | 'l'

export interface ViewBox {
    viewBox:    string      // the svg's viewBox
    transform:  string      // the transform of the plane's group (unit: the disk radius)
}

export interface Projection {
    readonly kind: string

    // positions ---------------------------------------------------------------------
    /**
     * Maps the visible nodes of a frame into the view (after culling): n.cache becomes
     * the view position (n.cacheDisk keeps the disk position), n.distScale is scaled by
     * the map, nodes outside the view get n.outOfView. Returns the nodes.
     */
    project(nodes:N[]): N[]
    /** A view position (pointer) as a disk position. */
    toDisk(view:C): C
    /** A disk position as a view position. */
    toView(disk:C): C

    // primitives, in view coordinates -----------------------------------------------
    /** The svg path from view position a to b along the geodesic through them. */
    geodesic(a:C, b:C, curvature:ArcCurvature): string
    /** The svg path of the root's stem from its view position into the root wedge's gap. */
    stem(root:C, curvature:ArcCurvature): string
    /** The image of the disk circle around center (disk position) with radius r; null: not drawable (through infinity). */
    circle(center:C, r:number): { cx:number, cy:number, r:number } | null
    /** The direction away from the center at a view position (unit vector). */
    outward(view:C): C
    /** How far out a view position is: 0 at the center .. 1 at the rim/border. */
    rim(view:C): number

    // host --------------------------------------------------------------------------
    /** The svg viewBox and the plane's transform for a drawn box (px) and geometry.diskSize. */
    viewBox(width:number, height:number, diskSize:number): ViewBox
    /** Whether the viewBox depends on the drawn box (the host then follows resizes). */
    readonly followsSize: boolean
    /** Appends the clip shape of the drawn plane to a clipPath (d3 selection). */
    clip(clipPath:any, clipRadius:number): void
    /** The extent of the voronoi diagram of the cells. */
    voronoiExtent(): [[number, number], [number, number]]
    /** The background: element type, class and how to create it (d3 selection). */
    background(): { elementType:string, className:string, create:(s:any)=> void }
    /** The start view of api.overview: P kept where the root stays in the picture. */
    overviewClamp(P:C): C
}
