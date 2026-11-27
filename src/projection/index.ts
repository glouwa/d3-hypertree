import { Projection }          from './projection'
import { DiskProjection }      from './disk'
import { HalfPlaneProjection } from './halfplane'
import { RectangleProjection } from './rectangle'

export type { Projection, ArcCurvature, ViewBox } from './projection'
export { DiskProjection, HalfPlaneProjection, RectangleProjection }

/** The projection of geometry.view: 'disk', 'halfplane', 'rectangle' or an own Projection. */
export function createProjection(view:'disk' | 'halfplane' | 'rectangle' | Projection | undefined,
                                 rootWedge:{ orientation:number, angle:number }) : Projection {
    if (view && typeof view === 'object') return view
    if (view === 'halfplane') return new HalfPlaneProjection(rootWedge)
    if (view === 'rectangle') return new RectangleProjection(rootWedge)
    return new DiskProjection()
}
