import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern }    from '../layerstack/d3updatePattern'

export interface BackgroundLayerArgs extends ILayerArgs
{
}

// The half-plane (cayley.ts) and a grid in its coordinates. The view draws w with y
// downward (the border at the top, view y = −1); upright that is the lower half-plane
// conj(w), so the labels say (x, −Im w): (0,0) on the border, (0,−1) the center of the
// disk (view 0,0), (±1,0) on the border. Lines every 0.5, labels every 1.
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

export class BackgroundLayer implements ILayer
{    
    view:            ILayerView
    args:            BackgroundLayerArgs
    d3updatePattern: D3UpdatePattern
    name =           'background'
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:BackgroundLayerArgs) {
        this.view = view
        this.args = args
    }

    private attach() {
        // half-plane view: the half-plane below the border (view y = −1), wide enough for
        // any aspect ratio of the view, with a grid to find one's way (halfPlaneGrid)
        if (this.view.hypertree.args.geometry.halfPlane) {
            this.d3updatePattern = new D3UpdatePattern({
                parent:            this.view.parent,
                layer:             this,
                data:              [1],
                name:              this.name,
                className:         'background-halfplane',
                elementType:       'g',
                create:            s=> s.each(function() { halfPlaneGrid(this as SVGGElement) }),
                updateColor:       s=> {},
                updateTransform:   s=> {},
            })
            return
        }
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         'background-circle',
            elementType:       'circle',
            create:            s=> s.attr('r', 1)
                                    .attr('fill', 'url(#exampleGradient)'),
            updateColor:       s=> {},
            updateTransform:   s=> {},
        })
    }
}