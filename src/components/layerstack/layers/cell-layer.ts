import { ILayer }        from '../layer'
import { D3UpdateLayer } from '../layer'

export interface CellLayerArgs
{
    data:  ()=> any,
    clip?: string,
}

export class CellLayer implements ILayer
{    
    args: CellLayerArgs
    layer: D3UpdateLayer
    name =            'cells'
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args: CellLayerArgs) {
        this.args = args
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,
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

