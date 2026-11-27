import { N }                          from '../data/n'
import { C, CsubC, CktoCp, arcCenter } from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'

// The Poincaré disk as it is: view positions are the disk positions, geodesics are
// circular arcs orthogonal to the rim (hyperbolic-math.ts arcCenter), the root's stem
// goes straight down to the rim.
export class PoincareProjection implements Projection
{
    readonly kind = 'poincare'
    readonly followsSize = false

    project(nodes:N[]) : N[] { return nodes }      // n.cache is the view position already
    toDisk(view:C) : C { return view }
    toView(disk:C) : C { return disk }

    geodesic(a:C, b:C, curvature:ArcCurvature) : string {
        if (curvature === '0' || curvature === 'l') return `M ${a.re} ${a.im} L ${b.re} ${b.im}`
        const arc = arcCenter(a, b)
        let r = CktoCp(CsubC(b, arc.c)).r
        if (isNaN(r) || r > 1000) r = 0
        // the sweep: '+' and '-' bend the arc to the other side
        const f = (arc.d > 0) === (curvature === '+') ? '1' : '0'
        return `M ${a.re} ${a.im} A ${r} ${r}, 0, 0, ${f}, ${b.re} ${b.im}`
    }

    stem(root:C, curvature:ArcCurvature) : string {
        return this.geodesic(root, { re: root.re, im: 1 }, curvature)
    }

    circle(center:C, r:number) { return { cx: center.re, cy: center.im, r } }

    outward(view:C) : C {
        const r = Math.hypot(view.re, view.im)
        return r > 1e-9 ? { re: view.re / r, im: view.im / r } : { re: 0, im: -1 }
    }
    rim(view:C) : number { return Math.hypot(view.re, view.im) }

    // geometry.diskSize: the diameter of the disk in the square view (.96); above 1 it
    // reaches beyond the view (cut at its edges, e.g. on a phone)
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        return { viewBox: '0 0 1000 1000', transform: `translate(500,500) scale(${500 * diskSize})` }
    }
    clip(clipPath:any, clipRadius:number) { clipPath.append('circle').attr('r', clipRadius) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-2, -2], [2, 2]] }
    background() {
        return { elementType: 'circle', className: 'background-circle',
                 create: (s:any)=> s.attr('r', 1).attr('fill', 'url(#exampleGradient)') }
    }
    overviewClamp(P:C) : C { return P }
}
