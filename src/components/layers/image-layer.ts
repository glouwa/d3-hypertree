import * as d3             from 'd3'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { CmulR } from '../../models/transformation/hyperbolic-math';

export interface ImageLayerArgs extends ILayerArgs
{
    name:      string,
    width:     number,
    height:    number,
    data:      ()=> any,    
    imagehref,
    delta,
    transform,    
}

export class ImageLayer implements ILayer
{    
    view:             ILayerView
    args:             ImageLayerArgs
    d3updatePattern:  D3UpdatePattern
    name:             string
   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args: ImageLayerArgs) {
        this.view = view
        this.args = args
        this.args.width = this.args.width || .05
        this.args.height = this.args.height || .05
        this.name = args.name               
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,   
            layer:             this,        
            data:              this.args.data,
            name:              this.args.name,
            className:         'node',
            elementType:       'image',
            create:            s=> s.attr('xlink:href', d=> this.args.imagehref(d))
                                    .attr('width', this.args.width)
                                    .attr('height', this.args.height)
                                    ,
            updateColor:       s=> {},
            updateTransform:   s=> s.attr("transform", (d, i, v)=> {
                
                //const delta = this.args.delta(d, i, v)
                const delta = CmulR({ re:-this.args.width, im:-this.args.height }, d.distScale/2)

                return ` translate(${delta.re} ${delta.im})` 
                    + this.args.transform(d, delta)
            })            
        })
    }
}
