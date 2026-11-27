import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { setClass, setStyle } from '../view/dom-write'
import { showsState, StateDisplay } from './state-display'

export interface NodeLayerArgs extends ILayerArgs
{
    className?:  string,
    r?:          (d:N)=> number,       // the radius; default geometry.nodeRadius
    transform?:  (d:N)=> string,       // default: the node's position, scaled by geometry.nodeScale
    fill?:       (d)=> any,
    stroke?:     (d)=> any,
    strokeWidth?:(d)=> any,
    show?:       'leaves' | 'all' | ((n:N)=> boolean),   // which nodes get a disk: 'leaves' (leaves, the root and nodes with hidden children: geometry.nodeFilter), 'all', or a function
    hover?:      StateDisplay,     // how hover is shown: 'path' (default), 'node' or false
    selection?:  StateDisplay,     // how selection is shown: 'path' (default), 'node' or false
    // nodes with hidden children (the filter hid some of them: n.hasOutChildren, class
    // lazy, red in the themes) are drawn this much larger
    lazyScale?:  number,
}

// The node disks.
export class NodeLayer implements ILayer
{
    static type : LayerType<NodeLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:   false,
            hideOnDrag:  false,
            className:   'node',
            show:        'leaves',
            r:           (d:N)=> ctx.model.geometry.nodeRadius(ctx.unitdisk, d),
            transform:   (d:N)=> d.transformStrCache + ` scale(${ctx.model.geometry.nodeScale(d)})`,
            fill:        n=> undefined,
            stroke:      n=> undefined,
            strokeWidth: n=> undefined,
            hover:       'path',
            selection:   'path',
            lazyScale:   1.5,
        }),
        create: (ctx, name, args)=> new NodeLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            NodeLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform', 'style']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:NodeLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    // the nodes to draw: option data (a channel or a function), else by option show
    private data() : N[] {
        if (this.args.data) return layerData(this.view, this.args.data, this)
        const show = this.args.show, cache = this.view.cache
        if (!show || show === 'leaves') return cache.leafOrLazy
        if (show === 'all') return cache.unculledNodes
        return cache.unculledNodes.filter(show)
    }

    // the radius: the layer's r, larger for nodes with hidden children (lazyScale)
    private radius(d:N) {
        const r = this.args.r(d)
        return d.hasOutChildren ? r * this.args.lazyScale : r
    }

    private attach() {
        const $this = this
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              ()=> this.data(),
            name:              this.name,
            className:         this.args.className,
            elementType:       'circle',
            create:            s=> s.attr("r",            d=> this.radius(d))
                                    .classed("root",      d=> !d.parent)
                                    .classed("lazy",      d=> !!d.hasOutChildren)
                                    .classed("leaf",      d=> d.parent)
                                    .classed("exit",      d=> (!d.children || !d.children.length)
                                                              && d.data && d.data.numLeafs)
                                    .style("stroke",       d=> (d.pathes && d.pathes.labelcolor) || this.args.stroke(d))
                                    .style("stroke-width", d=> (d.pathes && d.pathes.labelcolor) || this.args.strokeWidth(d)),

            // (on every frame while dragging: written only when changed, dom-write.ts)
            updateColor:       s=> s.each(function(d) {
                                    setClass(this, 'hovered',  showsState($this.args.hover, d, 'hover'))
                                    setClass(this, 'selected', showsState($this.args.selection, d, 'selection'))
                                    setStyle(this, 'fill', (d.pathes && d.pathes.labelcolor) || $this.args.fill(d))
                                }),

            updateTransform:   s=> s.attr("transform",    d=> this.args.transform(d))
                                    // r and lazy rarely change: write them only when they do
                                    // (lazy was set only when a disk was created: a node that
                                    // got or lost hidden children kept its color)
                                    .each(function(d) {
                                        const r = $this.radius(d)
                                        if (this.__r !== r) { this.setAttribute('r', String(r)); this.__r = r }
                                        const lazy = !!d.hasOutChildren
                                        if (this.__lazy !== lazy) { this.classList.toggle('lazy', lazy); this.__lazy = lazy }
                                    }),
        })
    }
}
