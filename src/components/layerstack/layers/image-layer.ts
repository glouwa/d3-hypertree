import * as d3           from 'd3'
import { ILayer }        from '../layer'
import { D3UpdateLayer } from '../layer'

export interface ImageLayerArgs
{
    name:      string,
    data:      ()=> any,    
    imagehref,
    delta,
    transform,
}

export class ImageLayer implements ILayer
{    
    args:             ImageLayerArgs
    layer:            D3UpdateLayer
    name:             string
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args: ImageLayerArgs) {
        this.args = args
        this.name = args.name
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,            
            data:              this.args.data,
            name:              this.args.name,
            className:         'node',
            elementType:       'image',
            create:            s=> s.attr('xlink:href', d=> this.args.imagehref(d))
                                    .attr('width', .05)
                                    .attr('height', .05),
            updateColor:       s=> {},
            updateTransform:   s=> s.attr("transform", (d, i, v)=> this.args.transform(d, this.args.delta(d, i, v)))
        })
    }
}
