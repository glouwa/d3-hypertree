import { Projection }          from './projection'
import { PoincareProjection }      from './poincare'
import { CayleyProjection } from './cayley'
import { SchwarzChristoffelProjection } from './schwarz-christoffel'
import { GlatzhoferProjection }  from './glatzhofer'

export type { Projection, ArcCurvature, ViewBox } from './projection'
export { PoincareProjection, CayleyProjection, SchwarzChristoffelProjection, GlatzhoferProjection }

/** The projection of geometry.projection: 'poincare', 'cayley', 'schwarz-christoffel', 'glatzhofer' or an own Projection. */
export function createProjection(view:'poincare' | 'cayley' | 'schwarz-christoffel' | 'glatzhofer' | Projection | undefined,
                                 rootWedge:{ orientation:number, angle:number }) : Projection {
    if (view && typeof view === 'object') return view
    if (view === 'cayley') return new CayleyProjection(rootWedge)
    if (view === 'schwarz-christoffel') return new SchwarzChristoffelProjection(rootWedge)
    if (view === 'glatzhofer') return new GlatzhoferProjection(rootWedge)
    return new PoincareProjection()
}
