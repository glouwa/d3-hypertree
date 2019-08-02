import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface NodeLayerArgs extends ILayerArgs
{
    name:      string,
    className:  string,
    data:      ()=> any,
    r:         (d)=> any,
    transform,
    clip?:     string,
}

export class NodeLayer implements ILayer
{    
    view:            ILayerView
    args:            NodeLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
   
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:NodeLayerArgs) {
        this.view = view
        this.args = args
        this.name = args.name
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent, 
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.args.name,
            className:         this.args.className,
            elementType:       'circle',
            create:            s=> s.attr("r",            d=> this.args.r(d))
                                    .classed("root",      d=> !d.parent)
                                    .classed("lazy",      d=> d.hasOutChildren)
                                    .classed("leaf",      d=> d.parent)                                        
                                    .classed("exit",      d=> (!d.children || !d.children.length)
                                                              && d.data && d.data.numLeafs),
            updateColor:       s=> s.classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                                    .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                                    .style("fill",      d=> (d.pathes && d.pathes.labelcolor) || this.args.nodeColor(d)),

            //updateColor:       s=> s.classed("hovered",   d=> d.isPartOfAnyHoverPath && d.parent)
            //                        .classed("selected",  d=> d.isPartOfAnySelectionPath && d.parent),
            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    .style("stroke",      d=> d.pathes && d.pathes.labelcolor)
                                    .attr("r",            d=> this.args.r(d)),
        })
    }
}




