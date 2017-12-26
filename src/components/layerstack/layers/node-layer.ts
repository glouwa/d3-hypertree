import { ILayer }          from '../layer'
import { D3UpdatePattern } from '../d3updatePattern'

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
    args: NodeLayerArgs
    d3updatePattern: D3UpdatePattern
    name: string
   
    update = {
        parent:         ()=> this.attach(null),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(args: NodeLayerArgs) {
        this.args = args
        this.name = args.name
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,
            layer:             this,
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
            updateColor:       s=> s.classed("hovered",   d=> d.isHovered/* && d.parent removed wegen nav on hover*/)
                                    .classed("selected",  d=> d.isSelected/* && d.parent*/),
            //updateColor:       s=> s.classed("hovered",   d=> d.isHovered && d.parent)
            //                        .classed("selected",  d=> d.isSelected && d.parent),
            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    .attr("r",            d=> this.args.r(d)),
        })
    }
}




