import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

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

    // half-plane view: the image of the circle |z| = r around the disk center is a
    // circle on the vertical middle axis, from height (1−r)/(1+r) to (1+r)/(1−r)
    private transform() : string {
        const r = this.args.r(), c = this.args.center()
        if (!this.view.hypertree.args.geometry.halfPlane || c !== '0 0' || !(r < 1))
            return `translate(${c}) scale(${r})`
        const top = (1 + r) / (1 - r), bottom = (1 - r) / (1 + r)
        return `translate(0 ${1 - (top + bottom) / 2}) scale(${(top - bottom) / 2})`
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





