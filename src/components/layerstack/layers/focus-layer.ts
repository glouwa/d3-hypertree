import { ILayer }        from '../layer'
import { D3UpdatePattern } from '../d3updatePattern'

export interface FocusLayerArgs
{
    r: ()=> number
}

export class FocusLayer implements ILayer
{    
    args: FocusLayerArgs
    d3updatePattern: D3UpdatePattern
    name =            'focus'
    updateData =      ()=> this.d3updatePattern.updateData()
    updateTransform = ()=> this.d3updatePattern.updateTransform()
    updateColor =     ()=> this.d3updatePattern.updateColor()

    constructor(args : FocusLayerArgs) {        
        this.args = args        
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,
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





