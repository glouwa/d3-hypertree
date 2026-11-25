import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { ArcCurvature }    from '../projection/projection'

export interface StemLayerArgs extends ILayerArgs
{
    className?:  string,
    curvature?:  ArcCurvature,
    width?:      (d:N)=> number,     // default geometry.linkWidth
}

// The root's stem: from the root into the gap of the root wedge (the rim of the disk,
// infinity in the half-plane view), as a link (stem-link) and as a path over it
// (stem-path, the hover and selection path colors).
export class StemLayer implements ILayer
{
    static type : LayerType<StemLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:  false,
            hideOnDrag: false,
            className:  'arc',
            curvature:  '+',
            width:      (d:N)=> ctx.model.geometry.linkWidth(d),
        }),
        create: (ctx, name, args)=> new StemLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            StemLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform', 'style']

    constructor(view:LayerContext, name:string, args:StemLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    update = {
        parent:         ()=> this.attach(),
        data:           ()=> {
            this.d3updatePattern.update.data()
            this.d3updatePattern2.update.data()
        },
        transformation: ()=> {
            this.d3updatePattern.update.transformation()
            this.d3updatePattern2.update.transformation()
        },
        style:          ()=> {
            this.d3updatePattern.update.style()
            this.d3updatePattern2.update.style()
        }
    }

    private attach() {
        const root = ()=> this.view.hypertree.data ? [this.view.hypertree.data] : []
        const path = (d:N)=> this.view.projection.stem(d.cache, this.args.curvature)
        const w = this.args.width
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              '#circle-clip' + this.view.model.geometry.clipRadius,
            data:              root,
            name:              'stem-link',
            className:         this.args.className,
            elementType:       'path',
            create:            s=> s.attr("stroke-linecap", "round"),   // constant: set once
            updateColor:       s=> s.classed("hovered",   d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                                    .classed("selected",  d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                                    .style("stroke",      d=> d.pathes && d.pathes.finalcolor)
                                    .attr("stroke-width", d=> w(d)),
            updateTransform:   s=> s.attr("d",            d=> path(d))
                                    .attr("stroke-width", d=> w(d) + .015),
        })
        this.d3updatePattern2 = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              '#circle-clip' + this.view.model.geometry.clipRadius,
            data:              root,
            name:              'stem-path',
            className:         this.args.className,
            elementType:       'path',
            create:            s=> s.attr("stroke-linecap", "round"),   // constant: set once
            updateColor:       s=> s.classed("hovered-path",  d=> d.pathes && d.pathes.isPartOfAnyHoverPath)
                                    .classed("selected-path", d=> d.pathes && d.pathes.isPartOfAnySelectionPath)
                                    .style("stroke",          d=> d.pathes && d.pathes.finalcolor)
                                    .attr("stroke-width", d=> w(d) +
                                        (((d.pathes && d.pathes.isPartOfAnySelectionPath) ||
                                          (d.pathes && d.pathes.isPartOfAnyHoverPath)) ? .015 : 0)),
            updateTransform:   s=> s.attr("d",            d=> path(d))
                                    .attr("stroke-width", d=> w(d) + .015),
        })
    }
}
