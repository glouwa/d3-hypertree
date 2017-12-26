import * as d3             from 'd3'
import { ILayer }          from '../layer'
import { D3UpdatePattern } from '../d3updatePattern'

export interface SymbolLayerArgs
{
    name:      string,
    data:      ()=> any,
    r:         (d)=> any,
    transform,
    clip?:     string,
}

var symbol = d3.symbol().size(.004)
var d_star = symbol.type(d3['symbolStar'])()

export class SymbolLayer implements ILayer
{    
    args: SymbolLayerArgs
    d3updatePattern: D3UpdatePattern
    name: string
   
    update = {
        parent:         ()=> this.attach(null),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(args: SymbolLayerArgs) {
        this.args = args
        this.name = args.name
    }

    public attach(parent) {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            parent,     
            layer:             this,     
            data:              this.args.data,
            name:              this.args.name,
            className:         'node',
            elementType:       'path',
            create:            s=> s.attr("r",            d=> this.args.r(d))
                                    .classed("root",      d=> !d.parent)
                                    .classed("lazy",      d=> d.hasOutChildren)
                                    .classed("leaf",      d=> d.parent)
                                    .classed("exit",      d=> (!d.children || !d.children.length)
                                                              && d.data && d.data.numLeafs),
            updateColor:       s=> s.classed("hovered",   d=> d.isHovered && d.parent)
                                    .classed("selected",  d=> d.isSelected && d.parent),
            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    .attr("d",            d=> d_star),
        })
    }
}




