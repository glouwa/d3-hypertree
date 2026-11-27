import { Projection }          from './projection'
import { PoincareProjection }      from './poincare'
import { CayleyProjection } from './cayley'
import { SchwarzChristoffelProjection } from './schwarz-christoffel'
import { GlatzhoferProjection }  from './glatzhofer'
import { BandProjection }        from './band'
import { HalfBandProjection }    from './half-band'
import { RadialProjection, StretchProjection, SquircleProjection, SectorProjection } from './euclidean'

export type { Projection, ArcCurvature, ViewBox } from './projection'
export { PoincareProjection, CayleyProjection, SchwarzChristoffelProjection, GlatzhoferProjection, BandProjection, HalfBandProjection,
         RadialProjection, StretchProjection, SquircleProjection, SectorProjection }

/** The named projections (geometry.projection). */
export type ProjectionName = 'poincare' | 'cayley' | 'schwarz-christoffel' | 'glatzhofer' | 'band' | 'half-band'
                           | 'klein' | 'equal-area' | 'equidistant' | 'gans' | 'stretch' | 'squircle' | 'sector'

/** The projection of geometry.projection: a ProjectionName or an own Projection. */
export function createProjection(view:ProjectionName | Projection | undefined,
                                 rootWedge:{ orientation:number, angle:number }) : Projection {
    if (view && typeof view === 'object') return view
    switch (view) {
        case 'cayley':              return new CayleyProjection(rootWedge)
        case 'schwarz-christoffel': return new SchwarzChristoffelProjection(rootWedge)
        case 'glatzhofer':          return new GlatzhoferProjection(rootWedge)
        case 'band':                return new BandProjection(rootWedge)
        case 'half-band':           return new HalfBandProjection(rootWedge)
        case 'klein': case 'equal-area': case 'equidistant': case 'gans':
                                    return new RadialProjection(view, rootWedge)
        case 'stretch':             return new StretchProjection(rootWedge)
        case 'squircle':            return new SquircleProjection(rootWedge)
        case 'sector':              return new SectorProjection(rootWedge)
    }
    return new PoincareProjection()
}

/**
 * The projections whose view center is the disk's center and that map the whole disk
 * bijectively: interaction.keepTreeInView applies its disk rules there (not in the
 * half-plane, whose focus is no visible point, nor in own projections).
 */
export const KEEP_IN_VIEW_KINDS = new Set(['poincare', 'schwarz-christoffel', 'glatzhofer', 'band', 'half-band',
                                           'klein', 'equal-area', 'equidistant', 'gans', 'stretch', 'squircle', 'sector'])
