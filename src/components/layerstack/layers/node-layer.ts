import { ILayer }        from '../layerstack'
import { D3UpdateLayer } from '../layer'

export interface NodeLayerArgs
{
    name:      string,
    data:      ()=> any,
    r:         (d)=> any,
    transform,
    clip?:     string,
}

export class NodeLayer implements ILayer
{
    name: string
    args: NodeLayerArgs
    layer: D3UpdateLayer
    updateData =      ()=> this.layer.updateData()
    updateTransform = ()=> this.layer.updateTransform()
    updateColor =     ()=> this.layer.updateColor()

    constructor(args: NodeLayerArgs) {
        this.args = args
        this.name = args.name
    }

    public attach(parent) {
        this.layer = new D3UpdateLayer({
            parent:            parent,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.args.name,
            className:         'node',
            elementType:       'circle',
            create:            s=> s.attr("r",            d=> this.args.r(d))
                                    .classed("root",      d=> !d.parent)
                                    .classed("lazy",      d=> d.hasOutChildren)
                                    .classed("leaf",      d=> d.parent)
                                    .classed("exit",      d=> (!d.children || !d.children.length)
                                                              && d.data && d.data.numLeafs),
            updateColor:       s=> s.classed("hovered",   d=> d.isHovered && d.parent)
                                    .classed("selected",  d=> d.isSelected && d.parent),
            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    .attr("r",            d=> this.args.r(d)),
        })
    }
}




