import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { showsState, StateDisplay } from './state-display'

export interface NodeLayerArgs extends ILayerArgs
{
    name:      string,
    className:  string,
    data:      ()=> any,
    r:         (d)=> any,
    transform,
    clip?:     string,
    fill?:       (d)=> any,
    stroke?:     (d)=> any,
    strokeWidth?:(d)=> any,
    show?:       'leaves' | 'all' | ((n)=> boolean),   // which nodes get a disk (default 'leaves')
    hover?:      StateDisplay,     // how hover is shown: 'path' (default), 'node' or false
    selection?:  StateDisplay,     // how selection is shown: 'path' (default), 'node' or false
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
        const $this = this
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
                                                              && d.data && d.data.numLeafs)
                                    .style("stroke",       d=> (d.pathes && d.pathes.labelcolor) || this.args.stroke(d))
                                    .style("stroke-width", d=> (d.pathes && d.pathes.labelcolor) || this.args.strokeWidth(d)),

            updateColor:       s=> s.classed("hovered",   d=> showsState(this.args.hover, d, 'hover'))
                                    .classed("selected",  d=> showsState(this.args.selection, d, 'selection'))
                                    .style("fill",      d=> (d.pathes && d.pathes.labelcolor) || this.args.fill(d)),

            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    // r rarely changes: write it only when it does
                                    .each(function(d) {
                                        const r = $this.args.r(d)
                                        if (this.__r !== r) { this.setAttribute('r', String(r)); this.__r = r }
                                    }),
        })
    }
}




