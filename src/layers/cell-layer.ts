import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'

export interface CellLayerArgs extends ILayerArgs
{
    // whether the layer shows the interaction state (the events and callbacks
    // don't depend on it): the cell under the mouse, the cells of selected nodes
    hover?:      boolean,
    selection?:  boolean,
    fill?:       (d)=> any,
    stroke?:     (d)=> any,
    strokeWidth?:(d)=> any,
}

// The voronoi cells of the clickable nodes (the click areas); invisible by default,
// the themes color the hovered and selected cells.
export class CellLayer implements ILayer
{
    static type : LayerType<CellLayerArgs> = {
        defaults: ()=> ({
            invisible:   true,
            hideOnDrag:  true,
            data:        'cells',
            hover:       true,
            selection:   true,
            fill:        n=> undefined,
            stroke:      n=> undefined,
            strokeWidth: n=> undefined,
        }),
        create: (ctx, name, args)=> new CellLayer(ctx, name, args),
    }

    view:             LayerContext
    args:             CellLayerArgs
    d3updatePattern:  D3UpdatePattern
    name:             string
    needs = <const>['data', 'transform', 'style']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:CellLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              '#circle-clip' + this.view.model.geometry.clipRadius,
            data:              ()=> layerData(this.view, this.args.data, this),
            name:              this.name,
            className:         'cell',
            elementType:       'polygon',
            create:            s=> s.attr('id', d=> 'cell-' + d.data.mergeId)
                                    .classed("leaf", false)
                                    .classed("lazy", true)
                                    .style("stroke",       d=> (d.pathes && d.pathes.labelcolor) || this.args.stroke(d))
                                    .style("stroke-width", d=> (d.pathes && d.pathes.labelcolor) || this.args.strokeWidth(d)),
            // d is a voronoi polygon; d.data is its node. Only the cell of the node
            // under the mouse is "hovered", and only cells of selected nodes are
            // "selected" (not every cell on the path to them).
            updateColor:       s=>  {
                                    // the node state set by the interaction (n.hovered, n.selected)
                                    const showHover = this.args.hover !== false
                                    const showSelection = this.args.selection !== false
                                    return s.classed("hovered",  d=> showHover && !!d.data.hovered)
                                            .classed("selected", d=> showSelection && !!d.data.selected)
                                            .style("fill",      d=> (d.pathes && d.pathes.labelcolor) || this.args.fill(d))
                               },
            updateTransform:   s=> s.attr("points", d=> d && d.join(" ")),
        })
    }
}
