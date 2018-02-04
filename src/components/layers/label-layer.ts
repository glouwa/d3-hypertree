import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface LabelLayerArgs extends ILayerArgs
{
    name:        string,
    className:   string,
    invisible?:  boolean,
    hideOnDrag?: boolean,
    data:        ()=> any,    
    delta,
    transform,
    text,
    clip?:       string,
}

export class LabelLayer implements ILayer
{    
    view:            ILayerView
    args:            LabelLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:LabelLayerArgs) {
        this.view = view
        this.args = args  
        this.name = args.name      
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text',
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.precalc.icon && navigator.platform.includes('inux'))
                                    //.style("fill",           d=> d.pathes.finalcolor)
                                    .style("stroke",          d=> d.pathes && d.pathes.labelcolor)
                                    .text(                   this.args.text),
            updateColor:       s=> s.style("stroke",          d=> d.pathes && d.pathes.labelcolor),
            updateTransform:   s=> s.attr("transform", (d, i, v)=> this.args.transform(d, this.args.delta(d, i, v)))
                                    .text(                   this.args.text)
        })
    }
}