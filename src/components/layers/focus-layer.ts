import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface FocusLayerArgs
{
    r: ()=> number
}

export class FocusLayer implements ILayer
{    
    view:             ILayerView
    args:             FocusLayerArgs
    d3updatePattern:  D3UpdatePattern
    name =            'focus'
   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args : FocusLayerArgs) {    
        this.view = view    
        this.args = args        
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         'focus-circle',
            elementType:       'circle',
            create:            s=> {},
            updateColor:       s=> {},
            updateTransform:   s=> s.attr('r', this.args.r),
        })
    }
}




