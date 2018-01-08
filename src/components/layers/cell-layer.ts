import { ILayer }          from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface CellLayerArgs
{    
    invisible?:  boolean,
    hideOnDrag?: boolean,    
    clip?:       string,
    data:        ()=> any,
} 

export class CellLayer implements ILayer
{    
    args:             CellLayerArgs
    d3updatePattern:  D3UpdatePattern
    name =            'cells'  
    update = {
        parent:         ()=> this.attach(null),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:{ parent, layerstack }, args: CellLayerArgs) {
        this.args = args
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         'cell',
            elementType:       'polygon',
            create:            s=> s.classed("root",      d=> !d.data.parent)   
                                    .classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .classed("leaf",      d=> !d.data.children),
            updateColor:       s=> s.classed("lazy",      d=> d.data.hasOutChildren),
                                    //.classed("hovered",   d=> d.data.isHovered && d.data.parent)
                                    //.classed("selected",  d=> d.data.isSelected && d.data.parent),
            updateTransform:   s=> s//.classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .attr("points",       d=> d.join(" ")),
        })
    }
}

