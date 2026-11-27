import { N }                          from '../data/n'
import { C }                          from '../geometry/hyperbolic-math'
import { Projection, ArcCurvature, ViewBox } from './projection'
import { toView, viewToDisk, mapToView, circleToView, infinityOf, BORDER_Y } from '../geometry/cayley'

// The rectangular view: the half-plane model via the Cayley transform (cayley.ts).
// Drawn with the border at the top (view y = −1) and the gap of the root wedge at
// infinity below, so it looks like the disk: the root at the bottom with its stem,
// the tree growing up to the border. Geodesics are semicircles centered on the
// border, or vertical lines.
export class CayleyProjection implements Projection
{
    readonly kind = 'cayley'
    readonly followsSize = true
    // the direction of the disk that goes to infinity: the middle of the root wedge's gap
    private g:C

    constructor(rootWedge:{ orientation:number, angle:number }) {
        this.g = infinityOf(rootWedge)
    }

    project(nodes:N[]) : N[] { return mapToView(nodes, this.g) }
    toDisk(view:C) : C { return viewToDisk(view, this.g) }
    toView(disk:C) : C { return toView(disk, this.g) }

    geodesic(a:C, b:C, curvature:ArcCurvature) : string {
        if (curvature === '0' || curvature === 'l') return `M ${a.re} ${a.im} L ${b.re} ${b.im}`
        const x1 = a.re, y1 = a.im - BORDER_Y, x2 = b.re, y2 = b.im - BORDER_Y
        if (Math.abs(x1 - x2) < 1e-9 * (1 + Math.abs(x1)))
            return `M ${x1} ${a.im} L ${x2} ${b.im}`
        const c = (x1 * x1 + y1 * y1 - x2 * x2 - y2 * y2) / (2 * (x1 - x2))
        const r = Math.hypot(x1 - c, y1)
        // the arc hangs below the border: from left to right is counterclockwise on
        // screen (sweep 0)
        return `M ${x1} ${a.im} A ${r} ${r}, 0, 0, ${x1 < x2 ? 0 : 1}, ${x2} ${b.im}`
    }

    // the root's stem: into the wedge gap, at infinity below
    stem(root:C, curvature:ArcCurvature) : string { return `M ${root.re} ${root.im} L ${root.re} 3` }

    // the image of a disk circle (any center, e.g. the λ circle at the point of the
    // last wheel zoom) is a circle; through the point at infinity it is not drawn
    circle(center:C, r:number) {
        return r > 0 && Math.hypot(center.re, center.im) + r < 1 ? circleToView(center, r, this.g) : null
    }

    outward(view:C) : C { return { re: 0, im: -1 } }                  // up, toward the border
    rim(view:C) : number { return Math.max(0, -view.im) }

    // a rectangle with the aspect ratio of the drawn box; the view coordinates stay
    // (y from about −1 to 1, x as wide as the rectangle)
    viewBox(width:number, height:number, diskSize:number) : ViewBox {
        const aspect = width > 0 && height > 0 ? width / height : 1.6
        const w = Math.round(1000 * aspect)
        return { viewBox: `0 0 ${w} 1000`, transform: `translate(${w / 2},500) scale(480)` }
    }
    // the half-plane below the border (view y = −1, the view ends at about y = 1), wide
    // enough for any aspect ratio
    clip(clipPath:any, clipRadius:number) { clipPath.append('rect').attr('x', -20).attr('y', -1).attr('width', 40).attr('height', 3) }
    voronoiExtent() : [[number, number], [number, number]] { return [[-20, -1], [20, 2]] }
    background() {
        return { elementType: 'g', className: 'background-halfplane',
                 create: (s:any)=> s.each(function() { halfPlaneGrid(this as SVGGElement) }) }
    }
    // the root (at P) in the picture, just above the bottom edge with its stem below it
    // (view y .85: |z| = .85 / 2.85); the disk's P (|z| up to .5) put it far below the view
    overviewClamp(P:C) : C {
        const r = Math.hypot(P.re, P.im), max = .85 / 2.85
        return r > max ? { re: P.re * max / r, im: P.im * max / r } : P
    }
}

// The half-plane and a grid in its coordinates. The view draws w with y downward (the
// border at the top, view y = −1); upright that is the lower half-plane conj(w), so the
// labels say (x, −Im w): (0,0) on the border, (0,−1) the center of the disk (view 0,0),
// (±1,0) on the border. Lines every 0.5, labels every 1.
function halfPlaneGrid(g:SVGGElement) {
    const NS = 'http://www.w3.org/2000/svg'
    const add = (tag:string, attrs:{[k:string]:string|number}, text?:string)=> {
        const e = document.createElementNS(NS, tag)
        for (const k in attrs) e.setAttribute(k, String(attrs[k]))
        if (text !== undefined) e.textContent = text
        g.appendChild(e)
        return e
    }
    const top = -1, bottom = 2, X = 20, line = 'rgba(128,128,128,.22)', axis = 'rgba(128,128,128,.55)'
    const ink = 'rgba(128,128,128,.85)', font = { 'font-size': .028, 'font-family': 'sans-serif' }
    const num = (v:number)=> v === 0 ? '0' : (v < 0 ? '−' : '') + Math.abs(v)
    add('rect', { x: -X, y: top, width: 2 * X, height: bottom - top, fill: 'rgba(128,128,128,.07)', 'class': 'background-halfplane-area' })
    for (let x = -X; x <= X; x += .5)
        add('line', { x1: x, y1: top, x2: x, y2: bottom, stroke: x === 0 ? axis : line, 'stroke-width': x % 1 ? .0015 : .0025, 'class': 'halfplane-grid' })
    for (let h = 0; h <= bottom - top; h += .5)
        add('line', { x1: -X, y1: top + h, x2: X, y2: top + h, stroke: h === 0 ? axis : line, 'stroke-width': h === 0 ? .004 : h % 1 ? .0015 : .0025, 'class': 'halfplane-grid' })
    // labels: x along the border, the height along the middle axis
    for (let x = -X; x <= X; x++)
        if (Math.abs(x) > 1) add('text', { x: x + .01, y: top + .035, fill: ink, ...font, 'class': 'halfplane-grid-label' }, num(x))
    for (let h = 2; h <= bottom - top; h++)
        add('text', { x: .01, y: top + h - .01, fill: ink, ...font, 'class': 'halfplane-grid-label' }, `${num(-h)}i`)
    // the named points
    for (const [x, h, label] of [[0, 0, '(0,0)'], [0, 1, '(0,−1)  disk center'], [1, 0, '(1,0)'], [-1, 0, '(−1,0)']] as [number, number, string][]) {
        add('circle', { cx: x, cy: top + h, r: .006, fill: ink, 'class': 'halfplane-grid-point' })
        add('text', { x: x + .012, y: top + h + (h === 0 ? .035 : -.012), fill: ink, ...font, 'font-weight': 'bold', 'class': 'halfplane-grid-label' }, label)
    }
}
