import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'

export interface CellLayerArgs extends ILayerArgs
{    
    clip?:       string,
    data:        ()=> any,
} 

export class CellLayer implements ILayer
{    
    view:             ILayerView
    args:             CellLayerArgs
    d3updatePattern:  D3UpdatePattern
    name =            'cells'  
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:CellLayerArgs) {
        this.view = view
        this.args = args
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         'cell',
            elementType:       'polygon',
            create:            s=> s.attr('id', d=> 'cell-' + d.data.mergeId)
                                    .classed("leaf", false)/*s.classed("root",      d=> !d.data.parent)   */
                                    .classed("lazy", true)
                                    .style("stroke",       d=> (d.pathes && d.pathes.labelcolor) || this.args.stroke(d))
                                    .style("stroke-width", d=> (d.pathes && d.pathes.labelcolor) || this.args.strokeWidth(d)),
                                    
                                    
                                    /*
                                    .classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .classed("leaf",      d=> !d.data.children),*/
            updateColor:       s=>  //s.classed("lazy",      d=> d.data.hasOutChildren),
                                    s.classed("hovered",   d=> d.data.isPartOfAnyHoverPath && d.data.parent)
                                    .style("fill",      d=> (d.pathes && d.pathes.labelcolor) || this.args.fill(d)),
                                    //.classed("selected",  d=> d.data.isPartOfAnySelectionPath && d.data.parent),
            updateTransform:   s=> s//.classed("lazy",      d=> d.data.hasOutChildren)                                 
                                    .attr("points",       d=> {
                                        return d && d.join(" ")
                                    }),
        })
    }
}

