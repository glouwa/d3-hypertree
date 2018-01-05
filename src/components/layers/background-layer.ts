import { ILayer }        from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface BackgroundLayerArgs
{
    
}

export class BackgroundLayer implements ILayer
{    
    args:             BackgroundLayerArgs
    d3updatePattern:  D3UpdatePattern
    name =            'background'     
    update = {
        parent:         ()=> this.attach(this.args.view.parent),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(args : BackgroundLayerArgs) {        
        this.args = args
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,            
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



