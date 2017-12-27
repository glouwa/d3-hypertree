import { ILayer }          from '../layer'
import { D3UpdatePattern } from '../d3updatePattern'

export interface LabelLayerArgs
{
    name:      string,
    data:      ()=> any,    
    delta,
    transform,
    text,
    clip?:     string,
}

export class LabelLayer implements ILayer
{    
    args:            LabelLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string   
    update = {
        parent:         ()=> this.attach(null),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(args: LabelLayerArgs) {
        this.args = args  
        this.name = args.name      
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         'caption',
            elementType:       'text',
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.icon && navigator.platform.includes('inux'))
                                    .text(                   this.args.text),
            updateColor:       s=> {},
            updateTransform:   s=> s.attr("transform", (d, i, v)=> this.args.transform(d, this.args.delta(d, i, v)))
                                    //.text(                   this.args.text)
        })
    }
}