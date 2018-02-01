import * as d3             from 'd3'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface SymbolLayerArgs extends ILayerArgs
{
    name:      string,
    data:      ()=> any,
    r:         (d)=> any,
    transform,
    clip?:     string,
}

var symbol = d3.symbol().size(.004)
var d_star = symbol.type(d3['symbolStar'])()

const home = 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'

export class SymbolLayer implements ILayer
{  
    view:            ILayerView  
    args:            SymbolLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:SymbolLayerArgs) {
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
            className:         'node',
            elementType:       'path',
            create:            s=> s.attr("r",            d=> this.args.r(d))
                                    .classed("root",      d=> !d.parent)
                                    .classed("lazy",      d=> d.hasOutChildren)
                                    .classed("leaf",      d=> d.parent)
                                    .classed("exit",      d=> (!d.children || !d.children.length)
                                                              && d.data && d.data.numLeafs),
            updateColor:       s=> s.classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath && d.parent)
                                    .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath && d.parent),
            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    .attr("d",            d=> /*home*/d_star),
        })
    }
}




