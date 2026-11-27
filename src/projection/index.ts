import { Projection }          from './projection'
import { PoincareProjection }      from './poincare'
import { CayleyProjection } from './cayley'
import { SchwarzChristoffelProjection } from './schwarz-christoffel'

export type { Projection, ArcCurvature, ViewBox } from './projection'
export { PoincareProjection, CayleyProjection, SchwarzChristoffelProjection }

/** The projection of geometry.projection: 'poincare', 'cayley', 'schwarz-christoffel' or an own Projection. */
export function createProjection(view:'poincare' | 'cayley' | 'schwarz-christoffel' | Projection | undefined,
                                 rootWedge:{ orientation:number, angle:number }) : Projection {
    if (view && typeof view === 'object') return view
    if (view === 'cayley') return new CayleyProjection(rootWedge)
    if (view === 'schwarz-christoffel') return new SchwarzChristoffelProjection(rootWedge)
    return new PoincareProjection()
}
