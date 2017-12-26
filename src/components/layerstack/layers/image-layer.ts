import * as d3           from 'd3'
import { ILayer }        from '../layer'
import { D3UpdatePattern } from '../d3updatePattern'

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
    d3updatePattern:            D3UpdatePattern
    name:             string
    updateData =      ()=> this.d3updatePattern.updateData()
    updateTransform = ()=> this.d3updatePattern.updateTransform()
    updateColor =     ()=> this.d3updatePattern.updateColor()

    constructor(args: ImageLayerArgs) {
        this.args = args
        this.name = args.name
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,   
            layer:             this,        
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
