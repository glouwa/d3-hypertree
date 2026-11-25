import { Projection }          from './projection'
import { DiskProjection }      from './disk'
import { HalfPlaneProjection } from './halfplane'

export type { Projection, ArcCurvature, ViewBox } from './projection'
export { DiskProjection, HalfPlaneProjection }

/** The projection of geometry.view: 'disk', 'halfplane' or an own Projection. */
export function createProjection(view:'disk' | 'halfplane' | Projection | undefined,
                                 rootWedge:{ orientation:number, angle:number }) : Projection {
    if (view && typeof view === 'object') return view
    if (view === 'halfplane') return new HalfPlaneProjection(rootWedge)
    return new DiskProjection()
}
