import { ILayer }        from '../layer'
import { D3UpdateLayer } from '../layer'

export interface FocusLayerArgs
{
    r: ()=> number
}

export class FocusLayer implements ILayer
{    
    args: FocusLayerArgs
    layer: D3UpdateLayer
    name =            'focus'
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args : FocusLayerArgs) {        
        this.args = args        
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,
            layersArgs:        this.args,
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





