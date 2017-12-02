import { ILayer }        from '../index'
import { D3UpdateLayer } from '../index'

export interface CellLayerArgs
{
    data:   ()=> any,
    clip?:  string,
}

export class CellLayer implements ILayer
{
    name = 'cells'
    args: CellLayerArgs
    layer: D3UpdateLayer
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
            name:              'cells',
            className:         'cell',
            elementType:       'polygon',
            create:            s=> s.classed("root",      d=> !d.data.parent)   
                                    .classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .classed("leaf",      d=> !d.data.children),
            updateColor:       s=> s.classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .classed("hovered",   d=> d.data.isHovered && d.data.parent)
                                    .classed("selected",  d=> d.data.isSelected && d.data.parent),
            updateTransform:   s=> s//.classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .attr("points",       d=> d.join(" ")),
        })
    }
}

