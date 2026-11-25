import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { circleToView, infinityOf } from '../../models/transformation/cayley'

export interface FocusLayerArgs extends ILayerArgs
{
    name:       string,    
    className?: string,
    r:          ()=> number,
    center:     ()=> string,
}

export class FocusLayer implements ILayer
{    
    view:             ILayerView
    args:             FocusLayerArgs
    d3updatePattern:  D3UpdatePattern
    name:             string
   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args : FocusLayerArgs) {    
        this.view = view    
        this.args = args        
        this.name = args.name
    }

    // half-plane view: the image of the disk circle (any center, e.g. the λ circle at the
    // point of the last wheel zoom; that one used to be drawn unmapped) is a circle
    // (cayley.ts circleToView); through the point at infinity it is not drawn
    private transform() : string {
        const r = this.args.r(), c = this.args.center()
        if (!this.view.hypertree.args.geometry.halfPlane)
            return `translate(${c}) scale(${r})`
        const [re, im] = c.split(' ').map(Number)
        const v = r > 0 && Math.hypot(re, im) + r < 1
                ? circleToView({ re, im }, r, infinityOf(this.view.hypertree.args.layout.rootWedge)) : null
        return v ? `translate(${v.cx} ${v.cy}) scale(${v.r})` : 'translate(0 0) scale(0)'
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         this.args.className || 'focus-circle',
            elementType:       'circle',
            create:            s=> s.attr('r', 1),
            updateColor:       s=> {},
            updateTransform:   s=> s.attr('transform', this.transform()),
        })
    }
}





