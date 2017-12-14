import { ILayer }        from '../layer'
import { D3UpdateLayer } from '../layer'

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
    args:             LabelLayerArgs
    layer:            D3UpdateLayer
    name:             string
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args: LabelLayerArgs) {
        this.args = args  
        this.name = args.name      
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,
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