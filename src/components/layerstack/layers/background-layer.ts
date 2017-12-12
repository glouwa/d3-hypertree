import { ILayer }        from '../layer'
import { D3UpdateLayer } from '../layer'

export interface BackgroundLayerArgs
{
}

export class BackgroundLayer implements ILayer
{    
    args: BackgroundLayerArgs
    layer: D3UpdateLayer
    name =            'background'  
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args : BackgroundLayerArgs) {        
        this.args = args
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,
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



