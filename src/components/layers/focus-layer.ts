import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { C }               from '../../models/transformation/hyperbolic-math'

export interface FocusLayerArgs extends ILayerArgs
{
    name:   string,    
    r:      ()=> number,
    center: ()=> string,
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

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         'focus-circle',
            elementType:       'circle',
            create:            s=> s.attr('r', 1),
            updateColor:       s=> {},
            updateTransform:   s=> s.attr('transform', `translate(${this.args.center()}) scale(${this.args.r()})`),
        })
    }
}





