import * as d3             from 'd3'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface TraceLayerArgs extends ILayerArgs
{
    name:      string,
    data:      ()=> any,    
    clip?:     string,
}

export class TraceLayer implements ILayer
{  
    view:            ILayerView  
    args:            TraceLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:TraceLayerArgs) {
        this.view = view
        this.args = args
        this.name = args.name
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,     
            layer:             this,     
            data:              this.args.data,
            name:              this.args.name,
            className:         'trace-polyline',
            elementType:       'polyline',
            create:            s=> {},
            updateColor:       s=> {},
            updateTransform:   s=> s.attr("points", d=> d.points
                .map(e=> `${e.re}, ${e.im}`)
                .join(' ') 
            )
        })
    }
}
