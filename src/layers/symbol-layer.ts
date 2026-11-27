import * as d3             from 'd3'
import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { showsState, StateDisplay } from './state-display'

export interface SymbolLayerArgs extends ILayerArgs
{
    transform?: (d:N)=> string,
    hover?:     StateDisplay,   // how hover is shown: 'path' (default), 'node' or false
    selection?: StateDisplay,   // how selection is shown: 'path' (default), 'node' or false
}

var symbol = d3.symbol().size(.0012)
var d_star = symbol.type(d3['symbolStar'])()

// A star for the special nodes (the root and the start node of the filter's path).
export class SymbolLayer implements ILayer
{
    static type : LayerType<SymbolLayerArgs> = {
        defaults: ()=> ({
            invisible:  false,
            hideOnDrag: false,
            data:       'spezialNodes',
            transform:  (d:N)=> d.transformStrCache + ` scale(${d.dampedDistScale})`,
            hover:      'path',
            selection:  'path',
        }),
        create: (ctx, name, args)=> new SymbolLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            SymbolLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform', 'style']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:SymbolLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              ()=> layerData(this.view, this.args.data, this),
            name:              this.name,
            className:         'node',
            elementType:       'path',
            create:            s=> s.classed("root",      d=> !d.parent)
                                    .classed("lazy",      d=> d.hasOutChildren)
                                    .classed("leaf",      d=> d.parent)
                                    .classed("exit",      d=> (!d.children || !d.children.length)
                                                              && d.data && d.data.numLeafs),
            updateColor:       s=> s.classed("hovered",   d=> showsState(this.args.hover, d, 'hover') && d.parent)
                                    .classed("selected",  d=> showsState(this.args.selection, d, 'selection') && d.parent),
            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    .attr("d",            d=> d_star),
        })
    }
}
